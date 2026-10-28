# Source / rendering toggle: specification

Every fence claimed by one of the six preview extensions (gnuplot, graphviz, onnx, pikchr, smiles, spice) carries an always-visible icon button, the **view toggle**, in its inline-end top corner. It flips the fence between the **rendering** (today's output) and the **source view** (the fence body as VS Code highlights any fence). A flipped fence stays flipped across preview re-renders, refreshes and reopening.

This document is the single source of truth. The pilot (`onnx-markdown-preview`) implements it; the five roll-outs copy the pilot's code and follow the [per-extension checklist](#per-extension-checklist). It consolidates the decisions recorded on the map at `.scratch/source-toggle/` in the workspace root; the tickets there hold the rationale and the alternatives rejected.

Reference implementation (throwaway, not merged): branch `prototype/view-toggle` in `onnx-markdown-preview`, commit af80d37. Its `src/markdown.ts`, `media/preview.js` and `media/preview.css` are what this spec describes, minus the prototype's variant switcher.

Vocabulary: `CONTEXT.md` in this repo (claimed fence, rendering, error card, source view, view toggle, inline-end corner, fence key, fence attributes). `<base>` below is the extension's base class: `gnuplot`, `graphviz`, `onnx`, `pikchr`, `smiles`, `spice`. `<word>` is the fence's first info word (`smiles` or `smarts` for the SMILES extension, otherwise equal to `<base>`).

## 1. Scope

In scope: the toggle on every claimed fence, including fences whose render failed or is still loading; its persistence; the stylesheet; the preview script; tests; CHANGELOG. Reader-only: no fence attribute presets the view.

Out of scope (map): an author-chosen initial view, a shared npm package, an expanded-netlist view for SPICE.

## 2. The DOM contract

Every return path of the fence rule for a claimed fence (success, error card, renderer threw, loading placeholder, cached slot) emits exactly this:

```html
<div class="<base>-fence code-line" data-line="12" data-fence-key="3f9a1c2b">
  <button type="button" class="<base>-toggle" aria-pressed="false" aria-label="Source view" title="Source view">
    <svg class="<base>-icon-code" …>…</svg>
    <svg class="<base>-icon-graph" …>…</svg>
  </button>
  <div class="<base>-rendering">
    …exactly today's HTML: notes, figure/figcaption, role="img", svg, error card, or loading…
  </div>
  <pre><code class="language-<word>" dir="auto">…escaped body…</code></pre>
</div>
```

Rules:

1. **Wrapper.** `div` with `class="<base>-fence code-line"` and `data-line="<token.map[0]>"`. If the token has no `map` (bare `markdown.api.render` of a string), omit both `code-line` and `data-line`. `data-fence-key` is always present (section 4). The wrapper carries **no** `dir` attribute and **no** other attributes. The plugin never emits `data-view`; the script sets `data-view="source"` when flipped, and absence means rendering.
2. **Button first.** The toggle is the wrapper's first child so morphdom never strips it and tab order reaches it before the content. Markup is exactly as in section 5. The plugin emits `aria-pressed="false"`; the script flips it.
3. **Rendering slot.** `div.<base>-rendering` holds today's output verbatim: figure, figcaption, `role="img"`, align classes, notes (`gnuplot-notes`, `pikchr-notes`), error card, loading placeholder. Nothing moves out of it.
4. **Source `<pre>` always present.** The delegated original fence rule's output with no element around it and no post-processing (no line numbers, no whitespace changes, no wrapping, no `aria-label`, no `hljs` class), **except** that `code-line` and `data-line` are stripped from its `<code>` (section 3): the wrapper is the fence's one scroll-sync element. It is the last child. CSS hides it by default (section 6). Building it on demand is impossible: only the plugin can reach VS Code's highlighter.
5. **Per-extension prefix, shared attribute names.** Class names carry the base class (`onnx-fence`, `onnx-toggle`, `onnx-rendering`, `onnx-icon-code`, `onnx-icon-graph`) because several extensions' scripts and stylesheets load into one webview. Data attribute names (`data-fence-key`, `data-view`, `data-line`) are shared and unprefixed: a script only reads them inside a wrapper it owns.
6. **One wrapper per fence.** A multi-line SMILES fence is one claimed fence: one wrapper, one toggle, one source view of the whole body; the row and per-cell error cards sit in the rendering slot.
7. **Slot caches (gnuplot, spice) cache only the rendering slot's inner HTML.** The wrapper, key, button and `<pre>` are always built from the current token, so an edited fence never shows a stale body in source view while its next render is being prepared.
8. **Never throws.** The plugin keeps its never-throws invariant on every path.

## 3. Obtaining the source `<pre>`

Call the fence rule that was registered before the plugin (saved as `original` at install) with a shallow-cloned token. VS Code installs `options.highlight` and the `source_map_data_attribute` core rule before any contributed plugin runs, so the delegate emits VS Code's exact `<pre><code data-line="N" class="code-line language-<word>" dir="auto">` shell, styled by VS Code's own `markdown.css` and `highlight.css`. None of the six fence words has a highlight.js grammar, so the body is escaped text; do not rewrite `token.info`.

Then strip `data-line` and `code-line` from that `<code>` (`unsynced` below). VS Code's scroll sync (`media/index.js` of `markdown-language-features`) measures a `.code-line` element's height up to its first nested `.code-line`, and a hidden element has a zero rect: with the inner `<code>` kept, the wrapper collapsed to one pixel in rendering view and editor-to-preview sync picked the hidden `<pre>` and scrolled to the top of the page (found by the pilot; the prototype's manual check had missed it). With the wrapper as the fence's only sync element both directions work in both views, at fence granularity. VS Code's copy button selects `pre > code` and is unaffected.

```ts
type FenceRule = NonNullable<MarkdownIt['renderer']['rules']['fence']>;

function sourceView(md: MarkdownIt, original: FenceRule | undefined, ...args: Parameters<FenceRule>): string {
  const [tokens, index, options, env, self] = args;
  const token = tokens[index]!;
  if (!original) {
    // Unit tests and bare markdown-it: no VS Code highlighter to delegate to.
    const word = md.utils.escapeHtml(token.info.trim().split(/\s+/)[0] ?? '');
    return `<pre><code class="language-${word}">${md.utils.escapeHtml(token.content)}</code></pre>\n`;
  }
  const clone = Object.assign(Object.create(Object.getPrototypeOf(token)), token, {
    attrs: token.attrs ? token.attrs.map((attr) => [...attr]) : null
  });
  const copy = tokens.slice();
  copy[index] = clone;
  return unsynced(original(copy, index, options, env, self));
}

function unsynced(html: string): string {
  return html.replace(/^<pre><code\b[^>]*>/, (tag) =>
    tag.replace(/ data-line="[^"]*"/, '').replace(/ class="([^"]*)"/, (_, names: string) => {
      const kept = names.split(' ').filter((name) => name !== 'code-line').join(' ');
      return kept ? ` class="${kept}"` : '';
    }));
}
```

Compute `source` **before** calling the renderer, so every return path (including the catch) has it.

Do not use `options.highlight(...)` directly: it returns only the inner HTML of `<code>`, without the shell scroll sync needs.

## 4. Fence key

The fence key is FNV-1a, 32-bit, of the exact body (`token.content` as markdown-it hands it to the rule, no normalisation), as 8 lowercase hex digits, emitted by the plugin as `data-fence-key`. The script never reads or hashes text.

```ts
function fenceKey(body: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
```

The wrapper builder, identical in every repo except for `BASE_CLASS`:

```ts
function fence(token: { content: string; map: [number, number] | null }, rendering: string, source: string): string {
  const line = token.map?.[0];
  const classes = line === undefined ? `${BASE_CLASS}-fence` : `${BASE_CLASS}-fence code-line`;
  const lineAttr = line === undefined ? '' : ` data-line="${line}"`;
  return `<div class="${classes}"${lineAttr} data-fence-key="${fenceKey(token.content)}">${TOGGLE}` +
    `<div class="${BASE_CLASS}-rendering">${rendering}</div>${source}</div>\n`;
}
```

## 5. The button

Markup, emitted by the plugin, identical in all six extensions apart from the class prefix. The label text is constant: it names the view the click leads to in rendering view, and `aria-pressed` carries the state.

```html
<button type="button" class="<base>-toggle" aria-pressed="false" aria-label="Source view" title="Source view">
  <svg class="<base>-icon-code" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M5.7 3.3 1 8l4.7 4.7.9-.9L2.8 8l3.8-3.8zM10.3 3.3l-.9.9L13.2 8l-3.8 3.8.9.9L15 8z"/></svg>
  <svg class="<base>-icon-graph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="9.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="5.5" y="11" width="5" height="3.5" rx=".5"/><path d="M4 5v3h8V5M8 8v3"/></svg>
</button>
```

- **Glyph swaps with state.** Both SVGs ship; the stylesheet shows the code brackets while the rendering shows and the three-box graph while the source view shows. The glyph names the view the click leads to.
- **Semantics.** Native `<button type="button">`; `aria-pressed="true"` in source view, `"false"` otherwise; `aria-label` and `title` are the constant string `Source view`. Icon only, no visible text. Enter and Space work natively and reach the delegated click listener; the script has no key handling.
- **Position.** Absolute, `inset-block-start: 8px; inset-inline-end: 8px` on the wrapper (`position: relative`). Logical properties inherit the writing direction from the document; no direction detection, no `dir` on the wrapper. The button is anchored to the wrapper, which spans the preview column, so an `align="center"` or `align="left"` figure never moves it. The toggle **never moves** between views.
- **Box.** 28×28, `border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.35))`, `border-radius: 4px`, `background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background))`, `color: var(--vscode-editor-foreground)`, hover `var(--vscode-toolbar-hoverBackground)`, active `var(--vscode-toolbar-activeBackground)`, `opacity: 1` always (unlike VS Code's copy button), `z-index: 1`. Focus: `:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px }`. Verified to read well in light, dark and high contrast, over the white card and over the error card.
- **Copy-button row.** VS Code injects `.code-block-copy-button` (28×28 at `top: 8px; right: 8px`, shown on hover) into every `pre > code`, so the source view gets copy for free. In source view the stylesheet shifts that button 36px inline-start so both share one row: `.<base>-fence[data-view="source"] > pre > .code-block-copy-button { right: 44px }`. **Accepted risk:** this depends on VS Code's class name and its `right: 8px`; if VS Code renames it the two buttons overlap in source view and nothing else breaks. In a right-to-left container the toggle is at the left, so the copy button keeps VS Code's `right: 8px` (a `:dir(rtl)` rule; found in the pilot's manual check). There is no `margin-top` on the `<pre>`.

## 6. Stylesheet

Appended to each repo's `media/preview.css` (already registered under `markdown.previewStyles`), with `<base>` substituted. Nothing styles the `<pre><code>` itself: VS Code's `markdown.css` and `highlight.css` do.

```css
.<base>-fence {
  position: relative;
}

.<base>-fence > pre {
  display: none;
}

.<base>-fence[data-view="source"] > .<base>-rendering {
  display: none;
}

.<base>-fence[data-view="source"] > pre {
  display: block;
}

/* In source view VS Code's copy button, injected inside our <pre>, moves 36px inline-start so it
   and the toggle share one row (8 + 28 + 8). Depends on VS Code's class name: accepted risk. */
.<base>-fence[data-view="source"] > pre > .code-block-copy-button {
  right: 44px;
}

/* In a right-to-left container the toggle sits at the left, so the copy button keeps its place. */
.<base>-fence[data-view="source"]:dir(rtl) > pre > .code-block-copy-button {
  right: 8px;
}

.<base>-toggle {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, .35));
  border-radius: 4px;
  background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
  color: var(--vscode-editor-foreground);
  cursor: pointer;
  opacity: 1;
  z-index: 1;
}

.<base>-toggle:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.<base>-toggle:active {
  background: var(--vscode-toolbar-activeBackground);
}

.<base>-toggle:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 1px;
}

.<base>-toggle svg {
  width: 16px;
  height: 16px;
}

.<base>-toggle svg.<base>-icon-code {
  fill: currentColor;
}

/* The glyph names the view the click leads to. */
.<base>-toggle .<base>-icon-graph {
  display: none;
}

.<base>-fence[data-view="source"] .<base>-toggle .<base>-icon-code {
  display: none;
}

.<base>-fence[data-view="source"] .<base>-toggle .<base>-icon-graph {
  display: inline;
}
```

The single hide rule on `.<base>-rendering` is what hides the caption, `alt` wrapper, notes, error card and loading placeholder in source view. Direct-child selectors (`>`) matter: error cards contain their own `<pre>`, which must stay governed by the rendering slot.

## 7. What the source view shows

- The fence body exactly as the delegated rule emits it: no info string, no attribute block, no extra DOM.
- markdown-it's normalisation (CRLF to LF, fence indentation stripped, single trailing newline) and VS Code's `pre code { tab-size: 4 }` are accepted as-is.
- No line numbers. Horizontal scroll, no wrapping (VS Code's `pre:not(.hljs) { overflow: auto }` applies).
- Caption, `alt`, notes and the error card hide with the rendering slot. A failed fence in source view shows the body alone; flip back to read the message.
- SPICE shows the fence as written, never the expanded netlist.
- Source view is available while a fence is loading, and a flip made during loading survives the swap to the result (same body, same key).

## 8. The preview script

One file, `media/preview.js`, registered in `package.json`:

```json
"markdown.previewScripts": [
  "media/preview.js"
]
```

Facts it is built on (ticket research, verified in the prototype):

- Document edits patch `.markdown-body` with morphdom. Script-set attributes (`data-view`, `aria-pressed="true"`) are stripped on any update that touches the wrapper; JS globals, timers and `window`/`document` listeners survive. A full reload (first render, refresh, panel hidden while editing, reopen) discards everything except browser storage.
- The script runs **once per page load**, as `<script async nonce>`. It may start before `.markdown-body` exists. `window` dispatches `vscode.markdown.updateContent` after each patch (not for the initial render), before VS Code re-adds its copy buttons.
- `acquireVsCodeApi` is unavailable (throws). `window.localStorage` works in the preview sandbox and is shared by every markdown preview in the profile.
- Strict CSP: no inline handlers, no inline `<script>`; inline styles, `data:` images and nonce scripts allowed. No codicon font; glyphs are inline SVG from the plugin.
- The document's identity is the `source` field of the settings JSON on `<meta id="vscode-markdown-preview-data" data-settings="…">`.

Behaviour:

1. **State** is a module-level list of entries `{ key, ordinal, index }`: the fence key, the fence's ordinal among wrappers with the same key, and its index among all of this extension's wrappers in document order. It is the truth; the DOM is re-decorated from it.
2. **Storage.** Mirrored to `localStorage` under `"<base>-markdown-preview.view-toggle:" + documentUri`. The entry is removed when no fence is flipped. Every storage access is wrapped in try/catch and degrades to memory-only. Storage is per VS Code profile and outlives closing the document (accepted consequence).
3. **Matching** (`apply`), run at start-up and on every `vscode.markdown.updateContent`: group the current wrappers by key; for each entry take `group[ordinal]` if the key exists, otherwise the wrapper at `index` among all wrappers; drop entries that match nothing. Set `data-view` and `aria-pressed` on every wrapper (clearing those not matched: rendering is always the default). Then re-read the state from the DOM (`collect`) so it only ever describes real fences, and save.
4. **Click.** One delegated `click` listener on `document`, matching `.<base>-toggle` inside `.<base>-fence`. Flip that wrapper, then `collect` and save.
5. **Start-up.** Load from storage. If `.markdown-body` exists, `apply`; otherwise a `MutationObserver` on `document.documentElement` (childList, subtree) waits for it, disconnects, and applies.
6. **The script never touches the wrapper's children** beyond `aria-pressed` on the button. It never reads fence text.

Reference script (the prototype's, with the variant switcher removed; change only `BASE`):

```js
(function () {
  'use strict';
  const BASE = 'onnx';
  const WRAPPER = `.${BASE}-fence`;
  const TOGGLE = `.${BASE}-toggle`;

  function documentUri() {
    try {
      const meta = document.getElementById('vscode-markdown-preview-data');
      return JSON.parse(meta.dataset.settings).source;
    } catch (_) {
      return location.href;
    }
  }
  const storageKey = `${BASE}-markdown-preview.view-toggle:${documentUri()}`;

  /** Flipped fences: key, ordinal among same-key fences, index among all of this extension's fences. */
  let entries = [];

  function load() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }
  function save() {
    try {
      if (entries.length === 0) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch (_) {
      // Memory-only: the flip still survives patch updates, not a reload.
    }
  }

  function fences() {
    return Array.from(document.querySelectorAll(WRAPPER));
  }
  function setView(fence, source) {
    if (source) fence.setAttribute('data-view', 'source');
    else fence.removeAttribute('data-view');
    const button = fence.querySelector(TOGGLE);
    if (button) button.setAttribute('aria-pressed', source ? 'true' : 'false');
  }
  /** Read the flipped set back from the DOM, so state only ever describes real fences. */
  function collect() {
    const seen = new Map();
    entries = [];
    fences().forEach((fence, index) => {
      const key = fence.dataset.fenceKey;
      const ordinal = seen.get(key) || 0;
      seen.set(key, ordinal + 1);
      if (fence.getAttribute('data-view') === 'source') entries.push({ key, ordinal, index });
    });
  }
  /** Match key first, then ordinal within the key group, then the same index among all fences. */
  function apply() {
    const all = fences();
    const groups = new Map();
    for (const fence of all) {
      const list = groups.get(fence.dataset.fenceKey) || [];
      list.push(fence);
      groups.set(fence.dataset.fenceKey, list);
    }
    const flip = new Set();
    for (const entry of entries) {
      const group = groups.get(entry.key);
      const target = group ? group[entry.ordinal] : all[entry.index];
      if (target) flip.add(target);
    }
    for (const fence of all) setView(fence, flip.has(fence));
    collect();
    save();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest(TOGGLE);
    if (!button) return;
    const fence = button.closest(WRAPPER);
    if (!fence) return;
    setView(fence, fence.getAttribute('data-view') !== 'source');
    collect();
    save();
  });

  window.addEventListener('vscode.markdown.updateContent', apply);

  entries = load();
  if (document.querySelector('.markdown-body')) {
    apply();
  } else {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.markdown-body')) return;
      observer.disconnect();
      apply();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
```

The shipped file has the two-layer shape section 9 fixes: pure functions on top, DOM wiring in a `boot()` below. The behaviour above is unchanged by that split.

## 9. Testing

Decided by the map ticket **How the pilot tests the preview script** (`.scratch/source-toggle/issues/15-testing-the-preview-script.md`). Four layers; the first two run in `npm test`, the other two on demand.

### 9.1 Script shape

`media/preview.js` stays one file, registered once, but has two layers:

- **Pure core**, no DOM access: `match(entries, keys)` takes the flipped entries and the list of fence keys in document order and returns the positions to flip (key present: `group[ordinal]`; key absent: `keys[index]` if it exists; otherwise the entry is dropped); `collect(keys, flipped)` turns a list of keys and the set of flipped positions back into entries; `storageKey(base, uri)`; `load(storage, key)` and `save(storage, key, entries)` take the storage object as a parameter and swallow its exceptions.
- **Wiring**, in a `boot()` that runs only when `typeof document !== 'undefined'`: the delegated click listener, `data-view`/`aria-pressed` on the wrapper and button, the `MutationObserver` waiting for `.markdown-body`, and the `vscode.markdown.updateContent` listener, each calling the core with `localStorage` and the wrappers' `data-fence-key` values.
- A guard at the end, `if (typeof module !== 'undefined') module.exports = { match, collect, storageKey, load, save }`, so Node tests `require` the file exactly as shipped.

No DOM shim (`jsdom`, `happy-dom`) is added: the wiring is thirty lines without branching and is covered by the live run (9.4).

### 9.2 Unit tests (`npm test`)

- **Plugin HTML** (`test/markdown.test.ts`): the wrapper with `code-line`/`data-line` and without (no `map`); `data-fence-key` for a known body (FNV-1a vector); the button markup with both glyphs; the delegated `<pre>` on every return path (success, error card, renderer threw, loading, cached slot); the hand-built fallback when no original fence rule exists; unclaimed fences delegated unchanged.
- **Existing exact-markup tests** keep asserting the rendering byte for byte through a helper `rendering(html)` in `test/helpers.ts` that returns the rendering slot's inner HTML. They are not rewritten to include the wrapper and not loosened to regexes; the wrapper's exact shape is asserted once, in the contract tests above.
- **Pure core** (`test/preview-script.test.ts`, requiring `media/preview.js`): requiring the file under Node does not throw; a table over `(entries, keys before, keys after)` covering: key present picks the ordinal within its group; two identical bodies flipped independently; a key gone from the document falls back to the fence at the same index; an index beyond the document drops the entry; a fence inserted above a flipped one keeps the flip on the right fence; `collect` after `match` yields entries that only describe real fences; `save` removes the key when nothing is flipped; `load`/`save` with a storage that throws degrade to memory-only; `storageKey` for a known base and URI.

### 9.3 Extension-host test (`npm run test:extension`)

`test/extension/index.cjs` gains: `contributes['markdown.previewScripts']` equals `['media/preview.js']`; a rendered claimed fence carries the wrapper, and its `<pre>` is VS Code's own shell minus the sync attributes (`<pre><code class="language-<word>" dir="auto">`, and exactly one `data-line` per claimed fence), proving delegation to the saved fence rule survives VS Code's renderer rather than the hand-built fallback.

### 9.4 Live run (`npm run test:preview`)

`scripts/test-preview.mjs` launches a real VS Code through `playwright-core` (dev dependency `1.63.0`, added to onnx, gnuplot and pikchr; graphviz, smiles and spice already have it), using the binary under `.vscode-test/` from a previous `test:extension` run or `VSCODE_EXECUTABLE`, a throwaway profile, and `--extensionDevelopmentPath` (no VSIX). It is a standalone file that duplicates the launch lines of `scripts/screenshots.mjs` where that exists, so every repo's copy is identical. It opens `examples/view-toggle.md` beside its preview and asserts inside the preview iframe:

1. Every claimed fence carries the wrapper, the button with `aria-pressed="false"` and a hidden `<pre>`; the `json` fence beside them has no button.
2. A click sets `data-view="source"` and `aria-pressed="true"`, hides the rendering slot and shows the `<pre>`; a second click reverts both.
3. Patch survival: flip a fence, type a line at the end of the editor, wait for the update; that fence is still flipped and no other is.
4. Identical bodies: flip the second of the two same-body fences, edit elsewhere; the second is still the flipped one.
5. Edited body: flip a fence, edit its body; the fence at the same position is still flipped.
6. `Markdown: Refresh Preview`: still flipped.
7. Close the preview and open it again: still flipped.
8. Flip everything back: the document's `localStorage` entry is gone.

### 9.5 Manual checklist

Done once by the pilot and once per roll-out, on `examples/view-toggle.md` in a development window (section 10 step 9): the three themes; the copy button sharing the row in source view; the button in an RTL container; scroll sync both ways on a flipped and an unflipped fence; the focus ring; the extension's quirks from section 10 (loading placeholder, notes, cached slot).

### 9.6 Sample document

One committed `examples/view-toggle.md` per repo, the fixture for 9.4 and the document for 9.5. It contains: a plain fence, a captioned centred one, a right-aligned one with `alt`, a failing fence, long lines and a tall body, two identical bodies, an ordinary `json` fence, a fence inside an RTL container, and the extension's quirks.

### 9.7 Release

A green `test:preview` run is a required line in the release verification note of the pilot's release and of each roll-out's first release carrying the toggle, beside `test:extension`. After that it is advisory, run when the toggle code changes.

## 10. Per-extension checklist

A roll-out session follows this in order. Copy from the pilot's merged code, not from the prototype branch.

1. **Read this spec and the pilot's resolution** (`.scratch/source-toggle/issues/09-pilot-onnx.md`): it records anything the spec got wrong.
2. **Base class.** Ensure `src/markdown.ts` exports `BASE_CLASS = '<base>'` (gnuplot and pikchr have no such constant today; add it). The toggle, wrapper, rendering slot and icon classes derive from it.
3. **Plugin.** Add `sourceView`, `fenceKey`, `fence`, `ICON_CODE`, `ICON_GRAPH`, `TOGGLE` from the pilot. Compute `source` before calling the renderer. Route **every** claimed-fence return through `fence(token, rendering, source)`, including the catch path, the empty-fence error (SMILES) and the loading placeholder. Unclaimed fences stay delegated unchanged.
4. **Slot caches** (gnuplot, spice): `remember(slot, html)` stores and `slots.get(slot)` returns only the rendering slot's inner HTML; wrap the cached HTML in a fresh wrapper built from the current token.
5. **Stylesheet.** Append section 6 to `media/preview.css` with `<base>` substituted.
6. **Script.** Copy `media/preview.js`, set `BASE`. Register it under `markdown.previewScripts` in `package.json`. Copy `scripts/test-preview.mjs` and `examples/view-toggle.md` (adapt the fences to this extension's word and quirks), add the `test:preview` npm script, and add `playwright-core` 1.63.0 as a dev dependency where missing.
7. **Build.** Confirm `scripts/build.mjs` (or the VSIX file list) ships `media/preview.js`; `media/` is already shipped for `preview.css`.
8. **Tests.** Add the `rendering()` helper and route the existing exact-markup tests through it; add the contract tests, `test/preview-script.test.ts` and the extension-host assertions from section 9. Run `npm test`, `npm run test:extension`, `npm run test:preview`.
9. **Manual checklist (section 9.5) in a development window.** Disable the installed copy of the same extension first, or two fence rules run and the view is corrupt:

   ```sh
   code --new-window --disable-extension=<publisher.name> --extensionDevelopmentPath="$PWD" examples/view-toggle.md
   ```

   Extension ids: `ReoX86.onnx-graph-preview`, `ReoX86.gnuplot-markdown-preview`, `ReoX86.graphviz-diagram-preview`, `ReoX86.pikchr-diagram-preview`, `ReoX86.smiles-structure-preview`, `ReoX86.spice-schematic-preview`. The sample should cover: plain fence, captioned centred, right-aligned with `alt`, a failing fence, long lines and a tall body, two identical bodies, an ordinary `json` fence beside it, a fence inside an RTL container, and the extension's quirks below. Check in light, dark and high contrast.
10. **CHANGELOG and release.** Add the entry to `CHANGELOG.md` under a new version, and to `docs/release-notes.md` where the repo keeps one. Publish and verify following the repo's existing `docs/publishing.md` and `release-verification-<version>.md` pattern; the verification note records a green `test:preview` run (section 9.7).

### Per-extension quirks

- **gnuplot.** Three content shapes in the rendering slot: `<p role="status">` loading placeholder (passed through `wrap`), `gnuplot-notes` above the figure, and `div/figure.gnuplot-markdown-preview` (the figure class is not `gnuplot-figure`; leave it). A data refresh re-renders with the same body, so the key matches and the flip survives. Slot cache per section 2 rule 7.
- **graphviz.** Simplest shape; the error report has its own signature (`errorReport(md, result, source)`) and all three return paths go through `fence`.
- **pikchr.** `notes + wrap(...)` concatenation goes inside the rendering slot as one string. No `BASE_CLASS` constant today.
- **smiles.** Two claimed words, `smiles` and `smarts`, so the source `<code>` carries `language-smiles` or `language-smarts`. The empty-fence error card is a claimed fence and gets the wrapper. One wrapper for the whole multi-line fence; the row and per-cell cards stay inside the rendering slot.
- **spice.** Loading placeholder is `div.spice-loading`; the source view shows the fence as written (the expanded netlist never reaches the plugin). Slot cache per section 2 rule 7.

## 11. Decision record

| Decision | Where |
| --- | --- |
| Delegate to the saved original fence rule with a cloned token; keep VS Code's shell verbatim | map ticket 01 |
| Patch-not-replace preview; script runs once; re-apply on `vscode.markdown.updateContent`; no `acquireVsCodeApi`; CSP | map ticket 02 |
| Fence key = body hash; key, then ordinal, then index; state in script memory mirrored to `localStorage` | map ticket 03 |
| One wrapper on every return path; per-extension class prefix; button first; `<pre>` always present | map ticket 04 |
| Logical inset, no `dir`; column edge; `aria-pressed`, constant label; box and focus ring | map ticket 05 |
| Body only, no post-processing; whole rendering slot hides; SPICE as written; available while loading | map ticket 06 |
| Glyph swaps with state; one row with the copy button via `right: 44px`; `localStorage` verified | map ticket 07 |
| Sync attributes stripped from the delegated `<code>`; copy button unshifted in RTL; VS Code binary is `Code` in current builds | map ticket 09 (pilot) |
| Two-layer script with exported pure core, no DOM shim; `rendering()` helper keeps exact tests; extension-host asserts real delegation; Playwright live run per repo; short manual checklist; one sample document; green live run required on the shipping release | map ticket 15 |
