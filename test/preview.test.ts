import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { createRuntime, type RenderInput, type RenderResult } from '@reonarudo/onnx-renderer';
import { createPreview, createRenderer } from '../src/preview';
import { DENSE, rendering } from './helpers';

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
  '```onnx {direction="Right"}',
  'g (float[1] x) => (float[1] y) { y = Relu (x) }',
  '```',
  '',
  '```onnxtxt',
  'left alone',
  '```'
].join('\n');

test('a Markdown document renders graphs beside delegated fences through the library, logging notes once', async () => {
  const logged: string[] = [];
  const runtime = await createRuntime();
  try {
    const preview = createPreview(runtime, (line) => logged.push(line));
    const html = preview.extendMarkdownIt(new MarkdownIt()).render(document);
    assert.equal((html.match(/<svg class="onnx" width="[\d.]+px" viewBox=/g) ?? []).length, 2);
    assert.match(html, /<figure class="onnx-figure"><svg class="onnx"[^>]*>[\s\S]*<\/svg><figcaption>A CNN<\/figcaption><\/figure>/);
    assert.match(html, /<pre>Unexpected token '}'\.\n\n3 │ }\n    \^<\/pre>/);
    assert.match(html, /<pre>Unknown direction &quot;Right&quot;: use down or right\.<\/pre>/);
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
    await runtime.dispose();
  }
});

test('the natural width is the drawing 0.1.2 drew: the viewBox width', async () => {
  const runtime = await createRuntime();
  try {
    const html = createPreview(runtime, () => {}).extendMarkdownIt(new MarkdownIt())
      .render('```onnx\ng (float[1] x) => (float[1] y) { y = Relu (x) }\n```');
    const [, width, viewBoxWidth] = /^<svg class="onnx" width="([\d.]+)px" viewBox="\S+ \S+ ([\d.]+) /.exec(rendering(html)) ?? [];
    assert.ok(width);
    assert.equal(width, viewBoxWidth);
  } finally {
    await runtime.dispose();
  }
});

test('a timeout is cached, so the same fence does not wait again', async () => {
  const runtime = await createRuntime({ timeout: 100 });
  try {
    const preview = createPreview(runtime, () => {});
    const md = preview.extendMarkdownIt(new MarkdownIt());
    const fence = '```onnx\n' + DENSE + '\n```';
    assert.match(md.render(fence), /Layout took longer than 0\.1 s/);
    const started = Date.now();
    assert.match(md.render(fence), /Layout took longer than 0\.1 s/);
    assert.ok(Date.now() - started < 50, 'the second render is a cache hit');
  } finally {
    await runtime.dispose();
  }
});

test('the cache keys on source and direction, skips unavailable results, and clears on demand', () => {
  const calls: RenderInput[] = [];
  let next: RenderResult = { status: 'unavailable', reason: 'starting' };
  const render = createRenderer({ render: (input) => { calls.push(input); return next; } });
  const source = 'g (float[1] x) => (float[1] y) { y = Relu (x) }';
  render({ source });
  next = { status: 'success', output: '<svg class="onnx"></svg>', notes: [] };
  render({ source });
  render({ source });
  render({ source, direction: 'right' });
  render({ source, direction: '' });
  assert.equal(calls.length, 4, 'unavailable was retried; then one render per distinct input');
  render.clear();
  render({ source });
  assert.equal(calls.length, 5);
});
