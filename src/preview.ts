import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderInput, RenderResult, Runtime } from '@reonarudo/onnx-renderer';
import { createHash } from 'node:crypto';
import { markdownPlugin, type Render } from './markdown';

const maxEntries = 96;

export interface Preview {
  extendMarkdownIt(md: MarkdownIt): MarkdownIt;
  /** Forget every cached outcome; call once a runtime with a new budget has taken over. */
  clear(): void;
}

/**
 * Assemble the preview: the library runtime behind a cache, and the fence plugin. Kept free of
 * `vscode` so it can be exercised end to end in tests.
 *
 * `log` receives what never reaches the preview (ADR 0002): attribute diagnostics, and the
 * reader's notes — once per fresh render, labelled with the fence's first line.
 */
export function createPreview(runtime: Pick<Runtime, 'render'>, log: (line: string) => void): Preview {
  const render = createRenderer(runtime, ({ source }, result) => {
    if (result.status !== 'success') return;
    for (const note of result.notes) log(`${label(source)}: ${note}`);
  });
  return {
    extendMarkdownIt: (md) => markdownPlugin(md, render, log),
    clear: () => render.clear()
  };
}

export interface Renderer extends Render {
  /** Forget every outcome, so that cached timeouts are retried under a new budget. */
  clear(): void;
}

/**
 * Put a cache in front of the runtime, so re-rendering an unchanged fence on every keystroke costs
 * a lookup rather than a layout. The library does not cache (ADR 0003).
 *
 * Outcomes are cached, timeouts included: a graph too large to lay out is not retried until its
 * fence changes or the cache is cleared. An unavailable runtime says nothing about the model, so
 * it is not cached. `onFresh` hears every real render — never a cache hit.
 */
export function createRenderer(
  runtime: Pick<Runtime, 'render'>,
  onFresh: (input: RenderInput, result: RenderResult) => void = () => {}
): Renderer {
  const cache = new Map<string, RenderResult>();
  const render = (input: RenderInput): RenderResult => {
    // An absent direction and an empty one are different inputs: the second is a failure.
    const direction = input.direction === undefined ? '' : `=${input.direction}`;
    const key = createHash('sha256').update(input.source).update('\u0000').update(direction).digest('hex');
    let result = cache.get(key);
    if (result) {
      // Re-insert so Map order tracks recency and the first key is the least recently used.
      cache.delete(key);
    } else {
      result = runtime.render(input);
      onFresh(input, result);
      if (result.status === 'unavailable') return result;
    }
    cache.set(key, result);
    if (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
    return result;
  };
  return Object.assign(render, { clear: () => cache.clear() });
}

function label(source: string): string {
  const first = source.trim().split('\n', 1)[0]!.trim();
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
