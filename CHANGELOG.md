# Changelog

## 0.3.0 — 2026-10-28

- Every graph carries a view toggle in its top corner that flips the fence
  between the graph and its source text, highlighted as the preview highlights
  any code block. A flipped fence stays flipped while the document is edited,
  after *Markdown: Refresh Preview* and when the preview is reopened. The
  toggle is also present on error cards. It is a reader's control; no fence
  attribute presets it.
- A preview script (`media/preview.js`) is contributed for the first time;
  `npm run test:preview` exercises it in a live preview through Playwright.

## 0.2.0 — 2026-10-25

- Graphs are drawn by [onnx-renderer](https://github.com/Reonarudo/onnx-renderer)
  1.0.0, the library that also draws ONNX on reonarudo.github.io, instead of a
  copy inside the extension: the same Netron reader, ELK layout and drawing,
  shipped under the VSIX's `node_modules`. **Requires VS Code 1.101 or later**;
  older versions stay on 0.1.2.
- A `direction` attribute other than exactly `down` or `right` is an error,
  instead of being lowercased or dropped in favour of `down`.
- The graph paints itself (fills, strokes, fonts as presentation attributes);
  the preview stylesheet adds only the white card. Its width is set from its
  `viewBox`, so it keeps its size.
- Changing `onnx.layoutTimeout` restarts the layout worker with the new limit,
  the old one drawing until it is ready, and retries graphs that timed out.

## 0.1.2 — 2026-10-17

- Match the preview extension family with a navy, mint-outline neural-network icon and blue-grey connections.

## 0.1.1 — 2026-10-17

- Fix the extension icon export so the artwork fills the square instead of appearing in its upper-left corner.

## 0.1.0 — 2026-10-16

- First release. `onnx` fences holding a model in the ONNX text syntax, the
  protobuf text form or the JSON form are drawn as Netron-style graphs:
  operators as boxes headed with their type on Netron's category colours,
  attributes and initializers as rows, inputs and outputs as pills, and tensors
  as arrows labelled with their shapes.
- Fence attributes `alt`, `caption`, `align`, `class` and `direction`.
- `onnx.layoutTimeout` bounds each layout; a parse error is quoted with a
  caret; the reader's remarks go to the *ONNX Graph Preview* output channel.
