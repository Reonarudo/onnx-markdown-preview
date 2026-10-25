# ONNX Graph Preview v0.2.0

Graphs are now drawn by [onnx-renderer](https://github.com/Reonarudo/onnx-renderer) 1.0.0, the same library that draws ONNX on reonarudo.github.io, instead of a copy inside the extension. It reads models with the same Netron reader and draws the same graphs. **Requires VS Code 1.101 or later**; older versions stay on 0.1.2.

- A `direction` attribute other than exactly `down` or `right` is now an error, instead of being lowercased or dropped in favour of `down`.
- The graph paints itself, so it looks the same wherever the SVG is shown; the preview stylesheet adds only the white card.
- Changing `onnx.layoutTimeout` restarts the layout worker with the new limit and retries graphs that timed out.
