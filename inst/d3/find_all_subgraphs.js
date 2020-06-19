function find_all_subgraphs(nodes, edges) {
  const Nv = nodes.length;
  const Ne = edges.length;
  let n_subgraphs = 0;
  const subgraph_membership = Uint32Array.from({ length: Nv });
  const subgraph_info = new Map();

  const id_to_index = new Map(nodes.map((node, i) => [node, i]));

  // Results arrays
  const results = {
    membership_vecs: [],
    cutoff_values: [],
    subgraph_stats: [],
    mergers: [],
  };

  for (let i = 0; i < Ne; i++) {
    const { a, b, strength } = edges[i];

    const a_index = id_to_index.get(a);
    const b_index = id_to_index.get(b);

    const a_subgraph = subgraph_membership[a_index];
    const b_subgraph = subgraph_membership[b_index];

    const a_has_subgraph = a_subgraph !== 0;
    const b_has_subgraph = b_subgraph !== 0;

    // Keep track of if this edge changed the status of out subgraphs
    // so we can dump the state after if it did
    let status_changed = true;

    // Neither have subgraphs
    if (!a_has_subgraph && !b_has_subgraph) {
      // Make a new subgraph id while incrementing the counter
      n_subgraphs++;
      let new_subgraph_id = n_subgraphs;

      subgraph_membership[a_index] = new_subgraph_id;
      subgraph_membership[b_index] = new_subgraph_id;

      // Build a new subgraph entry in subgraph info map with these nodes indices in it
      subgraph_info.set(new_subgraph_id, [a_index, b_index]);

      // One has a subgraph but the other doesnt
    } else if (
      (a_has_subgraph && !b_has_subgraph) ||
      (b_has_subgraph && !a_has_subgraph)
    ) {
      const index_wo_subgraph = a_has_subgraph ? b_index : a_index;
      const existing_subgraph = a_has_subgraph ? a_subgraph : b_subgraph;

      // Set subgraph membership of node without subgraph to existing subgraph
      subgraph_membership[index_wo_subgraph] = existing_subgraph;

      // Add subgraphless node to the existing subgraphs membership array
      subgraph_info.set(existing_subgraph, [
        ...subgraph_info.get(existing_subgraph),
        index_wo_subgraph,
      ]);

      // Both have subgraphs is only remaining option
      // If those subgraphs arent identical then we should make updates
    } else if (a_subgraph !== b_subgraph) {
      const a_subgraph_members = subgraph_info.get(a_subgraph);
      const b_subgraph_members = subgraph_info.get(b_subgraph);

      let larger_subgraph_members;
      let smaller_subgraph_members;
      let larger_subgraph;
      let smaller_subgraph;
      if (a_subgraph_members.length > b_subgraph_members.length) {
        larger_subgraph_members = a_subgraph_members;
        smaller_subgraph_members = b_subgraph_members;
        larger_subgraph = a_subgraph;
        smaller_subgraph = b_subgraph;
      } else {
        larger_subgraph_members = b_subgraph_members;
        smaller_subgraph_members = a_subgraph_members;
        larger_subgraph = b_subgraph;
        smaller_subgraph = a_subgraph;
      }

      results.mergers.push({
        step: results.membership_vecs.length + 1,
        smaller: smaller_subgraph,
        larger: larger_subgraph,
        smaller_n: smaller_subgraph_members.length,
        larger_n: larger_subgraph_members.length,
      });

      smaller_subgraph_members.forEach((member_index) => {
        subgraph_membership[member_index] = larger_subgraph;
        larger_subgraph_members.push(member_index);
      });

      // Remove smaller subgraph from the membership map
      subgraph_info.delete(smaller_subgraph);

      // Both nodes have subgraphs but those subgraphs are the same so no changes should be made
    } else {
      // Nothing to do
      status_changed = false;
    }

    // make sure we report the updates of a given merger for
    // multiple edges with same strength as one update
    const cutoff_has_changed =
      results.cutoff_values[results.cutoff_values.length - 1] != strength;

    if (status_changed && cutoff_has_changed) {
      results.membership_vecs.push(Uint32Array.from(subgraph_membership));
      results.cutoff_values.push(strength);

      const subgraph_to_size = [];
      subgraph_info.forEach((members, id) =>
        subgraph_to_size.push({ id, size: members.length })
      );
      results.subgraph_stats.push(subgraph_to_size);
    }
  } // end loop over edges

  return results;
}
