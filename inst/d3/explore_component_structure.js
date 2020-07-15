// !preview r2d3 data=list(nodes = dplyr::mutate(dplyr::rename(entropynet::virus_host_viruses, id = virus_id), color = ifelse(type == "RNA", "orangered", "steelblue")),edges = head(dplyr::arrange(entropynet::virus_net, -strength), 5000), structure = entropynet::virus_component_results), container = "div", dependencies = c("inst/d3/d3_helpers.js", "inst/d3/find_components.js"), d3_version = "5"

const margins = { left: 15, right: 35, top: 20, bottom: 10 };
const link_color_range = ["#edf8e9", "#006d2c"];
const viz_sizing = units_to_sizes(
  {
    network: 4,
    component: 2,
    timelines: 3,
  },
  height,
  10 //padding
);

const component_info = HTMLWidgets.dataframeToD3(data.structure);
const div_shadow = "1px 1px 9px black";

const network_views = setup_network_views({
  div,
  sizes: {
    network_h: viz_sizing.network.h,
    component_h: viz_sizing.component.h,
    width,
    margins,
  },
  all_edges: data.edges,
  component_info,
});

draw_timelines(div, {
  data: component_info,
  sizing: viz_sizing.timelines,
  margins: { left: 5, right: 30, top: 5, bottom: 20 },
  on_new_step: function (new_step) {
    network_views.set_to_step(new_step);
  },
});

// =============================================================================
// Functions for drawing each section of the plots

function setup_network_views({ div, all_edges, component_info, sizes = {} }) {
  const { network_h = 200, component_h = 200, width = 400, margins } = sizes;

  const selection_color = "black";
  const bar_color = "grey";
  const selected_color = d3.color(bar_color).darker();
  const alphaDecay = 0.01;
  const node_r = 3;
  const focus_r = 6;
  const lolly_r = 5;

  const network_div = div
    .select_append("div#network_plot")
    .style("position", "absolute");

  // Make the horizontal margins equal for network plot.
  // They're not even for the component charts because of axes drawing.
  const network = set_dom_elements({
    div: network_div,
    width,
    height: network_h,
    margins: { ...margins, right: margins.left },
  });

  const top_pad = 25; // A little bit of padding to avoid overlapping instruction text
  const member_glimpse_tooltip = network_div
    .select_append("div#edges_tooltip")
    .style("width", "auto")
    .style("max-width", "30%")
    .style("max-height", `${network.h - top_pad}px`)
    .style("box-shadow", div_shadow)
    .style("padding-top", "6px")
    .style("background", "white")
    .style("position", "absolute")
    .style("overflow", "scroll")
    .style("display", "none");

  const component_div = div
    .select_append("div#component_plot")
    .style("position", "absolute")
    .style("top", `${viz_sizing.component.start}px`);

  const component = set_dom_elements({
    div: component_div,
    width,
    height: component_h,
    margins,
    add_canvas: false,
  });

  const default_instructions =
    "Click a component in network of chart to see details";
  const in_focus_instructions =
    "Click anywhere outside of component to reset zoom";
  const instructions_text = network_div
    .select_append("span#instructions_text")
    .style("position", "absolute")
    .style("top", "0")
    .style("right", "0")
    .text(default_instructions);

  //#region Component chart setup
  const component_pos = units_to_sizes(
    {
      size: 2,
      density: 1,
      strength: 2,
    },
    component.h,
    3
  );
  component_pos.size.scale = d3.scaleLinear().range([component_pos.size.h, 0]);
  component_pos.density.scale = d3
    .scaleLinear()
    .range([component_pos.density.h, 0]);
  component_pos.strength.scale = d3
    .scaleLinear()
    .range([0, component_pos.strength.h - lolly_r]);

  let max_label_width = 0;
  component.g
    .select_append("g.axis_labels")
    .selectAll("text")
    .data([
      { label: "num members", id: "size" },
      { label: "avg density", id: "density" },
      { label: "total edge strength", id: "strength" },
    ])
    .join("text")
    .text((d) => d.label)
    .attr("dominant-baseline", "middle")
    .attr("y", (d) => component_pos[d.id].start + component_pos[d.id].h / 2)
    .each(function () {
      max_label_width = Math.max(
        d3.select(this).node().getBBox().width,
        max_label_width
      );
    })
    .attr("text-anchor", "end")
    .attr("x", max_label_width - 5);

  const component_X = d3
    .scaleBand()
    .range([max_label_width, component.w])
    .paddingInner(0.2);

  function update_components_chart(components, event_fns) {
    const components_df = HTMLWidgets.dataframeToD3(components).sort(
      (c_a, c_b) => c_b.size - c_a.size
    );

    // Update scales
    component_X.domain(components_df.map((d) => d.id));
    const largest_component = d3.max(components.size);
    component_pos.size.scale.domain([0, largest_component]);
    component_pos.density.scale.domain([0, 1]);
    component_pos.strength.scale.domain([0, d3.max(components.strength)]);

    const single_component = component.g
      .select_append("g.chart_elements")
      .selectAll("g.component_stats")
      .data(components_df, (d) => d.id)
      .join(function (enter) {
        const main_g = enter
          .append("g")
          .move_to({ x: (d) => component_X(d.id) });

        // We have a size bar
        main_g.append("rect").classed("size_bar", true).attr("fill", bar_color);

        // We hav a two rectangle density g element in the middle
        const density_g = main_g
          .append("g")
          .classed("density_chart", true)
          .move_to({ y: component_pos.density.start });

        density_g
          .append("rect")
          .classed("background", true)
          .attr("fill", "grey")
          .attr("fill-opacity", 0.5);

        density_g
          .append("defs")
          .append("clipPath")
          .attr("id", (d) => `${d.id}-clip`)
          .append("rect");

        density_g
          .append("rect")
          .classed("density_fill", true)
          .attr("fill", bar_color);

        // Finally we have a lollypop plot for strength on bottom
        const strength_g = main_g
          .append("g")
          .classed("strength_lollypop", true)
          .move_to({ y: component_pos.strength.start });
        strength_g
          .append("line")
          .classed("lollypop_stick", true)
          .attr("stroke", bar_color)
          .attr("stroke-width", 1);
        strength_g
          .append("circle")
          .classed("lollypop_head", true)
          .attr("r", lolly_r)
          .attr("fill", bar_color);

        // Place an invisible rectangle over the entire element space to make interactions more responsive
        main_g
          .append("rect")
          .classed("interaction_rect", true)
          .attr("stroke", selection_color)
          .attr("rx", 5)
          .attr("ry", 5)
          .attr("stroke-width", 0)
          .attr("fill-opacity", 0)
          .attr("height", component.h);

        return main_g;
      })
      .classed("component_stats", true)
      .on("mouseover", function (d) {
        event_fns.highlight_component(d.id);
      })
      .on("mouseout", function (d) {
        event_fns.reset_component_highlights();
      })
      .on("click", function (d) {
        event_fns.focus_on_component(d.id);
      });

    single_component
      .select("rect.interaction_rect")
      .attr("width", component_X.bandwidth());

    single_component
      .transition()
      .duration(100)
      .attr("transform", (d) => `translate(${component_X(d.id)}, 0)`);

    single_component
      .select("rect.size_bar")
      .attr("width", component_X.bandwidth())
      .attr("y", (d) => component_pos.size.scale(d.size))
      .attr(
        "height",
        (d) => component_pos.size.h - component_pos.size.scale(d.size)
      );

    const density_g = single_component.select("g.density_chart");

    const density_round = 10;

    single_component
      .select("clipPath")
      .select("rect")
      .attr("height", component_pos.density.h)
      .attr("width", component_X.bandwidth())
      .attr("rx", density_round)
      .attr("ry", density_round);

    density_g
      .select("rect.background")
      .attr("height", component_pos.density.h)
      .attr("width", component_X.bandwidth())
      .attr("clip-path", (d) => `url(#${d.id}-clip)`);

    density_g
      .select("rect.density_fill")
      .attr("clip-path", (d) => `url(#${d.id}-clip)`)
      .attr("y", (d) => component_pos.density.scale(d.density))
      .attr(
        "height",
        (d) => component_pos.density.h - component_pos.density.scale(d.density)
      )
      .attr("width", component_X.bandwidth());

    const strength_g = single_component.select("g.strength_lollypop");

    strength_g
      .select("line")
      .attr("y1", (d) => component_pos.strength.scale(d.strength))
      .attr("x1", component_X.bandwidth() / 2)
      .attr("x2", component_X.bandwidth() / 2);

    strength_g
      .select("circle")
      .attr("cy", (d) => component_pos.strength.scale(d.strength))
      .attr("cx", component_X.bandwidth() / 2);

    // Draw axes

    const too_thin_for_unit_bars = component_pos.size.h / largest_component < 3;

    component.g
      .select_append("g.size_axis")
      .move_to({ x: max_label_width, y: component_pos.size.start })
      .call(
        d3
          .axisLeft(component_pos.size.scale)
          .ticks(too_thin_for_unit_bars ? 5 : largest_component)
      )
      .call(extend_ticks, component.w, 0.8)
      .call(remove_domain)
      .call((g) => g.selectAll("text").remove());

    component.g
      .selectAll(`text.size_labels`)
      .data(components_df.head(too_thin_for_unit_bars ? 3 : 0))
      .join("text")
      .text((d) => d.size)
      .attr("class", "size_labels")
      .attr("x", (d) => component_X(d.id) + component_X.bandwidth() / 2)
      .attr("text-anchor", "middle")
      .attr("text-size", "9px")
      .attr("y", (d) => component_pos.size.scale(d.size) - 1)
      .raise();

    component.g
      .select_append("g.strength_axis")
      .move_to({ x: component.w, y: component_pos.strength.start })
      .call(d3.axisRight(component_pos.strength.scale).ticks(4))
      .call(remove_domain);

    function highlight_component(id) {
      const component_sel = single_component.filter((c) => c.id === id);

      component_sel.select("rect.size_bar").attr("fill", selected_color);
      component_sel.select("rect.density_fill").attr("fill", selected_color);
      component_sel
        .select("circle")
        .attr("fill", selected_color)
        .attr("r", lolly_r * 1.5);
    }

    function reset_component_highlights() {
      single_component.select("rect.size_bar").attr("fill", bar_color);
      single_component.select("rect.density_fill").attr("fill", bar_color);
      single_component
        .select("circle")
        .attr("fill", bar_color)
        .attr("r", lolly_r);
    }

    return { highlight_component, reset_component_highlights };
  }
  //#endregion

  //#region Network plot setup

  const zoom_detector_rect = network.g
    .select_append("rect#zoom_detector")
    .attr("width", network.w + margins.left + margins.right)
    .attr("x", -margins.left)
    .attr("height", network.h + margins.top + margins.bottom)
    .attr("y", -margins.top)
    .attr("fill", "white")
    .attr("fill-opacity", 0)
    .lower();

  network.scales = {
    link_dist: d3.scaleLog().range([10, 1]),
    link_color: d3
      .scaleLog()
      .range(link_color_range)
      .interpolate(d3.interpolateHcl),
    X_default: d3.scaleLinear().range([0, network.w]).domain([0, network.w]),
    Y_default: d3.scaleLinear().range([0, network.h]).domain([0, network.h]),
  };

  const simulation = d3
    .forceSimulation()
    .force("charge", d3.forceManyBody())
    .alphaDecay(alphaDecay)
    .force(
      "link",
      d3
        .forceLink()
        .id((d) => d.id)
        .distance((e) => network.scales.link_dist(e.strength))
    )
    .force(
      "x",
      d3
        .forceX()
        .strength(0.25)
        .x((node) => node.component_x)
    )
    .force(
      "y",
      d3
        .forceY()
        .strength(0.25)
        .y((node) => node.component_y)
    )
    .stop();

  const nodes_raw = HTMLWidgets.dataframeToD3(data.nodes);

  let all_nodes;

  function update_network_plot(
    { nodes, edges, nodes_by_component },
    event_fns
  ) {
    let current_focus = null;
    let zooming = false;
    let X = network.scales.X_default.copy();
    let Y = network.scales.Y_default.copy();
    const strength_extent = d3.extent(edges, (d) => d.strength);
    network.scales.link_dist.domain(strength_extent);
    network.scales.link_color.domain(strength_extent);

    // Update simulation with data
    if (all_nodes) {
      // Make a map of old data so we can pass along current positions and velocities to nodes that are common
      const prev_positions = new Map(all_nodes.data().map((d) => [d.id, d]));

      nodes.forEach((node) => {
        const prev_values = prev_positions.get(node.id);
        if (prev_values) {
          // If node is already in network, give it its same position
          Object.assign(node, prev_values);
        } else {
          // If it's new, place it in the middle of its component so it doesn't fly across screen
          node.x = node.component_x;
          node.y = node.component_y;
        }
      });
    }

    simulation.nodes(nodes);
    simulation.force("link").links(edges);
    simulation.alpha(1).restart();
    simulation.on("tick", update_positions);

    const component_containers = network.g
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
      .on("click", function (d) {
        if (!current_focus & !zooming) {
          event_fns.focus_on_component(d.id);
        }
      })
      .on("mouseover", function (d) {
        if (!current_focus & !zooming) {
          event_fns.highlight_component(d.id);
        }
      })
      .on("mouseout", function (d) {
        if (!current_focus & !zooming) {
          event_fns.reset_component_highlights();
        }
      });

    all_nodes = component_containers
      .select("g.node_container")
      .selectAll("circle")
      .data(
        ({ nodes }) => nodes,
        (d) => d.id
      )
      .join("circle")
      .attr("r", node_r)
      .attr("fill", (d) => d.color || "steelblue");

    const zoom = d3.zoom().on("zoom", function () {
      X = d3.event.transform.rescaleX(network.scales.X_default);
      Y = d3.event.transform.rescaleY(network.scales.Y_default);

      update_positions();
    });

    zoom_detector_rect.on("click", function () {
      event_fns.reset_focus();
    });

    let num_steps = 0;
    function update_positions() {
      num_steps++;
      // Edges
      network.context.clearRect(
        0,
        0,
        +network.canvas.attr("width"),
        +network.canvas.attr("height")
      );

      const draw_edge = ({ source, target }) => {
        network.context.moveTo(
          X(source.x) + margins.left,
          Y(source.y) + margins.top
        );
        network.context.lineTo(
          X(target.x) + margins.left,
          Y(target.y) + margins.top
        );
      };

      if (current_focus) {
        network.context.lineWidth = 2.5;
        nodes_by_component
          .find((c) => c.id === current_focus)
          .edge_indices.forEach((edge_i) => {
            const edge = edges[edge_i];

            network.context.beginPath();
            draw_edge(edge);
            // Set color of edges
            network.context.strokeStyle = network.scales.link_color(
              edge.strength
            );
            network.context.stroke();
          });
      } else {
        network.context.globalAlpha = 0.5;
        network.context.lineWidth = 1;
        network.context.strokeStyle = "#999";
        network.context.beginPath();
        edges.forEach(draw_edge);
        network.context.stroke();
      }

      if (!current_focus & !zooming & (num_steps > 20)) {
        // Check to make sure node are not spilling out of viewport
        let min_x = network.w;
        let min_y = network.h;
        let max_x = 0;
        let max_y = 0;
        all_nodes.each((n) => {
          const x_pos = X(n.x);
          const y_pos = Y(n.y);
          max_x = Math.max(x_pos, max_x);
          min_x = Math.min(x_pos, min_x);
          min_y = Math.min(y_pos, min_y);
          max_y = Math.max(y_pos, max_y);
        });

        const too_small_delta = 0.1;
        const x_too_small = network.w * too_small_delta;
        const y_too_small = network.h * too_small_delta;
        const too_small =
          (min_x > x_too_small) &
          (min_y > y_too_small) &
          (network.w - max_x > x_too_small) &
          (network.h - max_y > y_too_small);
        const too_large =
          min_x < 0 || min_y < 0 || max_x > network.w || max_y > network.h;

        if (too_large || too_small) {
          const scale_amnt = too_large ? 0.05 : -0.05;
          // Pullback scales a tiny bit to try and fit all nodes
          scale_scale(network.scales.X_default, scale_amnt);
          scale_scale(network.scales.Y_default, scale_amnt);

          X = network.scales.X_default.copy();
          Y = network.scales.Y_default.copy();
        }
      }
      // nodes
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

    function zoom_to_component(id, node_highlight_fns) {
      reset_component_highlights();
      current_focus = id;
      const nodes_in_sel = component_containers
        .filter((c) => c.id === id)
        .attr("opacity", 1)
        .selectAll("circle");
      const nodes_in_component = nodes_by_component.find((c) => c.id === id)
        .nodes;

      const [x_min, x_max] = d3.extent(nodes_in_component, (n) => X(n.x));
      const [y_min, y_max] = d3.extent(nodes_in_component, (n) => Y(n.y));
      zooming = true;
      network.svg
        .transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(network.w / 2, network.h / 2)
            .scale(
              Math.min(
                8,
                0.7 /
                  Math.max(
                    (x_max - x_min) / network.w,
                    (y_max - y_min) / network.h
                  )
              )
            )
            .translate(-(x_max + x_min) / 2, -(y_max + y_min) / 2),
          d3.mouse(network.svg.node())
        )
        .on("end", () => {
          zooming = false;
          // Enable panning
          network.svg
            .call(zoom)
            .on("dblclick.zoom", null)
            .on("wheel.zoom", null);

          nodes_in_sel
            .on("mouseover", function (n) {
              node_highlight_fns.highlight_node(n.id);
            })
            .on("mouseout", function () {
              node_highlight_fns.reset_node_highlights();
            });
        });

      function highlight_node(id) {
        nodes_in_sel.filter((n) => n.id === id).attr("r", focus_r * 1.5);
      }

      nodes_in_sel.transition().duration(750).attr("r", focus_r);

      component_containers.filter((c) => c.id !== id).attr("opacity", 0);

      return {
        highlight_node,
        reset_node_highlights: function () {
          nodes_in_sel.attr("r", focus_r);
        },
      };
    }

    function reset_component_highlights() {
      component_containers.select("rect.bounding_rect").attr("stroke", "white");
      member_glimpse_tooltip.style("display", "none");
    }

    return {
      zoom_to_component,
      reset_component_highlights,
      reset_zoom: function () {
        current_focus = null;
        zooming = true;

        //disable panning
        network.svg.on(".zoom", null);

        component_containers.attr("opacity", 1);

        network.svg
          .transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity)
          .on("end", () => {
            zooming = false;
          });

        all_nodes
          .on("mouseover", null)
          .on("mouseout", null)
          .transition()
          .duration(750)
          .attr("r", node_r);
      },
      highlight_component: function (id) {
        reset_component_highlights();

        // Do some math to figure out where to place tooltip
        const x_pad = 8;
        const component_bbox = component_containers
          .filter((c) => c.id === id)
          .select("rect.bounding_rect")
          .attr("stroke", "black");

        const box_left = +component_bbox.attr("x");
        const box_right = +component_bbox.attr("width") + box_left;
        const dist_to_left = box_left + margins.left;
        const dist_to_right = network.w - box_right + margins.right;
        const box_is_on_lower_half =
          +component_bbox.attr("y") + +component_bbox.attr("height") / 2 >
          network.h / 2;
        if (dist_to_left < dist_to_right) {
          // Component is on left of canvas so put tooltip to right of it
          member_glimpse_tooltip
            .style("right", "auto")
            .style("left", `${box_right + margins.left + x_pad}px`);
        } else {
          member_glimpse_tooltip
            .style("left", "auto")
            .style("right", `${network.w - box_left + margins.left + x_pad}px`);
        }

        if (box_is_on_lower_half) {
          member_glimpse_tooltip.style("top", "auto").style("bottom", `0`);
        } else {
          member_glimpse_tooltip
            .style("bottom", "auto")
            .style("top", `${top_pad}px`);
        }

        table_from_obj(
          member_glimpse_tooltip.style("display", "block").raise(),
          {
            data: nodes_by_component
              .find((c) => c.id === id)
              .nodes.map((n) => ({
                members: n.id,
                color: n.color,
              })),
            id: "tooltip",
            keys_to_avoid: [],
            max_width: "95%",
            colored_rows: true,
          }
        );
      },
    };
  }

  //#endregion Network plot

  //#region Information div
  const info_div = div
    .select_append("div#info_panel")
    .style("position", "absolute")
    .style("top", `${network_h}px`)
    .style("height", `calc(100% - ${network_h}px`)
    .style("width", `${width}px`)
    .style("box-shadow", div_shadow)
    .style("background", "white")
    .style("display", "none");

  // What we want to not show in now info
  const non_column_keys = [
    "component_id",
    "component_x",
    "component_y",
    "index",
    "x",
    "fx",
    "y",
    "fy",
    "vy",
    "vx",
    "color",
  ];

  function setup_info_div({ nodes, edges, nodes_by_component, components }) {
    const both_shown_padding = 2;
    const right_prop = 30;
    const left_prop = 100 - right_prop;
    const left_width = left_prop - 1.5 * both_shown_padding;
    const right_width = right_prop - 1.5 * both_shown_padding;
    const just_left_padding = (100 - left_width) / 2;

    const vert_pad = 1;
    const header_height = 17;
    const body_height = 100 - header_height - vert_pad * 2;
    const to_percent = (p) => `${p}%`;

    const transition_speed = 250;

    const header = info_div
      .select_append("div.header")
      .style("padding-top", to_percent(vert_pad))
      .style("width", "100%")
      .style("height", to_percent(header_height));

    const body = info_div
      .select_append("div.body")
      .style("position", "relative")
      .style("width", "100%")
      .style("height", to_percent(body_height));

    const left_side = body
      .select_append("div.left_side")
      .style("position", "absolute")
      .style("width", to_percent(left_width))
      .style("height", "100%");

    const right_side = body
      .select_append("div.right_side")
      .style("position", "absolute")
      .style("width", to_percent(right_width))
      .style("display", "none");

    const show_both = function () {
      right_side
        .style("display", "block")
        .transition()
        .duration(transition_speed)
        .style("right", to_percent(both_shown_padding));
      left_side
        .transition()
        .duration(transition_speed)
        .style("left", to_percent(both_shown_padding));
    };
    const just_left = function () {
      right_side
        .transition()
        .duration(transition_speed)
        .style("right", to_percent(-right_width))
        .on("end", function () {
          d3.select(this).style("display", "none");
        });
      left_side
        .transition()
        .duration(transition_speed)
        .style("left", to_percent(just_left_padding));
    };
    just_left();

    return {
      show_component: function (id, highlight_fns) {
        const component_i = components.id.findIndex((c_id) => c_id === id);
        info_div.style("display", "block").raise();

        info_table = table_from_obj(header, {
          data: [
            {
              density: components.density[component_i],
              strength: components.strength[component_i],
              size: components.size[component_i],
            },
          ],
          id: "component_info",
          keys_to_avoid: ["first_edge"],
          alignment: "center",
          even_cols: true,
          title: `Component ${id} statistics`,
        });

        nodes_table = table_from_obj(left_side, {
          data: nodes_by_component.find((c) => c.id === id).nodes,
          id: "nodes",
          keys_to_avoid: non_column_keys,
          max_width: "99%",
          title: "Nodes in component (hover to highlight in network plot)",
        });

        nodes_table.on("mouseover", function (n) {
          highlight_fns.highlight_node(n.id);
        });
        body.on("mouseout", function () {
          highlight_fns.reset_node_highlights();
        });

        return {
          highlight_node(id) {
            const neighbors = edges
              .filter((edge) => edge.source.id === id || edge.target.id === id)
              .map(({ source, target, strength }) => ({
                neighbor: source.id == id ? target.id : source.id,
                strength,
                color: network.scales.link_color(strength),
              }))
              .sort((a, b) => b.strength - a.strength);

            table_from_obj(right_side, {
              data: neighbors,
              id: "tooltip",
              keys_to_avoid: ["id", "first_edge"],
              even_cols: true,
              title: `${neighbors.length} Neighbors`,
              max_width: "100%",
              colored_rows: true,
            });

            nodes_table
              .filter((n) => n.id === id)
              .style("outline", "2px solid black")
              .call((node_row) => {
                node_row.node().scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
              });

            show_both();
          },
          reset_node_highlights() {
            just_left();
            nodes_table.style("outline", "none");
          },
        };
      },
      hide: function () {
        info_div.style("display", "none");
      },
    };
  }
  //#endregion

  function harmonize_data(step_i) {
    const { n_edges, components } = component_info[step_i];
    const { nodes, edges, nodes_by_component } = find_components({
      nodes: nodes_raw,
      edge_source: all_edges.a,
      edge_target: all_edges.b,
      edge_strength: all_edges.strength,
      n_edges,
      width: network.w,
      height: network.h,
    });

    // Match the component ids across the two datasets
    components.id = components.first_edge.map(
      (edge_i) => edges[edge_i].component
    );

    return { nodes, edges, components, nodes_by_component };
  }

  // Main interaction logic goes here.
  function set_to_step(step_i) {
    const step_data = harmonize_data(step_i);

    const component_chart = update_components_chart(step_data.components, {
      focus_on_component,
      reset_focus,
      highlight_component,
      reset_component_highlights,
    });

    const network_plot = update_network_plot(step_data, {
      focus_on_component,
      reset_focus,
      highlight_component,
      reset_component_highlights,
    });

    const info_panel = setup_info_div(step_data);

    function focus_on_component(id) {
      instructions_text.text(in_focus_instructions);

      const highlight_fns = {
        highlight_node,
        reset_node_highlights,
      };

      const focused_network = network_plot.zoom_to_component(id, highlight_fns);
      const focused_info = info_panel.show_component(id, highlight_fns);

      function highlight_node(node_id) {
        focused_network.highlight_node(node_id);
        focused_info.highlight_node(node_id);
      }

      function reset_node_highlights() {
        focused_network.reset_node_highlights();
        focused_info.reset_node_highlights();
      }
    }

    function reset_focus() {
      instructions_text.text(default_instructions);
      network_plot.reset_zoom();
      info_panel.hide();
    }

    function highlight_component(id) {
      network_plot.highlight_component(id);
      component_chart.highlight_component(id);
    }

    function reset_component_highlights() {
      network_plot.reset_component_highlights();
      component_chart.reset_component_highlights();
    }
  }
  return { set_to_step };
}

function draw_timelines(
  div,
  { data, sizing, margins, on_new_step, default_step }
) {
  const section_pad = 8;
  const background_color = "grey";
  const background_alpha = 0.1;
  const line_color = "steelblue";
  const line_width = 1;
  const callout_r = 3;
  const div_width = +div.attr("width");

  if (!default_step) {
    // If no default step is provided we find the step with the lowest relative size of largest component
    let min_rel_step = 0;
    let lowest_rel_size = 1;
    for (let step_i = 0; step_i < data.length; step_i++) {
      const rel_max_for_step = data[step_i].rel_max_size;
      if (rel_max_for_step < lowest_rel_size) {
        lowest_rel_size = rel_max_for_step;
        min_rel_step = step_i;
      }
    }
    default_step = min_rel_step;
  }

  const timelines = set_dom_elements({
    div: div
      .select_append("div#timeline")
      .style("position", "absolute")
      .style("top", `${sizing.start}px`),
    width: div_width,
    height: sizing.h,
    margins,
    add_canvas: false,
  });

  const { w, h } = timelines;

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

  const metric_sizes = units_to_sizes(
    all_metrics.reduce(
      (units, metric) => Object.assign(units, { [metric]: 1 }),
      {}
    ),
    timelines.h,
    section_pad
  );

  let max_label_width = 0;
  timelines.g
    .select_append("g.axis_labels")
    .selectAll("text")
    .data(all_metrics)
    .join("text")
    .text((d) => d.replace(/_/g, " "))
    .attr("dominant-baseline", "middle")
    .attr("y", (d) => metric_sizes[d].start + metric_sizes[d].h / 2)
    .each(function () {
      max_label_width = Math.max(
        d3.select(this).node().getBBox().width,
        max_label_width
      );
    })
    .attr("text-anchor", "end")
    .attr("x", max_label_width - 5);

  const chart_w = w - max_label_width;

  const X = d3.scaleLinear().domain([0, data.length]).range([0, chart_w]);

  const step_metrics = all_metrics.map((metric_id, i) => {
    let integer_valued = true;
    for (let i = 0; i < Math.min(15, data.length); i++) {
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
      X,
      is_integer: integer_valued,
      ...metric_sizes[metric_id],
    };

    data.forEach((step, i) => {
      const current_val = step[metric_id];
      metric.max = Math.max(metric.max, current_val);
      metric.values[i] = current_val;
    });

    metric.Y = d3
      .scaleLinear()
      .range([metric.h, 0])
      .domain([0, metric.max])
      .nice();

    metric.path = d3
      .line()
      .curve(d3.curveStep)
      .x((d, i) => X(i))
      .y((d) => metric.Y(d))(metric.values);

    return metric;
  });

  const chart_g = timelines.g
    .select_append("g#chart_area")
    .move_to({ x: max_label_width });

  chart_g
    .selectAll("g.charts")
    .data(step_metrics)
    .enter()
    .append("g")
    .attr("transform", ({ start }) => `translate(0, ${start})`)
    .each(function (d) {
      draw_metric_line({ g: d3.select(this), d });
    });

  const pinned_step_line = chart_g
    .select_append("line.pinned_step")
    .attr("y1", 0)
    .attr("y2", h)
    .attr("stroke", "steelblue")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  const callout_line = chart_g
    .append("line")
    .attr("y1", 0)
    .attr("y2", h)
    .attr("stroke", "grey")
    .attr("stroke-opacity", 0.5)
    .attr("stroke-width", 1);

  chart_g
    .append("rect")
    .attr("id", "interaction_rect")
    .attr("width", chart_w)
    .attr("height", h)
    .attr("fill", "forestgreen")
    .attr("fill-opacity", 0)
    .on("mousemove", on_mousemove)
    .on("mouseout", on_mouseout)
    .on("click", on_click);

  chart_g
    .select_append("g.x_axis")
    .move_to({ y: timelines.h })
    .call(d3.axisBottom(X));

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
  function draw_metric_line({ g, d }) {
    const { X, Y, h } = d;

    g.append("rect")
      .attr("width", chart_w)
      .attr("height", h)
      .attr("fill", background_color)
      .attr("fill-opacity", background_alpha);

    g.select_append("g.axis")
      .move_to({ x: chart_w + 4 })
      .call(d3.axisRight(Y).ticks(2))
      .call(extend_ticks, -chart_w)
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
        .text(format_number(d.values[step_i]))
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
