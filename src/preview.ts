import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { markdownPlugin } from './markdown';
import { createRenderer, createRuntime } from './renderer';

export interface Preview {
  extendMarkdownIt(md: MarkdownIt): MarkdownIt;
  /** Forget every cached drawing; call when the layout budget changes. */
  clear(): void;
  dispose(): void;
}

export interface PreviewOptions {
  /** Layout budget in milliseconds, read before every render. Default: 3000. */
  timeout?: () => number;
}

/**
 * Assemble the preview: the layout worker, the cache, and the fence plugin. Kept free of `vscode`
 * so it can be exercised end to end in tests.
 *
 * `log` receives what never reaches the preview: attribute diagnostics, and the reader's notes —
 * once per fresh render, labelled with the fence's first line.
 */
export async function createPreview(
  distDirectory: string,
  log: (line: string) => void,
  options: PreviewOptions = {}
): Promise<Preview> {
  const runtime = await createRuntime(distDirectory, options.timeout ? { timeout: options.timeout } : {});
  const render = createRenderer(runtime, (source, result) => {
    if (result.status !== 'success') return;
    for (const note of result.notes) log(`${label(source)}: ${note}`);
  });
  return {
    extendMarkdownIt: (md) => markdownPlugin(md, (source, _env, attributes) => render(source, attributes.direction), log),
    clear: () => render.clear(),
    dispose: () => runtime.dispose()
  };
}

function label(source: string): string {
  const first = source.trim().split('\n', 1)[0]!.trim();
  return first.length > 60 ? `${first.slice(0, 59)}…` : first;
}
