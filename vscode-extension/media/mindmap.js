// diagram/mindmap.js — parse a nested Markdown outline into a left/right
// balanced mindmap (Miro / MindNode style). Single module, no dependencies.
//
//   window.Mindmap.render(svgEl, markdownString)  -> draws + returns tree
//   window.Mindmap.zoomIn() / zoomOut() / resetView()
//   window.Mindmap.toggleFit()                    -> returns true if now "full"
//   window.Mindmap.expandAll() / collapseAll()    -> collapseAll = back to L1
//
// Layout: root is a centered rounded box. Top-level branches are split into a
// right group and a left group (balanced once, then fixed). Each side is a tidy
// horizontal tree growing away from the root; labels are bare text; each
// top-level branch owns a color shared by all its descendants; `Q:` lines are
// red. Nodes with children show a dot badge — filled = collapsed (has hidden
// children), hollow = expanded. Click a node or its dot to toggle.

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  // Branch colors are generated per map by spreading the actual number of
  // top-level branches evenly around the hue wheel — so colors never repeat
  // and adjacent branches are maximally far apart in hue, for any count.
  // Tune saturation/lightness here to change the overall palette feel.
  var COLOR_SAT = 0.68, COLOR_LIGHT = 0.48, COLOR_OFFSET = 8;
  function hslToHex(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    var m = l - c / 2;
    function hx(v) { var n = Math.round((v + m) * 255).toString(16); return n.length < 2 ? "0" + n : n; }
    return "#" + hx(r) + hx(g) + hx(b);
  }
  function colorFor(i, total) {
    var hue = (COLOR_OFFSET + i * 360 / Math.max(1, total)) % 360;
    return hslToHex(hue, COLOR_SAT, COLOR_LIGHT);
  }

  // Layout constants
  var COL_GAP = 46;   // horizontal gap between a parent's edge and its children
  var LINE_H = 16;    // px per wrapped text line
  var ROW_PAD = 12;   // vertical padding between sibling leaves
  var ROOT_H = 40;    // root box height
  var DOT_R = 5;      // collapse/expand badge radius
  var DOT_GAP = 10;   // gap from label edge to the badge

  // View constants
  var READABLE_W = 1300, READABLE_H = 840;
  var MIN_SCALE = 0.05, MAX_SCALE = 16;


  // ---- 1. Parse ------------------------------------------------------------
  function parseMarkdown(md) {
    var lines = String(md).split(/\r?\n/);
    var root = { text: "MINDMAP", children: [] };
    var rootTitle = null;
    var stack = [{ indent: -1, node: root }];

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw.trim()) continue;
      if (/^\s*<!--/.test(raw) || /^\s*>/.test(raw)) continue; // comments, quotes

      var h1 = raw.match(/^#\s+(.+)$/);
      if (h1) { if (rootTitle === null) rootTitle = h1[1].trim(); continue; }

      var text, indent;
      // `##`+ headings sit ABOVE bullets: a synthetic negative indent (by
      // heading level) makes the bullets below nest under the current heading
      // until the next heading, while headings of equal level stay siblings.
      var head = raw.match(/^(#{2,})\s+(.+)$/);
      if (head) {
        text = head[2].trim();
        indent = -100 + head[1].length; // ## -> -98, ### -> -97, ...
      } else {
        var bullet = raw.match(/^(\s*)(?:[-*]|\d+\.)\s+(.+)$/);
        if (!bullet) continue;
        indent = bullet[1].replace(/\t/g, "  ").length;
        text = bullet[2].trim();
      }

      // GitHub task checkbox: `- [ ] todo` / `- [x] done` (shown ☐ / ☑).
      var task = false, done = false;
      var cb = text.match(/^\[([ xX])\]\s+(.*)$/);
      if (cb) { task = true; done = /x/i.test(cb[1]); text = cb[2]; }

      text = text.replace(/\*+/g, "").replace(/`/g, "").trim();

      // Markdown link `[label](url)`: show the label, keep the first url so the
      // node can open it. Handles multiple links on one line.
      var url = null;
      text = text.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, function (_, label, href) {
        if (!url) url = href;
        return label;
      }).trim();
      if (!text) continue;

      var display = (task ? (done ? "☑ " : "☐ ") : "") + text;
      var node = {
        text: display, children: [], q: /^Q[:?]/i.test(text),
        task: task, done: done, url: url,
      };
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ indent: indent, node: node });
    }

    if (rootTitle) {
      // Root box shows just the project name — drop a trailing "Brainstorm"
      // (and any separator before it), e.g. "Bali & Me — Brainstorm" -> "Bali & Me".
      var name = rootTitle.replace(/[\s—–\-:|]*brainstorm\s*$/i, "").trim();
      root.text = name || rootTitle;
    }
    (function depth(n, d) {
      n.depth = d;
      n.children.forEach(function (c) { depth(c, d + 1); });
    })(root, 0);
    return root;
  }

  // ---- 2. Collapse helpers -------------------------------------------------
  function hasKids(n) { return n.children && n.children.length > 0; }
  function isOpen(n) { return hasKids(n) && !n._collapsed; }

  // Default view: show root + depth-1 branches only (everything deeper hidden).
  function collapseToLevel1(root) {
    (function walk(n) {
      if (n.depth >= 1 && hasKids(n)) n._collapsed = true;
      n.children.forEach(walk);
    })(root);
  }

  // ---- 3. Text helpers -----------------------------------------------------
  function wrapLines(str, maxChars) {
    var words = String(str).split(/\s+/);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if ((line + " " + w).trim().length > maxChars && line) {
        lines.push(line);
        line = w;
      } else {
        line = line ? line + " " + w : w;
      }
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push(String(str));
    return lines;
  }

  function nodeFont(node) { return node.depth === 1 ? 15 : 12; }
  function nodeWrapChars(node) { return node.depth === 1 ? 24 : 22; }

  function measure(node) {
    var lines = wrapLines(node.text, nodeWrapChars(node));
    node._lines = lines;
    var longest = 0;
    for (var i = 0; i < lines.length; i++) longest = Math.max(longest, lines[i].length);
    return longest * nodeFont(node) * 0.58;
  }

  // Leaf count for balancing — a collapsed node counts as a single leaf.
  function countLeaves(node) {
    if (!isOpen(node)) return 1;
    return node.children.reduce(function (s, c) { return s + countLeaves(c); }, 0);
  }

  // ---- 4. Layout (left/right balanced tidy tree) ---------------------------
  function layout(root) {
    root.x = 0;
    root.y = 0;
    var rootW = Math.max(90, (root.text || "MINDMAP").length * 11 + 28);
    root._w = rootW;

    var right = [], left = [];
    var fixed = root.children.length && root.children.every(function (b) { return b._side != null; });
    if (fixed) {
      // Sides were assigned on first render; keep them stable across redraws.
      root.children.forEach(function (b) { (b._side > 0 ? right : left).push(b); });
    } else {
      var rl = 0, ll = 0;
      var total = root.children.length;
      root.children.forEach(function (b, i) {
        b._color = colorFor(i, total);
        var leaves = countLeaves(b);
        if (rl <= ll) { b._side = 1; right.push(b); rl += leaves; }
        else { b._side = -1; left.push(b); ll += leaves; }
      });
    }

    layoutSide(right, +1, rootW / 2);
    layoutSide(left, -1, rootW / 2);
  }

  function layoutSide(branches, sign, rootEdge) {
    if (!branches.length) return;
    var cursor = { y: 0 };

    function place(node, parentX, parentWidth) {
      node._side = sign;
      node.x = parentX + sign * (parentWidth + COL_GAP);
      var w = measure(node);
      node._w = w;

      if (!isOpen(node)) {
        var h = node._lines.length * LINE_H;
        node.y = cursor.y + h / 2;
        cursor.y += h + ROW_PAD;
      } else {
        node.children.forEach(function (c) { place(c, node.x, w); });
        var first = node.children[0], last = node.children[node.children.length - 1];
        node.y = (first.y + last.y) / 2;
      }
    }

    branches.forEach(function (b) { place(b, sign * rootEdge, 0); });

    var ys = [];
    (function collect(ns) {
      ns.forEach(function (n) { ys.push(n.y); if (isOpen(n)) collect(n.children); });
    })(branches);
    var mid = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    (function shift(ns) {
      ns.forEach(function (n) { n.y -= mid; if (isOpen(n)) shift(n.children); });
    })(branches);
  }

  // ---- 5. Draw -------------------------------------------------------------
  function curvedPath(x1, y1, x2, y2) {
    var dx = (x2 - x1) * 0.5;
    return "M " + x1 + " " + y1 +
      " C " + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2;
  }

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function toggle(inst, node) {
    node._collapsed = !node._collapsed;
    redraw(inst);
  }

  function drawLabel(node, nodeG, inst) {
    var side = node._side || 1;
    var anchor = side < 0 ? "end" : "start";
    var cls = node.q ? "node-detail node-q" : node.depth === 1 ? "node-topic" : "node-detail";
    // Q → red, done task → muted, link → accent, else black (branches keep color).
    var fill = node.q ? "#b91c1c" : node.done ? "#9aa4af" : node.url ? "#2563eb" : "#1f2937";
    var t = el("text", { class: cls, "text-anchor": anchor, fill: fill });
    if (node.done) t.setAttribute("text-decoration", "line-through");
    else if (node.url) t.setAttribute("text-decoration", "underline");
    var lines = node._lines;
    var startY = node.y - (lines.length - 1) * LINE_H / 2;
    for (var i = 0; i < lines.length; i++) {
      var ts = el("tspan", {
        x: node.x, y: startY + i * LINE_H,
        "text-anchor": anchor, "dominant-baseline": "central",
      });
      ts.textContent = lines[i];
      t.appendChild(ts);
    }
    // A link opens its url; otherwise a parent's label toggles its children
    // (the dot badge still toggles either way, so linked parents stay openable).
    if (node.url) {
      t.setAttribute("cursor", "pointer");
      t.addEventListener("click", function (e) { e.stopPropagation(); window.open(node.url, "_blank", "noopener"); });
    } else if (hasKids(node)) {
      t.setAttribute("cursor", "pointer");
      t.addEventListener("click", function (e) { e.stopPropagation(); toggle(inst, node); });
    }
    nodeG.appendChild(t);
  }

  function drawBadge(node, color, nodeG, inst) {
    if (!hasKids(node)) return;
    var side = node._side || 1;
    var cx = node.x + side * (node._w + DOT_GAP);
    var c = el("circle", {
      cx: cx, cy: node.y, r: DOT_R,
      fill: node._collapsed ? color : "#ffffff",
      stroke: color, "stroke-width": 1.5,
      class: "toggle", cursor: "pointer",
    });
    c.addEventListener("click", function (e) { e.stopPropagation(); toggle(inst, node); });
    nodeG.appendChild(c);
  }

  function drawSubtree(node, parent, color, branchG, nodeG, inst) {
    if (parent) {
      var side = node._side || 1;
      var pEdge = parent.depth === 0
        ? parent.x + side * (parent._w / 2)
        : parent.x + side * parent._w;
      branchG.appendChild(el("path", {
        d: curvedPath(pEdge, parent.y, node.x, node.y),
        stroke: color, "stroke-width": String(Math.max(1.4, 5 - node.depth)),
        fill: "none", "stroke-linecap": "round", class: "branch",
      }));
    }
    drawLabel(node, nodeG, inst);
    drawBadge(node, color, nodeG, inst);
    if (isOpen(node)) {
      node.children.forEach(function (c) { drawSubtree(c, node, color, branchG, nodeG, inst); });
    }
  }

  function drawRoot(root, nodeG) {
    var grp = el("g", { class: "node-root" });
    var text = (root.text || "MINDMAP").toUpperCase();
    grp.appendChild(el("rect", {
      x: root.x - root._w / 2, y: root.y - ROOT_H / 2,
      width: root._w, height: ROOT_H, rx: 12, ry: 12,
    }));
    var t = el("text", {
      x: root.x, y: root.y, "text-anchor": "middle", "dominant-baseline": "central",
    });
    t.textContent = text;
    grp.appendChild(t);
    nodeG.appendChild(grp);
  }

  // ---- 6. ViewBoxes --------------------------------------------------------
  // `data-view-full` frames the whole (visible) map; the "readable" view is a
  // ~1:1 window centered on the root so labels are legible on load. Only the
  // initial render sets the current viewBox; redraws just refresh the two data
  // attributes so the current pan/zoom is preserved.
  function setViewBoxes(svg, root, setCurrent) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (function walk(n) {
      var lines = n.depth === 0 ? 1 : (n._lines ? n._lines.length : 1);
      var halfH = n.depth === 0 ? ROOT_H / 2 : (lines * LINE_H) / 2;
      var side = n._side || 0, x1, x2;
      if (n.depth === 0) { x1 = n.x - n._w / 2; x2 = n.x + n._w / 2; }
      else if (side < 0) { x1 = n.x - n._w - DOT_GAP; x2 = n.x; }
      else { x1 = n.x; x2 = n.x + n._w + DOT_GAP; }
      minX = Math.min(minX, x1); maxX = Math.max(maxX, x2);
      minY = Math.min(minY, n.y - halfH); maxY = Math.max(maxY, n.y + halfH);
      if (isOpen(n)) n.children.forEach(walk);
    })(root);

    var pad = 60;
    var fw = (maxX - minX) + pad * 2, fh = (maxY - minY) + pad * 2;
    var full = (minX - pad) + " " + (minY - pad) + " " + fw + " " + fh;

    var readable;
    if (fw <= READABLE_W && fh <= READABLE_H) {
      readable = full;
    } else {
      var w = Math.min(fw, READABLE_W), h = Math.min(fh, READABLE_H);
      readable = (-w / 2) + " " + (-h / 2) + " " + w + " " + h;
    }
    svg.setAttribute("data-view-full", full);
    svg.setAttribute("data-view-readable", readable);
    if (setCurrent) svg.setAttribute("viewBox", readable);
  }

  // ---- 7. Render / redraw (per-instance state) -----------------------------
  // Each render() owns an `inst` object, so multiple mind maps can live on one
  // page (e.g. the Step 2 output preview and the Generated Files panel) without
  // their toolbars/interactions fighting over shared state.
  function paint(inst) {
    var vp = inst.viewport;
    while (vp.firstChild) vp.removeChild(vp.firstChild);
    var branchG = el("g", { class: "branches" });
    var nodeG = el("g", { class: "nodes" });
    vp.appendChild(branchG);
    vp.appendChild(nodeG);
    inst.tree.children.forEach(function (b) {
      drawSubtree(b, inst.tree, b._color, branchG, nodeG, inst);
    });
    drawRoot(inst.tree, nodeG);
  }

  function redraw(inst) {
    layout(inst.tree);
    paint(inst);
    setViewBoxes(inst.svg, inst.tree, false); // keep current pan/zoom
  }

  function applyTransform(inst) {
    inst.viewport.setAttribute("transform",
      "translate(" + inst.tx + " " + inst.ty + ") scale(" + inst.scale + ")");
  }

  function parseVB(inst) {
    return (inst.svg.getAttribute("viewBox") || "0 0 1 1").split(/\s+/).map(Number);
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Zoom keeping the given viewBox-space point fixed under the pointer.
  function zoomAt(inst, factor, vbX, vbY) {
    var s = inst.scale, s2 = clamp(s * factor, MIN_SCALE, MAX_SCALE);
    if (s2 === s) return;
    inst.tx = vbX - (vbX - inst.tx) * (s2 / s);
    inst.ty = vbY - (vbY - inst.ty) * (s2 / s);
    inst.scale = s2;
    applyTransform(inst);
  }
  function zoomCenter(inst, factor) {
    var vb = parseVB(inst);
    zoomAt(inst, factor, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
  }
  function resetView(inst) {
    inst.full = false;
    inst.svg.setAttribute("viewBox", inst.svg.getAttribute("data-view-readable"));
    inst.scale = 1; inst.tx = 0; inst.ty = 0; applyTransform(inst);
  }
  function toggleFit(inst) {
    inst.full = !inst.full;
    inst.svg.setAttribute("viewBox",
      inst.svg.getAttribute(inst.full ? "data-view-full" : "data-view-readable"));
    inst.scale = 1; inst.tx = 0; inst.ty = 0; applyTransform(inst);
    return inst.full;
  }
  function expandAll(inst) {
    (function walk(n) { if (hasKids(n)) n._collapsed = false; n.children.forEach(walk); })(inst.tree);
    redraw(inst);
    resetView(inst);
  }
  function collapseAll(inst) {
    collapseToLevel1(inst.tree);
    redraw(inst);
    resetView(inst);
  }

  // Listeners bind ONCE per svg element and read the current instance from
  // `svg.__mm` (refreshed by render on every draw). This keeps re-rendering the
  // same svg — e.g. a live editor typing into the map — from stacking duplicate
  // wheel/drag handlers, while still panning/zooming the latest tree.
  function bindInteractions(inst) {
    var svg = inst.svg;
    if (svg.__mmBound) return;
    svg.__mmBound = true;
    var drag = null;

    svg.addEventListener("wheel", function (e) {
      e.preventDefault();
      var I = svg.__mm;
      var vb = parseVB(I);
      var r = svg.getBoundingClientRect();
      var vbX = vb[0] + ((e.clientX - r.left) / r.width) * vb[2];
      var vbY = vb[1] + ((e.clientY - r.top) / r.height) * vb[3];
      zoomAt(I, e.deltaY < 0 ? 1.12 : 1 / 1.12, vbX, vbY);
    }, { passive: false });

    // Drag state is captured on this svg's mousedown, so only the map being
    // dragged pans — window-level move/up just read that per-instance `drag`.
    svg.addEventListener("mousedown", function (e) { drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      var I = svg.__mm;
      var vb = parseVB(I);
      var r = svg.getBoundingClientRect();
      var k = r.width ? vb[2] / r.width : 1; // px -> viewBox units
      I.tx += (e.clientX - drag.x) * k;
      I.ty += (e.clientY - drag.y) * k;
      drag.x = e.clientX; drag.y = e.clientY;
      applyTransform(I);
    });
    window.addEventListener("mouseup", function () { drag = null; });
  }

  // Returns a controller bound to this instance — the caller (React component or
  // the standalone page) drives THIS map through it, never a global singleton.
  function controllerFor(inst) {
    return {
      tree: inst.tree,
      zoomIn: function () { zoomCenter(inst, 1.25); },
      zoomOut: function () { zoomCenter(inst, 1 / 1.25); },
      resetView: function () { resetView(inst); },
      toggleFit: function () { return toggleFit(inst); },
      expandAll: function () { expandAll(inst); },
      collapseAll: function () { collapseAll(inst); },
    };
  }

  function render(svg, md) {
    var tree = parseMarkdown(md);
    collapseToLevel1(tree);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var viewport = el("g", { class: "viewport" });
    svg.appendChild(viewport);

    var inst = { svg: svg, viewport: viewport, tree: tree, scale: 1, tx: 0, ty: 0, full: false };
    layout(tree);
    paint(inst);
    setViewBoxes(svg, tree, true);
    applyTransform(inst);
    svg.__mm = inst;         // the current instance the bound listeners act on
    bindInteractions(inst);
    last = inst;
    return controllerFor(inst);
  }

  // ---- 8. Public API -------------------------------------------------------
  // render() returns a per-instance controller (preferred). The convenience
  // methods below act on the most recently rendered map, for the single-instance
  // standalone page (diagram/index.html) whose buttons call window.Mindmap.*.
  var last = null;
  window.Mindmap = {
    parse: parseMarkdown,
    render: render,
    zoomIn: function () { if (last) zoomCenter(last, 1.25); },
    zoomOut: function () { if (last) zoomCenter(last, 1 / 1.25); },
    resetView: function () { if (last) resetView(last); },
    toggleFit: function () { return last ? toggleFit(last) : false; },
    expandAll: function () { if (last) expandAll(last); },
    collapseAll: function () { if (last) collapseAll(last); },
  };
})();
