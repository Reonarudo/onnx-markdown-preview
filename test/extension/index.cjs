// Runs inside a real VS Code (scripts/test-extension.mjs). Renders through the Markdown preview's
// own markdown-it via `markdown.api.render`, so every assertion sees what the preview would show.
const vscode = require('vscode');
const assert = require('node:assert/strict');

const fence = (info, source) => '```' + info + '\n' + source + '\n```\n';
// 24 inputs into 24 Sum nodes: 576 edges, which ELK takes several seconds over.
const dense = (() => {
  const inputs = Array.from({ length: 24 }, (_, i) => `float[1] i${i}`).join(', ');
  const outputs = Array.from({ length: 24 }, (_, i) => `float[1] o${i}`).join(', ');
  const nodes = Array.from({ length: 24 }, (_, i) => `  o${i} = Sum (${Array.from({ length: 24 }, (_, j) => `i${j}`).join(', ')})`);
  return `dense (${inputs}) => (${outputs}) {\n${nodes.join('\n')}\n}`;
})();
const cnn = 'cnn (float[N, 3, 32, 32] x, float[8, 3, 3, 3] w = {}) => (float[N, 10] y) {\n  c = Conv <kernel_shape = [3, 3]> (x, w)\n  r = Relu (c)\n  y = GlobalAveragePool (r)\n}';

exports.run = async () => {
  const extension = vscode.extensions.getExtension('ReoX86.onnx-graph-preview');
  assert(extension, 'extension ReoX86.onnx-graph-preview is installed');
  assert.deepEqual(extension.packageJSON.contributes['markdown.previewStyles'], ['media/preview.css']);
  await extension.activate();
  await vscode.extensions.getExtension('vscode.markdown-language-features').activate();
  const render = (markdown) => vscode.commands.executeCommand('markdown.api.render', markdown);

  // Graphs, and fences this extension must leave alone.
  const mixed = await render([
    fence('onnx', cnn),
    fence('onnx', 'ir_version: 7\ngraph { name: "g" node { input: "x" output: "y" op_type: "Sigmoid" } input { name: "x" } output { name: "y" } }'),
    fence('onnxtxt', 'left alone'),
    fence('graphviz', 'digraph { a -> b }'),
    fence('swift', 'let x = 42')
  ].join('\n'));
  assert.equal((mixed.match(/<svg class="onnx"/g) ?? []).length, 2);
  assert.match(mixed, /class="header category-layer"\/><text x="12" y="15" class="type">Conv<\/text>/);
  assert.match(mixed, /<tspan class="key">W<\/tspan> ⟨8×3×3×3⟩/);
  assert.match(mixed, />Sigmoid<\/text>/);
  assert.match(mixed, /class="[^"]*\blanguage-onnxtxt"/);
  assert.match(mixed, /class="[^"]*\blanguage-graphviz"/);
  assert.match(mixed, /class="[^"]*\blanguage-swift"/);

  // Attributes, escaping and a tolerated typo; model text is escaped too.
  const attributed = await render(fence('onnx {alt="A net" caption="Figure 1: <net>" align="center" direction="right" algin="x"}',
    'ir_version: 7\ngraph { name: "g" node { input: "<b>x</b>" output: "y" op_type: "Relu" } input { name: "<b>x</b>" } output { name: "y" } }'));
  assert.match(attributed, /<figure class="onnx-figure onnx-align-center"><div role="img" aria-label="A net"><svg class="onnx"/);
  assert.match(attributed, /<figcaption>Figure 1: &lt;net&gt;<\/figcaption>/);
  assert.match(attributed, />&lt;b&gt;x&lt;\/b&gt;<\/text>/);
  assert.doesNotMatch(attributed, /<b>/);

  // A model error quotes the line with a caret; the rest of the document survives.
  const broken = await render('Before\n\n' + fence('onnx', 'g (float[1] x) => (float[1] y) {\n  y = Relu (x\n}') + '\nAfter');
  assert.match(broken, /<div class="onnx-error" role="alert"><pre>Unexpected token '}'\.\n\n3 │ }\n    \^<\/pre><\/div>/);
  assert.match(broken, /<p\b[^>]*>After<\/p>/);

  // A graph too dense to lay out times out promptly, and the next graph still renders.
  const started = Date.now();
  assert.match(await render(fence('onnx', dense)), /Layout took longer than 3 s \(onnx\.layoutTimeout\)/);
  assert.ok(Date.now() - started < 6000, 'timeout returns promptly');
  assert.match(await render(fence('onnx', 'g (float[1] x) => (float[1] y) { y = Relu (x) }')), /<svg class="onnx"/);

  // The budget follows the setting live, and changing it retries a cached timeout.
  const configuration = vscode.workspace.getConfiguration('onnx');
  assert.equal(configuration.get('layoutTimeout'), 3);
  await configuration.update('layoutTimeout', 60, vscode.ConfigurationTarget.Global);
  try {
    assert.match(await render(fence('onnx', dense)), /<svg class="onnx"/);
  } finally {
    await configuration.update('layoutTimeout', undefined, vscode.ConfigurationTarget.Global);
  }
};
