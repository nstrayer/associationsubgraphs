#include <Rcpp.h>
#include <set>

using namespace Rcpp;


// [[Rcpp::export]]
int edges_to_all_nodes(CharacterVector a, CharacterVector b, const int n) {
  std::set<String> seen_nodes;

  const int Ne = a.length();

  int i = 0;
  for (i = 0; i < Ne; i++) {
    seen_nodes.insert(a[i]);
    seen_nodes.insert(b[i]);
    if(seen_nodes.size() == n){
      break;
    }
  }
  return i;
}

/*** R

data <- virus_net %>%
  dplyr::arrange(dplyr::desc(strength))
# %>%
  # head(05000)
Ne <- data %>% nrow()

n <- 586
# virus_host_viruses %>% nrow()
Ne_full_ordered <- edges_to_all_nodes(data$a, data$b, n)
random_order = sample(1:Ne, size = Ne)
Ne_full_rand <- edges_to_all_nodes(data$a[random_order], data$b[random_order], n)
n/Ne_full_ordered
n/Ne_full_rand

*/
