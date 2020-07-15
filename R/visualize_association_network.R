#' Interactive association network visualization
#'
#' Produces an interactive plot of nodes connected by edges scaled by the
#' strength of association.
#'
#' The plot automatically detects isolated subgraphs (groups of nodes with
#' connections only within the group) and lays them out in a grid to avoid
#' overlap between unrelated parts of the network.
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
#' @param n_neighbors How many neighbors for a hovered node should be shown?
#' @param warn_of_mismatches If there are differences in the ids present in
#'   `association_pairs` and `node_info` should a warning be issued?
#'
#' @return Interactive javascript visualization of association network
#' @export
#'
#' @examples
#'
#' entropynet::virus_net %>%
#'   dplyr::arrange(desc(strength)) %>%
#'   head(300) %>%
#'   visualize_association_network()
#'
visualize_association_network <- function(association_pairs,
                                          node_info,
                                          measure_title = "association",
                                          alphaDecay = 0.01,
                                          n_neighbors = 5,
                                          warn_of_mismatches = TRUE) {
  # browser()
  unique_nodes <- gather_unique_nodes(association_pairs)
  if (missing(node_info)) {
    nodes <- unique_nodes
  } else {
    all_passed_nodes <- unique(node_info$id)
    in_edges <- unique_nodes$id

    n_not_in_edges <- dplyr::setdiff(all_passed_nodes, in_edges) %>% length()
    n_not_in_info <- dplyr::setdiff(in_edges, all_passed_nodes) %>% length()

    if(n_not_in_edges > 0 & warn_of_mismatches){
      warning(glue::glue("There are {n_not_in_edges} ids in the node_info dataframe that were not seen in association pairs. These are omitted."))
    }

    if(n_not_in_info > 0 & warn_of_mismatches){
      warning(glue::glue("There are {n_not_in_info} ids in the association_pairs dataframe that are not in the node_info dataframe."))
    }

    # unique_nodes
    nodes <- dplyr::right_join(node_info, unique_nodes, by = "id")
  }

  r2d3::r2d3(
    system.file("d3/information_network.js", package = "entropynet"),
    dependencies = system.file("d3/find_subgraphs.js", package = "entropynet"),
    data = list(
      nodes = nodes,
      edges = dplyr::select(
        association_pairs,
        a,
        b,
        strength
      )
    ),
    container = "div",
    options = list(measure = measure_title,
                   alphaDecay = alphaDecay,
                   n_neighbors = n_neighbors,
                   source_id = "a",
                   target_id = "b")
  )
}

#' Interactive association components visualization
#'
#' Produces an interactive plot of network structure for all possible component
#' arrangements for passed association pairs with summary statistics to guide
#' exploration of cut-points.
#'
#'
#' @param association_pairs dataframe with columns `a` and `b` representing the
#'   ids of the variables or nodes and columns `strength` that is a numeric
#'   indicator of strength of association (higher = stronger).
#' @param node_info Optional dataframe that has a column `id` that corresponds
#'   to the variables codded in `a` and `b` of `association_pairs` that contains
#'   additional info nade available on hover in visualization.
#' @param component_results Dataframe of component results as returned by
#'   \code{\link{explore_component_structure}}. If it isnt provided it is
#'   calculated. Automatic calculation will slow down code depending on how
#'   large dataset is.
#' @param trim_component_results Should component results after a giant
#'   component has taken over be filtered out? Rule for filtering is at least
#'   10% of the variables are in components and largest component contains less
#'   than 95% of all variables in components. Allows for easier investigating of
#'   the component structure over strength.
#' @param warn_of_mismatches If there are differences in the ids present in
#'   `association_pairs` and `node_info` should a warning be issued?
#'
#' @return Interactive javascript visualization of association network
#'   components at all possible cut-points
#' @export
#'
#' @examples
#' visualize_component_structure(
#'   virus_net,
#'   node_info = virus_host_viruses %>%
#'     dplyr::rename(id = virus_id) %>%
#'     dplyr::mutate(color = ifelse(type == "RNA", "orangered", "steelblue"))
#' )
#'
visualize_component_structure <- function(association_pairs,
                                          node_info,
                                          component_results,
                                          trim_component_results = TRUE,
                                          warn_of_mismatches = TRUE) {
  unique_nodes <- gather_unique_nodes(association_pairs)

  association_pairs <- ensure_sorted(association_pairs)

  if (missing(node_info)) {
    nodes <- unique_nodes
  } else {
    all_passed_nodes <- unique(node_info$id)
    in_edges <- unique_nodes$id

    n_not_in_edges <- dplyr::setdiff(all_passed_nodes, in_edges) %>% length()
    n_not_in_info <- dplyr::setdiff(in_edges, all_passed_nodes) %>% length()

    if(n_not_in_edges > 0 & warn_of_mismatches){
      warning(glue::glue("There are {n_not_in_edges} ids in the node_info dataframe that were not seen in association pairs. These are omitted."))
    }

    if(n_not_in_info > 0 & warn_of_mismatches){
      warning(glue::glue("There are {n_not_in_info} ids in the association_pairs dataframe that are not in the node_info dataframe."))
    }

    # unique_nodes
    nodes <- dplyr::right_join(node_info, unique_nodes, by = "id")
  }

  if(missing(component_results)){


    message("Calculating component structure results...")
    component_results <- entropynet::explore_component_structure(association_pairs)
    message("...finished")
  }

  if(trim_component_results){
    component_results <- dplyr::filter(
        component_results,
        rel_max_size < 0.95 | n_nodes_seen < nrow(unique_nodes)*0.1
      )
  }

  get_js <- function(name){system.file(paste0("d3/", name), package = "entropynet")}

  r2d3::r2d3(
    get_js("explore_component_structure.js"),
    data = list(
      nodes = nodes,
      edges = dplyr::select(
        association_pairs,
        a,
        b,
        strength
      ),
      structure = component_results
    ),
    container = "div",
    dependencies = c(
      get_js("find_components.js"),
      get_js("d3_helpers.js")
    ),
    d3_version = "5"
  )
}




