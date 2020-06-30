#include <Rcpp.h>

#include <list>
#include <map>

using namespace Rcpp;

using Node_to_Component = std::map<String, int>;

struct Component {
  std::list<String> members;
  int num_edges = 1;
  int id = 0;
  double total_edge_w = 0;
  const int num_members() const { return members.size(); }

  void add_edge(const String& a_id,
                const String& b_id,
                const double& w_i,
                Node_to_Component& node_component_ids) {
    add_member(a_id, node_component_ids);
    add_member(b_id, node_component_ids);
    total_edge_w += w_i;
  }

  void add_member(const String& member_id,
                  Node_to_Component& node_component_ids) {
    members.push_back(member_id);
    node_component_ids[member_id] = id;
  }

  void add_edge(const String& member_id,
                const double& w_i,
                Node_to_Component& node_component_ids) {
    add_member(member_id, node_component_ids);
    total_edge_w += w_i;
  }

  void add_edge(const double& w_i) {
    num_edges++;
    total_edge_w += w_i;
  }
};

inline void merge_components(Component& C_a,
                             Component& C_b,
                             const double& w_i,
                             Node_to_Component& node_component_ids,
                             std::map<int, Component>& all_components) {
  const bool a_is_larger = C_a.num_members() > C_b.num_members();

  Component& C_small = a_is_larger ? C_b : C_a;
  Component& C_large = a_is_larger ? C_a : C_b;

  // Set all members of the smaller component to have this components id
  for (const auto& member_id : C_small.members) {
    node_component_ids[member_id] = C_large.id;
  }

  // Merge the members lists of the two components
  C_large.members.splice(C_large.members.end(), C_small.members);

  // We always absorb when an edge is added so add it here
  C_large.num_edges += (C_small.num_edges + 1);
  C_large.total_edge_w += (C_small.total_edge_w + w_i);

  // Tell the components map to get rid of the smaller component
  all_components.erase(all_components.find(C_small.id));
}

// [[Rcpp::export]]
List find_components(CharacterVector a, CharacterVector b, NumericVector w) {
  std::map<int, Component> components;
  Node_to_Component node_to_component;

  int component_id_counter = 0;
  const int n = a.length();

  // Vectors we will return as df columns
  IntegerVector n_components(n);
  IntegerVector n_triples(n);
  IntegerVector n_nodes_seen(n);
  NumericVector avg_size(n);
  IntegerVector max_size(n);
  NumericVector rel_max_size(n);
  NumericVector avg_density(n);
  NumericVector density_score(n);
  List step_component_info(n);

  for (int i = 0; i < n; i++) {
    const String& a_id = a[i];
    const String& b_id = b[i];
    const double w_i = w[i];

    auto a_component_id_loc = node_to_component.find(a_id);
    auto b_component_id_loc = node_to_component.find(b_id);

    const bool a_has_component = a_component_id_loc != node_to_component.end();
    const bool b_has_component = b_component_id_loc != node_to_component.end();

    if (a_has_component && b_has_component) {
      // Both have subgraphs
      const int a_component_id = a_component_id_loc->second;
      const int b_component_id = b_component_id_loc->second;

      // Are they the same subgraph?
      const bool different_component = a_component_id != b_component_id;

      if (different_component) {
        // Merge the smaller subgraph's members into largers
        merge_components(components[a_component_id], components[b_component_id],
                         w_i, node_to_component, components);

      } else {
        components[a_component_id].add_edge(w_i);
      }
    } else if (!a_has_component && !b_has_component) {
      // Neither have subgraphs

      // Make a new subgraph
      Component& new_component = components[++component_id_counter];
      new_component.id = component_id_counter;

      // Set both a and b nodes to have new component
      new_component.add_edge(a_id, b_id, w_i, node_to_component);

    } else if (a_has_component) {
      // If just a has subgraph add b as member of a's subgraph
      components[a_component_id_loc->second].add_edge(b_id, w_i,
                                                      node_to_component);
    } else {
      // If just b has a subgraph add a as member of b's subgraph
      components[b_component_id_loc->second].add_edge(a_id, w_i,
                                                      node_to_component);
    }

    const int nodes_seen = node_to_component.size();
    const int num_components = components.size();

    IntegerVector ids(num_components);
    IntegerVector sizes(num_components);
    NumericVector densities(num_components);
    NumericVector strengths(num_components);

    int step_num_triples = 0;
    int step_max_size = 0;
    double total_density = 0;
    int k = 0;
    for (const auto& component_itt : components) {
      const int Nv = component_itt.second.num_members();
      const double Ne = component_itt.second.num_edges;
      const double dens = Ne / double(Nv * (Nv - 1)) / 2.0;
      ids[k] = component_itt.first;
      sizes[k] = Nv;
      densities[k] = dens;
      strengths[k] = component_itt.second.total_edge_w/Ne;
      total_density += dens;
      if(Nv > 2) step_num_triples++;
      if (Nv > step_max_size) step_max_size = Nv;
      k++;
    }

    n_nodes_seen[i] = nodes_seen;
    n_components[i] = num_components;
    n_triples[i] = step_num_triples;
    max_size[i] = step_max_size;
    rel_max_size[i] = double(step_max_size) / double(nodes_seen);
    avg_size[i] = double(nodes_seen) / double(num_components);
    avg_density[i] = total_density / double(num_components);
    step_component_info[i] =
        DataFrame::create(_["id"] = ids,
                          _["size"] = sizes,
                          _["density"] = densities,
                          _["strength"] = strengths);
  }

  return List::create(
      _["n_edges"] = seq_len(n),
      _["strength"] = w,
      _["n_nodes_seen"] = n_nodes_seen,
      _["n_components"] = n_components,
      _["max_size"] = max_size,
      _["rel_max_size"] = rel_max_size,
      _["avg_size"] = avg_size,
      _["avg_density"] = avg_density,
      _["n_triples"] = n_triples,
      _["components"] = step_component_info);
}

/*** R
# library(entropynet)
data <- head(dplyr::arrange(virus_net, dplyr::desc(strength)), 1000)
res <- dplyr::as_tibble(find_components(data$a, data$b, data$strength))


res$components %>% pluck(5)

*/
