library(tidyverse)

# How can we simulate association networks?
ggplot(virus_net, aes(x = strength)) +
  geom_density()

gather_avg_strength(virus_net) %>%
  ggplot(aes(x = avg_strength)) +
  geom_density() +
  geom_rug(alpha = 0.1)


# Help determine which beta params to use
tibble(
  x = seq(0,1,length.out = 1000),
  p = dbeta(x, 0.5,10)
) %>%
  ggplot(aes(x = x, y = p)) + geom_line()


library(dplyr)

simulated_net <- simulate_sticky_association_network( n_variables = 100,
                                     n_clusters = 10,
                                     cluster_coherence=2,
                                     stickiness_dist = function(n){runif(n)},
                                     association_dist = function(n){rbeta(n, shape1 =1, shape2 = 10)})
simulated_net$associations <- dplyr::arrange(simulated_net$associations, -strength)

sim_comps <- dplyr::as_tibble(associationsubgraphs::calculate_subgraph_structure_rcpp(simulated_net$associations, w_col = "strength"))

visualize_subgraph_structure(
  simulated_net$associations %>% mutate(a = paste0("n",a), b = paste0("n",b)),
  node_info =simulated_net$variables %>%
    dplyr::rename(id = variable) %>%
    dplyr::mutate(
      id = paste0("n",id)),
  trim_subgraph_results = TRUE
)

r2d3::r2d3(
  "inst/d3/explore_subgraph_structure.js",
  data = list(
    nodes = simulated_net$variables %>%
      dplyr::rename(id = variable) %>%
      dplyr::mutate(
        id = paste0("n",id)),
    edges = simulated_net$associations %>% mutate(a = paste0("n",a), b = paste0("n",b)),
    structure = sim_comps %>% head(200)
  ),
  container = "div",
  dependencies = c("inst/d3/d3_helpers.js", "inst/d3/find_subgraphs.js"),
  d3_version = "5"
)

dplyr::as_tibble(associationsubgraphs::calculate_subgraph_structure_rcpp(simulated_net$associations, w_col = "strength"))

visualize_subgraph_structure(
  virus_net,
  node_info = virus_host_viruses %>%
    dplyr::rename(id = virus_id) %>%
    dplyr::mutate(color = ifelse(type == "RNA", "orangered", "steelblue"))
)

