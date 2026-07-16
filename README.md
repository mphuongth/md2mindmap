# md2mindmap

Turn a nested **Markdown outline** into a **left/right balanced mindmap** in the
Miro / MindNode style — right in the browser. No build step, no server, no
dependencies.

- Root node: rounded box, centered, UPPERCASE (the first `# H1`)
- Top-level branches split evenly into a left group and a right group
  (balanced by leaf count), each growing away from the root
- Branch nodes: bare text (no boxes)
- Branches: organic curved Bézier lines, tapering (thick → thin)
- Each top-level branch gets its own color, shared by all its descendants
- `Q:` lines render red (questions / open items)
- Handles deep trees (4+ levels)
- **Opens collapsed to level 1** (root + top-level sections); expand nodes
  one at a time, or all at once

## Run

Open the page in a browser — nothing to install:

```
index.html   ← double-click, or drag into Chrome / Edge / Firefox
```

On load it renders a built-in sample. Use **Upload .md** to render your own
outline, or **Paste MD** to paste one in.

## Input format

Any `.md` whose nesting uses:

- `# Title` → root node (the first H1 wins)
- `- ` / `* ` / `1. ` bullets, indented → children
- `##`+ headings → section nodes; bullets that follow nest **under** the
  current heading until the next one (deeper `###` nest under `##`)
- A line starting with `Q:` (or `Q?`) → red question node

See `sample.md` for a reference outline.

> **Markdown only, for now.** The internal model is a plain `{text, children}`
> tree, so JSON or plain-text input can be added later with a small parser —
> no layout/render changes needed.

## Interactions

- Mouse wheel → zoom toward the cursor; **−/+** buttons zoom about center
- Click-drag → pan
- Click a node (or its dot) → expand / collapse its children
  (filled dot = collapsed with hidden children, hollow dot = expanded)
- **Expand all / Collapse all** → open everything, or fold back to level 1
- **Fit** → toggle between the readable view and the whole-map overview
- **Export SVG** → download the current mindmap as `mindmap.svg`

## Files

| File         | Purpose |
|--------------|---------|
| `index.html` | UI shell: upload / paste / sample / export, pan & zoom |
| `mindmap.js` | Parser + left/right tidy layout + SVG render (one module) |
| `styles.css` | Layout + node typography + branch defaults |
| `sample.md`  | Demo outline |

## Embedding

`mindmap.js` exposes a small API on `window.Mindmap`:

```js
const controller = window.Mindmap.render(svgEl, markdownString);
controller.zoomIn();      // zoomOut(), resetView()
controller.toggleFit();   // returns true if now showing the full map
controller.expandAll();   // collapseAll() folds back to level 1
```

`render()` returns a per-instance controller, so multiple maps can coexist on
one page. The `window.Mindmap.*` convenience methods act on the most recently
rendered map (used by the standalone page's toolbar).

## Notes / limitations

- Layout is a hand-written tidy tree, not a force-directed solver. Node x
  spacing follows estimated label widths; very long single labels can crowd
  the next column.
- Top-level branches are assigned left/right greedily by leaf count to keep
  the two sides balanced; original order is preserved within each side.
- Color palette is generated per map (hues spread evenly around the wheel);
  no per-node color editing yet.

## License

[MIT](LICENSE) © 2026 Phuong Truong
