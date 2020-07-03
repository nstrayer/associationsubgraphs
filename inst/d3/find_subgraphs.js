function find_subgraphs({
  nodes,
  edge_source,
  edge_target,
  edge_strength,
  n_edges,
  width,
  height,
}) {
  const stop_point = n_edges || edge_source.length;
  const subgraphs = new Map();
  const node_to_subgraph = new Map();
  const edges = Array.from({ length: stop_point });

  let subgraph_counter = 0;

  const get_subgraph_id = function (node_id) {
    const node_subgraph = node_to_subgraph.get(node_id);
    if (!node_subgraph) {
      const new_subgraph_id = subgraph_counter++;
      subgraphs.set(new_subgraph_id, [node_id]);
      node_to_subgraph.set(node_id, new_subgraph_id);
      return new_subgraph_id;
    } else {
      return node_subgraph;
    }
  };

  // Loop over each link in the data
  for (let i = 0; i < stop_point; i++) {
    const source = edge_source[i];
    const target = edge_target[i];

    // Grab each node's subgraph
    const source_subgraph_id = get_subgraph_id(source);
    const target_subgraph_id = get_subgraph_id(target);

    let edge_subgraph_id = source_subgraph_id;

    // Are both nodes in the same subgraph?
    const different_subgraphs = source_subgraph_id !== target_subgraph_id;

    if (different_subgraphs) {
      const source_subgraph = subgraphs.get(source_subgraph_id);
      const target_subgraph = subgraphs.get(target_subgraph_id);

      const source_subgraph_is_larger =
        source_subgraph.length > target_subgraph.length;

      const absorbing_subgraph_id = source_subgraph_is_larger
        ? source_subgraph_id
        : target_subgraph_id;
      const culled_subgraph_id = source_subgraph_is_larger
        ? target_subgraph_id
        : source_subgraph_id;

      const absorbing_subgraph = source_subgraph_is_larger
        ? source_subgraph
        : target_subgraph;
      const culled_subgraph = source_subgraph_is_larger
        ? target_subgraph
        : source_subgraph;

      // Move all nodes in the target subgraph to source subgraph
      culled_subgraph.forEach((n) => {
        node_to_subgraph.set(n, absorbing_subgraph_id);
        absorbing_subgraph.push(n);
      });

      edge_subgraph_id = absorbing_subgraph_id;

      // Delete the target subgraph
      subgraphs.delete(culled_subgraph_id);
    }

    edges[i] = {
      source,
      target,
      strength: edge_strength[i],
      subgraph: edge_subgraph_id,
    };
  }

  const n = subgraphs.size;
  const n_in_col = Math.ceil(Math.sqrt((n * width) / height));
  const n_in_row = Math.ceil(n / n_in_col);
  const get_x_pos = (i) => (width * (i % n_in_col)) / (n_in_col - 1);
  const get_y_pos = (i) => (height * Math.floor(i / n_in_col)) / (n_in_row - 1);
  let i = 0;
  const is_giant_component = subgraphs.size == 1;
  const subgraph_to_center = new Map();
  subgraphs.forEach(function (subgraph, subgraph_id) {
    subgraph_to_center.set(
      subgraph_id,
      is_giant_component
        ? { x: width / 2, y: height / 2 }
        : {
            x: get_x_pos(i),
            y: get_y_pos(i),
          }
    );

    i++;
  });

  const nodes_to_return = nodes.reduce((nodes_w_subgraph, node) => {
    const subgraph_id = node_to_subgraph.get(node.id);
    if (subgraph_id) {
      const subgraph_center = subgraph_to_center.get(subgraph_id);
      node.subgraph_id = subgraph_id;
      node.subgraph_x = subgraph_center.x;
      node.subgraph_y = subgraph_center.y;
      nodes_w_subgraph.push(node);
    }
    return nodes_w_subgraph;
  }, []);

  return { nodes: nodes_to_return, edges, subgraphs };
}
