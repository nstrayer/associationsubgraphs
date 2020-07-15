#' Gather average association strength
#'
#' Takes an association pairs dataframe and collapses it to compute each
#' variable/ids average strength. Used for normalizing pairs or investigating
#' patterns in average strength.
#'
#' @inheritParams visualize_association_network
#'
#' @return Dataframe with `id` and `avg_strength` columns for each unique variable in association pairs
#' @export
#'
#' @examples
#' gather_avg_strength(virus_net)
#'
gather_avg_strength <- function(association_pairs) {
  dplyr::summarise(
    dplyr::group_by(dplyr::tibble(
      id = c(association_pairs$a, association_pairs$b),
      strength = c(association_pairs$strength, association_pairs$strength)
    ),
    id),
    avg_strength = mean(strength),
    .groups = "drop"
  )
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
  stickiness_dist = function(n){rbeta(n, shape1 = 1, shape2 = 4)},
  association_dist = function(n){rbeta(n, shape1 = 0.5, shape2 = 10)}
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
  rep_counts <- (n_variables:1) - 1
  a_i <- rep(1:n_variables, times = rep_counts)
  b_i <- unlist(lapply(rep_counts, function(x){tail(1:n_variables, x)}))
  n_pairs <- length(a_i)

  # Now we use those indices
  same_cluster <- cluster_membership[a_i] == cluster_membership[b_i]
  raw_association <-
    association_dist(n_pairs) * ifelse(same_cluster, cluster_coherence, 1)

  list(
    variables = dplyr::tibble(
      id = seq_len(n_variables),
      stickiness = stickiness,
      cluster = cluster_membership
    ),
    associations =  dplyr::tibble(
      a = a_i,
      b = b_i,
      same_cluster = same_cluster,
      strength = raw_association * (stickiness[a_i] + stickiness[b_i])
    )
  )
}
