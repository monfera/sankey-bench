/**
 * d3-sankey Copyright Mike Bostock
 *
 * Source repository: https://github.com/d3/d3-sankey
 *
 * Minor local modifications:
 *    - Stable sorting https://github.com/d3/d3-sankey/pull/19 (irrelevant here)
 *    - Inlining code here so it works with d3 v3.*
 *    - Replacing the relaxation loop with a rAF
 *    - Overriding alpha decay and iteration limit check with a half-sine curve
 */

var nest = d3.nest;
var interpolateNumber = d3.interpolateNumber;
var ascending = d3.ascending;
var min = d3.min;
var sum = d3.sum;

module.exports = function() {
  var sankey = {},
      nodeWidth = 24,
      nodePadding = 8,
      size = [1, 1],
      nodes = [],
      links = [];

  sankey.nodeWidth = function(_) {
    if (!arguments.length) return nodeWidth;
    nodeWidth = +_;
    return sankey;
  };

  sankey.nodePadding = function(_) {
    if (!arguments.length) return nodePadding;
    nodePadding = +_;
    return sankey;
  };

  sankey.nodes = function(_) {
    if (!arguments.length) return nodes;
    nodes = _;
    return sankey;
  };

  sankey.links = function(_) {
    if (!arguments.length) return links;
    links = _;
    return sankey;
  };

  sankey.size = function(_) {
    if (!arguments.length) return size;
    size = _;
    return sankey;
  };

  sankey.layout = function(iterations, callback) {
    computeNodeLinks();
    computeNodeValues();
    computeNodeBreadths();
    computeNodeDepths(iterations, callback);
  };

  sankey.relayout = function() {
    computeLinkDepths();
    return sankey;
  };

  sankey.snap = function(fixedNode) {
    var nodesByBreadth = getNodesByBreadth();
    resolveCollisions(nodesByBreadth, fixedNode);
    return sankey;
  };

  sankey.snapRelayout = function(fixedNode) {
    sankey.snap(fixedNode);
    sankey.relayout();
    return sankey;
  };

  sankey.link = function() {
    var curvature = .5;

    function link(d) {
      var x0 = d.source.x + d.source.dx,
          x1 = d.target.x,
          xi = interpolateNumber(x0, x1),
          x2 = xi(curvature),
          x3 = xi(1 - curvature),
          y0 = d.source.y + d.sy + d.dy / 2,
          y1 = d.target.y + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0
        + "C" + x2 + "," + y0
        + " " + x3 + "," + y1
        + " " + x1 + "," + y1;
    }

    link.curvature = function(_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  };

  function getNodesByBreadth() {
    return nest()
      .key(function(d) { return d.x; })
      .sortKeys(ascending)
      .entries(nodes)
      .map(function(d) { return d.values; })
  }

  // Populate the sourceLinks and targetLinks for each node.
  // Also, if the source and target are not objects, assume they are indices.
  function computeNodeLinks() {
    nodes.forEach(function(node) {
      node.sourceLinks = [];
      node.targetLinks = [];
    });
    links.forEach(function(link, i) {
      var source = link.source,
          target = link.target;
      if (typeof source === "number") source = link.source = nodes[link.source];
      if (typeof target === "number") target = link.target = nodes[link.target];
      link.originalIndex = i;
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
    });
  }

  // Compute the value (size) of each node by summing the associated links.
  function computeNodeValues() {
    nodes.forEach(function(node) {
      node.value = Math.max(
        sum(node.sourceLinks, value),
        sum(node.targetLinks, value)
      );
    });
  }

  // Iteratively assign the breadth (x-position) for each node.
  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
  // nodes with no incoming links are assigned breadth zero, while
  // nodes with no outgoing links are assigned the maximum breadth.
  function computeNodeBreadths() {
    var remainingNodes = nodes,
        nextNodes,
        x = 0;

    while (remainingNodes.length) {
      nextNodes = [];
      remainingNodes.forEach(function(node) {
        node.x = x;
        node.dx = nodeWidth;
        node.sourceLinks.forEach(function(link) {
          if (nextNodes.indexOf(link.target) < 0) {
            nextNodes.push(link.target);
          }
        });
      });
      remainingNodes = nextNodes;
      ++x;
    }

    //
    moveSinksRight(x);
    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
  }

  // function moveSourcesRight() {
  //   nodes.forEach(function(node) {
  //     if (!node.targetLinks.length) {
  //       node.x = min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
  //     }
  //   });
  // }

  function moveSinksRight(x) {
    nodes.forEach(function(node) {
      if (!node.sourceLinks.length) {
        node.x = x - 1;
      }
    });
  }

  function scaleNodeBreadths(kx) {
    nodes.forEach(function(node) {
      node.x *= kx;
    });
  }

  function ascendingDepth(a, b) {
    return a.y - b.y;
  }

  function resolveCollisionsInBreadth(nodes, fixedNode) {
    var node,
        dy,
        y0 = 0,
        fr = fixedNode ? fixedNode.dy / 2 : 0,
        fym = fixedNode ? fixedNode.y + fr : 0,
        i;

    // Push any overlapping nodes down.
    nodes.sort(function(a, b) {
      function val(thing) {

        var fixed = nodes.indexOf(fixedNode) === -1 ? null : fixedNode;
        var r = thing.dy / 2;
        var ym = thing.y + r;

        var jump = 2 * fr;

        if(thing === fixed || !fixed) {
          return ym;
        } else if(ym < fym && ym + r > fym - fr) {
          return ym + jump;
        } else if(ym > fym && ym - r < fym + fr) {
          return ym - jump;
        } else if (ym < fym) {
          return ym - jump;
        } else if(ym > fym) {
          return ym + jump;
        }

        debugger;

        return fixed && (thing.y + thing.dy < fixed.y) ? thing.y + fixed.dy : thing.y
      }
      var ay = val(a);
      var by = val(b);
      return ay - by;
    });
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      dy = y0 - node.y;
      if (dy > 0 && node !== fixedNode) node.y += dy;
      y0 = node.y + node.dy + nodePadding;
    }

    // If the bottommost node goes outside the bounds, push it back up.
    dy = y0 - nodePadding - size[1];
    if (dy > 0) {
      y0 = node.y -= dy;

      // Push any overlapping nodes back up.
      for (i = nodes.length - 2; i >= 0; i--) {
        node = nodes[i];
        dy = node.y + node.dy + nodePadding - y0;
        if (dy > 0 && node !== fixedNode) node.y -= dy;
        y0 = node.y;
      }
    }
  }

  function resolveCollisions(nodesByBreadth, fixedNode) {
    nodesByBreadth.forEach(function(nodes) {
      resolveCollisionsInBreadth(nodes, fixedNode);
    });
  }

  function computeNodeDepths(iterations, callback) {
    var nodesByBreadth = getNodesByBreadth();

    //
    initializeNodeDepth();

    if(iterations) {
      window.requestAnimationFrame(function render(t) {

        var alpha = Math.pow(Math.sin(t / 3000), 2);

        relaxRightToLeft(alpha);
        resolveCollisions(nodesByBreadth);
        relaxLeftToRight(alpha);
        resolveCollisions(nodesByBreadth);
        computeLinkDepths();
        callback(sankey);

        if(t / 3000 < Math.PI) {
          window.requestAnimationFrame(render);
        }

      });
    } else {
      resolveCollisions(nodesByBreadth);
      computeLinkDepths();
      callback(sankey);
    }

    function initializeNodeDepth() {
      var ky = min(nodesByBreadth, function(nodes) {
        return (size[1] - (nodes.length - 1) * nodePadding) / sum(nodes, value);
      });

      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node, i) {
          node.y = i;
          node.dy = node.value * ky;
        });
      });

      links.forEach(function(link) {
        link.dy = link.value * ky;
      });
    }

    function relaxLeftToRight(alpha) {
      nodesByBreadth.forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.targetLinks.length) {
            var y = sum(node.targetLinks, weightedSource) / sum(node.targetLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedSource(link) {
        return center(link.source) * link.value;
      }
    }

    function relaxRightToLeft(alpha) {
      nodesByBreadth.slice().reverse().forEach(function(nodes) {
        nodes.forEach(function(node) {
          if (node.sourceLinks.length) {
            var y = sum(node.sourceLinks, weightedTarget) / sum(node.sourceLinks, value);
            node.y += (y - center(node)) * alpha;
          }
        });
      });

      function weightedTarget(link) {
        return center(link.target) * link.value;
      }
    }
  }

  function computeLinkDepths() {
    nodes.forEach(function(node) {
      node.sourceLinks.sort(ascendingTargetDepth);
      node.targetLinks.sort(ascendingSourceDepth);
    });
    nodes.forEach(function(node) {
      var sy = 0, ty = 0;
      node.sourceLinks.forEach(function(link) {
        link.sy = sy;
        sy += link.dy;
      });
      node.targetLinks.forEach(function(link) {
        link.ty = ty;
        ty += link.dy;
      });
    });

    function ascendingSourceDepth(a, b) {
      return (a.source.y - b.source.y) || (a.originalIndex - b.originalIndex);
    }

    function ascendingTargetDepth(a, b) {
      return (a.target.y - b.target.y) || (a.originalIndex - b.originalIndex);
    }
  }

  function center(node) {
    return node.y + node.dy / 2;
  }

  function value(link) {
    return link.value;
  }

  return sankey;
}
