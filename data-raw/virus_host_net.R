## code to prepare `virus_host_net` dataset goes here
library(associationsubgraphs)

virus_net <- calc_entropy_net(
  pairs = virus_host,
  id_col = virus_id,
  target_col = host_id,
  parallel = TRUE,
  verbose = TRUE
)

usethis::use_data(virus_net, overwrite = TRUE)
