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
