// Webview side: receive Markdown from the extension, draw it with the shared
// Mindmap engine, and route link-node clicks back to VS Code.
(function () {
  "use strict";
  const vscode = acquireVsCodeApi();
  const svg = document.getElementById("mindmap");
  const hint = document.getElementById("hint");
  const bar = document.getElementById("bar");

  // The engine opens link nodes with window.open; in a webview that's blocked,
  // so route the url out to the host, which opens it with the system handler.
  window.open = function (url) { if (url) vscode.postMessage({ type: "openLink", url: String(url) }); return null; };

  function stats(tree) {
    let branches = tree.children.length, levels = 0, open = 0;
    (function walk(n) { if (n.q) open++; if (n.depth > levels) levels = n.depth; n.children.forEach(walk); })(tree);
    return { branches, levels, open };
  }

  function render(text) {
    try {
      const ctrl = window.Mindmap.render(svg, text || "");
      const s = stats(ctrl.tree);
      hint.textContent = s.branches
        ? s.branches + " branches · " + s.levels + " levels" + (s.open ? " · " + s.open + " open" : "")
        : "Empty outline — add a # Title and indented - bullets";
    } catch (e) {
      hint.textContent = "Render error: " + e.message;
    }
  }

  window.addEventListener("message", (ev) => {
    const m = ev.data;
    if (m && m.type === "md") render(m.text);
  });

  bar.addEventListener("click", (e) => {
    const act = e.target && e.target.getAttribute && e.target.getAttribute("data-act");
    if (!act || !window.Mindmap) return;
    if (act === "fit") window.Mindmap.toggleFit();
    else if (act === "expand") window.Mindmap.expandAll();
    else if (act === "collapse") window.Mindmap.collapseAll();
  });

  // Tell the host we're ready so it sends the current document.
  vscode.postMessage({ type: "ready" });
}());
