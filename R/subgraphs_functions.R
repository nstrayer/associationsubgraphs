#' Find all subgraphs in pairs for every subset of edges
#'
#' Given a dataframe of edges with strength between nodes this function returns
#' info on every subgraph state achieved by adding nodes in one-at-a-time in
#' descending order of strength.
#'
#' @inheritParams visualize_association_network
#'
#' @return Dataframe with the following columns for each unique subgraph state.
#' \describe{
#'   \item{cutoff}{The lowest of the edge(s) added to achieve network state}
#'   \item{subgraphs}{List column of dataframes that contains each node residing in a subgraph at this state and that subgraphs id.}
#'   \item{step}{Integer step, aka the number of unique edge strengths in network at state}
#'   \item{largest_size}{Size in number of nodes of the largest current subgraph}
#'   \item{smallest_size}{Size of the smallest current subgraph}
#'   \item{avg_size}{Average size of subgraphs}
#'   \item{n}{Total number of subgraphs}
#'   \item{n_mergers}{Number of subgraphs with more than two nodes that were merged in the last step}
#'   \item{total_merger_magnitude}{Sum of sizes of all merged subgraphs}
#' }
#' @export
#'
#' @examples
#' virus_net %>%
#'   dplyr::arrange(dplyr::desc(strength)) %>%
#'     head(1000) %>%
#'     find_all_subgraphs()
#'
find_all_subgraphs <- function(association_pairs){

  ctx <- V8::v8()

  # Load subgraph finding function
  ctx$eval(readr::read_file(system.file("d3/find_all_subgraphs.js", package = "entropynet")))

  node_ids <- gather_unique_nodes(association_pairs)$id

  # Call js function to get results list
  results <- ctx$call(
    "function(nodes, edges){ return find_all_subgraphs(nodes,edges); }",
    node_ids,
    association_pairs
  )

  subgraph_stats <- purrr::map2_dfr(
    results$subgraph_stats,
    1: length(results$subgraph_stats),
    function(stats, i){dplyr::mutate(stats, step = i) }
  ) %>%
    dplyr::group_by(step) %>%
    dplyr::summarise(
      largest_size = max(size),
      smallest_size = min(size),
      avg_size = mean(size),
      n = dplyr::n(),
      .groups = "drop"
    ) %>%
    dplyr::left_join(
      dplyr::summarise(
        dplyr::group_by(results$mergers, step),
        n_mergers = dplyr::n(),
        total_merger_magnitude = sum(smaller_n + larger_n),
        .groups = "drop"
      ),
      by = "step"
    ) %>%
    dplyr::mutate(
      n_mergers = ifelse(is.na(n_mergers), 0L, n_mergers),
      total_merger_magnitude = ifelse(is.na(total_merger_magnitude), 0L, total_merger_magnitude),
    )

  t(results$membership_vecs) %>%
    dplyr::as_tibble() %>%
    stats::setNames(results$cutoff_values) %>%
    dplyr::mutate(node = node_ids) %>%
    tidyr::pivot_longer(cols = -node, names_to = "cutoff", values_to = "subgraph") %>%
    dplyr::filter(subgraph != 0) %>%
    dplyr::group_by(cutoff) %>%
    tidyr::nest() %>%
    dplyr::ungroup() %>%
    dplyr::rename(subgraphs = data) %>%
    dplyr::mutate(cutoff = as.numeric(cutoff)) %>%
    dplyr::arrange(-cutoff) %>%
    dplyr::bind_cols(subgraph_stats)
}


#' Find all components in pairs for every subset of edges (c++ version)
#'
#' Given a dataframe of edges with strength between nodes this function returns
#' info on every subgraph state achieved by adding nodes in one-at-a-time in
#' descending order of strength.
#'
#' @inheritParams visualize_association_network
#'
#' @return Dataframe with the following columns for the subgraph info
#' @export
#'
#' @examples
#'
#' virus_net %>%
#'   dplyr::arrange(dplyr::desc(strength)) %>%
#'     head(1000) %>%
#'     explore_component_structure()
#'
explore_component_structure <- function(association_pairs){
  dplyr::as_tibble(find_components(association_pairs))
}



#' Visualize all possible subgraphs
#'
#' Companion function to \code{\link{find_all_subgraphs}} to visualize results.
#' Shows a streamgraph of subgraph's by size, total number of subgraphs, and
#' mergers of subgraphs that took place at every unique strength cutoff for
#' association network.
#'
#' @param all_subgraphs results dataframe from calling \code{\link{find_all_subgraphs}}
#'
#' @return NULL
#' @export
#'
#' @examples
#'
#' virus_net %>%
#'   dplyr::arrange(desc(strength)) %>%
#'     head(500) %>%
#'     find_all_subgraphs() %>%
#'     visualize_all_subgraphs()
#'
visualize_all_subgraphs <- function(all_subgraphs){

  r2d3::r2d3(system.file("d3/visualize_all_subgraphs.js", package = "entropynet"), data=all_subgraphs)
}
