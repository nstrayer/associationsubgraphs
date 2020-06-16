function find_subgraphs(nodes, edges){
  const subgraphs = new Map();
  nodes.forEach(node => {
    subgraphs.set(node.id, [node]);
    node.subgraph_id = node.id;
  });
  // Loop over each link in the data
  edges.forEach(({source, target}) => {
    // Grab each node
    const source_node = nodes.find(n => n.id == source);
    const target_node = nodes.find(n => n.id == target);

    // Are both nodes in the same subgraph?
    const different_subgraphs = source_node.subgraph_id !== target_node.subgraph_id;

    if(different_subgraphs){

      const source_subgraph = subgraphs.get(source_node.subgraph_id);
      const target_subgraph = subgraphs.get(target_node.subgraph_id);

      const source_subgraph_is_larger = source_subgraph.length > target_subgraph.length;

      const absorbing_subgraph_id = source_subgraph_is_larger ? source_node.subgraph_id : target_node.subgraph_id;
      const culled_subgraph_id = source_subgraph_is_larger ? target_node.subgraph_id : source_node.subgraph_id;

      const absorbing_subgraph = source_subgraph_is_larger ? source_subgraph : target_subgraph;
      const culled_subgraph = source_subgraph_is_larger ? target_subgraph : source_subgraph;

      // Move all nodes in the target subgraph to source subgraph
      culled_subgraph.forEach(n => {
        n.subgraph_id = absorbing_subgraph_id;
        absorbing_subgraph.push(n);
      });

      // Delete the target subgraph
      subgraphs.delete(culled_subgraph_id);
    }
  });
  return {nodes, subgraphs};
}
