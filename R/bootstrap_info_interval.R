#' Bootstrap resample an information measure
#'
#' Runs a simple bootstrap resampling of your observations on information measure of choice to assess uncertainty.
#'
#' @inheritParams calc_joint_ent
#' @param measure_func Any function that takes as its first two arguments to vectors of categorical values and returns a number can be used as a "measure".
#' @param B Number of bootstrap resamples to gather
#' @param ... Any additional arguments to `measure_func` outside of `a_vec` and `b_vec`.
#'
#' @return An array of values returned from running `measure_func` on bootstrap resampled observations from provided data.
#' @export
#'
#' @examples
#'
#' N <- 100
#' pois_mi_samples <- bootstrap_info_interval(
#'   a_vec = rpois(N, 5),
#'   b_vec = rpois(N, 8),
#'   B = 150
#' )
#' hist(pois_mi_samples)
#'
#' # Any function that takes as its first two arguments to vectors of categorical
#' # values and returns a number can be used as a "measure".
#' pois_je_samples <- bootstrap_info_interval(
#'   a_vec = rpois(N, 5),
#'   b_vec = rpois(N, 8),
#'   measure = calc_joint_ent,
#'   B = 150
#' )
#' hist(pois_je_samples)
#'
#' # You can pass any arguments to the entropy function you may desire as well...
#' binom_mi_samples <-
#'   bootstrap_info_interval(
#'     a_vec = rbinom(N, size = 1, p = 0.1),
#'     b_vec = rbinom(N, size = 1, p = 0.08),
#'     B = 150,
#'     measure = function(a, b, scalar) calc_joint_ent(a, b)*scalar,
#'     scalar = -2
#'   )
#' hist(binom_mi_samples)
#' #'
bootstrap_info_interval <- function(a_vec,
                                    b_vec,
                                    measure_func = entropynet::calc_mutual_info,
                                    B = 500,
                                    ...
                                    ) {

  generate_bootstrap_sample <- function(i) {
    bootstrap_ids <- sample(1:N, replace = TRUE)
    measure_func(a_vec[bootstrap_ids],
             b_vec[bootstrap_ids],
             ...)
  }

  purrr::map_dbl(1:B, generate_bootstrap_sample)
}







