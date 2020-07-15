## code to prepare `virclasp_protein_net` dataset goes here
library(associationsubgraphs)
library(fs)

cache_loc <- here::here("data-raw/virclasp_protein_net.rds")
has_cached <- file_exists(cache_loc)

if(has_cached){
  virclasp_protein_net <- readr::read_rds(cache_loc)

} else {
  # Takes around 7 mins to run on macbook pro with i-7 processor
  virclasp_protein_net <- calc_entropy_net(
    pairs = virclasp_chikv,
    id_col = id,
    target_col = condition,
    count_col = count,
    parallel = TRUE,
    verbose = TRUE
  )
  readr::write_rds(virclasp_protein_net, cache_loc)
}



# contaminants <- "FLN|PLEC|TLN|MVP"
#
# virclasp_clean <- virclasp_protein_net %>%
#   dplyr::filter(!(stringr::str_detect(a, contaminants) | stringr::str_detect(b, contaminants)))
#
# virclasp_strengths <- dplyr::bind_rows(
#   dplyr::rename(virclasp_clean, id = a, target = b),
#   dplyr::rename(virclasp_clean, id = b, target = a)
# ) %>%
#   dplyr::group_by(id) %>%
#   dplyr::summarise(avg_strength = mean(strength))
#
# virclasp_by_strength <- virclasp_clean %>%
#   left_join(virclasp_strengths, by = c("a" = "id")) %>%
#   rename(a_avg = avg_strength) %>%
#   left_join(virclasp_strengths, by = c("b" = "id")) %>%
#   rename(b_avg = avg_strength) %>%
#   mutate(relative_strength = strength / (a_avg + b_avg)) %>%
#   arrange(desc(relative_strength))

usethis::use_data(virclasp_protein_net, overwrite = TRUE)
