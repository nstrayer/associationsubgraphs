#' Gather average association strength
#'
#' Takes an association pairs dataframe and collapses it to compute each
#' variable/ids average strength. Used for normalizing pairs or investigating
#' patterns in average strength.
#'
#' @inheritParams calculate_subgraph_structure
#'
#' @return Dataframe with `id` and `avg_strength` columns for each unique variable in association pairs
#' @export
#'
#' @examples
#' gather_avg_strength(virus_net)
#'
gather_avg_strength <- function(association_pairs, strength_column = "strength") {
  dplyr::summarise(
    dplyr::group_by(dplyr::tibble(
      id = c(association_pairs$a, association_pairs$b),
      strength = c(association_pairs[[strength_column]], association_pairs[[strength_column]])
    ),
    id),
    avg_strength = mean(strength),
    .groups = "drop"
  )
}


#' Generate a relative association network
#'
#' Takes as input a raw association network and normalizes it to
#' relative-associations. Every edge's strength is transformed by dividing by
#' the average strength of each of the variables it connects. E.g. if edge `a-b`
#' has strength `1` and `a`'s average association is `0.5` and `b`'s average
#' association is `0.75` that means this edge has a higher than normal weight
#' for both nodes and its normalized strength is `1/((0.5 + 0.75)/2) = 1.6`.
#'
#' @section missing association pairs:
#'
#'   If there are missing pairs - I.e. not all `n*(n-1)/2` combinations of
#'   variables are represented - the function will throw a warning fill in the
#'   missing values with the minimum seen association strength.
#'
#'   The following options are available using the `impute_missing` argument:
#'   - `"minimum"`: The lowest seen strenght is assumed to be the value for all missing pairs (same
#'   as default but no warning is given).
#'   - `"zero"`: Value of `0` is substituted. This option only makes sense if your association is
#'   naturally lower bounded at `0`.
#'   - `"ignore"`: Here no action is taken and the averages are just used as is. Since it is likely this missingness is not at random it's likely the best option is an imputation of some sort.
#'
#' @inheritParams calculate_subgraph_structure
#' @param rank_based Should the relative strength be calculated using ranks?
#'   Here instead of using the raw values of strength, the ranking of edges is
#'   used with the max "strength" being the number of edges. Set to `FALSE` to
#'   use the raw strengths.
#' @param impute_missing If not all possible pairs are present in
#'   `association_pairs`, this parameter controls how the function deals with
#'   these missing values. Current options are `"minimum"`(lowest seen edge
#'   value is substituted) and `zero` (`0` is substituted). See the section
#'   "missing association pairs" for more details.
#'
#' @return A new association pairs dataframe (with columns `a`, `b`, and
#'   `strength`) where `strength` is transformed to relative strength.
#' @export
#'
#' @examples
#'
# dplyr::tibble(
#          a = c("A", "A", "A", "B", "B", "C"),
#          b = c("B", "C", "D", "C", "D", "D"),
#   strength = c(  3,   6,   9,  12,  15,  18)
# )

# association_pairs <-
# dplyr::tibble(
#          a = c("A", "A", "B", "B", "C"),
#          b = c("B", "C", "C", "D", "D"),
#   strength = c(  3,   6,  12,  15,  18)
# )
# build_relative_associations(association_pairs, impute_missing = "zero")
build_relative_associations <- function(association_pairs, strength_col = "strength", rank_based = FALSE, impute_missing){
  if(strength_col != "strength"){
    # We use "strength" as the normal column name for association strength so if
    # the user is using something different we need to update the dataframe so
    # we dont continually pass through this strength_col value and make code
    # ugly
    colnames(association_pairs)[colnames(association_pairs) == strength_col] <- "strength"
  }


  # We need the unique nodes to find out if we're missing edges and to know what
  # pairs we need to impute if any are missing
  all_node_ids <- unique(c(association_pairs$a, association_pairs$b))

  # Figure out if we have all the possible pairs.
  # This setup assumes that our association pairs are distinct
  n_variables <- length(all_node_ids)
  n_pairs <- nrow(association_pairs)
  have_missing_pairs <- n_pairs <  n_variables*(n_variables-1)/2

  # The user has passed us data with missing pairs and didn't specify an imputation behavior
  if(have_missing_pairs & missing(impute_missing)){
    warning(paste("There are missing association pairs. Defaulting to minimum imputation.",
                  "Run ?build_relative_associations and see section ",
                  "\"missing association pairs\" for more information."))
    impute_missing <- "minimum"
  }

  # We'll need to do some data surgery if we have missing values and it hasn't
  # been explicitly requested we leave them alone
  if(have_missing_pairs & impute_missing != "ignore"){
    imputation_fns <- c(
      "minimum" = function(s){min(s, na.rm = TRUE)},
      "zero" = function(s){rep_len(0, length(s))},
      "mean" = function(s){mean(s, na.rm = TRUE)},
      "median" = function(s){median(s, na.rm = TRUE)}
    )

    if(impute_missing %in% names(imputation_fns)){
      imputation_value <- imputation_fns[[impute_missing]](association_pairs$strength)
    } else {
      stop(
        paste0("The imputation option passed: \"",
              inpute_missing,
              "\" does not match the available options of {",
              paste0('"',names(imputation_fns),'"', collapse = ", "),
              "}")
      )
    }

    # Build a complete association pairs table with missing values encoded as NA
    # due to the left join's default value for rows missing in right dataframe.
    pair_indices <- build_all_pairs(n_variables)

    association_pairs <- join_pair_lists(
      dplyr::tibble(
        a = all_node_ids[pair_indices$a_i],
        b = all_node_ids[pair_indices$b_i]
      ),
      association_pairs
    )

    # Now we can do the actual imputation and replace the original association
    # pairs variable so we can work with it as before
    association_pairs <- dplyr::mutate(
      association_pairs,
      strength = ifelse(is.na(strength), imputation_value, strength)
    )
  }


  # If we're doing rank based relativeness we need to swap out the strength column
  if(rank_based){
    # Ranking here means 1 is the lowest (worst) strength. This is so we keep with
    # the concept of a high strength being a strong association
    association_pairs <- ensure_sorted(association_pairs)
    association_pairs$strength <- rev(seq_len(nrow(association_pairs)))
  }

  # Build a table of node to average strength so we can bind to each edge
  average_strengths <- gather_avg_strength(association_pairs)

  # Turn average strength into a named array so we can use names to index to values
  id_to_avg_strength <- setNames(
    average_strengths$avg_strength,
    average_strengths$id
  )

  # Now we can do the fun part: calculating the new relative strength and returning

  # The "expected" strength of an edge is just in between the average strengths
  # of the two end points
  expected_strength <- (id_to_avg_strength[association_pairs$a] +
                        id_to_avg_strength[association_pairs$b])/2


  # We treat the relative strength differently when in rank based mode versus
  # raw-value mode
  if(rank_based){
    # When using ranks as strength the relative strength is how many positions
    # the given edge outperformed its expected ranking based on the average of
    # its incident variables
    association_pairs$strength <- association_pairs$strength - expected_strength
  } else {
    # We divide the expected by the observed so the interpretation is strength
    # relative to its expected value. A value > 1 means the edge outperformed
    # its expected strength. Minimum is 0.
    association_pairs$strength <- association_pairs$strength / expected_strength
  }

  # To be safe, return the pairs sorted on our new strength
  dplyr::arrange(association_pairs, -strength)
}



#' Simulate a sticky association network
#'
#' Used for testing properties of algorithms. Will create an association network
#' that is constructed where some nodes are more "sticky" than others. Or they
#' are in general more associated than others.
#'
#' @param n_variables How many variables will be simulated
#' @param n_clusters Controls how many clusters are randomly assigned to nodes
#' @param cluster_coherence Scalar that multiplies random association value for
#'   nodes in the same clusters. E.g. A value of `2` means variables in same
#'   cluster have on average twice the association strength. Most likely above
#'   1.
#' @param stickiness_dist Function that takes a single input: `n` that will then
#'   generate `n` values from a distribution used to assign stickiness level for
#'   each variable. These values will be scaled to an average of 1 so stickiness
#'   doesn't change association distribution too much.
#' @param association_dist Function of same format as `stickiness_dist` that
#'   instead is used to generate raw associations between pairs of nodes. The
#'   values will then be scaled by `cluster_coherence` and each variable's
#'   stickiness.
#'
#' @return List with `variables` with info about each variable (`id`,
#'   `stickiness` scalar, and `cluster` id) and `associations` which contains
#'   the simulated associations in the format that works for all the functions
#'   that take `association_pairs` as an input.
#' @export
#'
#' @examples
#'
#' # Simulate an association network with flat stickiness profile
#' simulate_sticky_association_network(
#'   n_variables = 10,
#'   n_clusters = 3,
#'   cluster_coherence = 2,
#'   stickiness_dist = function(n) {runif(n)},
#'   association_dist = function(n) {rbeta(n, shape1 = 1, shape2 = 10)}
#' )
#'
simulate_sticky_association_network <- function(
  n_variables = 50,
  n_clusters = 4,
  cluster_coherence=2,
  stickiness_dist = function(n){stats::rbeta(n, shape1 = 1, shape2 = 4)},
  association_dist = function(n){stats::rbeta(n, shape1 = 0.5, shape2 = 10)}
){

  # Start by setting up vectors that represent variables
  cluster_membership <- sample(seq_len(n_clusters),
                               size = n_variables,
                               replace = TRUE)

  # Make sure stickiness averages out to a scalar of one
  stickiness <- stickiness_dist(n_variables)
  stickiness <- stickiness / mean(stickiness)

  # Move on to building the association values for each combo

  # First build indices of all unique pairs
  all_pairs <- build_all_pairs(n_variables)
  n_pairs <- length(all_pairs$a_i)

  # Now we use those indices
  same_cluster <- cluster_membership[all_pairs$a_i] == cluster_membership[all_pairs$b_i]
  raw_association <-
    association_dist(n_pairs) * ifelse(same_cluster, cluster_coherence, 1)

  list(
    variables = dplyr::tibble(
      id = seq_len(n_variables),
      stickiness = stickiness,
      cluster = cluster_membership
    ),
    associations =  dplyr::tibble(
      a = all_pairs$a_i_i,
      b = all_pairs$b_i,
      same_cluster = same_cluster,
      strength = raw_association * (stickiness[all_pairs$a_i] + stickiness[all_pairs$b_i])
    )
  )
}


