import { parentPort, workerData } from 'node:worker_threads';
import ELK from 'elkjs/lib/elk.bundled.js';
import { renderModel } from './render';
import type { RenderResult, Request } from './renderer';

const { buffer } = workerData as { buffer: SharedArrayBuffer };
/** [0] result ready, [1] result byte length, [2] 1 once ELK has loaded and this worker listens. */
const state = new Int32Array(buffer, 0, 3);
const bytes = new Uint8Array(buffer, 12);

function reply(result: RenderResult): void {
  let encoded = new TextEncoder().encode(JSON.stringify(result));
  if (encoded.length > bytes.length) {
    encoded = new TextEncoder().encode(JSON.stringify({
      status: 'failure',
      message: 'The drawing exceeds the 4 MB limit.'
    } satisfies RenderResult));
  }
  bytes.set(encoded);
  Atomics.store(state, 1, encoded.length);
  Atomics.store(state, 0, 1);
  Atomics.notify(state, 0);
}

const elk = new ELK();
const layout = (graph: Parameters<typeof elk.layout>[0]) => elk.layout(graph);

// The first layout in a fresh worker costs a few hundred milliseconds of warm-up that must not be
// charged to an author's budget, so it is spent here, before this worker reports ready.
void renderModel('<ir_version: 8, opset_import: ["" : 17]>\nwarm (float[1] x) => (float[1] y) { y = Relu (x) }', layout)
  .finally(() => {
    parentPort!.on('message', (request: Request) => {
      renderModel(request.source, layout, request.direction).then(reply, (error: unknown) => {
        reply({ status: 'failure', message: error instanceof Error ? error.message : String(error) });
      });
    });
    Atomics.store(state, 2, 1);
    Atomics.notify(state, 2);
    parentPort!.postMessage({ ready: true });
  });
