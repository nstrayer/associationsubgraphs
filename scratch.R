library(tidyverse)
library(magrittr)


association_pair_rankings <- virus_net %>%
  arrange(strength) %>%
  mutate(rank = row_number())

average_ranks <- bind_rows(
      association_pair_rankings %>% select(id = a, b = b, rank),
      association_pair_rankings %>% select(id = b, b = a, rank)
    )  %>%
  distinct(id, b, rank) %>%
  group_by(id) %>%
  summarise(average_rank = mean(rank), .groups = "drop")

pairs_indices <- build_all_pairs(nrow(average_ranks))

expected_pair_rankings <- tibble(
  a = average_ranks$id[pairs_indices$a_i],
  b = average_ranks$id[pairs_indices$b_i],
  a_avg_rank = average_ranks$average_rank[pairs_indices$a_i],
  b_avg_rank = average_ranks$average_rank[pairs_indices$b_i]
) %>%
  mutate(expected_rank = (a_avg_rank + b_avg_rank)/2) %>%
  select(a, b, expected_rank)


combined_pairs <- join_pair_lists(
  expected_pair_rankings,
  association_pair_rankings
) %>%
  mutate(rank_residual = rank/ expected_rank) %>%
  arrange(-rank_residual)

combined_pairs %>%
  ggplot(aes(x = rank_residual)) +
  geom_histogram(bins = 200)

combined_pairs %>%
  ggplot(aes(x = rank, y = expected_rank)) +
  geom_hex()

rank_relative_associations <- combined_pairs %>%
  select(a, b, strength = rank_residual)

visualize_subgraph_structure(
  rank_relative_associations,
  node_info = virus_host_viruses %>%
    dplyr::rename(id = virus_id) %>%
    dplyr::mutate(color = ifelse(type == "RNA", "orangered", "steelblue")),
  trim_subgraph_results = TRUE
)

visualize_subgraph_structure(
  rank_relative_associations,
  node_info =simulated_net$variables %>%
    dplyr::mutate(
      id = paste0("n",id)),
  trim_subgraph_results = TRUE
)

# How can we simulate association networks?
ggplot(virus_net, aes(x = strength)) +
  geom_density()

virus_net %$%
list(
  a = a,
  b = b,
  strength = strength
) %>% jsonlite::toJSON() %>%
  write_file("~/Desktop/virus_pairs.json")

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
  node_info =
)


virus_structure <- virus_net %>% calculate_subgraph_structure()


r2d3::r2d3(
  "inst/d3/explore_subgraph_structure.js",
  data = list(
    nodes = virus_host_viruses %>%
      dplyr::rename(id = virus_id) %>%
      dplyr::mutate(color = ifelse(type == "RNA", "orangered", "steelblue")),
    edges = virus_net %>% arrange(-strength) %>% head(1000),
    structure = filter(virus_structure, n_edges <= 1000)
  ),
  container = "div",
  dependencies = c("inst/d3/d3_helpers.js", "inst/d3/find_subgraphs.js"),
  d3_version = "5"
)



phecode_colors <- phewasHelper::category_colors()
phecode_info <- phewasHelper::phecode_descriptions %>%
  select(id = phecode, description, category) %>%
  mutate(color = phecode_colors[category])


vandy_structure <- associationsubgraphs::calculate_subgraph_structure(vandy_associations)
associationsubgraphs::visualize_subgraph_structure(
  vandy_associations,
  node_info = phecode_info,
  subgraph_results = vandy_structure)

visualize_subgraph_structure(
  simulated_net$associations %>% mutate(a = paste0("n",a), b = paste0("n",b)),
  node_info =simulated_net$variables %>%
    dplyr::mutate(
      id = paste0("n",id)),
  trim_subgraph_results = TRUE
)




library(tidyverse)
vandy_associations <- read_rds("~/Downloads/vandy_clean.rds")%>% select(a = phecode_a, b = phecode_b, strength = z_avg) %>%
  mutate(strength = abs(strength)) %>%
  arrange(-strength)

res <- calculate_subgraph_structure_rcpp(vandy_associations, w_col = "strength",
                                         return_subgraph_membership = FALSE)
