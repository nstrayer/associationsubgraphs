#include <Rcpp.h>

#include <list>
#include <map>

using namespace Rcpp;

using Node_to_Subgraph = std::map<String, int>;

class Subgraph {
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
                Node_to_Subgraph& node_subgraph_ids) {
    add_member(a_id, node_subgraph_ids);
    add_member(b_id, node_subgraph_ids);
    update_edges(w_i, edge_i);
  }

  void add_edge(const String& member_id,
                const double& w_i,
                const int edge_i,
                Node_to_Subgraph& node_subgraph_ids) {
    add_member(member_id, node_subgraph_ids);
    update_edges(w_i, edge_i);
  }

  void add_edge(const double& w_i, const int edge_i) {
    update_edges(w_i, edge_i);
  }

 private:
  void add_member(const String& member_id,
                  Node_to_Subgraph& node_subgraph_ids) {
    members.push_back(member_id);
    node_subgraph_ids[member_id] = id;
  }

  void update_edges(const double& edge_weight, const int edge_index) {
    total_edge_w += edge_weight;
    edge_indices.push_back(edge_index);
  }
};

inline void merge_subgraphs(Subgraph& C_a,
                            Subgraph& C_b,
                            const double& w_i,
                            const int edge_i,
                            Node_to_Subgraph& node_subgraph_ids,
                            std::map<int, Subgraph>& all_subgraphs) {
  const bool a_is_larger = C_a.num_members() > C_b.num_members();

  Subgraph& C_small = a_is_larger ? C_b : C_a;
  Subgraph& C_large = a_is_larger ? C_a : C_b;

  // Set all members of the smaller subgraph to have this subgraphs id
  for (const auto& member_id : C_small.members) {
    node_subgraph_ids[member_id] = C_large.id;
  }

  // Merge the members and edge lists of the two subgraphs
  C_large.members.splice(C_large.members.end(), C_small.members);
  C_large.edge_indices.splice(C_large.edge_indices.end(), C_small.edge_indices);
  C_large.total_edge_w += C_small.total_edge_w;

  // // We always absorb when an edge is added so add it here
  C_large.add_edge(w_i, edge_i);

  // Tell the subgraphs map to get rid of the smaller subgraph
  all_subgraphs.erase(all_subgraphs.find(C_small.id));
}

//' Find all subgraphs in pairs for every subset of edges (c++ version)
//'
//' Given a dataframe of edges with strength between nodes this function returns
//' info on every subgraph state achieved by adding nodes in one-at-a-time in
//' descending order of strength.
//'
//' @param associations Dataframe of association between two ids with a strength
//' @param a_col,b_col Names of columns that store the id's for the association pair
//' @param w_col Name of the column storing the strength of association
//' @param return_subgraph_membership Should an integer matrix of the subgraph
//'   membership for all nodes at all step be returned? This can be useful for
//'   comparing consistency of structure across different networks etc. but
//'   comes at the cost of speed and memory usage. This will also cause the
//'   algorithm to terminate after all nodes are merged into a giant component.
//'   This is to avoid execcessive memory usage.
//' @export
// [[Rcpp::export]]
List calculate_subgraph_structure_rcpp(
    DataFrame associations,
    const String& a_col = "a",
    const String& b_col = "b",
    const String& w_col = "w",
    const bool return_subgraph_membership = false) {

  CharacterVector a = associations[a_col];
  CharacterVector b = associations[b_col];
  NumericVector w = associations[w_col];

  const int total_num_edges = a.length();

  // Do a very quick sanity check to make sure the weight vector is sorted.
  // I have been bitten by this too many times to count. This is not comprehensive but
  // the assumption is if a vector is sorted for the first 100 elements its sorted...
  for (int i = 1; i < std::min(100, total_num_edges); i++) {
    if(w[i] > w[0]){
      stop("Your edges don't appear to be in largest-to-smallest order. The algorithm requires them to be sorted.");
    }
  }

  // We only want to record a step for each unique weight
  NumericVector unique_w = unique(w);
  const int n_steps = unique_w.length();

  // Vectors we will return as df columns
  IntegerVector n_subgraphs(n_steps);
  IntegerVector n_triples(n_steps);
  IntegerVector num_nodes_seen_at_step(n_steps);
  IntegerVector n_edges(n_steps);
  NumericVector strengths(n_steps);
  NumericVector avg_size(n_steps);
  IntegerVector max_size(n_steps);
  NumericVector rel_max_size(n_steps);
  NumericVector avg_density(n_steps);
  NumericVector density_score(n_steps);
  List step_subgraph_info(n_steps);

  // Dont waste allocated space for memberships if we're not returning them
  List step_subgraph_memberships(return_subgraph_membership ? n_steps : 0);

  // If we're returning the subgraph membership vectors we need to know all nodes present
  // before running anything so we can know how long the membership vector needs to be
  CharacterVector all_nodes = return_subgraph_membership
                                  ? union_(unique(a), unique(b))
                                  : CharacterVector(0);

  std::map<int, Subgraph> subgraphs;
  Node_to_Subgraph node_to_subgraph;
  int subgraph_id_counter = 0;
  int step_i = 0;


  for (int i = 0; i < total_num_edges; i++) {
    const double w_i = w[i];

    const String& a_id = a[i];
    const String& b_id = b[i];
    const auto a_subgraph_id_loc = node_to_subgraph.find(a_id);
    const auto b_subgraph_id_loc = node_to_subgraph.find(b_id);

    const bool a_has_subgraph = a_subgraph_id_loc != node_to_subgraph.end();
    const bool b_has_subgraph = b_subgraph_id_loc != node_to_subgraph.end();

    if (a_has_subgraph && b_has_subgraph) {
      // Both have subgraphs
      const int a_subgraph_id = a_subgraph_id_loc->second;
      const int b_subgraph_id = b_subgraph_id_loc->second;

      // Are they the same subgraph?
      const bool different_subgraph = a_subgraph_id != b_subgraph_id;

      if (different_subgraph) {
        // Merge the smaller subgraph's members into largers
        merge_subgraphs(subgraphs[a_subgraph_id], subgraphs[b_subgraph_id], w_i,
                        i, node_to_subgraph, subgraphs);

      } else {
        // Already in subgraph so just add an edge
        subgraphs[a_subgraph_id].add_edge(w_i, i);
      }
    } else if (!a_has_subgraph && !b_has_subgraph) {
      // Neither have subgraphs

      // Make a new subgraph
      Subgraph& new_subgraph = subgraphs[++subgraph_id_counter];
      new_subgraph.id = subgraph_id_counter;

      // Set both a and b nodes to have new subgraph
      new_subgraph.add_edge(a_id, b_id, w_i, i, node_to_subgraph);

    } else if (a_has_subgraph) {
      // If just a has subgraph add b as member of a's subgraph
      subgraphs[a_subgraph_id_loc->second].add_edge(b_id, w_i, i,
                                                    node_to_subgraph);
    } else {
      // If just b has a subgraph add a as member of b's subgraph
      subgraphs[b_subgraph_id_loc->second].add_edge(a_id, w_i, i,
                                                    node_to_subgraph);
    }

    // Note that this works to pick up the last edge as a defined value doesn't
    // equal the undefined one pointed to by one beyond range of vector
    const bool last_edge_at_strength = w_i != w[i + 1];

    if (last_edge_at_strength) {
      const int num_nodes_seen = node_to_subgraph.size();
      const int num_subgraphs = subgraphs.size();

      IntegerVector ids(num_subgraphs);
      IntegerVector sizes(num_subgraphs);
      NumericVector densities(num_subgraphs);
      NumericVector total_strengths(num_subgraphs);
      IntegerVector first_edge(num_subgraphs);

      int step_num_triples = 0;
      int step_max_size = 0;
      double total_density = 0;
      int k = 0;
      for (const auto& subgraph_itt : subgraphs) {
        const int Nv = subgraph_itt.second.num_members();
        const double Ne = subgraph_itt.second.num_edges();
        const double dens = Ne / double((Nv * (Nv - 1)) / 2);
        ids[k] = subgraph_itt.first;
        sizes[k] = Nv;
        densities[k] = dens;
        total_strengths[k] = subgraph_itt.second.total_edge_w / Ne;
        first_edge[k] = subgraph_itt.second.edge_indices.front();
        total_density += dens;
        if (Nv > 2)
          step_num_triples++;
        if (Nv > step_max_size)
          step_max_size = Nv;
        k++;
      }

      strengths[step_i] = w_i;
      num_nodes_seen_at_step[step_i] = num_nodes_seen;
      n_edges[step_i] = i + 1;
      n_subgraphs[step_i] = num_subgraphs;
      n_triples[step_i] = step_num_triples;
      max_size[step_i] = step_max_size;
      rel_max_size[step_i] = double(step_max_size) / double(num_nodes_seen);
      avg_size[step_i] = double(num_nodes_seen) / double(num_subgraphs);
      avg_density[step_i] = total_density / double(num_subgraphs);
      step_subgraph_info[step_i] = List::create(
          _["id"] = ids, _["size"] = sizes, _["density"] = densities,
          _["strength"] = total_strengths, _["first_edge"] = first_edge);

      if (return_subgraph_membership) {
        // We store our memberships in a vector returned for each step
        IntegerVector subgraph_memberships(all_nodes.length());

        // If no membership is available, we give the node a unique negative
        // integer This allows us to easily test what nodes are yet to be
        // clustered (subgraph_id < 0) While also letting us keep node info
        // separate so we don't accidentally confuse every node that isn't
        // clustered as in the same giant subgraph.
        int non_subgraphed_counter = -1;
        for (int node_index = 0; node_index < all_nodes.length(); node_index++) {

          // Check node's subgraph status to decide how to fill membership id
          auto node_membership = node_to_subgraph.find(all_nodes[node_index]);

          // Either the node has been assigned a subgraph so we can use that or
          // we use the negative integer format
          subgraph_memberships[node_index] = node_membership != node_to_subgraph.end()
            ? node_membership->second
            : non_subgraphed_counter--;
        }
        step_subgraph_memberships[step_i] = subgraph_memberships;

        // Very often we'll reach a stage were every node has been connected and
        // we have a single giant component but we're still adding edges. In this
        // case we'd be wasting a lot of flops querying every node's membership in
        // the map. Since adding edges wont change membership we don't need to worry
        // about modifying the membership matrix row because it will already have the
        // same integer (0) for all nodes.
        const bool all_nodes_seen = num_nodes_seen == all_nodes.length();
        const bool only_one_subgraph = num_subgraphs == 1;
        if(all_nodes_seen & only_one_subgraph){
          Rcout << "Exiting subgraph algorithm early as all members belong to same subgraph\nThere are " << (a.length() - i) << " remaining un-added edges.\n";
          break;
        }
      }

     // Wrap up step by incrementing step counter and move on
     step_i++;

    } // End step finishing conditional
  } // End loop over all edges

  List to_return =
      List::create(_["step"] = seq_len(n_steps), _["n_edges"] = n_edges,
                   _["strength"] = strengths, _["n_nodes_seen"] = num_nodes_seen_at_step,
                   _["n_subgraphs"] = n_subgraphs, _["max_size"] = max_size,
                   _["rel_max_size"] = rel_max_size, _["avg_size"] = avg_size,
                   _["avg_density"] = avg_density, _["n_triples"] = n_triples,
                   _["subgraphs"] = step_subgraph_info);

  if (return_subgraph_membership) {

    to_return["subgraph_memberships"] = step_subgraph_memberships;

    // We need to know what position in each membership vector corresponds to what nodes
    to_return["subgraph_membership_ids"] = all_nodes;
  }

  return to_return;
}

/*** R
# library(associationsubgraphs)
data <- head(dplyr::arrange(virus_net, dplyr::desc(strength)), 1000)

res <- calculate_subgraph_structure_rcpp(data, w_col = "strength", return_subgraph_membership = TRUE)
*/
