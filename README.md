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

**[Live demo →](https://mphuongth.github.io/md2mindmap/)**

## Run

Open the page in a browser — nothing to install:

```
index.html   ← double-click, or drag into Chrome / Edge / Firefox
```

Type a Markdown outline in the left **editor** and the map redraws as you
write. Your outline is kept in `localStorage`, so it's still there next time.
You can also **Open .md**, **drag a `.md` onto the canvas**, or load the
**Sample**. Hide the editor with the **Editor** toggle for a full-width map.

## Input format

Any `.md` whose nesting uses:

- `# Title` → root node (the first H1 wins)
- `- ` / `* ` / `1. ` bullets, indented → children
- `##`+ headings → section nodes; bullets that follow nest **under** the
  current heading until the next one (deeper `###` nest under `##`)
- A line starting with `Q:` (or `Q?`) → red question node
- `- [ ]` / `- [x]` → task node: unchecked shows ☐; checked shows ☑ and is
  struck through and muted
- `[label](url)` → shows the label; the node turns into a link (accent +
  underline) that opens the url in a new tab

See `sample.md` for a reference outline.

> **Markdown only, for now.** The internal model is a plain `{text, children}`
> tree, so JSON or plain-text input can be added later with a small parser —
> no layout/render changes needed.

## Interactions

- Type in the **editor** → the map redraws live (and saves to `localStorage`)
- **Editor** toggle → show / hide the editor; drag the divider to resize it
- Mouse wheel → zoom toward the cursor; **−/+** buttons zoom about center
- Click-drag → pan
- Click a node (or its dot) → expand / collapse its children
  (filled dot = collapsed with hidden children, hollow dot = expanded)
- **Expand all / Collapse all** → open everything, or fold back to level 1
- **Fit** → toggle between the readable view and the whole-map overview
- **Share** → copy a link that reopens this exact outline (the Markdown is
  compressed into the URL — no server, nothing stored)
- **Export ▾** → download **PNG** or **SVG**, or **copy the image** to the
  clipboard to paste into Slack / Docs / slides

## VS Code extension

There's a companion extension in [`vscode-extension/`](vscode-extension/) that
previews the active `.md` file as a mindmap beside your editor, live as you
type — same engine.

**Install:** download the prebuilt `.vsix` from the
[latest release](https://github.com/mphuongth/md2mindmap/releases/latest), then
**Extensions ▸ … ▸ Install from VSIX** (or `code --install-extension md2mindmap-*.vsix`).

Commands: **Open Mindmap Preview** (`Ctrl/Cmd+K M`) and **List Open Questions**
(`Ctrl/Cmd+K Q`).

To build it yourself:

```
cd vscode-extension
npm run package        # builds md2mindmap-<version>.vsix (needs @vscode/vsce)
```

Or press `F5` in that folder to run it in an Extension Development Host.

## Files

| File         | Purpose |
|--------------|---------|
| `index.html` | UI shell: editor, share, export, pan & zoom |
| `mindmap.js` | Parser + left/right tidy layout + SVG render (one module) |
| `styles.css` | Layout + node typography + branch defaults |
| `sample.md`  | Demo outline |
| `vscode-extension/` | VS Code preview extension (reuses `mindmap.js`) |

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
