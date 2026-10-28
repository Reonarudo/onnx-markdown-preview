# The view toggle

Every `onnx` fence below carries a button in its top corner that flips it between the graph
and the fence's source. This file is the fixture for `npm run test:preview` and the document
for the manual checklist (`docs/source-toggle-spec.md`, section 9.5): open it in a development
window and view it in a light, a dark and a high-contrast theme.

## 1. A plain fence

```onnx
g (float[N, 3, 32, 32] x) => (float[N, 10] y) {
  c = Conv <kernel_shape = [3, 3], pads = [1, 1, 1, 1]> (x, w, b)
  r = Relu (c)
  p = MaxPool <kernel_shape = [2, 2], strides = [2, 2]> (r)
  f = Flatten (p)
  y = Gemm <transB = 1> (f, fc_w, fc_b)
}
```

## 2. Captioned, centred: the button stays at the column edge

```onnx {caption="Figure 1: a basic residual block" align="center" direction="right"}
block (float[N, 64, 56, 56] x) => (float[N, 64, 56, 56] y) {
  c1 = Conv <kernel_shape = [3, 3], pads = [1, 1, 1, 1]> (x, w1)
  r1 = Relu (c1)
  c2 = Conv <kernel_shape = [3, 3], pads = [1, 1, 1, 1]> (r1, w2)
  s = Add (c2, x)
  y = Relu (s)
}
```

## 3. Right-aligned with alt: the card sits under the button

```onnx {alt="a two-node graph" align="right"}
tiny (float[1] x) => (float[1] y) {
  h = Relu (x)
  y = Relu (h)
}
```

## 4. Error card: the source view shows the body alone

```onnx
g (float[1] x) => (float[1] y) {
  y = Relu (x
}
```

## 5. Long lines and a tall body: horizontal scroll, height jump

```onnx
attention (float[B, T, 512] x, bool mask) => (float[B, T, 512] y) {
  q = MatMul (x, wq)
  k = MatMul (x, wk)
  v = MatMul (x, wv)
  kt = Transpose <perm = [0, 2, 1]> (k)
  scores = MatMul (q, kt)
  scaled = Div (scores, scale)
  masked = If <then_branch = yes () => (float[B, T, T] t) { t = Where (mask, scaled, neg_inf) }, else_branch = no () => (float[B, T, T] e) { e = Identity (scaled) }> (mask)
  p = Softmax <axis = -1> (masked)
  y = MatMul (p, v)
}
```

## 6. Two identical bodies: flip the second one only, then edit this heading

```onnx
same (float[1] x) => (float[1] y) {
  y = Relu (x)
}
```

```onnx
same (float[1] x) => (float[1] y) {
  y = Relu (x)
}
```

## 7. An ordinary fence: no toggle, VS Code's own copy button on hover

```json
{ "compare": "hover me: the copy button is top-right, on hover only" }
```

## 8. Right-to-left container: the button moves to the left

<div dir="rtl">

```onnx
rtl (float[1] x) => (float[1] y) {
  y = Relu (x)
}
```

</div>

## 9. Quirks

The ONNX preview has no loading placeholder, notes or slot cache; a graph that takes longer
than `onnx.layoutTimeout` shows a timeout card, which the toggle treats like any error card.
