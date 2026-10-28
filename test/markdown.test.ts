import { test } from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { markdownPlugin } from '../src/markdown';
import { rendering } from './helpers';
import type { RenderInput, RenderResult } from '@reonarudo/onnx-renderer';

const graph = (output = '<svg class="onnx" viewBox="-8 -8 110 308"></svg>'): RenderResult => ({ status: 'success', output, notes: [] });

const ICON_CODE = '<svg class="onnx-icon-code" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M5.7 3.3 1 8l4.7 4.7.9-.9L2.8 8l3.8-3.8zM10.3 3.3l-.9.9L13.2 8l-3.8 3.8.9.9L15 8z"/></svg>';
const ICON_GRAPH = '<svg class="onnx-icon-graph" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">' +
  '<rect x="1.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="9.5" y="1.5" width="5" height="3.5" rx=".5"/><rect x="5.5" y="11" width="5" height="3.5" rx=".5"/>' +
  '<path d="M4 5v3h8V5M8 8v3"/></svg>';
const TOGGLE = `<button type="button" class="onnx-toggle" aria-pressed="false" aria-label="Source view" title="Source view">${ICON_CODE}${ICON_GRAPH}</button>`;

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

test('a previously registered fence renderer still receives its fences, and supplies the source view of ours', () => {
  const md = new MarkdownIt();
  md.renderer.rules.fence = () => '<div class="other-extension"></div>';
  markdownPlugin(md, () => graph());
  assert.equal(md.render('```smiles\nCCO\n```'), '<div class="other-extension"></div>');
  const html = md.render('```onnx\nm\n```');
  assert.match(html, /<svg/);
  assert.match(html, /<\/div><div class="other-extension"><\/div><\/div>\n$/);
});

// The DOM contract (docs/source-toggle-spec.md section 2): asserted exactly once, here.
test('every claimed fence is wrapped: toggle first, rendering slot, then the delegated source <pre>', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph());
  assert.equal(md.render('```onnx\nm\n```'),
    `<div class="onnx-fence code-line" data-line="0" data-fence-key="bd2eb076">${TOGGLE}` +
    '<div class="onnx-rendering"><svg class="onnx" width="110px" viewBox="-8 -8 110 308"></svg></div>' +
    '<pre><code class="language-onnx">m\n</code></pre>\n</div>\n');
});

test('the wrapper carries code-line and data-line from the token map, and neither without a map', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph());
  const tokens = md.parse('# Title\n\n```onnx\nm\n```', {});
  assert.match(md.renderer.render(tokens, md.options, {}), /<div class="onnx-fence code-line" data-line="2" data-fence-key="bd2eb076">/);
  for (const token of tokens) token.map = null;
  const bare = md.renderer.render(tokens, md.options, {});
  assert.match(bare, /<div class="onnx-fence" data-fence-key="bd2eb076">/);
  assert.doesNotMatch(bare, /data-line/);
});

test('the fence key is FNV-1a of the exact body', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph());
  assert.match(md.render('```onnx\nm\n```'), /data-fence-key="bd2eb076"/);
  assert.match(md.render('```onnx\n```'), /data-fence-key="811c9dc5"/);
  // The info string and attributes play no part: same body, same key.
  assert.match(md.render('```onnx {caption="c"}\nm\n```'), /data-fence-key="bd2eb076"/);
  assert.match(md.render('```onnx\nm \n```'), /data-fence-key="(?!bd2eb076)[0-9a-f]{8}"/);
});

test('the source <pre> is the delegated fence rule output, with VS Code-style highlighting kept verbatim', () => {
  const highlighted = markdownPlugin(new MarkdownIt({ highlight: (code, lang) => `<i class="${lang}">${code.trim()}</i>` }), () => graph());
  assert.match(highlighted.render('```onnx {alt="x"}\nm\n```'), /<\/div><pre><code class="language-onnx"><i class="onnx">m<\/i><\/code><\/pre>\n<\/div>\n$/);
  // VS Code's shell keeps its highlighting and `dir`, but not the scroll-sync class and line,
  // which the wrapper carries for the whole fence.
  const vscode = new MarkdownIt();
  vscode.renderer.rules.fence = (tokens, index) =>
    `<pre><code data-line="${tokens[index]!.map![0]}" class="code-line language-onnx" dir="auto">${tokens[index]!.content}</code></pre>\n`;
  markdownPlugin(vscode, () => graph());
  assert.match(vscode.render('```onnx\nm\n```'), /<\/div><pre><code class="language-onnx" dir="auto">m\n<\/code><\/pre>\n<\/div>\n$/);
  // Bare markdown-it with no fence rule at all: a hand-built, escaped fallback.
  const md = new MarkdownIt();
  delete md.renderer.rules.fence;
  markdownPlugin(md, () => graph());
  assert.match(md.render('```onnx\n<m>\n```'), /<\/div><pre><code class="language-onnx">&lt;m&gt;\n<\/code><\/pre>\n<\/div>\n$/);
});

test('the error card and a renderer that threw sit in the rendering slot, with the source <pre> beside them', () => {
  const failed = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'no' }));
  assert.equal(failed.render('```onnx\nm\n```'),
    `<div class="onnx-fence code-line" data-line="0" data-fence-key="bd2eb076">${TOGGLE}` +
    '<div class="onnx-rendering"><div class="onnx-error" role="alert"><pre>no</pre></div>\n</div>' +
    '<pre><code class="language-onnx">m\n</code></pre>\n</div>\n');
  const threw = markdownPlugin(new MarkdownIt(), () => { throw new Error('x'); });
  assert.match(threw.render('```onnx\nm\n```'), /<div class="onnx-rendering"><div class="onnx-error" role="alert"><pre>The graph renderer failed: x<\/pre><\/div>\n<\/div><pre><code class="language-onnx">m\n<\/code><\/pre>\n<\/div>\n$/);
});

test('alt, caption, align and class wrap the drawing, escaped', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph());
  const html = md.render('```onnx {alt="A <net>" caption="Fig <1>" align="center" class="x&y"}\nm\n```');
  assert.equal(rendering(html), '<figure class="onnx-figure onnx-align-center"><div role="img" aria-label="A &lt;net&gt;"><svg class="onnx x&amp;y" width="110px" viewBox="-8 -8 110 308"></svg></div><figcaption>Fig &lt;1&gt;</figcaption></figure>');
  assert.equal(rendering(md.render('```onnx\nm\n```')), '<svg class="onnx" width="110px" viewBox="-8 -8 110 308"></svg>');
});

test('the graph keeps its natural width from the viewBox, and an SVG without one is left as is', () => {
  const md = markdownPlugin(new MarkdownIt(), () => graph('<svg class="onnx" viewBox="-8 -8 412.5 90" font-family="x"></svg>'));
  assert.equal(rendering(md.render('```onnx\nm\n```')), '<svg class="onnx" width="412.5px" viewBox="-8 -8 412.5 90" font-family="x"></svg>');
  const bare = markdownPlugin(new MarkdownIt(), () => graph('<svg class="onnx"></svg>'));
  assert.equal(rendering(bare.render('```onnx\nm\n```')), '<svg class="onnx"></svg>');
});

test('a renderer that throws degrades its own fence, not the preview', () => {
  const reported: string[] = [];
  const md = markdownPlugin(new MarkdownIt(), () => { throw new TypeError('bad <input>'); }, (line) => reported.push(line));
  const html = md.render('```onnx\nm\n```\n\nAfter');
  assert.equal(rendering(html), '<div class="onnx-error" role="alert"><pre>The graph renderer failed: bad &lt;input&gt;</pre></div>\n');
  assert.match(html, /<\/div>\n<p>After<\/p>\n$/);
  assert.deepEqual(reported, ['ONNX render failed: bad <input>']);
});

test('failures are reported in place, escaped, with the offending line and a caret under the 1-based column', () => {
  const md = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'Unexpected token \'}\'.', line: 2, column: 5 }));
  assert.equal(rendering(md.render('```onnx\ng (x) => (y) {\n  y = }\n```')), '<div class="onnx-error" role="alert"><pre>Unexpected token \'}\'.\n\n2 │   y = }\n        ^</pre></div>\n');
  const plain = markdownPlugin(new MarkdownIt(), () => ({ status: 'failure', message: 'Unknown direction "<up>": use down or right.' }));
  assert.equal(rendering(plain.render('```onnx\nm\n```')), '<div class="onnx-error" role="alert"><pre>Unknown direction &quot;&lt;up&gt;&quot;: use down or right.</pre></div>\n');
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
  assert.equal(rendering(html), '<svg class="onnx" width="110px" viewBox="-8 -8 110 308"></svg>');
  assert.deepEqual(reported, ['Unknown attribute "algin"; ignored.']);
});
