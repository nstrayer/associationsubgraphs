#include <Rcpp.h>

#include <map>
#include <list>

using namespace Rcpp;

struct Component {
  std::list<String> members;
  int num_edges = 1;
  const int num_members() const {
    return members.size();
  }
  void absorb(Component& smaller_component){

    members.splice(members.end(), smaller_component.members);
    // We always absorb when an edge is added so add it here
    num_edges += (smaller_component.num_edges + 1);
  }
};

// [[Rcpp::export]]
DataFrame find_components(CharacterVector a, CharacterVector b, NumericVector w) {

  std::map<int, Component> components;
  std::map<String, int> node_to_component;

  int component_id_counter = 0;
  const int n = a.length();

  // Vectors we will return as df columns
  IntegerVector n_components(n);
  IntegerVector n_nodes_seen(n);
  IntegerVector max_size(n);
  NumericVector max_density(n);

  for (int i = 0; i < n; i++) {
    const String& a_id = a[i];
    const String& b_id = b[i];

    auto a_component_id_loc = node_to_component.find(a_id);
    auto b_component_id_loc = node_to_component.find(b_id);

    const bool a_has_component = a_component_id_loc != node_to_component.end();
    const bool b_has_component = b_component_id_loc != node_to_component.end();

    bool state_has_changed = true;

    if(a_has_component && b_has_component) {
      // Both have subgraphs
      const int a_component_id = a_component_id_loc->second;
      const int b_component_id = b_component_id_loc->second;

      // Are they the same subgraph?
      const bool different_component = a_component_id != b_component_id;

      if(different_component){
        Component& a_component = components[a_component_id];
        Component& b_component = components[b_component_id];

        if (a_component.num_members() > b_component.num_members()){
          // Merge the smaller subgraph's members into largers

          for (const auto& member_id : b_component.members) {
            node_to_component[member_id] = a_component_id;
          }

          a_component.absorb(b_component);
          components.erase(components.find(b_component_id));

        } else {

          for (const auto& member_id : a_component.members) {
            node_to_component[member_id] = b_component_id;
          }
          b_component.absorb(a_component);
          components.erase(components.find(a_component_id));
        }
      } else {
        state_has_changed = false;
        components[a_component_id].num_edges++;
      }
    } else if(!a_has_component && !b_has_component){
      // Neither have subgraphs

      // Make a new subgraph
      const int new_component_id = component_id_counter++;
      Component& new_component = components[new_component_id];
      new_component.members.push_back(a_id);
      new_component.members.push_back(b_id);

      // Assign both a and b to it
      node_to_component[a_id] = new_component_id;
      node_to_component[b_id] = new_component_id;

    } else if (a_has_component){
      // Just a has subgraph

      // add b as member of a's subgraph
      Component& a_component = components[a_component_id_loc->second];
      a_component.members.push_back(b_id);
      a_component.num_edges++;

      node_to_component[b_id] = a_component_id_loc->second;
    } else {
      // just b has a subgraph

      // add a as member of b's subgraph
      Component& b_component = components[b_component_id_loc->second];
      b_component.members.push_back(a_id);
      b_component.num_edges++;

      node_to_component[a_id] = b_component_id_loc->second;
    }

    int step_max_size = 0;
    double step_max_density = 0;
    for (const auto& component_itt : components) {
      const int Nv = component_itt.second.num_members();
      const double dens = double(Nv)/double(component_itt.second.num_edges);
      if(Nv > step_max_size){
        step_max_size = Nv;
      }
      if(dens > step_max_density){
        step_max_density = dens;
      }
    }

    n_components[i] = components.size();
    n_nodes_seen[i] = node_to_component.size();
    max_size[i] = step_max_size;
    max_density[i] = step_max_density;
  }

  return DataFrame::create(
    _["n_components"] = n_components,
    _["n_nodes_seen"] = n_nodes_seen,
    _["max_size"] = max_size,
    _["max_density"] = max_density,
    _["strength"] = w
  );
}


// You can include R code blocks in C++ files processed with sourceCpp
// (useful for testing and development). The R code will be automatically
// run after the compilation.
//

/*** R
data <- virus_net %>%
 dplyr::arrange(dplyr::desc(strength)) %>%
   head(1500)

res <- find_components(data$a, data$b, data$strength)


#
# # step_stats <- res$stats
#
#
#
# step_stats <- map_dfr(res$subgraphs, function(step_df){
#   step_df %>%
#     mutate(density = Nv/Ne) %>%
#     summarise(
#       med_density = median(density),
#       min_density = min(density),
#       avg_density = mean(density),
#       density_sd = sd(density),
#       max_size = max(Nv),
#       median_size = median(Nv),
#       avg_size = mean(Nv)
#     )
# }) %>%
#   bind_cols(res$stats) %>%
#   mutate(
#     step = row_number(),
#     density_stat = avg_density*n_components,
#     rel_max_size = max_size/n_nodes_seen
#   )
#
#
# step_stats %>%
#   mutate(
#     density_lower = avg_density - (1.96*density_sd)/sqrt(n_components),
#     density_upper = avg_density + (1.96*density_sd)/sqrt(n_components)
#   ) %>%
#   ggplot(aes(x = step, y = avg_density)) +
#   geom_ribbon(aes(ymin = density_lower, ymax = density_upper))
#
# step_stats %>%
#   mutate(
#     density_stat = avg_density*n_components
#   ) %>%
#   pivot_longer(
#     cols = c(n_components, avg_density, density_stat)
#   ) %>%
#   ggplot(aes(x = step, y = value)) +
#   geom_line() +
#   facet_grid(rows = vars(name), scales = "free_y")
#
#
# step_of_max_rel <- which(step_stats$rel_max_size == min(step_stats$rel_max_size))[1]
# step_stats %>%
#   pivot_longer(-step) %>%
#   ggplot(aes(x = step, y = value)) +
#   geom_line() +
#   geom_vline(xintercept = step_of_max_rel, color = 'orangered') +
#   facet_grid(rows = vars(name), scales = "free_y")
#
#
# virus_net %>%
#  dplyr::arrange(desc(strength)) %>%
#  head(step_of_max_rel) %>%
#  visualize_association_network()

*/
