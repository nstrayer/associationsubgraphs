#' Gather average association strength
#'
#' Takes an association pairs dataframe and collapses it to compute each
#' variable/ids average strength. Used for normalizing pairs or investigating
#' patterns in average strength.
#'
#' @inheritParams visualize_association_network
#'
#' @return Dataframe with `id` and `avg_strength` columns for each unique variable in association pairs
#' @export
#'
#' @examples
#' gather_avg_strength(virus_net)
#'
gather_avg_strength <- function(association_pairs){

  dplyr::tibble(
    id = c(association_pairs$a, association_pairs$b),
    strength = c(association_pairs$strength, association_pairs$strength)
  ) %>%
    dplyr::group_by(id) %>%
    dplyr::summarise(avg_strength = mean(strength),.groups = "drop")
}
