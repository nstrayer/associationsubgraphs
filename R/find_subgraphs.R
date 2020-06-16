#' Find subgraphs in pairs
#'
#' Given a dataframe of edges between nodes this function returns a dataframe of
#' each unique node with a subgraph id attached indicating its shared membership
#' in an isolated subgraph with other nodes.
#'
#' @inheritParams visualize_association_network
#'
#' @return Dataframe with the node `id`, that nodes `degree` in the pair edges
#'   provided and the `subgraph_id` corresponding to the isolated subgraph the
#'   node belongs to.
#' @export
#'
#' @examples
#' virus_net %>%
#'   dplyr::arrange(dplyr::desc(strength)) %>%
#'     head(200) %>%
#'     find_subgraphs()
#'
find_subgraphs <- function(association_pairs){

  ctx <- V8::v8()

  # Load subgraph finding function
  ctx$eval(readr::read_file(system.file("d3/find_subgraphs.js", package = "entropynet")))

  # Call subgraph function and return the nodes object
  ctx$call("function(nodes, edges){ return find_subgraphs(nodes,edges).nodes; }",
           gather_unique_nodes(association_pairs),
           dplyr::select(association_pairs, source = a, target = b)
  ) %>%
    dplyr::as_tibble()

}
