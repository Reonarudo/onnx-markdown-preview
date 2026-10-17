import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import { createPreview } from '../src/preview';
import { DENSE } from './helpers';

const document = [
  '# Models',
  '',
  '```onnx {caption="A CNN" algin="x"}',
  'g (float[1] x) => (float[1] y) { y = Relu (x) }',
  '```',
  '',
  '```onnx',
  'g (bool c, float[1] x) => (float[1] y) {',
  '  y = If <then_branch = yes () => (float[1] t) { t = Relu (x) }, else_branch = no () => (float[1] e) { e = Neg (x) }> (c)',
  '}',
  '```',
  '',
  '```onnx',
  'g (float[1] x) => (float[1] y) {',
  '  y = Relu (x',
  '}',
  '```',
  '',
  '```onnxtxt',
  'left alone',
  '```'
].join('\n');

test('a Markdown document renders graphs beside delegated fences, logging notes once', async () => {
  const logged: string[] = [];
  const preview = await createPreview(resolve('dist'), (line) => logged.push(line));
  try {
    const html = preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal((html.match(/<svg class="onnx"/g) ?? []).length, 2);
    assert.match(html, /<figure class="onnx-figure"><svg class="onnx"[^>]*>[\s\S]*<\/svg><figcaption>A CNN<\/figcaption><\/figure>/);
    assert.match(html, /<pre>Unexpected token '}'\.\n\n3 │ }\n    \^<\/pre>/);
    assert.match(html, /<pre><code class="language-onnxtxt">left alone/);
    assert.deepEqual(logged, [
      'Unknown attribute "algin"; ignored.',
      'g (bool c, float[1] x) => (float[1] y) {: If.then_branch: the nested graph yes is not drawn.',
      'g (bool c, float[1] x) => (float[1] y) {: If.else_branch: the nested graph no is not drawn.'
    ]);
    // Rendering again is served from the cache: only the attribute diagnostic repeats.
    preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal(logged.length, 4);
  } finally {
    preview.dispose();
  }
});

test('the preview takes a live budget and clears its cache on demand', async () => {
  let budget = 100;
  const preview = await createPreview(resolve('dist'), () => {}, { timeout: () => budget });
  try {
    const md = preview.extendMarkdownIt(new MarkdownIt());
    const fence = '```onnx\n' + DENSE + '\n```';
    assert.match(md.render(fence), /Layout took longer than 0\.1 s/);
    budget = 60000;
    assert.match(md.render(fence), /Layout took longer than 0\.1 s/, 'the timeout is cached until cleared');
    preview.clear();
    assert.match(md.render(fence), /<svg class="onnx"/);
  } finally {
    preview.dispose();
  }
});
