gather_unique_nodes <- function(pairs){
  dplyr::count(dplyr::bind_rows(
    dplyr::select(pairs, id = a),
    dplyr::select(pairs, id = b)
  ),
  id,
  name = "degree")
}

# Lots of functions in package rely on association network being sorted
ensure_sorted <- function(association_pairs, strength_column = "strength"){
  desc_strengths <- -association_pairs[[strength_column]]
  if(is.unsorted(desc_strengths)){
    return(association_pairs[order(desc_strengths),])
  }
  association_pairs
}

# Setup indices for all possible pairs of n values
build_all_pairs <- function(n){
  rep_counts <- (n:1) - 1
  list(
    a_i = rep(1:n, times = rep_counts),
    b_i = unlist(lapply(rep_counts, function(x){utils::tail(1:n, x)}))
  )
}


# To make our pairs match up we need to know all the pairs have the same a-b order
# By making a always be the first in alphabetical order then this is assured.
alphabetize_ids <- function(pairs){
  new_a <- ifelse(pairs$a < pairs$b, pairs$a, pairs$b)
  new_b <- ifelse(pairs$a < pairs$b, pairs$b, pairs$a)

  pairs$a <- new_a
  pairs$b <- new_b

  pairs
}


#' Join two association pairs lists by their ids
#'
#'
#' Left join two pairs lists together.  Pairs not included in `pairs_b` will be
#' added as `NAs` to returned list and any pairs not in `pairs_a` will simply be
#' ignored.
#'
#' @param pairs_a,pairs_b association pairs list with columns `a` and `b`
#'   encoding ids
#'
#' @return Joined version of the two association pairs with any missing pairs
#'   from `pairs_b` set as `NA` for non-id columns.
#' @export
#'
join_pair_lists <- function(pairs_a, pairs_b){
  #  Note the use of alphabetize ids.
  # This is so we dont miss pairs that are just flipped versions of the same a-b
  # combo By always having a be the earlier id alphabetically (or numerically if
  # ids are numeric) we always have a match if it exists
  dplyr::left_join(
    alphabetize_ids(pairs_a),
    alphabetize_ids(pairs_b),
    by = c("a", "b")
  )
}

