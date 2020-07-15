#' Find all subgraphs in pairs for every subset of edges
#'
#' Given a dataframe of edges with strength between nodes this function returns
#' info on every subgraph state achieved by adding nodes in one-at-a-time in
#' descending order of strength.
#'
#' @section `subgraph` list column:
#'
#' The subgraph list column in the results contains information on the present subgraphs at each step. It is a list with the following format, but can be turned into a dataframe/tibble easily with `dplyr::as_tibble/as.data.frame`.
#'
#' |**Column** | | **Description**|
#' | ----- |-| ---------- |
#' |`id` || Integer ID for subgraph. Can be used to track subgraph evolution over steps.|
#' |`size` || How many variables/nodes subgraph has|
#' |`density` || Density of subgraph. Scale from >0 - 1. Where a density of 1 is a fully-connected subgraph.|
#' |`strength` || How many unique nodes/variables are currently in network|
#' |`first_edge` || 0-based integer index of first edge that made up subgraph. Used internally to match subgraphs in interactive visualizations with these results.|
#'
#'
#' @param association_pairs dataframe with columns `a` and `b` representing the
#'   ids of the variables or nodes and columns `strength` that is a numeric
#'   indicator of strength of association (higher = stronger).
#' @param strength_column Id of column that encodes the strength of the associations for pairs
#'
#' @return Dataframe with the following columns for each unique subgraph state.
#'
#' |**Column** | |**Description**|
#' | ----- |-|---------- |
#' |`step` | | Integer step, aka the number of unique edge strengths in network at state|
#' |`n_edges` | | How many edges have been added thus far|
#' |`strength` | | The lowest strength of the edge(s) added|
#' |`n_nodes_seen` | | How many unique nodes/variables are currently in network|
#' |`n_subgraphs` | | How many isolated subgraphs/components of size > 2 are in current network|
#' |`n_triples` | | How many isolated subgraphs of size 3 or larger are in current network|
#' |`max_size` | | Size in number of nodes of the largest current subgraph|
#' |`max_rel_size` | | Proportion of all seen nodes (`n_nodes_seen`) that the largest subgraph includes. Large values indicate presence of a giant-component.|
#' |`avg_size` | | Average size of subgraphs|
#' |`avg_density` | | Average density of subgraphs. Scale from >0 - 1. Where a density of 1 is a fully-connected subgraph.|
#' |`subgraphs` | | List column of summary stats for each subgraph at a given step. See the `subgraph` list column section for more info.|
#'
#' @export
#'
#' @examples
#'
#' virus_associations <- dplyr::arrange(virus_net, dplyr::desc(strength))
#' calculate_subgraph_structure(head(virus_associations, 1000))
#'
calculate_subgraph_structure <- function(association_pairs, strength_column = "strength"){
  dplyr::as_tibble(calculate_subgraph_structure_rcpp(ensure_sorted(association_pairs, strength_column), w_col = strength_column))
}

utils::globalVariables(c("a","b", "id", "n_nodes_seen", "rel_max_size", "strength"))

