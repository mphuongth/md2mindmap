# md2mindmap for VS Code

Preview a Markdown outline as a **left/right balanced mindmap**, live as you
type — right beside your editor.

![It renders the active .md file into a mindmap and updates as you edit.](https://mphuongth.github.io/md2mindmap/)

## Use it

1. Open any `.md` file.
2. Run **md2mindmap: Open Mindmap Preview** — from the Command Palette, the
   editor-title button, or `Ctrl/Cmd+K M`.
3. A preview opens beside the editor and redraws as you type.

## What it understands

- `# Title` → the root node (the first H1)
- `- ` / `* ` / `1. ` bullets, indented → children
- `##`+ headings → section nodes; the bullets under them nest in
- `Q:` … → a red question node
- `- [ ]` / `- [x]` → task nodes (☐ / ☑, done ones muted + struck through)
- `[label](url)` → a link node; clicking it opens the url in your browser

## In the preview

- Wheel → zoom to cursor · drag → pan · click a node (or its dot) → expand /
  collapse
- **Fit** · **Expand** · **Collapse** buttons in the toolbar

Same engine as the web tool: <https://mphuongth.github.io/md2mindmap/>

## Notes

- The preview follows the editor it was opened from, and switches when you
  focus another Markdown file.
- No telemetry, no network — everything renders locally.
