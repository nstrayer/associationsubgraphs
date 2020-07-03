## code to prepare `virus_component_results` dataset goes here
library(tidyverse)
library(entropynet)

association_pairs <- head(dplyr::arrange(entropynet::virus_net, -strength), 5000)

virus_component_results <- dplyr::as_tibble(entropynet::find_components(association_pairs, w_col = "strength"))

list(nodes = dplyr::mutate(dplyr::rename(entropynet::virus_host_viruses, id = virus_id), color = ifelse(type == "RNA", "orangered", "steelblue")),edges = head(dplyr::arrange(entropynet::virus_net, -strength), 500))
usethis::use_data(virus_component_results, overwrite = TRUE)

