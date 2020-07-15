## code to prepare `virus_subgraph_results` dataset goes here
library(tidyverse)
library(associationsubgraphs)

association_pairs <- head(dplyr::arrange(associationsubgraphs::virus_net, -strength), 5000)

virus_subgraph_results <- dplyr::as_tibble(associationsubgraphs::calculate_subgraph_structure_rcpp(association_pairs, w_col = "strength"))

list(nodes = dplyr::mutate(dplyr::rename(associationsubgraphs::virus_host_viruses, id = virus_id), color = ifelse(type == "RNA", "orangered", "steelblue")),edges = head(dplyr::arrange(associationsubgraphs::virus_net, -strength), 500))
usethis::use_data(virus_subgraph_results, overwrite = TRUE)

