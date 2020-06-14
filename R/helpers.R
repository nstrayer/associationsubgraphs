#' Calculate partial entropy of a given observation
#'
#' Computes x*log(x) with exception that 0 is returned if x = 0 or infinity.
#' Infinity happens when calculating conditional entropy where the denominator
#' of fraction for probability may be 0.
#'
#' @param p A probability value
#' @param log_base Base of logarithm used. `2` will return entropy in bits.
#'
#' @return negative partial entropy for given probability
#' @export
#'
#' @examples
#' partial_entropy(c(0.5, 0.1, 0.001, 0, 1/0))
#'
partial_entropy <- function(p, log_base = 2){

  ifelse(is.infinite(p) | p == 0, 0, p*log(p))
}



#' Expand all combinations
#'
#' Expands all possible pairs of integers (`n*(n - 1)/2`) (order doesn't matter)
#' for `1:n`. Useful for creating combinations of elements based on their
#' indices in an array.
#' @param n number of unique items
#' @param self_pairs Should self-pairs be included? I.e. 2-2 and 4-4?
#'
#' @return dataframe with two columns `a_index` and `b_index` that contain all pairs.
#' @export
#'
#' @examples
#'
#' # Default options dont have self-pairs
#' expand_combinations(4)
#'
#' # Self pairs can be added, though!
#' expand_combinations(4, self_pairs = TRUE)
expand_combinations <- function(n, self_pairs = FALSE){

  rep_counts <- n:1

  if(!self_pairs){
    rep_counts <- rep_counts - 1
  }

  dplyr::tibble(
    a_index = rep(1:n, times = rep_counts),
    b_index = purrr::flatten_int( purrr::map(rep_counts, ~{tail(1:n, .x)}) )
  )
}


#' Build logical occurrence vec
#'
#' @param true_indices Integer vector of all indices an occurrence happened.
#' @param n Total number of observations (aka the length of the final vector).
#'
#' @return Array of length `n` with `TRUE` in every place indicated by `true_indices` and `FALSE` elsewhere.
#' @export
#'
#' @examples
#' build_occurrence_vec(c(1,3,5), 6)
build_occurrence_vec <- function(true_indices, n){

  vec <- rep(FALSE, n)
  vec[true_indices] <- TRUE
  vec
}

