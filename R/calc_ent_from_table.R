#' Calculate entropy of a contingency table of one or two variables.
#'
#' @seealso base::table
#'
#' @param t Contingency table as produced by `base::table()`
#' @param N Total number of observations in table. Used to convert counts to
#'   empirical probabilities.
#' @param log_base Base of logarithm used. `2` will return entropy in bits.
#'
#' @return Entropy value for variable(s) making up table.
#' @export
#'
#' @examples
# N <- 15
# a_vec <- rbinom(N, 1, 0.2)
# b_vec <- rbinom(N, 1, 0.8)
# calc_ent_from_table(table(a_vec, b_vec), N)
#
# # Switch base of log to switch units of entropy
# calc_ent_from_table(table(a_vec, b_vec), N, log_base = exp(1))
calc_ent_from_table <- function(t, N = sum(t), log_base = 2){
  # Extract all non-zero elements of contingency table and divide them by N to
  # make them probabilities
  non_zero <- t[t!= 0]/N

  -sum(non_zero*log(non_zero, base = log_base))
}
