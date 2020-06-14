#' Interactive association network visualization
#'
#' @param association_pairs dataframe with columns `a` and `b` representing the
#'   ids of the variables or nodes and columns `strength` that is a numeric
#'   indicator of strength of association (higher = stronger).
#' @param node_info Optional dataframe that has a column `id` that corresponds
#'   to the variables codded in `a` and `b` of `association_pairs` that contains
#'   additional info nade available on hover in visualization.
#' @param measure_title Name of measure used to quantify strength of association
#'   between the variables.
#' @param alphaDecay Paramter to control how fast the force-layout converges.
#'   Lower values mean a better but slower layout, higher means faster. See the
#'   [d3-force docs](https://github.com/d3/d3-force#simulation_alphaDecay) for
#'   more info.
#'
#' @return Interactive javascript visualization of association network
#' @export
#'
#' @examples
visualize_association_network <- function(association_pairs,
                                          node_info,
                                          measure_title = "association",
                                          alphaDecay = 0.01) {
  unique_nodes <- dplyr::count(dplyr::bind_rows(
      dplyr::select(association_pairs, id = a),
      dplyr::select(association_pairs, id = b)
    ),
    id, name = "degree")

  if (missing(node_info)) {
    nodes <- unique_nodes
  } else {
    nodes <- dplyr::filter(node_info, id %in% unique_nodes$id)
  }

  r2d3::r2d3(
    system.file("d3/information_network.js", package = "entropynet"),
    data = list(
      nodes = nodes,
      edges = dplyr::select(
        association_pairs,
        source = a,
        target = b,
        strength
      )
    ),
    container = "div",
    options = list(measure = measure_title, alphaDecay = alphaDecay)
  )
}
