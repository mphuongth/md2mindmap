// md2mindmap — VS Code extension host.
// Opens a webview beside the active Markdown editor and renders its outline as
// a mindmap, live. The heavy lifting (parse + layout + draw) is the same
// media/mindmap.js engine the standalone web app uses; this file just shuttles
// the document text into the webview and routes link clicks back out.

const vscode = require("vscode");

function getNonce() {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function cleanLabel(s) {
  return s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").replace(/`/g, "").trim();
}

// Collect every open question (a `Q:` line) with the outline path leading to it
// and its source line — the mindmap's questions, turned into a jump list. Mirrors
// the engine's nesting: `##`+ headings sit above bullets (synthetic negative
// indent), bullets nest by leading whitespace.
function scanQuestions(text) {
  const lines = text.split(/\r?\n/);
  const stack = []; // { indent, label }
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    if (/^\s*(<!--|>)/.test(raw)) continue;

    let indent, label;
    const head = raw.match(/^(#{1,6})\s+(.+)$/);
    if (head) {
      indent = -100 + head[1].length;
      label = cleanLabel(head[2]);
    } else {
      const bullet = raw.match(/^(\s*)(?:[-*]|\d+\.)\s+(.+)$/);
      if (!bullet) continue;
      indent = bullet[1].replace(/\t/g, "  ").length;
      label = cleanLabel(bullet[2].replace(/^\[[ xX]\]\s+/, ""));
    }
    if (!label) continue;

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (/^Q[:?]/i.test(label)) {
      out.push({ line: i, text: label, path: stack.map((s) => s.label) });
    }
    stack.push({ indent, label });
  }
  return out;
}

function activate(context) {
  let panel = null;
  let trackedUri = null; // uri.toString() of the document the preview follows
  let debounce = null;

  function activeMarkdownEditor() {
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document.languageId === "markdown") return ed;
    return vscode.window.visibleTextEditors.find((e) => e.document.languageId === "markdown") || null;
  }

  function post(text) {
    if (panel) panel.webview.postMessage({ type: "md", text });
  }

  // Send whatever the preview should currently show: the tracked document if it
  // is still open, otherwise the active Markdown editor.
  function update() {
    if (!panel) return;
    let doc = null;
    if (trackedUri) doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === trackedUri) || null;
    if (!doc) {
      const ed = activeMarkdownEditor();
      if (ed) doc = ed.document;
    }
    if (doc) { trackedUri = doc.uri.toString(); post(doc.getText()); }
    else post("");
  }

  function htmlFor(webview) {
    const nonce = getNonce();
    const uri = (f) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", f));
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
    return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<link rel="stylesheet" href="${uri("styles.css")}" />
</head><body>
<div class="wrap">
  <div class="bar" id="bar">
    <button data-act="fit">Fit</button>
    <button data-act="expand">Expand</button>
    <button data-act="collapse">Collapse</button>
    <span class="hint" id="hint"></span>
  </div>
  <div class="stage"><svg id="mindmap" xmlns="http://www.w3.org/2000/svg"></svg></div>
</div>
<script nonce="${nonce}" src="${uri("mindmap.js")}"></script>
<script nonce="${nonce}" src="${uri("webview.js")}"></script>
</body></html>`;
  }

  function createPanel() {
    panel = vscode.window.createWebviewPanel(
      "md2mindmap",
      "Mindmap Preview",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
      }
    );
    panel.webview.html = htmlFor(panel.webview);
    panel.onDidDispose(() => { panel = null; trackedUri = null; }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage((msg) => {
      if (!msg) return;
      if (msg.type === "ready") update();               // webview asks for content once loaded
      else if (msg.type === "openLink" && msg.url) vscode.env.openExternal(vscode.Uri.parse(msg.url));
    });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("md2mindmap.openPreview", () => {
      // Follow the editor the command was invoked from.
      const ed = activeMarkdownEditor();
      if (ed) trackedUri = ed.document.uri.toString();
      if (panel) { panel.reveal(vscode.ViewColumn.Beside, true); update(); }
      else createPanel();
    })
  );

  // The niche move: every `Q:` in the outline as a jump list. Pick one → land on
  // its line. This is the BA "Questions List" the mindmap already encodes.
  context.subscriptions.push(
    vscode.commands.registerCommand("md2mindmap.listQuestions", async () => {
      const ed = activeMarkdownEditor();
      if (!ed) { vscode.window.showInformationMessage("Open a Markdown file to list its questions."); return; }
      const doc = ed.document;
      const qs = scanQuestions(doc.getText());
      if (!qs.length) {
        vscode.window.showInformationMessage("No open questions found. Start a line with “Q:” to mark one.");
        return;
      }
      const items = qs.map((q) => ({
        label: q.text,
        description: q.path.length ? q.path.join("  ›  ") : undefined,
        _line: q.line,
      }));
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: qs.length + " open question" + (qs.length === 1 ? "" : "s") + " — pick one to jump to it",
        matchOnDescription: true,
      });
      if (!pick) return;
      const pos = new vscode.Position(pick._line, 0);
      const shown = await vscode.window.showTextDocument(doc, {
        viewColumn: ed.viewColumn,
        selection: new vscode.Range(pos, pos),
      });
      shown.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    })
  );

  // Live: retype in the tracked document → re-render (debounced).
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!panel) return;
      if (trackedUri && e.document.uri.toString() !== trackedUri) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => post(e.document.getText()), 250);
    })
  );

  // Switch to another Markdown file → follow it.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (panel && ed && ed.document.languageId === "markdown") {
        trackedUri = ed.document.uri.toString();
        post(ed.document.getText());
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
