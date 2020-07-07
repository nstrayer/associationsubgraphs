function setup_svg_canvas_overlap({ div, width, height, margins }) {
  // Get the device pixel ratio, falling back to 1.
  const dpr = window.devicePixelRatio || 1;

  // Append the canvas
  const canvas = div
    .append("canvas")
    .style("position", "absolute")
    .attr("width", width * dpr)
    .attr("height", height * dpr)
    .style("width", `${width}px`)
    .style("height", `${height}px`)
    .style("left", 0)
    .style("top", 0);

  const context = canvas.node().getContext("2d");

  // Scale canvas image so it looks good on retina displays
  context.scale(dpr, dpr);

  const svg = div
    .append("svg")
    .attr("height", height)
    .attr("width", width)
    .style("position", "absolute")
    .style("left", 0)
    .style("top", 0)
    .call(add_blur_filter);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margins.left},${margins.top})`);

  return {
    canvas,
    context,
    svg,
    g,
    w: width - margins.left - margins.right,
    h: height - margins.top - margins.bottom,
  };
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

function add_background_rect(g, { w, h, margins, color = "white" }) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = margins;
  g.select_append("rect.background")
    .attr("width", w + left + right)
    .attr("height", h + top + bottom)
    .attr("x", -left)
    .attr("y", -top)
    .attr("fill", color);
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
  const eval_pos = (p, d) => (typeof p == "function" ? p(d) : p);
  return this.attr(
    "transform",
    (d) => `translate(${eval_pos(x, d)},${eval_pos(y, d)})`
  );
};

function table_from_obj(
  container,
  { data, id, keys_to_avoid, alignment = "left", even_cols = false }
) {
  const column_names = Object.keys(data[0]).filter(
    (key) => !keys_to_avoid.includes(key)
  );

  const max_width = "85%";
  const stripe_color = d3.color("#dedede");
  const off_stripe_color = stripe_color.brighter();
  const header_color = stripe_color.darker(0.5);

  const formatters = {
    string: (d) => d,
    integer: d3.format(",i"),
    float: d3.format(".3f"),
  };

  const column_types = {};
  data.forEach((d) => {
    column_names.forEach((col_name) => {
      const col_value = d[col_name];
      if (typeof col_value === "string") {
        column_types[col_name] = "string";
      } else if (typeof col_value === "boolean") {
        column_types[col_name] = "string";
      } else {
        const val_is_integer = col_value % 1 === 0;
        const wasnt_already_float = column_types[col_name] !== "float";
        if (val_is_integer && wasnt_already_float) {
          column_types[col_name] = "integer";
        } else {
          column_types[col_name] = "float";
        }
      }
    });
  });

  const table = container
    .select_append(`table#${id}`)
    .style("max-width", max_width)
    .style("border-collapse", "collapse")
    .style("border", `1px solid ${header_color.toString()}`)
    .style("margin-left", "auto")
    .style("margin-right", "auto");

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
    .join("tr")
    .style("background", (d, i) => (i % 2 ? stripe_color : off_stripe_color));

  rows
    .selectAll("td")
    .data((d) =>
      column_names.map((key) => formatters[column_types[key]](d[key]))
    )
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
