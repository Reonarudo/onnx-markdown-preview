// Models and helpers the tests share.
import assert from 'node:assert/strict';

/** A dense graph: every one of 16 inputs feeds every one of 16 Sum nodes, 256 edges that take ELK most of a second. */
export const DENSE = (() => {
  const inputs = Array.from({ length: 16 }, (_, i) => `float[1] i${i}`).join(', ');
  const outputs = Array.from({ length: 16 }, (_, i) => `float[1] o${i}`).join(', ');
  const nodes = Array.from({ length: 16 }, (_, i) => `  o${i} = Sum (${Array.from({ length: 16 }, (_, j) => `i${j}`).join(', ')})`);
  return `dense (${inputs}) => (${outputs}) {\n${nodes.join('\n')}\n}`;
})();

/**
 * The rendering slot's inner HTML of the first claimed fence in `html`, so the exact-markup tests
 * keep asserting the rendering byte for byte while the wrapper, toggle and source `<pre>` are
 * asserted once, in the contract tests. The slot ends where the delegated source `<pre><code`
 * begins; an error card's own `<pre>` carries no `<code>`, so it never ends the slot early.
 */
export function rendering(html: string): string {
  const open = '<div class="onnx-rendering">';
  const start = html.indexOf(open);
  assert.notEqual(start, -1, `no rendering slot in ${html}`);
  const end = html.indexOf('</div><pre><code', start);
  assert.notEqual(end, -1, `no source <pre> after the rendering slot in ${html}`);
  return html.slice(start + open.length, end);
}
