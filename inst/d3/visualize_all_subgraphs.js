// !preview r2d3 data=subgraph_results

const margin = {left: 20, right: 1, top: 20, bottom: 35, middle: 15};
const h = height - margin.top - margin.bottom;
const w = width - margin.left - margin.right;
const unique_subgraph_ids = new Set();
const blend_mode = 'screen';
const line_color = "steelblue";
const merger_bars_color = "orangered";

// Place margined g
const g = svg.append('g')
  .style('isolation', 'isolate')
  .attr('transform', `translate(${margin.left}, ${margin.top})`);

// Control grid sizing
const units = {stream: 5,
               subgraph: 3,
               mergers: 0.8};

const total_units = units.stream + units.subgraph + units.mergers;

const heights = {
  stream: (units.stream/total_units)*h - margin.middle/2,
  mergers: (units.mergers/total_units)*h - margin.middle/2,
  n_subgraphs: (units.subgraph/total_units)*h,
};


const steps = [];
const num_subgraphs_at_step = [];
const merger_magnitudes = [];
let max_merger_magnitude = 0;
let max_num_subgraphs = 0;
data.forEach(({subgraphs, cutoff, n, n_mergers, total_merger_magnitude}, i) => {
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
});

// Construct streamgraph series
const series = d3.stack()
  .keys([...unique_subgraph_ids])
  .value((d,key) => d[key] || 0)
  .order(d3.stackOrderAppearance)
  (steps);

// Build scales
const y = d3.scaleLinear()
  .domain([d3.min(series, d => d3.min(d, d => d[0])), d3.max(series, d => d3.max(d, d => d[1]))])
  .range([heights.stream, 0])
  .nice();

const n_subgraphs_y = d3.scaleLinear()
  .domain([0, max_num_subgraphs])
  .range([heights.n_subgraphs, 10])
  .nice();

const x = d3.scaleLinear()
  .domain([1, steps.length])
  .range([0,w]);

const merger_sizes = d3.scaleLog()
  .domain([1, max_merger_magnitude])
  .range([2, heights.mergers*0.9]);

const palette = d3.schemePaired;
const color_subgraph = id => palette[id % palette.length];

const area = d3.area()
  .x((d,i) => x(i+1))
  .y0(d => y(d[0]))
  .y1(d => y(d[1]));

const line = d3.line()
  .x(d => x(d.step))
  .y(d => n_subgraphs_y(d.n));

// Width of each step on x-axis
const bar_width = x(1) - x(0);

// ===============================================================
// Draw Streamgraph

const stream = g.append('g').attr('id', 'streamgraph');
stream.append("g")
  .selectAll("path")
  .data(series)
  .enter().append("path")
    .attr("fill", ({key}) => color_subgraph(key))
    .attr("stroke", "white")
    .attr('stroke-width', 0.5)
    .attr("d", area)
  .append("title")
    .text(({key}) => key);

// ===============================================================
// Draw mergers bars
const mergers_g = g.append('g')
  .attr('id', 'mergers')
  .attr('transform', `translate(0, ${heights.stream + margin.middle})`);

mergers_g.append('text')
  .attr('y', heights.mergers*0.8)
  .attr('x', -10)
  .text('Subgraph mergers by magnitude');

mergers_g
  .selectAll('rect')
  .data(merger_magnitudes)
  .enter().append('rect')
  .attr('transform', d => `translate(${x(d.step)+1},0)` )
  .attr('height', d => merger_sizes(d.magnitude))
  .attr('width', bar_width)
  .attr('fill', merger_bars_color)
  .append('title')
    .text(d => `Step ${d.step}: Subgraph ${d.smaller}(n:${d.smaller_n}) merged with ${d.larger}(n:${d.larger_n}).`);


// ===============================================================
// Draw Subgraph count line
const n_subgraphs_g = g.append('g')
  .attr('id', 'n_subgraphs')
  .attr('transform', `translate(0, ${heights.stream + heights.mergers + margin.middle})`);

n_subgraphs_g.append('path')
  .attr('d', line(num_subgraphs_at_step))
  .attr('fill', 'none')
  .attr('stroke-width', 2)
  .attr('stroke', line_color);

// ===============================================================
// Draw Interaction bars for each step

const interaction_bars = g.append('g').attr('id', 'interaction_bars');

const subgraph_count_callout = n_subgraphs_g.append('g');
const subgraph_count_background = subgraph_count_callout.append('rect')
  .attr('fill', 'white')
  .attr('fill-opacity', 0.65);
const subgraph_count_text = subgraph_count_callout.append('text');

subgraph_count_callout.append('circle')
  .attr('r', 5)
  .attr('fill', 'none')
  .attr('stroke', 'black')
  .attr('stroke-width', 2);

const place_count_ball = function({step, n, cutoff}){

  const x_pos = x(step);
  const past_halfway = x_pos > w/2;

  subgraph_count_callout.attr('transform',`translate(${x_pos},${n_subgraphs_y(n)})`);
  subgraph_count_text
    .text(`${n} subgraphs w/ cutoff ${d3.format(".3f")(cutoff)}`)
    .attr('text-anchor', past_halfway ? "end": "start")
    .attr('x', past_halfway ? -10: 10);

  const text_bbox = subgraph_count_text.node().getBBox();
  subgraph_count_background
    .attr('width', text_bbox.width)
    .attr('height', text_bbox.height)
    .attr('x', text_bbox.x)
   .attr('y', text_bbox.y);
};

const max_step = num_subgraphs_at_step.find(({step, n}) => n === max_num_subgraphs);
const default_count_callout = function(){
  place_count_ball(max_step);
};

default_count_callout();

interaction_bars.on('mouseout', default_count_callout);

interaction_bars.selectAll('rect')
  .data(num_subgraphs_at_step)
  .enter().append('rect')
  .attr('transform', d => `translate(${x(d.step)},0)` )
  .attr('width', bar_width)
  .attr('height', h)
  .attr('fill', 'forestgreen')
  .attr('fill-opacity', 0)
  .on('mouseover', place_count_ball);


// =============================================
// Append axes

// Streamgraph
stream
  .append("g")
  .call(d3.axisRight(y).ticks(5))
  .attr('transform', `translate(-10,0)`)
  .call(
    add_label_to_axis({
      label: `Number of nodes = `,
      which_tick: 'last',
      before_val: true
    })
  )
  .call(extend_ticks, w)
  .call(remove_domain)
    .selectAll('text')
    .style('font-size', '1rem');

// Subgraph line
n_subgraphs_g
  .append("g")
  .call(d3.axisRight(n_subgraphs_y).ticks(3))
  .attr('transform', `translate(-10,0)`)
.call(extend_ticks, w)
.call(remove_domain)
  .selectAll('text')
  .style('font-size', '1rem');

// Universal x-axis
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






g.selectAll('text')
  .style('font-size', '0.95rem')
  .style('font-family', 'sans-serif');

//return svg.node();

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

function extend_ticks(g, tick_width) {
  g
    .selectAll(`.tick line`)
    .attr('x2', tick_width)
    .style('mix-blend-mode', blend_mode)
    .attr('stroke', 'lightgrey')
    .attr('stroke-opacity', 0.7);

  g
    .selectAll(`.tick text`)
    .attr('y', -9)
    .attr('x', 0);

}

function remove_domain(els) {
  els.selectAll(".domain").remove();
}

