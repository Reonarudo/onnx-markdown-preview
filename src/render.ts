import { readModel } from './model';
import { layoutGraph, type Direction, type Layout } from './layout';
import { drawGraph } from './draw';
import type { RenderResult } from './renderer';

/** How many operators one fence may hold: past this, a static drawing stops being readable. */
export const MAX_NODES = 1000;

/**
 * Read, lay out and draw one fence: everything the worker does, kept free of the worker so tests
 * can call it directly.
 */
export async function renderModel(source: string, layout: Layout, direction: Direction = 'down'): Promise<RenderResult> {
  const read = await readModel(source);
  if (!read.ok) {
    const result: RenderResult = { status: 'failure', message: read.message };
    if (read.line !== undefined) result.line = read.line;
    if (read.column !== undefined) result.column = read.column;
    return result;
  }
  const { graph } = read;
  if (graph.nodes.length > MAX_NODES) {
    return { status: 'failure', message: `The graph has ${graph.nodes.length} nodes; at most ${MAX_NODES} are drawn.` };
  }
  let drawing;
  try {
    drawing = await layoutGraph(graph, layout, direction);
  } catch (error) {
    // ELK's messages are Java exception names; they are logged, and the author gets a plain one.
    const detail = error instanceof Error ? error.message : String(error);
    return { status: 'failure', message: `The graph could not be laid out (${detail.slice(0, 200)}).` };
  }
  return { status: 'success', output: drawGraph(drawing), notes: graph.notes };
}
