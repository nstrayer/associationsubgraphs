## code to prepare `virclasp_chikv` dataset goes here

library(tidyverse)
library(here)

virclasp_chikv <- read_tsv(here("data-raw/arcos_et_al.txt")) %>%
  select(id = `Majority protein IDs`, contains("Unique peptides ", ignore.case = FALSE)) %>%
  filter(!str_detect(id, "REV_|CON_")) %>%
  mutate(
    id_clean = str_extract(id, "(?<=[a-z]{2}\\|[AOPQ][0-9][A-Z0-9]{3}[0-9]\\|).+?(?=\\;|$)"),
    id = ifelse(is.na(id_clean), id, id_clean)
  ) %>%
  select(-id_clean) %>%
  pivot_longer(-id, names_to = "condition", values_to = "count") %>%
  mutate(
    condition = str_remove(condition, "Unique peptides "),
    count = as.integer(count)
  )

usethis::use_data(virclasp_chikv, overwrite = TRUE)
