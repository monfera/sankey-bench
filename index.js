var d3 = require('d3');
var d3sankey = require('./d3-sankey')
var c = {
  nodeTextOffset: 5,
  nodeWidth: 20,
  nodePadding: 15,
  sankeyIterations: 50,
  vertical: false
};

function keyFun(d) {return d.key;}

function repeat(d) {return [d];}

function viewModel(sankey) {

  return {
    key: 0,
    translateX: margin.l,
    translateY: margin.t,
    dragLength: c.vertical ? width : height,
    nodes: sankey.nodes(),
    links: sankey.links(),
    sankey: sankey
  };
}

function render(svg, callbacks) {
  return function(sankey) {

    var dragInProgress = false;
    var hovered = false;

    function attachPointerEvents(selection, eventSet) {
      selection
        .on('mouseover', function (d) {
          if (!dragInProgress) {
            eventSet.hover(this, d);
            hovered = [this, d];
          }
        })
        .on('mouseout', function (d) {
          if (!dragInProgress) {
            eventSet.unhover(this, d);
            hovered = false;
          }
        })
        .on('click', function (d) {
          if (hovered) {
            eventSet.unhover(this, d);
            hovered = false;
          }
          if (!dragInProgress) {
            eventSet.select(this, d);
          }
        });
    }

    function linkPath(d) {
      return d.sankey.link()(d.link);
    }

    var colorer = d3.scale.category20();

    var sankey = svg.selectAll('.sankey')
      .data([viewModel(sankey)], keyFun);

    sankey.exit().remove();

    sankey.enter()
      .append('g')
      .classed('sankey', true)
      .attr('overflow', 'visible')
      .style('box-sizing', 'content-box')
      .style('position', 'absolute')
      .style('left', 0)
      .style('overflow', 'visible')
      .style('shape-rendering', 'geometricPrecision')
      .style('pointer-events', 'auto')
      .style('box-sizing', 'content-box');

    sankey
      .attr('transform', function(d) {
        return 'translate(' + d.translateX + ',' + d.translateY + ')';
      });

    var sankeyLinks = sankey.selectAll('.sankeyLinks')
      .data(repeat, keyFun);

    sankeyLinks.enter()
      .append('g')
      .classed('sankeyLinks', true)
      .style('transform', c.vertical ? 'matrix(0,1,1,0,0,0)' : 'matrix(1,0,0,1,0,0)')
      .style('fill', 'none')
      .style('stroke', 'black')
      .style('stroke-opacity', 0.25);

    var sankeyLink = sankeyLinks.selectAll('.sankeyPath')
      .data(function(d) {
        return d.sankey.links().map(function(l) {
          return {
            link: l,
            sankey: d.sankey
          };
        });
      });

    sankeyLink.exit().remove();

    sankeyLink.enter()
      .append('path')
      .classed('sankeyPath', true)
      .call(attachPointerEvents, callbacks.linkEvents);

    sankeyLink
      .attr('d', linkPath)
      .style('stroke-width', function(d) {return Math.max(1, d.link.dy);});

    var sankeyNodes = sankey.selectAll('.sankeyNodes')
      .data(repeat, keyFun);

    sankeyNodes.enter()
      .append('g')
      .style('shape-rendering', 'crispEdges')
      .classed('sankeyNodes', true);

    var sankeyNode = sankeyNodes.selectAll('.sankeyNode')
      .data(function(d) {
        return d.sankey.nodes().map(function(l) {
          return {
            node: l,
            sankey: d.sankey,
            model: d
          };
        });
      }, function(d) {return d.node.name;});

    sankeyNode.exit().remove();

    sankeyNode.enter()
      .append('g')
      .classed('sankeyNode', true)
      .call(d3.behavior.drag()
        .origin(function(d) {return c.vertical ? {x: d.node.y} : d.node;})
        .on('dragstart', function(d) {
          d.node.dragStartLocation = c.vertical ? d3.event.x : d3.event.y;
          this.parentNode.appendChild(this);
          dragInProgress = true;
          if(hovered) {
            callbacks.nodeEvents.unhover.apply(0, hovered);
            hovered = false;
          }
        })
        .on('drag', function(d) {
            if(c.vertical) {
              d.node.y = Math.max(0, Math.min(d.model.dragLength - d.node.dy, d3.event.x));
              d3.select(this).style('transform', 'translate(' + d.node.y + 'px,' + d.node.x + 'px)');
            } else {
              d.node.y = Math.max(0, Math.min(d.model.dragLength - d.node.dy, d3.event.y));
              d3.select(this).style('transform', 'translate(' + d.node.x + 'px,' + d.node.y + 'px)');
            }

            d.sankey.relayout();
            sankeyLink.attr('d', linkPath);
          }
        )
        .on('dragend', function() {
          dragInProgress = false;
        }));

    sankeyNode
      .style('transform', c.vertical ?
        function(d) {return 'translate(' + (Math.floor(d.node.y) - 0.5) + 'px, ' + (Math.floor(d.node.x) + 0.5) + 'px)';} :
        function(d) {return 'translate(' + (Math.floor(d.node.x) - 0.5) + 'px, ' + (Math.floor(d.node.y) + 0.5) + 'px)';});

    var nodeRect = sankeyNode.selectAll('.nodeRect')
      .data(repeat);

    nodeRect.exit().remove();

    nodeRect.enter()
      .append('rect')
      .classed('nodeRect', true)
      .style('shape-rendering', 'crispEdges')
      .style('fill', function(d) {return colorer(d.sankey.nodes().indexOf(d.node));})
      .style('stroke-width', 0.5)
      .style('stroke', 'black')
      .style('stroke-opacity', 1)
      .call(attachPointerEvents, callbacks.nodeEvents);

    nodeRect // ceil, +/-0.5 and crispEdges is wizardry for consistent border width on all 4 sides
      .attr(c.vertical ? 'height' : 'width', function(d) {return Math.ceil(d.node.dx + 0.5);})
      .attr(c.vertical ? 'width' : 'height', function(d) {return Math.ceil(d.node.dy - 0.5);});

    var nodeLabel = sankeyNode.selectAll('.nodeLabel')
      .data(repeat);

    nodeLabel.exit().remove();

    nodeLabel.enter()
      .append('text')
      .classed('nodeLabel', true);

    nodeLabel
      .attr('x', function(d) {return c.vertical ? d.node.dy / 2 : d.node.dx + c.nodeTextOffset;})
      .attr('y', function(d) {return c.vertical ? d.node.dx / 2 : d.node.dy / 2;})
      .text(function(d) {return d.node.name;})
      .attr('alignment-baseline', 'middle')
      .attr('text-anchor', c.vertical ? 'middle' : 'start')
      .style('font-family', 'sans-serif')
      .style('font-size', '10px');
  };
};


var width = 800;
var height = 800;
var margin = {
  l: 40,
  t: 40,
  r: 120,
  b: 40
};

var svg = d3.select('body').append('svg')
  .attr('width', width + margin.l + margin.r)
  .attr('height', height + margin.t + margin.b);

var nodes = [{"label":"Afghanistan","visible":true},{"label":"Air Force","visible":true},{"label":"Army","visible":true},{"label":"Atlantic Ocean","visible":true},{"label":"Classified","visible":true},{"label":"Djibouti","visible":true},{"label":"Fire Scout","visible":true},{"label":"Fire Scout MQ-8B","visible":true},{"label":"Global Hawk","visible":true},{"label":"Global Hawk EQ-4B","visible":true},{"label":"Global Hawk RQ-4A","visible":true},{"label":"Gray Eagle","visible":true},{"label":"Gray Eagle MQ-1C","visible":true},{"label":"Hummingbird","visible":true},{"label":"Hummingbird A160T Hummingbird","visible":true},{"label":"Hunter","visible":true},{"label":"Hunter MQ-5A","visible":true},{"label":"Hunter MQ-5B","visible":true},{"label":"Hunter RQ-5A","visible":true},{"label":"IGNAT","visible":true},{"label":"IGNAT RQ-1L","visible":true},{"label":"Iran","visible":true},{"label":"Iraq","visible":true},{"label":"Italy","visible":true},{"label":"K-MAX","visible":true},{"label":"K-MAX K-MAX","visible":true},{"label":"Kuwait","visible":true},{"label":"Libya","visible":true},{"label":"Mali","visible":true},{"label":"Marine Corps","visible":true},{"label":"Navy","visible":true},{"label":"Pakistan","visible":true},{"label":"Phantom","visible":true},{"label":"Phantom QF-4","visible":true},{"label":"Phantom QF-4E","visible":true},{"label":"Phantom QRF-4C","visible":true},{"label":"Predator","visible":true},{"label":"Predator MQ-1","visible":true},{"label":"Predator MQ-1B","visible":true},{"label":"Predator MQ-1L","visible":true},{"label":"Predator RQ-1","visible":true},{"label":"Predator RQ-1B","visible":true},{"label":"Predator RQ-1L","visible":true},{"label":"Reaper","visible":true},{"label":"Reaper MQ-9","visible":true},{"label":"Reaper MQ-9A","visible":true},{"label":"Sentinel","visible":true},{"label":"Sentinel RQ-170","visible":true},{"label":"Seychelles","visible":true},{"label":"Shadow","visible":true},{"label":"Shadow RQ-7B","visible":true},{"label":"United Arab Emirates","visible":true},{"label":"United States","visible":true},{"label":"Warrior","visible":true},{"label":"Warrior MQ-1B","visible":true},{"label":"Warrior MQ-1C","visible":true},{"label":"Warrior RQ-1C","visible":true}];
var links = [{"visible":true,"source":"1","target":"0","value":42,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"4","value":18,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"5","value":6,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"21","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"22","value":24,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"23","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"26","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"28","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"31","value":6,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"48","value":2,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"51","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"1","target":"52","value":35,"label":"Air Force --> United States"},{"visible":true,"source":"2","target":"0","value":23,"label":"Air Force --> Iraq"},{"visible":true,"source":"2","target":"22","value":17,"label":"Air Force --> Iraq"},{"visible":true,"source":"2","target":"52","value":10,"label":"Air Force --> Iraq"},{"visible":true,"source":"6","target":"30","value":4,"label":"Air Force --> Pakistan"},{"visible":true,"source":"7","target":"6","value":4,"label":"Air Force --> Pakistan"},{"visible":true,"source":"8","target":"1","value":4,"label":"Air Force --> Pakistan"},{"visible":true,"source":"8","target":"30","value":1,"label":"Air Force --> Pakistan"},{"visible":true,"source":"9","target":"8","value":1,"label":"Air Force --> Kuwait"},{"visible":true,"source":"10","target":"8","value":4,"label":"Air Force --> Pakistan"},{"visible":true,"source":"11","target":"2","value":10,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"12","target":"11","value":10,"label":"Air Force --> United States"},{"visible":true,"source":"13","target":"2","value":1,"label":"Air Force --> Pakistan"},{"visible":true,"source":"14","target":"13","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"15","target":"2","value":26,"label":"Air Force --> United States"},{"visible":true,"source":"16","target":"15","value":4,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"17","target":"15","value":18,"label":"Air Force --> Classified"},{"visible":true,"source":"18","target":"15","value":4,"label":"Air Force --> Classified"},{"visible":true,"source":"19","target":"2","value":3,"label":"Army --> United States"},{"visible":true,"source":"20","target":"19","value":3,"label":"Air Force --> United States"},{"visible":true,"source":"24","target":"29","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"25","target":"24","value":1,"label":"Air Force --> Pakistan"},{"visible":true,"source":"29","target":"0","value":1,"label":"Air Force --> Classified"},{"visible":true,"source":"30","target":"0","value":1,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"30","target":"3","value":1,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"30","target":"27","value":1,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"30","target":"52","value":2,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"32","target":"1","value":9,"label":"Air Force --> Iraq"},{"visible":true,"source":"33","target":"32","value":1,"label":"Air Force --> Iraq"},{"visible":true,"source":"34","target":"32","value":7,"label":"Air Force --> Iraq"},{"visible":true,"source":"35","target":"32","value":1,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"36","target":"1","value":102,"label":"Air Force --> United States"},{"visible":true,"source":"37","target":"36","value":16,"label":"Army --> United States"},{"visible":true,"source":"38","target":"36","value":59,"label":"Air Force --> Classified"},{"visible":true,"source":"39","target":"36","value":13,"label":"Air Force --> Classified"},{"visible":true,"source":"40","target":"36","value":4,"label":"Air Force --> United States"},{"visible":true,"source":"41","target":"36","value":3,"label":"Army --> Iraq"},{"visible":true,"source":"42","target":"36","value":7,"label":"Air Force --> Iraq"},{"visible":true,"source":"43","target":"1","value":22,"label":"Air Force --> United States"},{"visible":true,"source":"44","target":"43","value":13,"label":"Army --> Iraq"},{"visible":true,"source":"45","target":"43","value":9,"label":"Army --> United States"},{"visible":true,"source":"46","target":"1","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"47","target":"46","value":1,"label":"Air Force --> United States"},{"visible":true,"source":"49","target":"2","value":1,"label":"Army --> United States"},{"visible":true,"source":"50","target":"49","value":1,"label":"Air Force --> Classified"},{"visible":true,"source":"53","target":"2","value":9,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"54","target":"53","value":5,"label":"Air Force --> Afghanistan"},{"visible":true,"source":"55","target":"53","value":1,"label":"Army --> Iraq"},{"visible":true,"source":"56","target":"53","value":3,"label":"Army --> Iraq"}].map(function(d) {return {visible: d.visible, source: parseInt(d.source), target: parseInt(d.target), value: d.value, label: d.label};});

function nil() {}

var renderer = render(svg, {linkEvents: {hover: nil, unhover: nil, select: nil}, nodeEvents: {hover: nil, unhover: nil, select: nil}});

var sankey = d3sankey()
  .size(c.vertical ? [height, width]: [width, height])
  .nodeWidth(c.nodeWidth)
  .nodePadding(c.nodePadding)
  .nodes(nodes.map(function(d) {return {name: d.label};}))
  .links(links)
  .layout(c.sankeyIterations, renderer);

