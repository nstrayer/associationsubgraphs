#' Calculate entropy network
#'
#' Takes a dataset of occurence or count observations and runs a pair-wise
#' information network over all combinations of variables.
#'
#' @param pairs Dataframe with at least two columns: `id` and `target`. `id`
#'   corresponds to the variables to be associated with each other and `target`
#'   corresponds to the observations they had. This is in essence a tidy version
#'   of an tabular dataset with columns as `id` and rows as `target`. If data is
#'   count based an addition `count` column can be included. (Not yet
#'   implemented).
#' @param id_col Name of column containing variable id (I.e. nodes of the
#'   association network).
#' @param target_col Name of the column containing the target for occurance
#'   (I.e. the data used to infer association between nodes).
#' @param count_col Name of column containing count values as integers. If this
#'   is not set and no column with title `count` is included in `pairs` then
#'   entropy will be run on binary occurrence.
#' @param info_func What information function should be used? Like all of the
#'   `calc_*` functions in this package this takes as its arguments two paired
#'   vectors of observations as input and returns a number corresponding to
#'   strength of association.
#' @param possible_targets If there are some `target` values that are never seen
#'   in your dataset then they can be provided here with the form of a
#'   characterr, factor, or integer vector of all target values.
#' @param parallel Should the processing be run in parallel? Three options. A
#'   logical `TRUE` will run in parallel over every core available using
#'   `future::multisession`. A number will run in parallel over that many cores.
#'   E.g. `parallel = 5` will run in parallel on `5` core. Last, for the most
#'   control a `future` processing plan can be passed (I.e. what is run by
#'   `future::plan()` to set up your parallel processing environment.) This
#'   allows you to run on clusters etc..
#' @param subset_pairs Should the algorithm be run on a random subset of
#'   possible combinations? Useful for making sure everything is good before
#'   running larger jobs. Set to the number of pairs you want to calculate
#'   strength for. If reproducability is desired use `set.seed()`.
#' @param verbose Information about steps is written to console.
#'
#' @return
#' @export
#'
#' @examples
#'
#' # Run association net on the virus-host dataset
#' calc_entropy_net(
#'   pairs = virus_host,
#'   id_col = virus_id,
#'   target_col = host_id,
#'   parallel = FALSE,
#'   subset_pairs = 100
#' )
#'
#' # Run count-based association for vir-clasp rna-seq dataset
#' calc_entropy_net(
#'   pairs = virclasp_chikv,
#'   id_col = id,
#'   target_col = condition,
#'   count_col = count,
#'   parallel = FALSE,
#'   subset_pairs = 100
#' )
#'
calc_entropy_net <- function(pairs,
                             id_col,
                             target_col,
                             count_col,
                             info_func = associationsubgraphs::calc_mutual_info,
                             possible_targets,
                             parallel = TRUE,
                             subset_pairs = FALSE,
                             verbose = FALSE){
  status_update <- function(msg){ if(verbose) cat(msg, "\n") }

  if(!missing(id_col)){
    pairs <- dplyr::rename(pairs, id := {{id_col}})
  }
  if(!missing(target_col)){
    pairs <- dplyr::rename(pairs, target := {{target_col}})
  }
  if(!missing(count_col)){
    pairs <- dplyr::rename(pairs, count := {{count_col}})
  }

  # Do we have a count column in data?
  if("count" %in% colnames(pairs)){
    count_mode <- TRUE
    status_update("Running in count-mode")
  } else {
    count_mode <- FALSE
    status_update("Running in occurrence-mode")
  }

  all_targets <- dplyr::distinct(pairs, target)

  if(!missing(possible_targets)){

    # Make sure possible_targets is a superset of observed targets
    in_pairs_not_possible <- setdiff(obs, given)
    if(length(in_pairs_not_possible) > 0){
      stop("The passed list of possible targets doesn't include some targets seen in pairs")
    }

    # Replace all targets df with custom one
    all_targets <- dplyr::tibble(target = possible_targets)
  } else{
    status_update("Built list of possible targets with all observed targets in pairs data")
  }

  id_to_target <- dplyr::right_join(
      pairs,
      dplyr::mutate(all_targets, int_id = dplyr::row_number()),
      by = c("target")
    ) %>%
    dplyr::select(matches("id|count")) %>%
    dplyr::group_by(id) %>%
    tidyr::nest()

  N_targets <- nrow(all_targets)
  N_ids <- nrow(id_to_target)

  # Set up parallel processing environment if requested .skip will avoid re-creating a
  # plan if one already exists (saves substantial time on subsequent runs)
  if(parallel){
    status_update("Setting up parallel running environment")
    requireNamespace("future", quietly = TRUE)
    requireNamespace("furrr", quietly = TRUE)

    provided_plan <- "future" %in% class(parallel)
    provided_num_cores <- is.numeric(parallel)
    if(provided_plan){
      status_update("Using custom supplied future execution plan")
      future::plan(parallel)
    } else if(provided_num_cores){
      status_update(paste("Setting up parallel environment to use", verbose, "cores"))
      future::plan(future::multiprocess, workers = parallel)
    } else {
      status_update("Setting up default future::multiprocess parallel environment")
      future::plan(future::multiprocess)
    }

    map_fn <- furrr::future_pmap_dfr
  } else {
    map_fn <- purrr::pmap_dfr
    status_update("Running calculations in sequential mode")
  }

  id_combos <- expand_combinations(N_ids)
  if(subset_pairs){
    status_update(paste("Taking a random sample of", subset_pairs, "id pairs out of a total of", nrow(id_combos)))
    id_combos <- id_combos %>% dplyr::sample_n(subset_pairs)
  }
  status_update("Running information network calculation")
  map_fn(
    id_combos,
    function(a_index, b_index){
      a_data <- id_to_target$data[[a_index]]
      b_data <- id_to_target$data[[b_index]]

      if(count_mode){
        a_vec <- build_count_vec(N_targets, a_data$int_id, a_data$count)
        b_vec <- build_count_vec(N_targets, b_data$int_id, b_data$count)
      } else {
        a_vec <- build_occurrence_vec(N_targets, a_data$int_id)
        b_vec <- build_occurrence_vec(N_targets, b_data$int_id)
      }

      dplyr::tibble(
        a = id_to_target$id[a_index],
        b = id_to_target$id[b_index],
        strength = info_func(a_vec, b_vec)
      )
    }
  )
}
