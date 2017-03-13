/**
 * Copyright 2012-2017, Plotly, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var d3sankey = require('./d3-sankey');

var data = require('./energy');

var width = 800;
var height = 500;
var margin = {
  l: 20,
  t: 20,
  r: 200,
  b: 20
};

var c = {
  nodeTextOffset: 5,
  nodeWidth: 15,
  nodePadding: 14,
  sankeyIterations: 100,
  vertical: false,
  nodeOpacity: 0.7,
  nodeSalientOpacity: 1,
  linkOpacity: 0.2,
  linkSalientOpacity: 0.4
};

function keyFun(d) {return d.key;}

function repeat(d) {return [d];}

function noop() {}

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
      .style('stroke-opacity', c.linkOpacity);

    var sankeyLink = sankeyLinks.selectAll('.sankeyPath')
      .data(function(d) {
        return d.sankey.links().map(function(l) {
          return {
            link: l,
            sankey: d.sankey
          };
        });
      });

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
            //callbacks.nodeEvents.unhover.apply(0, hovered);
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

            d.sankey.relayout(d.node);
            sankeyLink.attr('d', linkPath);
            sankeyNode
              .style('transform', c.vertical ?
                function(d) {return 'translate(' + (Math.floor(d.node.y) - 0.5) + 'px, ' + (Math.floor(d.node.x) + 0.5) + 'px)';} :
                function(d) {return 'translate(' + (Math.floor(d.node.x) - 0.5) + 'px, ' + (Math.floor(d.node.y) + 0.5) + 'px)';});
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

    nodeRect.enter()
      .append('rect')
      .classed('nodeRect', true)
      .style('shape-rendering', 'crispEdges')
      .style('fill', function(d) {return colorer(d.sankey.nodes().indexOf(d.node));})
      .style('stroke-width', 0.5)
      .style('stroke', 'black')
      .style('stroke-opacity', 1)
      .style('fill-opacity', c.nodeOpacity)
      .call(attachPointerEvents, callbacks.nodeEvents);

    nodeRect // ceil, +/-0.5 and crispEdges is wizardry for consistent border width on all 4 sides
      .attr(c.vertical ? 'height' : 'width', function(d) {return Math.ceil(d.node.dx + 0.5);})
      .attr(c.vertical ? 'width' : 'height', function(d) {return Math.ceil(d.node.dy - 0.5);});

    var nodeLabel = sankeyNode.selectAll('.nodeLabel')
      .data(repeat);

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

var svg = d3.select('body').append('svg')
  .attr('width', width + margin.l + margin.r)
  .attr('height', height + margin.t + margin.b);

var renderer = render(svg, {
  linkEvents: {
    hover: function(e, l) {
      d3.selectAll('.nodeRect')
        .filter(function(n) {return n.node.name === l.link.source.name || n.node.name === l.link.target.name;})
        .style('fill-opacity', c.nodeSalientOpacity);
      d3.select(e).style('stroke-opacity', c.linkSalientOpacity);
    },
    unhover: function(e, d) {
      d3.selectAll('.nodeRect').style('fill-opacity', c.nodeOpacity);
      d3.select(e).style('stroke-opacity', c.linkOpacity);
    },
    select: noop
  },
  nodeEvents: {
    hover: function(e, n) {
      d3.selectAll('.sankeyPath')
        .filter(function(l) {return n.node.name === l.link.source.name || n.node.name === l.link.target.name;})
        .style('stroke-opacity', c.linkSalientOpacity);
      d3.select(e).style('fill-opacity', c.nodeSalientOpacity);
    },
    unhover: function(e, d) {
      d3.selectAll('.sankeyPath').style('stroke-opacity', c.linkOpacity);
      d3.select(e).style('fill-opacity', c.nodeOpacity);
    },
    select: noop
  }
});

d3sankey()
  .size(c.vertical ? [height, width]: [width, height])
  .nodeWidth(c.nodeWidth)
  .nodePadding(c.nodePadding)
  .nodes(data.nodes)
  .links(data.links)
  .layout(c.sankeyIterations, renderer);