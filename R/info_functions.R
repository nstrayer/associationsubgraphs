#' Calculate joint entropy of two vectors
#'
#' @param a_vec an [atomic vector](https://adv-r.hadley.nz/vectors-chap.html) of observations (can be logical, factor, character, or integer).
#' @param b_vec paired observations for second variable.
#' @param log_base Base of logarithm used. `2` will return information measures in bits.
#'
#' @return
#' @export
#'
#' @examples
#'
# N <- 100
#
# # Works with binary observation data
# a_binom <- rbinom(N, 1, 0.5)
# b_binom <- rbinom(N, 1, 0.8)
# calc_joint_ent(a_binom, b_binom)
#
# # Also works with poisson count data (best low lambda)
# a_pois <- rpois(N, 5)
# b_pois <- rpois(N, 8)
# calc_joint_ent(a_pois, b_pois)
#'
calc_joint_ent <- function(a_vec, b_vec, log_base = 2) {

  joint_tab <- table(a = a_vec, b = b_vec)
  N <- length(a_vec)

  calc_ent_from_table(joint_tab, N, log_base)
}


#' Calculate mutual information from two vectors
#'
#' Calculates mutual information from two vectors of observations for
#' non-continuous data. There is no parametric assumption here but if the
#' number of unique values for either vector is high smoothing (see other
#' package functions) may improve performance.
#'
#' Note that mutual information is symmetric so `calc_mutual_info(a,b) == calc_mutual_info(b,a)`.
#'
#' @inheritParams calc_joint_ent
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


#' Calculate entropy of a contingency table of one or two variables.
#'
#' @seealso base::table
#'
#' @param t Contingency table as produced by `base::table()`
#' @param N Total number of observations in table. Used to convert counts to
#'   empirical probabilities.
#' @inheritParams calc_joint_ent
#'
#' @return Entropy value for variable(s) making up table.
#' @export
#'
#' @examples
#' N <- 15
#' a_vec <- rbinom(N, 1, 0.2)
#' b_vec <- rbinom(N, 1, 0.8)
#' calc_ent_from_table(table(a_vec, b_vec), N)
#'
#' # Switch base of log to switch units of entropy
#' calc_ent_from_table(table(a_vec, b_vec), N, log_base = exp(1))
calc_ent_from_table <- function(t, N = sum(t), log_base = 2){
  # Extract all non-zero elements of contingency table and divide them by N to
  # make them probabilities
  non_zero <- t[t!= 0]/N

  -sum(non_zero*log(non_zero, base = log_base))
}
