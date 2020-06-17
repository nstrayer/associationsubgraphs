// !preview r2d3 data=subgraph_results

const margin = {left: 20, right: 1, top: 20, bottom: 35, middle: 10};
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
data.forEach(({subgraphs, n, n_mergers, total_merger_magnitude}, i) => {
  const step = i+1;
  const step_map = {step};

  HTMLWidgets.dataframeToD3(subgraphs)
    .forEach(({node,subgraph}) => {
      step_map[subgraph] = step_map[subgraph] + 1 | 1;
      unique_subgraph_ids.add(subgraph);
    });
  steps.push(step_map);

  num_subgraphs_at_step.push({step, n});
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
  .range([heights.n_subgraphs, 0])
  .nice();

const x = d3.scaleLinear()
  .domain([1, steps.length])
  .range([0,w])
  .nice();

const merger_sizes = d3.scaleLog()
  .domain([1, max_merger_magnitude])
  .range([1, heights.mergers*0.9]);

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
  //.attr('y', d => -merger_sizes(d.magnitude)/2)
  .attr('height', d => merger_sizes(d.magnitude))
  .attr('width', bar_width-2)
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
  .call(
    add_label_to_axis({
      label: `Number of subgraphs = `,
      which_tick: 'last',
      before_val: true
    })
  )
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


//const interaction_bars = g.append('g').attr('id', 'interaction_bars');
//interaction_bars.selectAll('g')
//  .data(num_subgraphs_at_step)
//  .enter().append('g')
//  .attr('transform', d => `translate(${x(d.step)},0)` )
//  .each(function(d){
//    d3.select(this)
//    .append('rect')
//    .attr('width', bar_width)
//    .attr('height', h)
//    .attr('fill', 'forestgreen')
//    .attr('fill-opacity', 0);
//    })
//.append('title')
//    .text(d => `Step ${d.step}`);


g.selectAll('text')
  .style('font-size', '0.95rem')
  .style('font-family', 'sans-serif')

return svg.node();

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

