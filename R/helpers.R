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
