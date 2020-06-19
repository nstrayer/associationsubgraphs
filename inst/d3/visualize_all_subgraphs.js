// !preview r2d3 data=subgraphs

const margin = {left: 20, right: 1, top: 20, bottom: 35, middle: 15};
const h = height - margin.top - margin.bottom;
const w = width - margin.left - margin.right;
const unique_subgraph_ids = new Set();
const blend_mode = 'screen';
const line_color = "steelblue";
const line_width = 2;
const merger_bars_color = "orangered";

// ===============================================================
// Set up all the separate charts in correct places
// Place margined g

const units = [
  {id: 'stream', unit: 2, color: 'forestgreen', y: d3.scaleLinear()},
  {id: 'mergers', unit: 0.5, color: 'steelblue', y: d3.scaleLinear()},
  {id: 'n_in_subgraphs', unit: 2, color: 'orangered', y: d3.scaleLinear().nice()},
  {id: 'n_subgraphs', unit: 2, color: 'lightgrey', y: d3.scaleLinear().nice()},
];

const g = svg.append('g')
  .style('isolation', 'isolate')
  .attr('transform', `translate(${margin.left}, ${margin.top})`);

const total_units = units.reduce((s,u) => s + u.unit,0);

const charts = {};

const layout_debug = false;
const pad = 13;
units.forEach((el,i)=> {
  el.start = i === 0 ? 0 : units[i-1].start + units[i-1].height;
  el.height = (el.unit/total_units)*h;
  el.g = g.append('g')
    .attr('id', el.id)
    .attr('transform', `translate(0, ${el.start})`);

  if(layout_debug) el.g.call(add_background, el.height, el.color);

  el.y.range([el.height-pad, pad]);

  charts[el.id] = el;
});



// ===============================================================
// Process data to right formats
const steps = [];
const num_subgraphs_at_step = [];
const merger_magnitudes = [];
let max_merger_magnitude = 0;
let max_num_subgraphs = 0;
data.forEach((d, i) => {
  const {subgraphs, cutoff, n, n_mergers, total_merger_magnitude} = d;
  const step = i+1;
  const step_map = {step};

  subgraphs.subgraph.forEach(subgraph_id => {
    step_map[subgraph_id] = (step_map[subgraph_id] | 0) + 1;
    unique_subgraph_ids.add(subgraph_id);
  });
  steps.push(step_map);

  num_subgraphs_at_step.push({step, n, cutoff});
  max_num_subgraphs = Math.max(max_num_subgraphs, n);

  if(n_mergers > 0){
    merger_magnitudes.push({step, magnitude: total_merger_magnitude});
    max_merger_magnitude = Math.max(max_merger_magnitude, total_merger_magnitude);
  }

  d.nodes_in_subgraphs = Math.round(d.avg_size * d.n);
});


// ===============================================================
// Universal X-scale

const x = d3.scaleLinear()
  .domain([1, steps.length])
  .range([0,w]);

// Width of each step on x-axis
const bar_width = x(1) - x(0);

g
  .append("g")
  .call(d3.axisBottom(x).ticks(3))
  .attr('transform', `translate(0,${h})`)
  .call(
    add_label_to_axis({
      label: ` steps taken`,
      which_tick: 'first',
      before_val: false
    })
  )
  .call(remove_domain)
  .selectAll('text')
  .attr('text-anchor', 'start')
  .style('font-size', '1rem');


// ===============================================================
// Streamgraph

// Construct streamgraph series
const series = d3.stack()
  .keys([...unique_subgraph_ids])
  .value((d,key) => d[key]||0)
  .offset(d3.stackOffsetWiggle)
  .order(d3.stackOrderInsideOut)
  (steps);

// Build scales
charts.stream.y
  .domain([
    d3.min(series, d => d3.min(d, d => d[0])),
    d3.max(series, d => d3.max(d, d => d[1]))
  ]);

const palette = d3.schemePaired;
const color_subgraph = id => palette[id % palette.length];

const area = d3.area()
  .x((d,i) => x(i+1))
  .y0(d => charts.stream.y(d[0]))
  .y1(d => charts.stream.y(d[1]));

charts.stream.g.append("g")
  .selectAll("path")
  .data(series)
  .enter().append("path")
    .attr("fill", ({key}) => color_subgraph(key))
    .attr("stroke", "white")
    .attr('stroke-width', 0.5)
    .attr("d", area)
  .append("title")
    .text(({key}) => key);

charts.stream.g.append('text')
  .attr('y', 15)
  .attr('x', -10)
  .text('Subgraph distributions');


// ===============================================================
// Number of nodes in subgraphs line
const total_num_nodes = d3.max(data, d => d.nodes_in_subgraphs);
charts.n_in_subgraphs.y
  .domain([0, total_num_nodes]);

charts.n_in_subgraphs.g.append('path')
  .attr('d', d3.line()
  .curve(d3.curveStep)
  .x(d => x(d.step))
  .y(d => charts.n_in_subgraphs.y(d.nodes_in_subgraphs))(data))
  .attr('fill', 'none')
  .attr('stroke-width', line_width)
  .attr('stroke', line_color);

charts.n_in_subgraphs.g
  .append("g")
  .call(d3.axisRight(charts.n_in_subgraphs.y).ticks(3))
  .attr('transform', `translate(-10,0)`)
  .call(extend_ticks, w)
  .call(remove_domain)
    .selectAll('text')
    .style('font-size', '1rem');



// ===============================================================
// mergers bars
charts.mergers.y
  .domain([1, max_merger_magnitude])
  .range(charts.mergers.y.range().reverse());

charts.mergers.g.append('text')
  .attr('y', 10)
  .attr('x', -10)
  .text('Subgraph mergers by magnitude');

charts.mergers.g
  .selectAll('rect')
  .data(merger_magnitudes)
  .enter().append('rect')
  .attr('x', d => x(d.step)-1)
  .attr('y', d => charts.mergers.height/2 - charts.mergers.y(d.magnitude)/2)
  .attr('height', d => charts.mergers.y(d.magnitude))
  .attr('width', 2)
  .attr('fill', merger_bars_color);

// ===============================================================
// number of subgraphs line
charts.n_subgraphs.y
  .domain([0, max_num_subgraphs])
  .nice();

charts.n_subgraphs.g.append('path')
  .attr('d', d3.line()
    .curve(d3.curveStep)
    .x(d => x(d.step))
    .y(d => charts.n_subgraphs.y(d.n))(num_subgraphs_at_step))
  .attr('fill', 'none')
  .attr('stroke-width', line_width)
  .attr('stroke', line_color);

charts.n_subgraphs.g
  .append("g")
  .call(d3.axisRight(charts.n_subgraphs.y).ticks(3))
  .attr('transform', `translate(-10,0)`)
  .call(extend_ticks, w)
  .call(remove_domain)
    .selectAll('text')
    .style('font-size', '1rem');


// ===============================================================
// Setup interactions

const max_step = num_subgraphs_at_step.findIndex(({step, n}) => n === max_num_subgraphs);

const subgraph_count_callout = make_callout(charts.n_subgraphs.g);
const n_in_subgraphs_callout = make_callout(charts.n_in_subgraphs.g);

const callout_line = g.append('line')
  .attr('y1', 0)
  .attr('y2', h)
  .attr('stroke', 'black');

const place_callouts = function(step_i){

  const {step, n, cutoff} = num_subgraphs_at_step[step_i];
  const {nodes_in_subgraphs} = data[step_i];
  const x_pos = x(step);

  subgraph_count_callout.update({
    x: x_pos,
    y: charts.n_subgraphs.y(n),
    txt: `${n} subgraphs at cutoff ${d3.format(".3f")(cutoff)}`,
  });

  n_in_subgraphs_callout.update({
    x: x_pos,
    y: charts.n_in_subgraphs.y(nodes_in_subgraphs),
    txt: `${nodes_in_subgraphs} nodes (${d3.format(".1%")(nodes_in_subgraphs/total_num_nodes)}) in subgraphs`,
  });

  callout_line
    .attr('stroke-opacity', 0.3)
    .attr('transform', `translate(${x_pos}, 0)`);
};

const default_callouts = function(){
  place_callouts(max_step);
  callout_line.attr('stroke-opacity', 0);
};


g.append('rect').attr('id', 'interaction_rect')
  .attr('width', w)
  .attr('height', h)
  .attr('fill', 'white')
  .attr('fill-opacity', 0)
  .on('mousemove', function(){
    const step_i = Math.round(x.invert(d3.mouse(this)[0])) - 1;
    place_callouts(step_i)
  })
  .on('mouseout', default_callouts);

// =============================================
// Style all text
g.selectAll('text')
  .style('font-size', '0.95rem')
  .style('font-family', 'sans-serif');

default_callouts();

// =============================================
// Helper functions for axes

function add_label_to_axis({ label, which_tick, before_val }) {
  return g =>
  g
    .select(`.tick:${which_tick}-of-type text`)
    .classed("axis_title", true)
    .html(function() {
    if (before_val) {
      return `${label}${d3.select(this).text()}`;
    } else {
      return `${d3.select(this).text()}${label}`;
    }
  });
}

function extend_ticks(g, tick_width, tick_opacity = 0.1) {
  const outcrop = 9;
  g
    .selectAll(`.tick line`)
    .attr('x2', tick_width + outcrop)
    .style('mix-blend-mode', blend_mode)
    .attr('stroke', 'black')
    .attr('stroke-opacity', tick_opacity);

  g.select(`.tick:first-of-type line`)
    .attr('stroke-opacity', 0.7);

  g
    .selectAll(`.tick text`)
    .attr('y', -outcrop)
    .attr('x', 0);
}

function remove_domain(els) {
  els.selectAll(".domain").remove();
}

function add_background(g, r_h, r_color){
  g.append('rect')
    .attr('width', w)
    .attr('height', r_h)
    .attr('fill', r_color)
    .attr('fill-opacity', 0.3);
};


function make_callout(g){
  const callout_g = g.append('g').attr('class', 'callout');

  const background_rect = callout_g.append('rect')
    .attr('fill', 'white')
    .attr('fill-opacity', 0.65);

  const callout_text = callout_g.append('text');

  callout_g.append('circle')
    .attr('r', 5)
    .attr('fill', 'none')
    .attr('stroke', 'black')
    .attr('stroke-width', 2);

  return {update:({txt, x, y}) => {
    callout_g.attr('transform',`translate(${x},${y})`);

    const past_halfway = x > w/2;
    callout_text
      .text(txt)
      .attr('text-anchor', past_halfway ? "end": "start")
      .attr('x', past_halfway ? -10: 10);

    const text_bbox = callout_text.node().getBBox();
    background_rect
      .attr('width', text_bbox.width)
      .attr('height', text_bbox.height)
      .attr('x', text_bbox.x)
      .attr('y', text_bbox.y);
  }};
};

