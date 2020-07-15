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
#' @param n Total number of observations (aka the length of the final vector).
#' @param fill_indices Integer vector of all indices an occurrence happened.
#'
#' @return Array of length `n` with `TRUE` in every place indicated by `fill_indices` and `FALSE` elsewhere.
#' @export
#'
#' @examples
#' build_occurrence_vec(c(1,3,5), 6)
build_occurrence_vec <- function(n, fill_indices){

  vec <- rep(FALSE, n)
  vec[fill_indices] <- TRUE
  vec
}

#' Build counts observation vec
#'
#' @inheritParams build_occurrence_vec
#' @param fill_values Array of same length as `fill_indices` that contain the
#'   integer counts for the filled observations.
#'
#' @return Array of length `n` with every observation indicated by `fill_indices` filled with the matching entry in `fill_values` and `0` elsewhere.
#' @export
#'
#' @examples
#' build_count_vec(10, c(1,3,4), fill_values = c(10, 20, 30))
build_count_vec <- function(n, fill_indices, fill_values){
  vec <- rep(0L, n)
  vec[fill_indices] <- fill_values
  vec
}

gather_unique_nodes <- function(pairs){
  dplyr::count(dplyr::bind_rows(
    dplyr::select(pairs, id = a),
    dplyr::select(pairs, id = b)
  ),
  id,
  name = "degree")
}

# Lots of functions in package rely on association network being sorted
ensure_sorted <- function(association_pairs){
  if(is.unsorted(-association_pairs$strength)){
    return(dplyr::arrange(association_pairs, -strength))
  }
  association_pairs
}
