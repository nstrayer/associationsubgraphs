function find_components({
  nodes,
  edge_source,
  edge_target,
  edge_strength,
  n_edges,
  width,
  height,
}) {
  const stop_point = n_edges || edge_source.length;
  const components = new Map();
  const node_to_component = new Map();

  let component_counter = 0;

  const get_component_id = function (node_id) {
    const node_component = node_to_component.get(node_id);
    if (!node_component) {
      const new_component_id = component_counter++;
      components.set(new_component_id, [node_id]);
      node_to_component.set(node_id, new_component_id);
      return new_component_id;
    } else {
      return node_component;
    }
  };

  // Loop over each link in the data
  for (let i = 0; i < stop_point; i++) {
    const source = edge_source[i];
    const target = edge_target[i];

    // Grab each node's component
    const source_component_id = get_component_id(source);
    const target_component_id = get_component_id(target);

    let edge_component_id = source_component_id;

    // Are both nodes in the same component?
    const different_components = source_component_id !== target_component_id;

    if (different_components) {
      const source_component = components.get(source_component_id);
      const target_component = components.get(target_component_id);

      const source_component_is_larger =
        source_component.length > target_component.length;

      const absorbing_component_id = source_component_is_larger
        ? source_component_id
        : target_component_id;
      const culled_component_id = source_component_is_larger
        ? target_component_id
        : source_component_id;

      const absorbing_component = source_component_is_larger
        ? source_component
        : target_component;
      const culled_component = source_component_is_larger
        ? target_component
        : source_component;

      // Move all nodes in the target component to source component
      culled_component.forEach((n) => {
        node_to_component.set(n, absorbing_component_id);
        absorbing_component.push(n);
      });

      edge_component_id = absorbing_component_id;

      // Delete the target component
      components.delete(culled_component_id);
    }
  }

  const component_to_edges = {};
  const add_to_obj_arr = function (obj, key, val) {
    if (!obj[key]) {
      obj[key] = [];
    }
    obj[key].push(val);
  };
  const edges = Array.from({ length: stop_point }).map((_, i) => {
    const source = edge_source[i];
    const target = edge_target[i];
    const component_id = node_to_component.get(source);
    add_to_obj_arr(component_to_edges, component_id, i);

    return {
      source,
      target,
      strength: edge_strength[i],
      component: component_id,
      index: i,
    };
  });

  const n = components.size;
  const n_in_col = Math.ceil(Math.sqrt((n * width) / height));
  const n_in_row = Math.ceil(n / n_in_col);
  const x_gap = width / Math.min(n_in_col, n);
  const y_gap = height / Math.min(n_in_row, n);
  const get_x_pos = (i) => (i % n_in_col) * x_gap + x_gap / 2;
  const get_y_pos = (i) => Math.floor(i / n_in_col) * y_gap + y_gap / 2;
  let i = 0;
  const is_giant_component = components.size == 1;
  const component_to_center = new Map();
  components.forEach(function (component, component_id) {
    component_to_center.set(
      component_id,
      is_giant_component
        ? { x: width / 2, y: height / 2 }
        : {
            x: get_x_pos(i),
            y: get_y_pos(i),
          }
    );

    i++;
  });

  const component_to_nodes = {};
  const nodes_w_component = [];
  nodes.forEach((node) => {
    const component_id = node_to_component.get(node.id);
    if (component_id) {
      const component_center = component_to_center.get(component_id);
      node.component_id = component_id;
      node.component_x = component_center.x;
      node.component_y = component_center.y;
      nodes_w_component.push(node);
      add_to_obj_arr(component_to_nodes, component_id, node);
    }
  });

  const nodes_by_component = [];
  for (let component_id in component_to_nodes) {
    nodes_by_component.push({
      id: +component_id,
      nodes: component_to_nodes[component_id],
      edge_indices: component_to_edges[component_id],
    });
  }

  return {
    nodes: nodes_w_component,
    nodes_by_component,
    edges,
    components,
  };
}
