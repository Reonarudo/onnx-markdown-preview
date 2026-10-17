import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRuntime } from '../src/renderer';
import { DENSE } from './helpers';

test('a model renders to a graph through the worker, with the reader\'s notes', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const result = runtime.render('g (bool c, float[1] x) => (float[1] y) {\n  y = If <then_branch = yes () => (float[1] t) { t = Relu (x) }, else_branch = no () => (float[1] e) { e = Neg (x) }> (c)\n}');
    assert.equal(result.status, 'success', JSON.stringify(result));
    if (result.status !== 'success') return;
    assert.match(result.output, /^<svg class="onnx"/);
    assert.match(result.output, />If<\/text>/);
    assert.deepEqual(result.notes, ['If.then_branch: the nested graph yes is not drawn.', 'If.else_branch: the nested graph no is not drawn.']);
  } finally {
    runtime.dispose();
  }
});

test('a model error comes back with its line and column', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    assert.deepEqual(runtime.render('g (float[1] x) => (float[1] y) {\n  y = Relu (x\n}'), { status: 'failure', message: 'Unexpected token \'}\'.', line: 3, column: 0 });
  } finally {
    runtime.dispose();
  }
});

test('a layout over the time limit times out, and the next render still works', async () => {
  const runtime = await createRuntime(resolve('dist'), { timeout: 200 });
  try {
    assert.deepEqual(runtime.render(DENSE), { status: 'timeout', budget: 200 });
    const started = Date.now();
    assert.equal(runtime.render('g (float[1] x) => (float[1] y) { y = Relu (x) }').status, 'success');
    assert.ok(Date.now() - started < 5000, 'a fresh worker is ready promptly');
  } finally {
    runtime.dispose();
  }
});

test('the direction reaches the worker', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    const size = (svg: string) => /width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1, 3).map(Number) as [number, number];
    const down = runtime.render('g (float[1] x) => (float[1] y) { y = Relu (x) }');
    const right = runtime.render('g (float[1] x) => (float[1] y) { y = Relu (x) }', 'right');
    assert.ok(down.status === 'success' && right.status === 'success');
    const [, downHeight] = size(down.output);
    const [, rightHeight] = size(right.output);
    assert.ok(downHeight > rightHeight);
  } finally {
    runtime.dispose();
  }
});

test('an oversized fence is refused without a layout', async () => {
  const runtime = await createRuntime(resolve('dist'));
  try {
    assert.deepEqual(runtime.render('x'.repeat(1_000_001)), { status: 'failure', message: 'The model exceeds the 1 MB limit.' });
  } finally {
    runtime.dispose();
  }
});
