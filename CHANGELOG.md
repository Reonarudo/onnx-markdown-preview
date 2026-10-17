# Changelog

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
