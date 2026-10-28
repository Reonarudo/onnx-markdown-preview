# ONNX Graph Preview

Draws ONNX models written as text as Netron-style graphs in VS Code's built-in
Markdown preview. It draws; it never runs a model.

Write a model in a fence tagged `onnx`, in the [ONNX text syntax](https://onnx.ai/onnx/repo-docs/Syntax.html):

````markdown
```onnx
<ir_version: 8, opset_import: ["" : 17]>
cnn (float[N, 3, 32, 32] x) => (float[N, 10] y) {
  c = Conv <kernel_shape = [3, 3], pads = [1, 1, 1, 1]> (x, w)
  r = Relu (c)
  p = GlobalAveragePool (r)
  y = Gemm <transB = 1> (p, fc_w, fc_b)
}
```
````

Only `onnx` fences are claimed — `onnxtxt`, `netron` and other fences are left
to other renderers. Placement and routing are automatic: the model says what
feeds what, not where it goes.

## What is drawn

Each operator is a box in the style of [Netron](https://github.com/lutzroeder/netron),
whose ONNX reader this extension uses to read the fence:

| In the model | Drawn as |
| --- | --- |
| An operator (`Conv`, `Relu`, …) | A box headed with its type, coloured by Netron's category (layers blue, activations red, pooling green, …), and its name beside the type when it has one |
| An attribute | A row `name = value` in the box; attributes left at their default are not shown, as in Netron |
| An initializer the operator reads | A row `W ⟨64×3×7×7⟩` in the box, named as the operator's specification names that input |
| A graph input or output | A pill with its name and, when declared, its type |
| A tensor between operators | An arrow, labelled with the tensor's shape when the model declares it |
| A name that is used but never declared | A pill, as an input: a hand-written model need not spell out every weight |

The header `<ir_version: …>` is optional. Nested graphs (an `If`'s branches, a
`Loop`'s body) are named in the row but not drawn, and functions are not
drawn; both are noted in the *ONNX Graph Preview* output channel, which also
receives anything the reader skipped.

## Other text forms

The same fence also reads the two text forms tools produce, told apart by
content:

- the protobuf text form of `ModelProto` (what `onnx.save` writes with
  `format="pbtxt"`, or `protoc --decode`):

  ````markdown
  ```onnx
  ir_version: 7
  graph {
    name: "g"
    node { input: "x" output: "y" op_type: "Sigmoid" }
    input { name: "x" type { tensor_type { elem_type: 1 shape { dim { dim_value: 2 } } } } }
    output { name: "y" }
  }
  ```
  ````

- the JSON form (`MessageToJson` of a `ModelProto`).

A binary `.onnx` file cannot go in a fence; convert it to one of these first,
for instance with `onnx.save(model, "model.onnxtxt", format="textproto")`, or
`onnx.printer.to_text(model)` for the text syntax.

## Fence attributes

An optional attribute block after the tag adjusts how one graph is presented:

````markdown
```onnx {caption="Figure 1: the stem" align="center" direction="right"}
stem (float[N, 3, 224, 224] x) => (float[N, 64, 56, 56] y) {
  c = Conv <kernel_shape = [7, 7], strides = [2, 2], pads = [3, 3, 3, 3]> (x, w)
  r = Relu (c)
  y = MaxPool <kernel_shape = [3, 3], strides = [2, 2], pads = [1, 1, 1, 1]> (r)
}
```
````

| Attribute | Effect |
| --- | --- |
| `alt` | Description for readers who cannot see the graph |
| `caption` | Text shown beneath the graph |
| `align` | `left`, `center` or `right` |
| `class` | Extra CSS class on the graph's `<svg>` |
| `direction` | `down` (the default) or `right`, exactly: which way the graph flows |

Values are quoted. A mistyped or malformed attribute never costs you the
graph: it is ignored, and a note is written to the output channel. The one
exception is `direction`: any value but `down` or `right` is reported in place
of the graph.

## Viewing the source

Every graph carries a small button in its top corner that flips the fence
between the graph and the fence's text, highlighted the way the preview shows
any other code block. A flipped fence stays flipped while you edit the
document, after *Markdown: Refresh Preview*, and when the preview is reopened;
flip it back to see the graph again. The button is a reader's control: a fence
cannot be written to open in source view.

## Errors and limits

A model that does not parse is reported in place of the graph, quoting the
line with a caret under the column where the reader stopped; the rest of the
document still renders. Text that is not a model in any of the three forms
says so in one sentence.

Layout runs in a worker thread with a time budget, `onnx.layoutTimeout`
(3 seconds by default, 0.5 to 60). A graph that takes longer is reported as a
timeout and not retried until the fence changes or the setting does; a change
to the setting restarts the worker with the new limit. A fence
may hold 1 MB of text and 1000 nodes; past that, a static drawing stops being
readable, and the fence is refused with a message saying so. Drawings are
cached, so editing elsewhere in the document costs nothing.

## Development

Requires Node 22 or newer (see `.nvmrc`).

```sh
npm ci
npm run lint            # tsc --noEmit
npm test                # node --test, after building
npm run package         # vsce package
npm run test:package    # the VSIX inside a real VS Code
npm run test:preview    # the view toggle in a live preview, through Playwright
```

The extension is the preview glue: fence attributes, figure wrapping, the
cache and the setting. Reading, laying out and drawing models — Netron's
reader, ELK and the drawing — live in onnx-renderer, pinned in `package.json`
to a release tarball and shipped in the VSIX's `node_modules`.
`THIRD_PARTY_NOTICES.md` says what ships and under which terms.

To regenerate the Marketplace PNG from its SVG source, use librsvg:

```sh
rsvg-convert -w 128 -h 128 media/icon.svg -o media/icon.png
```
