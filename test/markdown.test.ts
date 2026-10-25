import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { markdownPlugin } from '../src/markdown';
import type { RenderInput, RenderResult } from '@reonarudo/onnx-renderer';

const graph = (output = '<svg class="onnx" viewBox="-8 -8 110 308"></svg>'): RenderResult => ({ status: 'success', output, notes: [] });

test('claims exactly onnx fences and passes the model text through', () => {
  let seen = '';
  const md = markdownPlugin(new MarkdownIt(), ({ source }) => { seen = source; return graph(); });
  assert.match(md.render('```onnx\ng (float[1] x) => (float[1] y) { y = Relu (x) }\n```'), /<svg class="onnx"/);
  assert.equal(seen, 'g (float[1] x) => (float[1] y) { y = Relu (x) }\n');
});

test('the direction attribute reaches the renderer exactly as written, and only when given', () => {
  const given: RenderInput[] = [];
  const md = markdownPlugin(new MarkdownIt(), (input) => { given.push(input); return graph(); });
  md.render('```onnx {direction="right" alt="x"}\nm\n```');
  md.render('```onnx {direction="RIGHT"}\nm\n```');
  md.render('```onnx {direction=""}\nm\n```');
  md.render('```onnx {alt="x"}\nm\n```');
  assert.deepEqual(given, [
    { source: 'm\n', direction: 'right' },
    { source: 'm\n', direction: 'RIGHT' },
    { source: 'm\n', direction: '' },
    { source: 'm\n' }
  ]);
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
  assert.equal(html, '<figure class="onnx-figure onnx-align-center"><div role="img" aria-label="A &lt;net&gt;"><svg class="onnx x&amp;y" width="110px" viewBox="-8 -8 110 308"></svg></div><figcaption>Fig &lt;1&gt;</figcaption></figure>');
  assert.equal(md.render('```onnx\nm\n```'), '<svg class="onnx" width="110px" viewBox="-8 -8 110 308"></svg>');
});

test('the graph keeps its natural width from the viewBox, and an SVG without one is left as is', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph('<svg class="onnx" viewBox="-8 -8 412.5 90" font-family="x"></svg>'));
  assert.equal(md.render('```onnx\nm\n```'), '<svg class="onnx" width="412.5px" viewBox="-8 -8 412.5 90" font-family="x"></svg>');
  const bare = markdownPlugin(new MarkdownIt(), () => graph('<svg class="onnx"></svg>'));
  assert.equal(bare.render('```onnx\nm\n```'), '<svg class="onnx"></svg>');
});

test('a renderer that throws degrades its own fence, not the preview', () => {
  const reported: string[] = [];
  const md = markdownPlugin(new MarkdownIt(), () => { throw new TypeError('bad <input>'); }, (line) => reported.push(line));
  const html = md.render('```onnx\nm\n```\n\nAfter');
  assert.match(html, /^<div class="onnx-error" role="alert"><pre>The graph renderer failed: bad &lt;input&gt;<\/pre><\/div>\n<p>After<\/p>/);
  assert.deepEqual(reported, ['ONNX render failed: bad <input>']);
});

test('failures are reported in place, escaped, with the offending line and a caret under the 1-based column', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'Unexpected token \'}\'.', line: 2, column: 5 }));
  assert.equal(md.render('```onnx\ng (x) => (y) {\n  y = }\n```'), '<div class="onnx-error" role="alert"><pre>Unexpected token \'}\'.\n\n2 │   y = }\n        ^</pre></div>\n');
  const plain = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'Unknown direction "<up>": use down or right.' }));
  assert.equal(plain.render('```onnx\nm\n```'), '<div class="onnx-error" role="alert"><pre>Unknown direction &quot;&lt;up&gt;&quot;: use down or right.</pre></div>\n');
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
  assert.equal(html, '<svg class="onnx" width="110px" viewBox="-8 -8 110 308"></svg>');
  assert.deepEqual(reported, ['Unknown attribute "algin"; ignored.']);
});
