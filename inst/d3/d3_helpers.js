function set_dom_elements({
  div,
  width,
  height,
  margins,
  add_canvas = true,
  font_family = "sans-serif",
  font_weight = 300,
  font_size = 14,
}) {
  const res = {};

  div
    .style("width", `${width}px`)
    .style("height", `${height}px`)
    .style("font-family", font_family)
    .style("font-weight", font_weight);

  if (add_canvas) {
    // Get the device pixel ratio, falling back to 1.
    const dpr = window.devicePixelRatio || 1;

    // Append the canvas
    res.canvas = div
      .append("canvas")
      .style("position", "absolute")
      .attr("width", width * dpr)
      .attr("height", height * dpr)
      .style("width", `${width}px`)
      .style("height", `${height}px`)
      .style("left", 0)
      .style("top", 0);

    res.context = res.canvas.node().getContext("2d");

    // Scale canvas image so it looks good on retina displays
    res.context.scale(dpr, dpr);
  }

  res.svg = div
    .append("svg")
    .attr("height", height)
    .attr("width", width)
    .style("position", "absolute")
    .style("left", 0)
    .style("top", 0)
    .style("font-family", font_family)
    .style("font-weight", font_weight)
    .style("font-size", font_size)
    .call(add_blur_filter);

  res.g = res.svg
    .append("g")
    .attr("transform", `translate(${margins.left},${margins.top})`);

  res.w = width - margins.left - margins.right;
  res.h = height - margins.top - margins.bottom;

  return res;
}

function extend_ticks(g, tick_width, tick_opacity = 0.8) {
  g.selectAll(`.tick line`)
    .attr("x2", tick_width)
    .attr("stroke", "white")
    .attr("stroke-opacity", tick_opacity)
    .attr("pointer-events", "none"); // dont let ticks mess up hover etc.

  g.selectAll(`.tick text`).attr("x", -2);
}

function remove_domain(els) {
  els.selectAll(".domain").remove();
}

function not_integer(x) {
  return x % 1 !== 0;
}

function add_blur_filter(svg) {
  svg.append("defs").html(`
    <filter id="blur_filter" x="0" y="0">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
    </filter>
  `);
}

function add_background_rect(
  g,
  { w, h, margins = {}, color = "white", fill_opacity = 0.5 }
) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = margins;
  g.select_append("rect.background")
    .attr("width", w + left + right)
    .attr("height", h + top + bottom)
    .attr("x", -left)
    .attr("y", -top)
    .attr("fill", color)
    .attr("fill-opacity", fill_opacity)
    .attr("stroke", color)
    .attr("stroke-width", 2);
}

d3.selection.prototype.select_append = function (query) {
  const [el_type, specifier] = query.split(/\.|#/g);

  let sel = this.select(query);
  if (sel.size() === 0) {
    sel = this.append(el_type);
    if (specifier) {
      const specifier_is_id = query.includes("#");
      sel.attr(specifier_is_id ? "id" : "class", specifier);
    }
  }

  return sel.raise();
};

d3.selection.prototype.move_to = function ({ x = 0, y = 0 }) {
  return this.attr("transform", function () {
    const x_pos = typeof x === "function" ? x.apply(this, arguments) : x;
    const y_pos = typeof y === "function" ? y.apply(this, arguments) : y;
    return `translate(${x_pos},${y_pos})`;
  });
};

function table_from_obj(
  container,
  {
    data,
    id,
    keys_to_avoid,
    alignment = "left",
    even_cols = false,
    title,
    max_width = "85%",
    colored_rows = false,
  }
) {
  if (colored_rows) {
    keys_to_avoid.push("color");
  }
  const column_names = Object.keys(data[0]).filter(
    (key) => !keys_to_avoid.includes(key)
  );

  const stripe_color = d3.color("#dedede");
  const off_stripe_color = stripe_color.brighter();
  const header_color = stripe_color.darker(0.5);

  const table_holder = container
    .select_append(`div#table_holder${id}`)
    .style("max-width", max_width)
    .style("margin-left", "auto")
    .style("margin-right", "auto")
    .style("margin-bottom", "0.75rem");

  if (title) {
    table_holder
      .select_append("span")
      .style("font-style", "italic")
      .text(title);
  }

  const table = table_holder
    .select_append(`table#${id}`)
    .style("border-collapse", "collapse")
    .style("border", `1px solid ${header_color.toString()}`);

  // header
  table
    .select_append("thead")
    .select_append("tr")
    .style("background", header_color)
    .selectAll("th")
    .data(column_names)
    .join("th")
    .attr("class", "table_cell")
    .text((d) => d.replace(/_/g, " "));

  // body
  const rows = table
    .select_append("tbody")
    .selectAll("tr")
    .data(data)
    .join("tr");

  if (colored_rows) {
    const color_is_light = (cell_color) => d3.hcl(d3.color(cell_color)).l > 60;

    rows
      .style("background", (d) => d.color)
      .style("color", (d) => (color_is_light(d.color) ? "black" : "white"));
  } else {
    rows.style("background", (d, i) =>
      i % 2 ? stripe_color : off_stripe_color
    );
  }
  const print_val = (val) =>
    typeof val === "number" ? format_number(val) : val;
  rows
    .selectAll("td")
    .data((d) => column_names.map((key) => print_val(d[key])))
    .join("td")
    .attr("class", "table_cell")
    .text((d) => d);

  // Style all the cells in common
  const all_cells = table
    .selectAll(".table_cell")
    .style("text-align", alignment)
    .style("margin-top", "2px")
    .style("padding", "0.2rem 0.5rem");

  if (even_cols) {
    all_cells.style("width", `calc(${max_width} / ${column_names.length})`);
  }

  return rows;
}

function format_number(x, digits = 3) {
  return d3
    .format(`,.${digits}f`)(x)
    .replace(/(\.)*0+$/, "");
}

function units_to_sizes(units, h, padding = 5) {
  const values = Object.values(units);
  const n = values.length;
  const total_units = values.reduce((tot, u) => tot + u, 0);
  const total_h = h - padding * (n - 1);
  const sizes = {};
  let current_h = 0;
  for (let measure in units) {
    const measure_h = (total_h * units[measure]) / total_units;
    sizes[measure] = { h: measure_h, start: current_h };
    current_h += measure_h + padding;
  }
  return sizes;
}

const scale_scale = function (scale, rel_amnt = 0.05) {
  const [range_min, range_max] = scale.domain();
  const total_width = Math.abs(range_min - range_max);
  const extension_amnt = total_width * rel_amnt;

  scale.domain(
    range_min < range_max
      ? [range_min - extension_amnt / 2, range_max + extension_amnt / 2]
      : [range_min + extension_amnt / 2, range_max - extension_amnt / 2]
  );
};
