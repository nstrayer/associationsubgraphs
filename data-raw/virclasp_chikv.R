## code to prepare `virclasp_chikv` dataset goes here

library(tidyverse)
library(here)
raw <- read_tsv(here("data-raw/arcos_et_al.txt"))

virclasp_chikv <- raw %>%
  select(id = `Majority protein IDs`, contains("Unique peptides ", ignore.case = FALSE)) %>%
  pivot_longer(-id, names_to = "condition", values_to = "count") %>%
  mutate(
    condition = str_remove(condition, "Unique peptides "),
    count = as.integer(count)
  )

usethis::use_data(virclasp_chikv, overwrite = TRUE)
