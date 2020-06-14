#' Sample from null distribution for mutual information between binary occurrence observations
#'
#' Generates an example realization from the null distribution (two arrays are independent) of mutual information between two vectors of paired binary occurances.
#'
#'
#' @param N Total number of observations
#' @param Na Number of times the a-variable occurs
#' @param Nb Number of times the b-variable occurs
#' @inheritParams calc_ent_from_table
#'
#' @return Single row dataframe with settings for draw and mutual information (`mi`) for current draw.
#' @export
#'
#' @examples
#'
#' draw_null_info_binary(10, 5, 2)
draw_null_info_binary <- function(N, Na, Nb, log_base = 2){

  ids <- 1:N

  dplyr::tibble(
    N = N,
    Na = Na,
    Nb = Nb,
    mi = calc_mutual_info(
      build_occurance_vec(sample(ids, size = Na), N, log_base = log_base),
      build_occurance_vec(sample(ids, size = Nb), N, log_base = log_base),
      N
    )
  )
}
