import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { markdownPlugin } from '../src/markdown';
import type { RenderResult } from '../src/renderer';

const graph = (output = '<svg class="onnx" width="10"></svg>'): RenderResult => ({ status: 'success', output, notes: [] });

test('claims exactly onnx fences and passes the model text through', () => {
  let seen = '';
  const md = markdownPlugin(new MarkdownIt(), (source) => { seen = source; return graph(); });
  assert.match(md.render('```onnx\ng (float[1] x) => (float[1] y) { y = Relu (x) }\n```'), /<svg class="onnx"/);
  assert.equal(seen, 'g (float[1] x) => (float[1] y) { y = Relu (x) }\n');
});

test('the fence rule hands the checked attributes to the renderer, direction included', () => {
  const given: unknown[] = [];
  const md = markdownPlugin(new MarkdownIt(), (_source, env, attributes) => { given.push(env, attributes); return graph(); });
  md.render('```onnx {direction="right" alt="x"}\nm\n```', { document: 'demo.md' });
  md.render('```onnx {direction="nope"}\nm\n```');
  assert.deepEqual(given, [{ document: 'demo.md' }, { direction: 'right', alt: 'x' }, {}, {}]);
});

test('preserves unrelated fences byte for byte including highlighting', () => {
  for (const language of ['ONNX', 'onnx extra', 'onnxtxt', 'netron', 'spice', 'graphviz', 'smiles', 'swift', '']) {
    const input = '```' + language + '\nm\n```';
    const options = { highlight: () => '<b>highlight</b>' };
    const delegated = markdownPlugin(new MarkdownIt(options), () => { throw new Error('wrong fence'); });
    assert.equal(delegated.render(input), new MarkdownIt(options).render(input), language);
  }
});

test('a previously registered fence renderer still receives its fences', () => {
  const md = new MarkdownIt();
  md.renderer.rules.fence = () => '<div class="other-extension"></div>';
  markdownPlugin(md, () => graph());
  assert.equal(md.render('```smiles\nCCO\n```'), '<div class="other-extension"></div>');
  assert.match(md.render('```onnx\nm\n```'), /<svg/);
});

test('alt, caption, align and class wrap the drawing, escaped', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph());
  const html = md.render('```onnx {alt="A <net>" caption="Fig <1>" align="center" class="x&y"}\nm\n```');
  assert.equal(html, '<figure class="onnx-figure onnx-align-center"><div role="img" aria-label="A &lt;net&gt;"><svg class="onnx x&amp;y" width="10"></svg></div><figcaption>Fig &lt;1&gt;</figcaption></figure>');
  assert.equal(md.render('```onnx\nm\n```'), '<svg class="onnx" width="10"></svg>');
});

test('failures are reported in place, with the offending line and a caret when known', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'Unexpected token \'}\'.', line: 2, column: 4 }));
  assert.equal(md.render('```onnx\ng (x) => (y) {\n  y = }\n```'), '<div class="onnx-error" role="alert"><pre>Unexpected token \'}\'.\n\n2 │   y = }\n        ^</pre></div>\n');
  const plain = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'The model has no graph.' }));
  assert.equal(plain.render('```onnx\nm\n```'), '<div class="onnx-error" role="alert"><pre>The model has no graph.</pre></div>\n');
});

test('timeouts and an unavailable renderer explain themselves', () => {
  const timeout = markdownPlugin(new MarkdownIt(), () => ({ status: 'timeout', budget: 2500 }));
  assert.match(timeout.render('```onnx\nm\n```'), /Layout took longer than 2\.5 s \(onnx\.layoutTimeout\)/);
  const down = markdownPlugin(new MarkdownIt(), () => ({ status: 'unavailable', reason: 'no worker' }));
  assert.match(down.render('```onnx\nm\n```'), /could not start: no worker\. It will retry/);
});

test('attribute diagnostics go to the reporter, never the preview', () => {
  const reported: string[] = [];
  const md = markdownPlugin(new MarkdownIt(), () => graph(), (line) => reported.push(line));
  const html = md.render('```onnx {algin="x"}\nm\n```');
  assert.equal(html, '<svg class="onnx" width="10"></svg>');
  assert.deepEqual(reported, ['Unknown attribute "algin"; ignored.']);
});
