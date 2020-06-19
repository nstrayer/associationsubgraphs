// !preview r2d3 data=entropy_network, container = "div", options = list(), dependencies = system.file("d3/find_subgraphs.js", package = "entropynet")

const padding = 50;
const node_r = 3;
// Expects that your edges have a source and target column
// and that the nodes has an id column that matches the values
// in that column
const edges = HTMLWidgets.dataframeToD3(data.edges);
const nodes_raw = HTMLWidgets.dataframeToD3(data.nodes);

const { nodes, subgraphs } = find_subgraphs(nodes_raw, edges);

const subgraph_grid_side = Math.ceil(Math.sqrt(subgraphs.size));
let i = 0;
const grid_side_length = Math.min(width, height);
const margins = {
  horizontal: (width - grid_side_length)/2,
  vertical: (height - grid_side_length)/2,
};
const gap_size = grid_side_length / subgraph_grid_side;
const is_giant_component = subgraphs.size == 1;

subgraphs.forEach(function (subgraph, subgraph_id) {
  const row = is_giant_component
    ? width / 2
    : (i % subgraph_grid_side) * gap_size;
  const col = is_giant_component
    ? height / 2
    : Math.floor(i / subgraph_grid_side) * gap_size;
  i++;
  subgraph.forEach((node) => {
    node.subgraph_x = row + margins.horizontal;
    node.subgraph_y = col + margins.vertical;
  });
});

const link_dist = d3
  .scaleLog()
  .domain(d3.extent(edges, (d) => d.strength))
  .range([Math.max(2, subgraph_grid_side / 3), 1]);

let X = d3
  .scaleLinear()
  .range([padding, grid_side_length - padding])
  .domain([-grid_side_length * (1 / 3), grid_side_length * 0.85]);

let Y = d3
  .scaleLinear()
  .range([padding, grid_side_length - padding])
  .domain([-grid_side_length * (1 / 3), grid_side_length * 0.9]);

let scales = { X, Y };

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
      //.x(width/2)
      .x((node) => node.subgraph_x)
  )
  .force(
    "y",
    d3
      .forceY()
      .strength(0.25)
      //.y(height/2 + 14)
      .y((node) => node.subgraph_y)
  )
  .alphaDecay(options.alphaDecay || 0.0005)
  .on("tick", ticked);

div.style("position", "relative");
div
  .append("h2")
  .style("position", "absolute")
  .style("top", "-20px")
  .text(`Top ${edges.length} ${options.measure || "association"} pairs`);

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
  .style("top", 0);

const g = svg.append("g");

const node = g
  .append("g")
  .attr("stroke", "#fff")
  .attr("stroke-width", node_r / 3)
  .selectAll("circle")
  .data(nodes)
  .enter()
  .append("circle")
  .attr("r", node_r)
  .attr("fill", (d) => d.color || "steelblue")
  .on("mouseover", show_tooltip)
  .on("mouseout", hide_tooltip)
  .call(drag(simulation));

const tooltip = div
  .append("div")
  .style("width", "auto")
  .style("border", "1px solid black")
  .style("background", "white")
  .style("position", "absolute")
  .style("display", "none")
  .style("font-family", "san-serif");

function show_tooltip(d) {
  const dont_show = [
    "id",
    "color",
    "subgraph_id",
    "subgraph_x",
    "subgraph_y",
    "index",
    "fx",
    "fy",
    "x",
    "y",
    "vx",
    "vy",
  ];

  const common_styles = `margin: 5px;`;

  const table_styles = `
    border-collapse: collapse;
    border-spacing: 0;
    empty-cells: show;
    width: calc(100% - 10px);
    margin-top: 3px;
  `;

  const table_row_styles = `
    padding: 0.2em 0.4em;
    border-width: 0 0 1px 0;
    border-bottom: 1px solid #cbcbcb;
  `;

  const n_neighbors = options.n_neighbors || 5;

  const neighbors = edges
    .filter((edge) => edge.source === d || edge.target === d)
    .map(({ source, target, strength }) => ({
      neighbor: source.id == d.id ? target.id : source.id,
      strength,
    }))
    .sort((a, b) => b.strength - a.strength)
    .filter((d, i) => i < n_neighbors);

  const neighbors_table =
    neighbors.reduce(
      (content, { neighbor, strength }) => `
      ${content}
      <tr >
        <td style="${table_row_styles}">${neighbor}</td>
        <td style="${table_row_styles}">${d3.format(".3f")(strength)}</td>
      </tr>
    `,
      `
    <span style = "${common_styles} font-style: italic; font-size: 0.9rem;">Top ${neighbors.length} associations</span>
    <table style = "${common_styles} ${table_styles}">
      <tr>
        <th style="${table_row_styles}; text-align:left;">Neighbor</th>
        <th style="${table_row_styles}; text-align:left;">Strength</th>
      </tr>`
    ) + "</table>";

  const make_entry = (key) => `
    <p style = "${common_styles}">
      <span style = "font-style: italic;">${key}:</span>
      ${d[key]}
    </p>`;

  const node_information = Object.keys(d)
    .filter((key) => !dont_show.includes(key))
    .reduce(
      (content, key) => `${content} ${make_entry(key)}`,
      `<h3 style = "${common_styles};">${d.id}</h3>`
    );

  const content = `
    ${node_information}
    ${neighbors_table}
  `;

  tooltip
    .style("left", `${d3.event.offsetX + 10}px`)
    .style("top", `${d3.event.offsetY + 10}px`)
    .style("display", "block")
    .html(content);
}

function hide_tooltip() {
  tooltip.style("display", "none");
}

//add zoom capabilities
svg.call(d3.zoom().on("zoom", zoomed));

function ticked() {
  update_edges();
  update_nodes();
}

function update_nodes() {
  node.attr("cx", (d) => scales.X(d.x)).attr("cy", (d) => scales.Y(d.y));
}

function update_edges() {
  context.clearRect(0, 0, +canvas.attr("width"), +canvas.attr("height"));

  // Scale edge opacity based upon how many edges we have
  context.globalAlpha = 0.5;

  context.beginPath();
  edges.forEach((d) => {
    context.moveTo(scales.X(d.source.x), scales.Y(d.source.y));
    context.lineTo(scales.X(d.target.x), scales.Y(d.target.y));
  });

  // Set color of edges
  context.strokeStyle = "#999";

  // Draw to canvas
  context.stroke();
}

function zoomed() {
  scales = {
    X: d3.event.transform.rescaleX(X),
    Y: d3.event.transform.rescaleY(Y),
  };
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
