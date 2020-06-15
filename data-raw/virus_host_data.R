## code to prepare `mammal_virus_data` dataset goes here

library(tidyverse)
library(here)

# Dataset was found using the University of Colorado ICON system (https://icon.colorado.edu/#!/networks)
# and downloaded from github (https://github.com/cjcarlson/brevity/tree/master/Olival%20Nature%202017%20Raw%20Data)

virus_host_net_hosts <- read_csv(here("data-raw/mammal_virus_hosts.csv")) %>%
  select(
    host_id = hHostNameFinal,
    common_name = Common_names_Eng,
    population_trend = Population_trend,
    status = RedList_status
  ) %>%
  mutate(host_index = row_number())

virus_host_net_viruses <- read_csv(here("data-raw/mammal_virus_viruses.csv")) %>%
  select(
    virus_id = vVirusNameCorrected,
    avg_genome_length = vGenomeAveLength,
    restricted_to_cytoplasm = vCytoReplicTF,
    segmented_genome = vSegmentedTF,
    type = vDNAoRNA,
    enveloped = vEnvelope
  ) %>%
  mutate(
    enveloped = enveloped == "enveloped",
  )

virus_host <- read_csv(here("data-raw/mammal_virus_associations.csv")) %>%
  select(
    virus_id = vVirusNameCorrected,
    host_id = hHostNameFinal,
    method = DetectionMethod
  )



usethis::use_data(virus_host, overwrite = TRUE)
usethis::use_data(virus_host_hosts, overwrite = TRUE)
usethis::use_data(virus_host_viruses, overwrite = TRUE)


