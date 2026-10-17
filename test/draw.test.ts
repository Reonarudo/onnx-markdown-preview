import { test } from 'node:test';
import assert from 'node:assert/strict';
import ELK from 'elkjs/lib/elk.bundled.js';
import { renderModel } from '../src/render';
import { measure } from '../src/measure';
import { sizeOf } from '../src/layout';
import { CONV } from './helpers';

const elk = new ELK();
const layout = (graph: Parameters<typeof elk.layout>[0]) => elk.layout(graph);

async function draw(source: string, direction?: 'down' | 'right'): Promise<string> {
  const result = await renderModel(source, layout, direction);
  assert.equal(result.status, 'success', JSON.stringify(result));
  return result.status === 'success' ? result.output : '';
}

test('a graph is one SVG with the onnx class, a viewBox, its operators, rows, pills and labels', async () => {
  const svg = await draw(CONV);
  // The class comes first: the fence rule adds an author's class by rewriting it.
  assert.match(svg, /^<svg class="onnx" width="[\d.]+" height="[\d.]+" viewBox="-8 -8 [\d.]+ [\d.]+" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
  assert.match(svg, /<path d="[^"]+" class="header category-layer"\/><text x="12" y="15" class="type">Conv<\/text>/);
  assert.match(svg, /<text x="12" y="[\d.]+" class="attribute"><tspan class="key">kernel_shape<\/tspan> = \[3, 3\]<\/text>/);
  assert.match(svg, /<text x="12" y="[\d.]+" class="weight"><tspan class="key">W<\/tspan> ⟨8×3×3×3⟩<\/text>/);
  assert.match(svg, /<g class="node input"[^>]*><rect [^>]*class="pill"\/><text x="12" y="15" class="type">x<\/text><text x="12" y="34" class="tensor">float32\[N,3,32,32\]<\/text>/);
  assert.match(svg, /<g class="node output"/);
  assert.match(svg, /<text x="[\d.]+" y="[\d.]+" class="label">N×3×32×32<\/text>/);
  assert.equal((svg.match(/class="wire"/g) ?? []).length, 7);
  assert.equal((svg.match(/class="arrow"/g) ?? []).length, 7);
  assert.doesNotMatch(svg, / id="/);
});

test('the layout flows down by default, and to the right on request', async () => {
  const down = await draw('g (float[1] x) => (float[1] y) { y = Relu (x) }');
  const right = await draw('g (float[1] x) => (float[1] y) { y = Relu (x) }', 'right');
  const size = (svg: string) => /width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1, 3).map(Number) as [number, number];
  const [downWidth, downHeight] = size(down);
  const [rightWidth, rightHeight] = size(right);
  assert.ok(downHeight > downWidth, `down: ${downWidth}×${downHeight}`);
  assert.ok(rightWidth > rightHeight, `right: ${rightWidth}×${rightHeight}`);
});

test('model text reaches the SVG only as escaped text', async () => {
  const svg = await draw('ir_version: 7\ngraph { name: "<g>" node { name: "<n>" input: "<b>x</b>" output: "y" op_type: "Relu" attribute { name: "<a>" type: STRING s: "<i>v</i>" } } input { name: "<b>x</b>" } output { name: "y" } }');
  assert.doesNotMatch(svg, /<b>|<i>|<n>|<a>/);
  assert.match(svg, />&lt;b&gt;x&lt;\/b&gt;<\/text>/);
  assert.match(svg, /<tspan class="key">&lt;a&gt;<\/tspan> = &lt;i&gt;v&lt;\/i&gt;/);
  assert.match(svg, /<title>Relu \(&lt;n&gt;\)<\/title>/);
});

test('failures carry the reader\'s position through, and too many nodes are refused', async () => {
  assert.deepEqual(await renderModel('g (float[1] x) => (float[1] y) {\n  y = Relu (x\n}', layout), { status: 'failure', message: 'Unexpected token \'}\'.', line: 3, column: 0 });
  const chain = ['g (float[1] x0) => (float[1] y) {'];
  for (let i = 0; i < 1001; i++) chain.push(`  x${i + 1} = Relu (x${i})`);
  chain.push('  y = Identity (x1001)', '}');
  assert.deepEqual(await renderModel(chain.join('\n'), layout), { status: 'failure', message: 'The graph has 1004 nodes; at most 1000 are drawn.' });
});

test('boxes grow with their widest text, measured as Helvetica', () => {
  assert.equal(measure('iii', 10), 6.66);
  assert.ok(measure('WWW', 10, true) > measure('WWW', 10));
  const narrow = sizeOf({ kind: 'operator', id: 'a', type: 'Relu', attributes: [], weights: [] });
  const wide = sizeOf({ kind: 'operator', id: 'b', type: 'Relu', attributes: [{ name: 'a_long_attribute_name', value: '[1, 2, 3, 4]' }], weights: [{ name: 'W', shape: '1×2' }] });
  assert.deepEqual(narrow, { width: 60, height: 22 });
  assert.ok(wide.width > narrow.width);
  assert.equal(wide.height, 22 + 17 * 2);
  assert.deepEqual(sizeOf({ kind: 'input', id: 'c', name: 'x' }), { width: 60, height: 22 });
  assert.deepEqual(sizeOf({ kind: 'input', id: 'c', name: 'x', type: 'float32[1]' }).height, 39);
});
