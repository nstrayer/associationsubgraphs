## code to prepare `virclasp_protein_net` dataset goes here
library(entropynet)
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

usethis::use_data(virclasp_protein_net, overwrite = TRUE)
