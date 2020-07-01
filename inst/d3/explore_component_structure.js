// !preview r2d3 data=entropynet::virus_component_results, container = "div", dependencies = c("inst/d3/d3_helpers.js")

const margins = { left: 30, right: 10, top: 20, bottom: 10 };
const { canvas, context, svg, g, w, h } = setup_svg_canvas_overlap({
  div,
  width,
  height,
  margins,
});

const timeline_settings = {
  padding: 5,
  margin_left: 85,
  background_color: "grey",
  background_alpha: 0.1,
  line_width: 1,
  line_color: "steelblue",
  rel_height: 1 / 2.5,
  callout_r: 3,
};

const component_settings = {
  rel_height: 1 / 2,
};

const components_g = g
  .append("g")
  .attr("width", w)
  .attr("height", h * component_settings.rel_height);

const current_components = data[50].components;
components_g.call(draw_components, current_components);

function draw_components(g, components) {
  const h = +g.attr("height");
  const w = +g.attr("width");
  const sizes = {
    size_bars: h * (2 / 5),
    density_bars: h * (1 / 5),
    strength_lines: h * (2 / 5),
  };
  const X = d3.scaleBand().domain(components.id).range([0, w]);
  const component_w = X.bandwidth();

  const sizes_Y = d3
    .scaleLinear()
    .domain([0, d3.max(components.size)])
    .range([0, sizes.size_bars]);

  const densities_Y = d3
    .scaleLinear()
    .domain([0, d3.max(components.density)])
    .range([0, sizes.density_bars]);

  const strengths_Y = d3
    .scaleLinear()
    .domain([0, d3.max(components.strength)])
    .range([0, sizes.strength_lines]);

  g.selectAll("g.component_stats")
    .data(HTMLWidgets.dataframeToD3(components))
    .enter()
    .append("g")
    .classed("component_stats", true)
    .attr("transform", (d) => `translate(${X(d.id)}, 0)`)
    .each(function (d) {
      const component_g = d3.select(this);

      component_g
        .append("rect")
        .attr("width", component_w)
        .attr("y", sizes.size_bars - sizes_Y(d.size))
        .attr("height", sizes_Y(d.size))
        .attr("fill", "steelblue");

      component_g
        .append("circle")
        .attr("cy", h - sizes.strength_lines + strengths_Y(d.strength))
        .attr("cx", component_w / 2)
        .attr("r", 5)
        .attr("fill", "steelblue");
    });
}

//debugger;

g.call(draw_timelines, data, timeline_settings, { w, h });

function draw_timelines(g, data, settings, { w, h }) {
  const total_h = h * settings.rel_height;

  const timeline_g = g
    .append("g")
    .attr("transform", `translate(0, ${h - total_h})`);

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

  const chart_h = total_h / all_metrics.length;
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
    .attr("y2", total_h - settings.padding)
    .attr("stroke", "grey")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  timeline_g
    .append("rect")
    .attr("id", "interaction_rect")
    .attr("width", chart_w)
    .attr("height", total_h)
    .attr("fill", "forestgreen")
    .attr("fill-opacity", 0)
    .on("mousemove", on_mousemove)
    .on("mouseout", on_mouseout)
    .on("click", on_click);

  const get_step_i = (mouse_pos) => Math.round(X.invert(mouse_pos[0])) - 1;

  function on_mousemove() {
    const step_i = get_step_i(d3.mouse(this));
    callout_line
      .attr("visibility", "visible")
      .attr("transform", `translate(${X(step_i)}, 0)`);
    step_metrics.forEach((m) => m.set_callout(step_i));
  }
  function on_mouseout() {
    callout_line.attr("visibility", "hidden");
    step_metrics.forEach((m) => m.hide_callout());
  }
  function on_click() {
    const step_i = get_step_i(d3.mouse(this));
    console.log(`Selected step ${step_i}`);
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
