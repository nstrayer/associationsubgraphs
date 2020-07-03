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
  rel_h: 1,
};

const component_settings = {
  w,
  rel_h: 2,
  bar_color: "grey",
};

const timeline_settings = {
  padding: 5,
  margin_left: 85,
  background_color: "grey",
  background_alpha: 0.1,
  line_width: 1,
  line_color: "steelblue",
  w,
  rel_h: 1,
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

// Setup and start the component charts;
const components_g = g
  .append("g")
  .classed("components_chart", true)
  .attr("transform", `translate(0, ${component_settings.start_h})`);

const timelines_g = g
  .append("g")
  .classed("timelines_chart", true)
  .attr("transform", `translate(0, ${timeline_settings.start_h})`);

const network_g = g.append("g").classed("network_plot", true);

const update_components_chart = function (step_i) {
  components_g.call(
    draw_components_chart,
    structure_data[step_i].components,
    component_settings
  );
};
update_components_chart(default_step);

// Setup and start the timeline charts
timelines_g.call(
  draw_timelines,
  structure_data,
  timeline_settings,
  update_components_chart
);

network_g.call(draw_network_plot, data.edges, 50, network_settings);

function draw_network_plot(g, edges, n_edges, settings) {
  const { w, h } = settings;

  const edges_df = HTMLWidgets.dataframeToD3({
    source: edges.a,
    target: edges.b,
    strength: edges.strength,
  });
  const nodes_raw = HTMLWidgets.dataframeToD3(data.nodes);

  const { nodes, subgraphs } = find_subgraphs({
    nodes: nodes_raw,
    source_edges: edges.a,
    target_edges: edges.b,
    n_edges,
    width: w,
    height: h,
  });

  select_append(g, "rect", "background")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "forestgreen")
    .attr("fill-opacity", 0)
    .attr("stroke", "forestgreen")
    .attr("stroke-width", 2);
}

function draw_components_chart(g, components, settings) {
  const {
    w,
    h,
    bar_color,
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
    .attr("transform", `translate(0, ${sizes.size + padding})`);

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
    .attr(
      "transform",
      `translate(0, ${total_h - sizes.strength + padding * 2})`
    );
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

  select_append(g, "g", "size_axis")
    .call(d3.axisLeft(sizes_Y).ticks(sizes_Y.domain()[1]))
    .call(extend_ticks, w, 0.4)
    .call(remove_domain)
    .call((g) => g.selectAll("text").remove());

  select_append(g, "g", "strength_axis")
    .attr(
      "transform",
      `translate(0, ${sizes.size + sizes.density + 2 * padding})`
    )
    .call(d3.axisLeft(strengths_Y).ticks(2));
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

  let updating_alowed = true;
  const get_step_i = (mouse_pos) => Math.round(X.invert(mouse_pos[0])) - 1;

  const move_callouts = (step_i) => {
    callout_line.attr("transform", `translate(${X(step_i)}, 0)`);
    step_metrics.forEach((m) => m.set_callout(step_i));
  };
  function on_mousemove() {
    if (updating_alowed) {
      const step_i = get_step_i(d3.mouse(this));
      update_fn(step_i);
      move_callouts(step_i);
    }
  }
  function on_mouseout() {
    updating_alowed = true;
    move_callouts(default_step);
    update_fn(default_step);
  }
  function on_click() {
    updating_alowed = false;
    default_step = get_step_i(d3.mouse(this));
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
        .attr("transform", `translate(${x_pos}, ${Y(value_at_step)})`);

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
