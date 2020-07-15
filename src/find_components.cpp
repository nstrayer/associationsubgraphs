#include <Rcpp.h>

#include <list>
#include <map>

using namespace Rcpp;

using Node_to_Component = std::map<String, int>;

class Component {
 public:
  std::list<String> members;
  std::list<int> edge_indices;
  int id = 0;
  double total_edge_w = 0;
  const int num_members() const { return members.size(); }
  const int num_edges() const { return edge_indices.size(); }
  void add_edge(const String& a_id,
                const String& b_id,
                const double& w_i,
                const int edge_i,
                Node_to_Component& node_component_ids) {
    add_member(a_id, node_component_ids);
    add_member(b_id, node_component_ids);
    update_edges(w_i, edge_i);
  }

  void add_edge(const String& member_id,
                const double& w_i,
                const int edge_i,
                Node_to_Component& node_component_ids) {
    add_member(member_id, node_component_ids);
    update_edges(w_i, edge_i);
  }

  void add_edge(const double& w_i, const int edge_i) {
    update_edges(w_i, edge_i);
  }

 private:
  void add_member(const String& member_id,
                  Node_to_Component& node_component_ids) {
    members.push_back(member_id);
    node_component_ids[member_id] = id;
  }

  void update_edges(const double& edge_weight, const int edge_index) {
    total_edge_w += edge_weight;
    edge_indices.push_back(edge_index);
  }
};

inline void merge_components(Component& C_a,
                             Component& C_b,
                             const double& w_i,
                             const int edge_i,
                             Node_to_Component& node_component_ids,
                             std::map<int, Component>& all_components) {
  const bool a_is_larger = C_a.num_members() > C_b.num_members();

  Component& C_small = a_is_larger ? C_b : C_a;
  Component& C_large = a_is_larger ? C_a : C_b;

  // Set all members of the smaller component to have this components id
  for (const auto& member_id : C_small.members) {
    node_component_ids[member_id] = C_large.id;
  }

  // Merge the members and edge lists of the two components
  C_large.members.splice(C_large.members.end(), C_small.members);
  C_large.edge_indices.splice(C_large.edge_indices.end(), C_small.edge_indices);
  C_large.total_edge_w += C_small.total_edge_w;

  // // We always absorb when an edge is added so add it here
  C_large.add_edge(w_i, edge_i);

  // Tell the components map to get rid of the smaller component
  all_components.erase(all_components.find(C_small.id));
}

//' Find all components in pairs for every subset of edges (c++ version)
//'
//' Given a dataframe of edges with strength between nodes this function returns
//' info on every component state achieved by adding nodes in one-at-a-time in
//' descending order of strength.
//'
//' @param associations Dataframe of association between two ids with a strength
//' @param a_col,b_col Names of columns that store the id's for the association
//pair ' @param w_col Name of the column storing the strength of association
//'
//' @export
// [[Rcpp::export]]
List find_components(DataFrame associations,
                     const String& a_col = "a",
                     const String& b_col = "b",
                     const String& w_col = "w") {
  CharacterVector a = associations[a_col];
  CharacterVector b = associations[b_col];
  NumericVector w = associations[w_col];

  // We only want to record a step for each unique weight
  NumericVector unique_w = unique(w);
  const int n_steps = unique_w.length();

  // Vectors we will return as df columns
  IntegerVector n_components(n_steps);
  IntegerVector n_triples(n_steps);
  IntegerVector n_nodes_seen(n_steps);
  IntegerVector n_edges(n_steps);
  NumericVector strengths(n_steps);
  NumericVector avg_size(n_steps);
  IntegerVector max_size(n_steps);
  NumericVector rel_max_size(n_steps);
  NumericVector avg_density(n_steps);
  NumericVector density_score(n_steps);
  List step_component_info(n_steps);

  std::map<int, Component> components;
  Node_to_Component node_to_component;
  int component_id_counter = 0;
  int step_i = 0;

  for (int i = 0; i < a.length(); i++) {
    const double w_i = w[i];

    const String& a_id = a[i];
    const String& b_id = b[i];
    const auto a_component_id_loc = node_to_component.find(a_id);
    const auto b_component_id_loc = node_to_component.find(b_id);

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
                         w_i, i, node_to_component, components);

      } else {
        // Already in component so just add an edge
        components[a_component_id].add_edge(w_i, i);
      }
    } else if (!a_has_component && !b_has_component) {
      // Neither have components

      // Make a new component
      Component& new_component = components[++component_id_counter];
      new_component.id = component_id_counter;

      // Set both a and b nodes to have new component
      new_component.add_edge(a_id, b_id, w_i, i, node_to_component);

    } else if (a_has_component) {
      // If just a has subgraph add b as member of a's subgraph
      components[a_component_id_loc->second].add_edge(b_id, w_i, i,
                                                      node_to_component);
    } else {
      // If just b has a subgraph add a as member of b's subgraph
      components[b_component_id_loc->second].add_edge(a_id, w_i, i,
                                                      node_to_component);
    }

    const bool last_edge_at_strength = w_i != w[i + 1];
    if (last_edge_at_strength) {
      const int nodes_seen = node_to_component.size();
      const int num_components = components.size();

      IntegerVector ids(num_components);
      IntegerVector sizes(num_components);
      NumericVector densities(num_components);
      NumericVector total_strengths(num_components);
      IntegerVector first_edge(num_components);

      int step_num_triples = 0;
      int step_max_size = 0;
      double total_density = 0;
      int k = 0;
      for (const auto& component_itt : components) {
        const int Nv = component_itt.second.num_members();
        const double Ne = component_itt.second.num_edges();
        const double dens = Ne / double((Nv * (Nv - 1)) / 2);
        ids[k] = component_itt.first;
        sizes[k] = Nv;
        densities[k] = dens;
        total_strengths[k] = component_itt.second.total_edge_w / Ne;
        first_edge[k] = component_itt.second.edge_indices.front();
        total_density += dens;
        if (Nv > 2)
          step_num_triples++;
        if (Nv > step_max_size)
          step_max_size = Nv;
        k++;
      }
      strengths[step_i] = w_i;
      n_nodes_seen[step_i] = nodes_seen;
      n_edges[step_i] = i + 1;
      n_components[step_i] = num_components;
      n_triples[step_i] = step_num_triples;
      max_size[step_i] = step_max_size;
      rel_max_size[step_i] = double(step_max_size) / double(nodes_seen);
      avg_size[step_i] = double(nodes_seen) / double(num_components);
      avg_density[step_i] = total_density / double(num_components);
      step_component_info[step_i] = List::create(
          _["id"] = ids, _["size"] = sizes, _["density"] = densities,
          _["strength"] = total_strengths, _["first_edge"] = first_edge);

      step_i++;
    }
  }

  return List::create(
      _["step"] = seq_len(n_steps), _["n_edges"] = n_edges,
      _["strength"] = strengths, _["n_nodes_seen"] = n_nodes_seen,
      _["n_components"] = n_components, _["max_size"] = max_size,
      _["rel_max_size"] = rel_max_size, _["avg_size"] = avg_size,
      _["avg_density"] = avg_density, _["n_triples"] = n_triples,
      _["components"] = step_component_info);
}

/*** R
# library(associationsubgraphs)
data <- head(dplyr::arrange(virus_net, dplyr::desc(strength)), 1000)

res <- dplyr::as_tibble(find_components(data, w_col = "strength"))

res$components %>% purrr::pluck(5) %>% as_tibble()
*/
