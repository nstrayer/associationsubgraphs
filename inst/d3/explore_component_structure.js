// !preview r2d3 data=list(nodes = dplyr::mutate(dplyr::rename(entropynet::virus_host_viruses, id = virus_id), color = ifelse(type == "RNA", "orangered", "steelblue")),edges = head(dplyr::arrange(entropynet::virus_net, -strength), 5000), structure = entropynet::virus_component_results), container = "div", dependencies = c("inst/d3/d3_helpers.js", "inst/d3/find_subgraphs.js"), d3_version = "5"

const margins = { left: 50, right: 50, top: 20, bottom: 10 };
const { canvas, context, svg, g, w, h } = setup_svg_canvas_overlap({
  div,
  width,
  height,
  margins,
});

const network_settings = {
  w,
  rel_h: 3,
};

const component_settings = {
  w,
  rel_h: 2,
  bar_color: "grey",
  selection_color: "black",
};

const timeline_settings = {
  padding: 5,
  margin_left: 85,
  background_color: "grey",
  background_alpha: 0.1,
  line_width: 1,
  line_color: "steelblue",
  w,
  rel_h: 2,
  callout_r: 3,
};

// Order of this vector decides order of placement
const all_settings = [network_settings, component_settings, timeline_settings];

const total_units = all_settings.reduce((sum, { rel_h }) => sum + rel_h, 0);
let current_h = 0;
all_settings.forEach((settings) => {
  settings.start_h = current_h;
  settings.h = h * (settings.rel_h / total_units);
  current_h += settings.h;
});

let default_step = 50;
const structure_data = HTMLWidgets.dataframeToD3(data.structure);

// =============================================================================
// Setup the g elements that hold the separate plots
// Setup and start the component charts;
const network_holder = g.append("g").classed("network_plot", true);

const components_holder = g
  .append("g")
  .classed("components_chart", true)
  .move_to({ y: component_settings.start_h })
  .call(add_background_rect, {
    ...component_settings,
    margins: { left: margins.left, right: margins.right },
  });

const div_shadow = "1px 1px 9px black";
const info_div = div
  .append("div")
  .style("background", "white")
  .style("position", "absolute")
  .style("left", 0)
  .style("width", `${width}px`)
  .style("height", `${h - network_settings.h - 5}px`)
  .style("top", `${component_settings.start_h + margins.top}px`)
  .style("box-shadow", div_shadow)
  .style("display", "none");

const tooltip_div = div
  .append("div")
  .style("width", "auto")
  .style("max-width", "40%")
  // .style("border", "1px solid black")
  .style("box-shadow", div_shadow)
  .style("padding-top", "6px")
  .style("background", "white")
  .style("position", "absolute")
  .style("display", "none");

const instructions = div
  .select_append("p.instructions")
  .style("font-style", "italic")
  .style("text-align", "right")
  .style("font-size", "0.9rem")
  .style("margin", "3px 5px")
  .style("position", "sticky")
  .style("top", "30px")
  .select_append("span")
  .style("background", "#ffffffc4")
  .style("border-radius", "5px");

// .text("Click a component in chart or network to see details.");
const set_instructions = function (focus_mode = false) {
  instructions.text(
    focus_mode
      ? "Click anywhere outside of component to exit focus view."
      : "Click a component in chart or network to see details."
  );
};

set_instructions();

// =============================================================================
// Initialize the plots themselves
let network_plot;
let component_plot;

// =============================================================================
// Setup the interaction behaviours between chart components
const info_panel_interactions = {
  node_mouseover: function (node) {
    network_plot.highlight_node(node);
  },
  node_mouseout: function () {
    network_plot.reset_node_highlights();
  },
};
let info_panel;
info_panel = setup_info_panel(info_div, info_panel_interactions);

const component_interactions = {
  click: function (component) {
    network_plot.focus_on_component(component.first_edge);
  },
  mouseover: function (component) {
    network_plot.highlight_component(component.first_edge);
  },
  mouseout: function (component) {
    network_plot.reset_highlights();
  },
};

const default_state = function () {
  if (info_panel) {
    info_panel.hide();
  }
  if (component_plot) {
    component_plot.show();
  }
  set_instructions();
};

const network_interactions = {
  click: function (component) {},
  mouseover: function (component) {
    component_plot.highlight_component(component.edge_indices);
  },
  mouseout: function (component) {
    component_plot.reset_highlights();
  },
  reset: function () {
    default_state();
  },
  focus: function (component) {
    info_panel.update(
      component,
      component_plot.info_for_component(component.edge_indices)
    );
    component_plot.hide();
    set_instructions(true);
  },
  node_mouseover: function (node) {
    info_panel.highlight_node(node.id);
  },
  node_mouseout: function (node) {
    info_panel.reset_highlights();
  },
};

function update_components_chart(step_i, update_network = false) {
  default_state();
  component_plot = draw_components_chart(components_holder, {
    components: structure_data[step_i].components,
    settings: component_settings,
    interaction_fns: component_interactions,
  });

  if (update_network) {
    network_plot = draw_network_plot(network_holder, {
      edge_vals: data.edges,
      n_edges: structure_data[step_i].n_edges,
      settings: network_settings,
      context,
      margins,
      interaction_fns: network_interactions,
      tooltip_div,
    });
  }
}

// Setup and start the timeline charts
g.append("g")
  .classed("timelines_chart", true)
  .move_to({ y: timeline_settings.start_h })
  .call(add_background_rect, {
    ...timeline_settings,
    margins: { left: margins.left, right: margins.right },
  })
  .call(draw_timelines, {
    data: structure_data,
    settings: timeline_settings,
    update_fn: update_components_chart,
  });

update_components_chart(default_step, true);

// =============================================================================
// Functions for drawing each section of the plots

function setup_info_panel(info_div, interaction_fns) {
  const non_column_keys = [
    "subgraph_id",
    "subgraph_x",
    "subgraph_y",
    "index",
    "x",
    "fx",
    "y",
    "fy",
    "vy",
    "vx",
    "color",
  ];

  info_div.style("overflow", "scroll").style("padding-top", "0.75rem");

  let info_table;
  let nodes_table;

  function update(component, component_info) {
    info_div.style("display", "block");
    info_table = table_from_obj(info_div, {
      data: [component_info],
      id: "component_info",
      keys_to_avoid: ["id", "first_edge"],
      alignment: "center",
      even_cols: true,
      title: `Component ${component_info.id} statistics`,
    });

    nodes_table = table_from_obj(info_div, {
      data: component.nodes,
      id: "nodes",
      keys_to_avoid: non_column_keys,
      title: "Nodes in component (hover to highlight in network plot)",
    })
      .on("mouseover", function (d) {
        reset_highlights();
        highlight_node(d.id);
        interaction_fns.node_mouseover(d);
      })
      .on("mouseout", function (d) {
        reset_highlights();
        interaction_fns.node_mouseout();
      });
  }

  function highlight_node(node_id) {
    nodes_table
      .filter((node) => node.id === node_id)
      .style("outline", "2px solid black")
      .call((node_row) => {
        node_row.node().scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
  }

  function reset_highlights() {
    nodes_table.style("outline", "none");
  }

  function hide() {
    info_div.style("display", "none");
  }

  hide();
  return { update, highlight_node, reset_highlights, hide };
}

function draw_network_plot(
  g,
  {
    edge_vals,
    n_edges,
    settings,
    context,
    margins,
    interaction_fns,
    tooltip_div,
  }
) {
  let focused_on = null;

  const { w, h, node_r = 3, focus_r = 6, alphaDecay = 0.01 } = settings;
  g.select_append("rect#zoom_detector")
    .attr("width", w + margins.left + margins.right)
    .attr("x", -margins.left)
    .attr("height", h + margins.top)
    .attr("y", -margins.top)
    .attr("fill", "white")
    .attr("fill-opacity", 0)
    .lower()
    .on("click", function () {
      reset();
    });

  const nodes_raw = HTMLWidgets.dataframeToD3(data.nodes);

  const { nodes, edges, node_to_subgraph } = find_subgraphs({
    nodes: nodes_raw,
    edge_source: edge_vals.a,
    edge_target: edge_vals.b,
    edge_strength: edge_vals.strength,
    n_edges,
    width: w,
    height: h,
  });

  const subgraph_to_nodes = {};
  nodes.forEach((node) => {
    if (!subgraph_to_nodes[node.subgraph_id]) {
      subgraph_to_nodes[node.subgraph_id] = [];
    }
    subgraph_to_nodes[node.subgraph_id].push(node);
  });

  const nodes_by_component = [];
  for (let subgraph_id in subgraph_to_nodes) {
    nodes_by_component.push({
      id: subgraph_id,
      nodes: subgraph_to_nodes[subgraph_id],
      edge_indices: edges
        .filter((e) => e.subgraph == subgraph_id)
        .map((e) => e.index),
    });
  }
  const edge_to_subgraph_id = function (edge_in_component) {
    return +edges[edge_in_component].subgraph;
  };

  edge_to_subgraph_data = function (edge_in_component) {
    const subgraph_id = edge_to_subgraph_id(edge_in_component);
    return nodes_by_component.find((d) => +d.id === subgraph_id);
  };

  const link_scale = d3.scaleLog().domain(d3.extent(edge_vals.strength));
  const link_dist = link_scale.copy().range([10, 1]);

  const link_color = link_scale.copy();
  const X_default = d3.scaleLinear().range([0, w]).domain([0, w]);
  const Y_default = d3.scaleLinear().range([0, h]).domain([0, h]);
  let X = X_default.copy();
  let Y = Y_default.copy();

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(edges)
        .id((d) => d.id)
        .distance((d) => link_dist(d.strength))
    )
    .force("charge", d3.forceManyBody())
    .force(
      "x",
      d3
        .forceX()
        .strength(0.25)
        .x((node) => node.subgraph_x)
    )
    .force(
      "y",
      d3
        .forceY()
        .strength(0.25)
        .y((node) => node.subgraph_y)
    )
    .alphaDecay(alphaDecay)
    .on("tick", ticked);

  const component_containers = g
    .attr("stroke", "#fff")
    .attr("stroke-width", node_r / 3)
    .selectAll("g.component")
    .data(nodes_by_component, (component) => component.id)
    .join((enter) => {
      const main_g = enter.append("g").attr("class", "component");
      main_g
        .append("rect")
        .attr("class", "bounding_rect")
        .attr("fill-opacity", 0)
        .attr("rx", 5)
        .attr("ry", 5);
      main_g.append("g").attr("class", "node_container");
      return main_g;
    })
    .on("mouseover", function (d) {
      if (!focused_on) {
        d3.select(this).call(show_bounding_box);
        interaction_fns.mouseover(d);
      }
    })
    .on("mouseout", function (d) {
      reset_component_highlights();
      interaction_fns.mouseout(d);
    })
    .on("click", function (d) {
      focus_on_component(d);
    })
    .on("dblclick", function () {
      if (focused_on) {
        reset();
      }
    });

  const all_nodes = component_containers
    .select("g.node_container")
    .selectAll("circle")
    .data(
      ({ nodes }) => nodes,
      (d) => d.id
    )
    .join((enter) =>
      enter
        .append("circle")
        .call((node_circle) => node_circle.append("title").text((d) => d.id))
    )
    .attr("r", node_r)
    .attr("fill", (d) => d.color || "steelblue")
    .on("mouseover", function (d) {
      if (focused_on) {
        highlight_node(d);
        interaction_fns.node_mouseover(d);
      }
    })
    .on("mouseout", function (d) {
      if (focused_on) {
        reset_node_highlights();
        interaction_fns.node_mouseout();
      }
    })
    .call(drag(simulation));

  function ticked() {
    update_edges();
    update_nodes();
  }

  function update_edges() {
    context.clearRect(0, 0, +canvas.attr("width"), +canvas.attr("height"));

    if (focused_on) {
      context.lineWidth = 2.5;
      nodes_by_component
        .find((c) => c.id === focused_on)
        .edge_indices.forEach((edge_i) => {
          const { source, target, strength } = edges[edge_i];
          context.beginPath();
          context.moveTo(X(source.x) + margins.left, Y(source.y) + margins.top);
          context.lineTo(X(target.x) + margins.left, Y(target.y) + margins.top);
          // Set color of edges
          context.strokeStyle = d3.interpolateReds(link_color(strength));
          context.stroke();
        });
    } else {
      // Scale edge opacity based upon how many edges we have
      context.globalAlpha = 0.5;
      context.lineWidth = 1;
      // Set color of edges
      context.strokeStyle = "#999";
      context.beginPath();
      edges.forEach((d) => {
        context.moveTo(
          X(d.source.x) + margins.left,
          Y(d.source.y) + margins.top
        );
        context.lineTo(
          X(d.target.x) + margins.left,
          Y(d.target.y) + margins.top
        );
      });

      // Draw to canvas
      context.stroke();
    }
  }

  function update_nodes() {
    all_nodes.attr("cx", (d) => X(d.x)).attr("cy", (d) => Y(d.y));
    // Update bounding rects for interaction purposes
    component_containers.each(function (d) {
      const pad = 5;

      const component_bbox = d3
        .select(this)
        .select("g.node_container")
        .node()
        .getBBox();

      d3.select(this)
        .select("rect.bounding_rect")
        .attr("width", component_bbox.width + pad * 2)
        .attr("height", component_bbox.height + pad * 2)
        .attr("x", component_bbox.x - pad)
        .attr("y", component_bbox.y - pad);
    });
  }

  function drag(simulation) {
    function dragstarted(d) {
      if (!d3.event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
  const zoom = d3.zoom().scaleExtent([0.5, 8]).on("zoom", zoomed);
  // We dont want the double click to work because double clicking is taken over
  // for de-selecting a component
  g.call(zoom).on("dblclick.zoom", null);

  function zoomed() {
    X = d3.event.transform.rescaleX(X_default.copy());
    Y = d3.event.transform.rescaleY(Y_default.copy());
    update_edges();
    update_nodes();
  }

  function show_bounding_box(component) {
    reset_component_highlights();
    component.select("rect.bounding_rect").attr("stroke", "black");
  }

  function highlight_component(edge_in_component) {
    component_containers
      .filter((d) => +d.id === edge_to_subgraph_id(edge_in_component))
      .call(show_bounding_box);
  }

  function reset_component_highlights() {
    component_containers.select("rect.bounding_rect").attr("stroke", "white");
  }

  function reset() {
    g.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    all_nodes.transition().duration(750).attr("r", node_r);

    reset_component_highlights();
    interaction_fns.reset();
    component_containers.attr("opacity", 1);

    focused_on = null;
  }

  function focus_on_component(component) {
    interaction_fns.focus(component);

    const nodes_in_component = component.nodes;

    const [x_min, x_max] = d3.extent(nodes_in_component, (n) => n.x);
    const [y_min, y_max] = d3.extent(nodes_in_component, (n) => n.y);

    g.transition()
      .duration(750)
      .call(
        zoom.transform,
        d3.zoomIdentity
          .translate(w / 2, h / 2)
          .scale(
            Math.min(
              8,
              0.7 / Math.max((x_max - x_min) / w, (y_max - y_min) / h)
            )
          )
          .translate(-(x_max + x_min) / 2, -(y_max + y_min) / 2)
      );

    component_containers
      .filter((c) => c.id === component.id)
      .selectAll("circle")
      .transition()
      .duration(750)
      .attr("r", focus_r);

    component_containers
      .filter((c) => c.id !== component.id)
      .attr("opacity", 0);

    link_color.domain(
      d3.extent(component.edge_indices, (i) => edge_vals.strength[i])
    );

    focused_on = component.id;
  }

  function highlight_node(node) {
    const n_neighbors = 5;
    all_nodes.filter((n) => n.id == node.id).attr("r", focus_r * 2);

    const neighbors = edges
      .filter((edge) => edge.source === node || edge.target === node)
      .map(({ source, target, strength }) => ({
        neighbor: source == node ? target.id : source.id,
        strength,
      }))
      .sort((a, b) => b.strength - a.strength)
      .filter((d, i) => i < n_neighbors);

    tooltip_div
      .style("display", "block")
      .style("top", Y(node.y))
      .style("left", X(node.x))
      .call(table_from_obj, {
        data: neighbors,
        id: "tooltip",
        keys_to_avoid: ["id", "first_edge"],
        even_cols: true,
        title: `Top ${neighbors.length} Neighbors`,
        max_width: "95%",
      });
  }

  function reset_node_highlights(radius = focus_r) {
    all_nodes.attr("r", radius);
    tooltip_div.style("display", "none");
  }

  return {
    highlight_component,
    reset_highlights: reset_component_highlights,
    focus_on_component: (edge_id) =>
      focus_on_component(edge_to_subgraph_data(edge_id)),
    highlight_node,
    reset_node_highlights,
    reset,
  };
}

function draw_components_chart(g, { components, settings, interaction_fns }) {
  const {
    w,
    h,
    bar_color,
    selection_color,
    padding = 3,
    strength_r = 4,
    units = {
      size: 2,
      density: 1,
      strength: 2,
    },
  } = settings;

  const total_units = Object.values(units).reduce((tot, u) => tot + u, 0);
  const total_h = h - padding * 2;

  const sizes = {};
  for (let measure in units) {
    sizes[measure] = (total_h * units[measure]) / total_units;
  }
  const components_df = HTMLWidgets.dataframeToD3(components).sort(
    (c_a, c_b) => c_b.size - c_a.size
  );

  const X = d3
    .scaleBand()
    .domain(components_df.map((d) => d.id))
    .range([0, w])
    .paddingInner(0.03);

  const component_w = X.bandwidth();

  const sizes_Y = d3
    .scaleLinear()
    .domain([0, d3.max(components.size)])
    .range([sizes.size, 0]);

  const densities_Y = d3
    .scaleLinear()
    .domain(d3.extent(components.density))
    .range([sizes.density, 0]);

  const strengths_Y = d3
    .scaleLinear()
    .domain([0, d3.max(components.strength)])
    .range([0, sizes.strength - strength_r]);

  const setup_new_subgraph_g = function (enter) {
    const main_g = enter.append("g");

    // We have a size bar
    main_g.append("rect").classed("size_bar", true);

    // We hav a two rectangle density g element in the middle
    const density_g = main_g.append("g").classed("density_chart", true);
    density_g.append("rect").classed("background", true);
    density_g.append("rect").classed("density_fill", true);

    // Finally we have a lollypop plot for strength on bottom
    const strength_g = main_g.append("g").classed("strength_lollypop", true);
    strength_g.append("line").classed("lollypop_stick", true);
    strength_g.append("circle").classed("lollypop_head", true);

    // Place an invisible rectangle over the entire element space to make interactions more responsive
    main_g
      .append("rect")
      .classed("interaction_rect", true)
      .attr("stroke", selection_color)
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("stroke-width", 0)
      .attr("fill-opacity", 0);

    return main_g;
  };

  const component_g = g
    .selectAll("g.component_stats")
    .data(components_df)
    .join(
      setup_new_subgraph_g,
      (update) => update,
      (exit) => exit.attr("opacity", 0).remove()
    )
    .classed("component_stats", true)
    .on("mouseover", function (d) {
      d3.select(this).call(emphasize_component);
      interaction_fns.mouseover(d);
    })
    .on("mouseout", function (d) {
      reset_highlights();
      interaction_fns.mouseout(d);
    })
    .on("click", function (d) {
      reset_highlights();
      interaction_fns.click(d);
    });

  const v_pad = 5; // padding added to top of selection rectangle
  component_g
    .select("rect.interaction_rect")
    .attr("width", component_w)
    .attr("height", h + v_pad)
    .attr("y", -v_pad);

  component_g
    .attr("stroke", "black")
    .transition()
    .duration(100)
    .attr("transform", (d) => `translate(${X(d.id)}, 0)`);

  component_g
    .select("rect.size_bar")
    .attr("width", component_w)
    .attr("y", (d) => sizes_Y(d.size))
    .attr("height", (d) => sizes.size - sizes_Y(d.size))
    .attr("fill", bar_color);

  const density_g = component_g
    .select("g.density_chart")
    .move_to({ y: sizes.size + padding });

  density_g
    .select("rect.background")
    .attr("height", sizes.density)
    .attr("width", component_w)
    .attr("fill", "grey")
    .attr("fill-opacity", 0.5);

  density_g
    .select("rect.density_fill")
    .attr("y", (d) => densities_Y(d.density))
    .attr("height", (d) => sizes.density - densities_Y(d.density))
    .attr("width", component_w)
    .attr("fill", bar_color);

  const strength_g = component_g
    .select("g.strength_lollypop")
    .move_to({ y: total_h - sizes.strength + padding * 2 });

  strength_g
    .select("line")
    .attr("y1", (d) => strengths_Y(d.strength))
    .attr("x1", component_w / 2)
    .attr("x2", component_w / 2)
    .attr("stroke", bar_color)
    .attr("stroke-width", 1);

  strength_g
    .select("circle")
    .attr("cy", (d) => strengths_Y(d.strength))
    .attr("cx", component_w / 2)
    .attr("r", strength_r)
    .attr("fill", bar_color);
  reset_highlights();
  g.select_append("g.size_axis")
    .call(d3.axisLeft(sizes_Y).ticks(sizes_Y.domain()[1]))
    .call(extend_ticks, w, 0.4)
    .call(remove_domain)
    .call((g) => g.selectAll("text").remove());

  g.select_append("g.strength_axis")
    .attr(
      "transform",
      `translate(0, ${sizes.size + sizes.density + 2 * padding})`
    )
    .call(d3.axisLeft(strengths_Y).ticks(2));

  function emphasize_component(component_g) {
    reset_highlights();
    component_g.attr("stroke-width", 2.5);
  }
  function reset_highlights() {
    component_g.attr("stroke-width", 1);
  }

  function highlight_component(edge_indices) {
    component_g
      .filter((c) => edge_indices.includes(c.first_edge))
      .call(emphasize_component);
  }

  function info_for_component(edge_indices) {
    return components_df.find((c) => edge_indices.includes(c.first_edge));
  }

  function hide() {
    g.attr("opacity", 0);
  }
  function show() {
    g.attr("opacity", 1);
  }

  return {
    highlight_component,
    info_for_component,
    reset_highlights,
    hide,
    show,
  };
}

function draw_timelines(
  timeline_g,
  { data, settings, update_fn: on_new_step }
) {
  const { w, h } = settings;

  const non_metric_keys = [
    "step",
    "components",
    "n_edges",
    "max_size",
    "n_nodes_seen",
  ];
  const all_metrics = Object.keys(data[0]).filter(
    (key) => !non_metric_keys.includes(key)
  );

  const chart_h = h / all_metrics.length;
  const chart_w = w - settings.margin_left;
  const X = d3.scaleLinear().domain([0, data.length]).range([0, chart_w]);

  const step_metrics = all_metrics.map((metric_id, i) => {
    let integer_valued = true;
    for (let i = 0; i < 15; i++) {
      if (not_integer(data[i][metric_id])) {
        integer_valued = false;
        break;
      }
    }

    const metric = {
      id: metric_id,
      max: 0,
      values: (integer_valued ? Int32Array : Float32Array).from({
        length: data.length,
      }),
      Y: d3.scaleLinear().range([chart_h - settings.padding, settings.padding]),
      X,
      is_integer: integer_valued,
    };

    data.forEach((step, i) => {
      const current_val = step[metric_id];
      metric.max = Math.max(metric.max, current_val);
      metric.values[i] = current_val;
    });

    metric.Y.domain([0, metric.max]).nice();

    metric.path = d3
      .line()
      .curve(d3.curveStep)
      .x((d, i) => X(i))
      .y((d) => metric.Y(d))(metric.values);

    return metric;
  });

  timeline_g
    .selectAll("g.charts")
    .data(step_metrics)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * chart_h})`)
    .attr("height", chart_h)
    .attr("width", chart_w)
    .each(function (d, i) {
      draw_metric_line({ g: d3.select(this), d, settings });
    });

  const pinned_step_line = timeline_g
    .select_append("line.pinned_step")
    .attr("y1", settings.padding)
    .attr("y2", h - settings.padding)
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  const callout_line = timeline_g
    .append("line")
    .attr("y1", settings.padding)
    .attr("y2", h - settings.padding)
    .attr("stroke", "grey")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  timeline_g
    .append("rect")
    .attr("id", "interaction_rect")
    .attr("width", chart_w)
    .attr("height", h)
    .attr("fill", "forestgreen")
    .attr("fill-opacity", 0)
    .on("mousemove", on_mousemove)
    .on("mouseout", on_mouseout)
    .on("click", on_click);

  const move_callouts = ({ mouse_pos, step_i, pin = false }) => {
    const x_pos = mouse_pos ? mouse_pos[0] : X(step_i);
    const step = step_i | Math.round(X.invert(x_pos));

    if (pin) {
      default_step = step;
      pinned_step_line.move_to({ x: x_pos });
    }
    callout_line.move_to({ x: x_pos });
    step_metrics.forEach((m) => m.set_callout(step));
    on_new_step(step, pin);
  };

  move_callouts({ step_i: default_step, pin: true });

  function on_mousemove() {
    move_callouts({ mouse_pos: d3.mouse(this) });
  }
  function on_mouseout() {
    move_callouts({ step_i: default_step });
  }
  function on_click() {
    move_callouts({ mouse_pos: d3.mouse(this), pin: true });
  }
  function draw_metric_line({ g, d, settings }) {
    const { X, Y } = d;
    const {
      background_color,
      background_alpha,
      line_color,
      line_width,
      padding,
      callout_r,
    } = settings;
    const chart_hight = +g.attr("height");
    const chart_width = +g.attr("width");

    g.append("rect")
      .attr("width", chart_width)
      .attr("height", chart_hight - 2 * padding)
      .attr("y", padding)
      .attr("fill", background_color)
      .attr("fill-opacity", background_alpha);

    g.append("text")
      // .attr("text-anchor", "end")
      .attr("x", chart_width + 4)
      .attr("y", chart_hight / 2)
      .attr("dominant-baseline", "middle")
      .text(d.id.replace(/_/g, " "));

    g.append("g")
      .call(d3.axisLeft(Y).ticks(2))
      .call(extend_ticks, chart_width)
      .call(remove_domain);

    g.append("path")
      .attr("d", d.path)
      .attr("fill", "none")
      .attr("stroke-width", line_width)
      .attr("stroke", line_color);

    // A hidden callout for values revealed on mouseover
    const callout = g.append("g").attr("id", `${d.id}-callout`);

    const callout_background = callout
      .append("rect")
      .attr("fill", "white")
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("filter", "url(#blur_filter)");

    callout
      .append("circle")
      .attr("r", callout_r)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 1);

    const callout_text = callout
      .append("text")
      .attr("x", callout_r)
      .attr("y", callout_r);

    d.set_callout = function (step_i) {
      const x_pos = X(step_i);
      const past_halfway = x_pos > w / 2;
      const value_at_step = d.values[step_i];

      callout
        .attr("visibility", "visible")
        .move_to({ x: x_pos, y: Y(value_at_step) });

      callout_text
        .text(d3.format(d.is_integer ? ",i" : ".3f")(d.values[step_i]))
        .attr("text-anchor", past_halfway ? "end" : "start")
        .attr("x", past_halfway ? -10 : 10);

      const text_bbox = callout_text.node().getBBox();
      const pad = 3;
      callout_background
        .attr("width", text_bbox.width + pad * 2)
        .attr("height", text_bbox.height)
        .attr("x", text_bbox.x - pad)
        .attr("y", text_bbox.y);
    };

    d.hide_callout = function () {
      callout.attr("visibility", "hidden");
    };
    d.hide_callout();
  }
}
