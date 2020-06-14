#' Calculate mutual information from two vectors
#'
#' Calculates mutual information from two vectors of observations for
#' non-continuous data. There is no parametric assumption here but if the
#' number of unique values for either vector is high smoothing (see other
#' package functions) may improve performance.
#'
#' Note that mutual information is symmetric so `calc_mutual_info(a,b) == calc_mutual_info(b,a)`.
#'
#' @param a_vec vector of observations (can be logical, factor, character, or integer).
#' @param b_vec paired observations for second variable.
#' @inheritParams calc_ent_from_table
#'
#' @return mutual information between the two vectors.
#' @export
#'
#' @examples
#'
# N <- 100
#
# # Works with binary observation data
# a_binom <- rbinom(N, 1, 0.5)
# b_binom <- rbinom(N, 1, 0.8)
# calc_mutual_info(a_binom, b_binom)
#
# # Also works with poisson count data (best low lambda)
# a_pois <- rpois(N, 5)
# b_pois <- rpois(N, 8)
# calc_mutual_info(a_pois, b_pois)
#'
calc_mutual_info <- function(a_vec, b_vec, log_base = 2){

  joint_tab <- table(a = a_vec, b = b_vec)
  N <- length(a_vec)

  joint_ent <- calc_ent_from_table(joint_tab, N, log_base)
  a_ent <- calc_ent_from_table(margin.table(joint_tab, 1), N, log_base)
  b_ent <- calc_ent_from_table(margin.table(joint_tab, 2), N, log_base)

  a_ent + b_ent - joint_ent
}


