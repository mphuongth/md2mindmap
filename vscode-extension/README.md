# md2mindmap — Mindmap for brainstorms & planning

See your Markdown outline as a **balanced, left/right Miro-style mindmap**, live
beside the editor. Built for the way people actually plan: **open questions**,
**task checkboxes**, and sections — not just a generic outline tree.

## Why this one

Most Markdown mindmap tools draw the same one-directional tree. md2mindmap is
opinionated for **thinking and planning work**:

- **Balanced layout** — top-level branches split evenly left and right around a
  centered root, in the Miro / MindNode style. Easier to read a wide brainstorm.
- **`Q:` questions are first-class** — any line starting with `Q:` renders red,
  and **List Open Questions** turns every one into a jump list (the review
  artifact a BA/PM actually needs).
- **Task checkboxes** — `- [ ]` / `- [x]` become ☐ / ☑ nodes; done ones are
  muted and struck through, and the header shows `done / total` progress.
- **Links** — `[label](url)` nodes open in your browser.
- **Section headings** — bullets nest under the `##`/`###` heading above them.

## Commands

| Command | Default key | What it does |
|---|---|---|
| **md2mindmap: Open Mindmap Preview** | `Ctrl/Cmd+K M` | Live mindmap beside the editor, redraws as you type |
| **md2mindmap: List Open Questions** | `Ctrl/Cmd+K Q` | Pick any `Q:` (with its outline path) to jump to that line |

Both are also on the editor-title bar and the Command Palette for any `.md`.

## In the preview

- Wheel → zoom to cursor · drag → pan · click a node (or its dot) → expand /
  collapse
- **Fit** · **Expand** · **Collapse** in the toolbar
- The header reads out the shape: branches · levels · open questions · tasks done

## Example

```markdown
# Checkout redesign
- Cart
  - [x] Line-item edit
  - [ ] Save for later
  - Q: guest checkout in v1?
- Payment
  - [Stripe docs](https://stripe.com/docs)
  - Q: which wallets at launch?
```

Same engine as the web tool — try it with no install:
**<https://mphuongth.github.io/md2mindmap/>**

## Notes

- Follows the focused Markdown file; updates as you type.
- No telemetry, no network — everything renders locally.
