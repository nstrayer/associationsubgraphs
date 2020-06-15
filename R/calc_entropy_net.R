#' Title
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
#'   strength for.
#'
#' @return
#' @export
#'
#' @examples
calc_entropy_net <- function(pairs,
                             id_col,
                             target_col,
                             info_func = calc_mutual_info,
                             possible_targets,
                             parallel = TRUE,
                             subset_pairs = FALSE){

  if(!missing(id_col)){
    pairs <- dplyr::rename(pairs, id := {{id_col}})
  }
  if(!missing(target_col)){
    pairs <- dplyr::rename(pairs, target := {{target_col}})
  }

  all_targets <- dplyr::distinct(pairs, target)

  if(!missing(possible_targets)){

    # Make sure possible_targets is a superset of observed targets
    in_pairs_not_possible <- setdiff(obs, given)
    if(length(in_pairs_not_possible) > 0){
      stop("The passed list of possible targets doesn't include some targets seen in pairs.")
    }

    # Replace all targets df with custom one
    all_targets <- dplyr::tibble(target = possible_targets)
  }

  id_to_target <- dplyr::right_join(
      pairs,
      dplyr::mutate(all_targets, int_id = dplyr::row_number()),
      by = c("target")
    ) %>%
    dplyr::select(id, int_id) %>%
    dplyr::group_by(id) %>%
    tidyr::nest() %>%
    mutate(data = map(data, ~.x$int_id))

  N_targets <- nrow(all_targets)
  N_ids <- nrow(id_to_target)

  # Set up parallel processing environment if requested .skip will avoid re-creating a
  # plan if one already exists (saves substantial time on subsequent runs)
  if(parallel){
    requireNamespace("future", quietly = TRUE)
    requireNamespace("furrr", quietly = TRUE)

    provided_plan <- "future" %in% class(parallel)
    provided_num_cores <- is.numeric(parallel)
    if(provided_plan){
      future::plan(parallel)
    } else if(provided_num_cores){
      future::plan(future::tweak(future::multiprocess, workers = parallel))
    } else {
      future::plan(future::multiprocess)
    }

    map_fn <- furrr::future_map_dfr
  } else {
    map_fn <- purrr::map_dfr
  }

  id_combos <- expand_combinations(N_ids)
  if(subset_pairs){
    id_combos <- id_combos %>% sample_n(subset_pairs)
  }

  purrr::pmap_dfr(
    id_combos,
    function(a_index, b_index){
      a_vec <- build_occurrence_vec(N_targets, id_to_target$data[[a_index]])
      b_vec <- build_occurrence_vec(N_targets, id_to_target$data[[b_index]])
      tibble(
        a = id_to_target$id[a_index],
        b = id_to_target$id[b_index],
        strength = info_func(a_vec, b_vec)
      )
    }
  )
}
