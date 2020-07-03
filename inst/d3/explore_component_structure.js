// !preview r2d3 data=list(nodes = dplyr::mutate(dplyr::rename(entropynet::virus_host_viruses, id = virus_id), color = ifelse(type == "RNA", "orangered", "steelblue")),edges = head(dplyr::arrange(entropynet::virus_net, -strength), 5000), structure = entropynet::virus_component_results), container = "div", dependencies = c("inst/d3/d3_helpers.js", "inst/d3/find_subgraphs.js"), d3_version = "5"

const margins = { left: 30, right: 10, top: 20, bottom: 10 };
const { canvas, context, svg, g, w, h } = setup_svg_canvas_overlap({
  div,
  width,
  height,
  margins,
});

const network_settings = {
  w,
  rel_h: 3,
  padding: 50,
};

const component_settings = {
  w,
  rel_h: 2,
  bar_color: "grey",
  selection_color: "green",
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
const components_holder = g
  .append("g")
  .classed("components_chart", true)
  .move_to({ y: component_settings.start_h });

const timelines_holder = g
  .append("g")
  .classed("timelines_chart", true)
  .move_to({ y: timeline_settings.start_h });

const network_holder = g.append("g").classed("network_plot", true);

// =============================================================================
// Initialize the plots themselves
let network_plot;
let component_plot;

const component_interactions = {
  click: function (component) {
    console.log("clicked!");
  },
  mouseover: function (component) {
    network_plot.highlight_component(component.first_edge);
  },
  mouseout: function (component) {
    network_plot.reset_highlights();
  },
};

const network_interactions = {
  click: function (component) {
    // component_plot.highlight_component(component.edge_indices);
  },
  mouseover: function (component) {
    component_plot.highlight_component(component.edge_indices);
  },
  mouseout: function (component) {
    component_plot.reset_highlights();
  },
};

const update_components_chart = function (step_i, update_network = false) {
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
    });
  }
};

update_components_chart(default_step, true);

// Setup and start the timeline charts
timelines_holder.call(
  draw_timelines,
  structure_data,
  timeline_settings,
  update_components_chart
);

// =============================================================================
// Functions for drawing each section of the plots

function draw_network_plot(
  g,
  { edge_vals, n_edges, settings, context, margins, interaction_fns }
) {
  const { w, h, padding, node_r = 3, alphaDecay = 0.01 } = settings;
  g.call(d3.zoom().on("zoom", zoomed));

  const nodes_raw = HTMLWidgets.dataframeToD3(data.nodes);

  const { nodes, edges, node_to_subgraph } = find_subgraphs({
    nodes: nodes_raw,
    edge_source: edge_vals.a,
    edge_target: edge_vals.b,
    edge_strength: edge_vals.strength,
    n_edges,
    width: w - padding * 2,
    height: h - padding * 2,
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

  const link_dist = d3
    .scaleLog()
    .domain(d3.extent(edge_vals.strength))
    .range([10, 1]);

  let X = d3.scaleLinear().range([0, w]).domain([0, w]);
  let Y = d3.scaleLinear().range([0, h]).domain([0, h]);
  const x_pos = (x) => X(x) + padding;
  const y_pos = (y) => Y(y) + padding;

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
    .selectAll("g")
    .data(nodes_by_component)
    .join((enter) => {
      const main_g = enter.append("g").attr("id", (d) => d.id);

      main_g.append("g").attr("class", "node_container");

      main_g
        .append("rect")
        .attr("class", "bounding_rect")
        .attr("fill-opacity", 0);

      return main_g;
    })
    .attr("id", (d) => d.id);

  const bounding_rects = component_containers
    .select("rect.bounding_rect")
    .call(setup_interactions, interaction_fns);

  const all_nodes = component_containers
    .select("g.node_container")
    .selectAll("circle")
    .data((component) => component.nodes)
    .join("circle")
    .attr("r", node_r)
    .attr("fill", (d) => d.color || "steelblue")
    .call(drag(simulation));

  function ticked() {
    update_edges();
    update_nodes();
  }

  function update_edges() {
    context.clearRect(0, 0, +canvas.attr("width"), +canvas.attr("height"));

    // Scale edge opacity based upon how many edges we have
    context.globalAlpha = 0.5;

    context.beginPath();
    edges.forEach((d) => {
      context.moveTo(
        x_pos(d.source.x) + margins.left,
        y_pos(d.source.y) + margins.top
      );
      context.lineTo(
        x_pos(d.target.x) + margins.left,
        y_pos(d.target.y) + margins.top
      );
    });

    // Set color of edges
    context.strokeStyle = "#999";

    // Draw to canvas
    context.stroke();
  }

  function update_nodes() {
    all_nodes.attr("cx", (d) => x_pos(d.x)).attr("cy", (d) => y_pos(d.y));

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

  function zoomed() {
    X = d3.event.transform.rescaleX(
      d3.scaleLinear().range([0, w]).domain([0, w])
    );
    Y = d3.event.transform.rescaleY(
      d3.scaleLinear().range([0, h]).domain([0, h])
    );
    update_edges();
    update_nodes();
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

  function highlight_component(edge_in_component) {
    const subgraph_id = edges[edge_in_component].subgraph;

    all_nodes
      .filter((d) => d.subgraph_id === subgraph_id)
      .attr("r", node_r * 1.5);
    all_nodes.filter((d) => d.subgraph_id !== subgraph_id).attr("r", node_r);
  }

  function reset_highlights() {
    all_nodes.attr("r", node_r);
  }

  return { highlight_component, reset_highlights };
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
    .call(setup_interactions, interaction_fns);

  const component_backgrounds = component_g
    .select("rect.interaction_rect")
    .attr("width", component_w)
    .attr("height", h);

  component_g
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
    .call(move_to, { y: sizes.size + padding });

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
    .call(move_to, { y: total_h - sizes.strength + padding * 2 });

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

  function highlight_component(edge_indices) {
    component_backgrounds
      .filter((c) => edge_indices.includes(c.first_edge))
      .attr("stroke-width", 2);
  }

  function reset_highlights() {
    component_backgrounds.attr("stroke-width", 0);
  }

  return { highlight_component, reset_highlights };
}

function draw_timelines(timeline_g, data, settings, update_fn) {
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

  const get_step_i = (mouse_pos) => Math.round(X.invert(mouse_pos[0])) - 1;

  const move_callouts = (step_i) => {
    callout_line.attr("transform", `translate(${X(step_i)}, 0)`);
    step_metrics.forEach((m) => m.set_callout(step_i));
    update_fn(step_i);
  };
  function on_mousemove() {
    const step_i = get_step_i(d3.mouse(this));
    move_callouts(step_i);
  }
  function on_mouseout() {
    move_callouts(default_step);
  }
  function on_click() {
    default_step = get_step_i(d3.mouse(this));
    pinned_step_line.move_to({ x: X(default_step) });
    update_fn(default_step, true);
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
