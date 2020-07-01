## code to prepare `virus_component_results` dataset goes here
library(tidyverse)
library(entropynet)

association_pairs <- virus_net %>%
  arrange(desc(strength))

virus_component_results <- association_pairs %>% head(5000) %>% explore_component_structure()


usethis::use_data(virus_component_results, overwrite = TRUE)

