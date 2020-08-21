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
#' virus_associations <- head(dplyr::arrange(virus_net, dplyr::desc(strength)), 300)
#' visualize_association_network(virus_associations)
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

    n_not_in_edges <- length(dplyr::setdiff(all_passed_nodes, in_edges))
    n_not_in_info <-  length(dplyr::setdiff(in_edges, all_passed_nodes))

    if(n_not_in_edges > 0 & warn_of_mismatches){
      warning(paste("There are", n_not_in_edges, "ids in the node_info dataframe that were not seen in association pairs. These are omitted."))
    }

    if(n_not_in_info > 0 & warn_of_mismatches){
      warning(paste("There are", n_not_in_info,  "ids in the association_pairs dataframe that are not in the node_info dataframe."))
    }

    # unique_nodes
    nodes <- dplyr::right_join(node_info, unique_nodes, by = "id")
  }

  r2d3::r2d3(
    system.file("d3/information_network.js", package = "associationsubgraphs"),
    dependencies = system.file("d3/find_subgraphs.js", package = "associationsubgraphs"),
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

#' Interactive association subgraphs visualization
#'
#' Produces an interactive plot of network structure for all possible subgraph
#' arrangements for passed association pairs with summary statistics to guide
#' exploration of cut-points.
#'
#' @inheritParams calculate_subgraph_structure
#' @param node_info Optional dataframe that has a column `id` that corresponds
#'   to the variables codded in `a` and `b` of `association_pairs` that contains
#'   additional info nade available on hover in visualization.
#' @param subgraph_results Dataframe of subgraph results as returned by
#'   \code{\link{calculate_subgraph_structure}}. If it isnt provided it is
#'   calculated. Automatic calculation will slow down code depending on how
#'   large dataset is.
#' @param trim_subgraph_results Should subgraph results after a giant
#'   subgraph has taken over be filtered out? Rule for filtering is at least
#'   10% of the variables are in subgraphs and largest subgraph contains less
#'   than 95% of all variables in subgraphs. Allows for easier investigating of
#'   the subgraph structure over strength.
#' @param warn_of_mismatches If there are differences in the ids present in
#'   `association_pairs` and `node_info` should a warning be issued?
#' @param default_step What step (as integer) should be the default loading
#'   position for the visualization? Defaults to the step with the lowest
#'   relative maximum cluster size.
#' @param width,height Valid css units for output size (e.g. pixels (`px`) or percent(`%`)).
#'
#' @return Interactive javascript visualization of association network
#'   subgraphs at all possible cut-points
#' @export
#'
#' @examples
#'
#' node_info <- dplyr::rename(virus_host_viruses, id = virus_id)
#' node_info$color <- ifelse(node_info$type == "RNA", "orangered", "steelblue")
#' visualize_subgraph_structure(
#'   virus_net,
#'   node_info = node_info
#' )
#'
visualize_subgraph_structure <- function(association_pairs,
                                         node_info,
                                         subgraph_results,
                                         trim_subgraph_results = TRUE,
                                         warn_of_mismatches = TRUE,
                                         width = "100%",
                                         height = "800px",
                                         default_step) {

  # If association pairs are not sorted bad things happen in the algorithm
  association_pairs <- ensure_sorted(association_pairs)

  if (missing(subgraph_results)) {
    message("Calculating subgraph structure results...")
    subgraph_results <- calculate_subgraph_structure(association_pairs)
    message("...finished")
  }

  if(missing(default_step)){
    default_step <- subgraph_results$step[which.min(subgraph_results$rel_max_size)]
  }
  if(default_step > nrow(subgraph_results)){
    stop("requested default step is greater than the total number of steps")
  }

  # We need to know what ids are present in pairs for trimming and checking for mismatches
  unique_nodes <- gather_unique_nodes(association_pairs)

  # Often just the first little bit of the edges have interesting info
  # In this case we want to trim the data sent to the visualization to only be what's necessary
  # because sending the data over to javascript is expensive
  if (trim_subgraph_results) {
    tenth_of_nodes <- nrow(unique_nodes) * 0.1

    # The head is in here because sometimes we have a junk row at end of subgraph results (needs fixing)
    subgraph_results <- dplyr::filter(
      utils::head(subgraph_results, -1),
      rel_max_size < 0.95 |  n_nodes_seen < tenth_of_nodes
    )

    # We can now get rid of all the excess edges we wont ever use
    max_num_edges <- utils::tail(subgraph_results$n_edges, 1)
    association_pairs <- head(association_pairs, max_num_edges)
  }


  if (missing(node_info)) {
    # When no node info is supplied we just use our unique node list
    nodes <- unique_nodes
  } else {
    # Otherwise we need to make sure we have matching node and edge datsets
    all_passed_nodes <- unique(node_info$id)
    in_edges <- unique_nodes$id

    n_not_in_edges <-
      length(dplyr::setdiff(all_passed_nodes, in_edges))
    n_not_in_info <-
      length(dplyr::setdiff(in_edges, all_passed_nodes))

    if (n_not_in_edges > 0 &
        warn_of_mismatches & !trim_subgraph_results) {
      warning(
        paste(
          "There are",
          n_not_in_edges,
          "ids in the node_info dataframe that were not seen in association pairs. These are omitted."
        )
      )
    }

    if (n_not_in_info > 0 & warn_of_mismatches) {
      warning(
        paste(
          "There are",
          n_not_in_info,
          "ids in the association_pairs dataframe that are not in the node_info dataframe."
        )
      )
    }

    # A right join will make sure we dont pull in the node info we don't need
    nodes <- dplyr::right_join(node_info, unique_nodes, by = "id")
  }

  # Typing out the system file command is tiresome. Also this helps if we change the location root
  get_js <-
    function(name) {
      system.file(paste0("d3/", name), package = "associationsubgraphs")
    }

  r2d3::r2d3(
    get_js("explore_subgraph_structure.js"),
    data = list(
      nodes = nodes,
      edges = dplyr::select(
        association_pairs,
        a,
        b,
        strength
      ),
      structure = subgraph_results
    ),
    options = list("default_step" = default_step),
    container = "div",
    dependencies = c(
      get_js("find_subgraphs.js"),
      get_js("d3_helpers.js")
    ),
    d3_version = "5", # We use the .join() method a lot so we need 5.0 or later
    width = width,
    height = height
  )
}




