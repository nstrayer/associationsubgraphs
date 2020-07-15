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
