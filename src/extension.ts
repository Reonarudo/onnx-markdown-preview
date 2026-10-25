import type { ExtensionContext } from 'vscode';
import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { window, workspace } from 'vscode';
import { createPreview, type Preview } from './preview';
import { createRestartable, type Restartable } from './runtimes';

let runtime: Restartable | undefined;

export async function activate(context: ExtensionContext): Promise<{ extendMarkdownIt(md: MarkdownIt): MarkdownIt }> {
  // Unrecognised fence attributes and the reader's notes never surface in the preview (ADR 0002);
  // they are reported here so an author who suspects a typo has somewhere to look.
  const channel = window.createOutputChannel('ONNX Graph Preview');
  context.subscriptions.push(channel);
  const log = (line: string) => channel.appendLine(line);

  let preview: Preview;
  try {
    // Required here, not imported, so that a library that fails to load lands in this `try`
    // instead of failing activation. esbuild leaves it external (ADR 0010).
    const library: typeof import('@reonarudo/onnx-renderer') = require('@reonarudo/onnx-renderer');
    const started = await createRestartable(library, { timeout: layoutTimeout() });
    runtime = started;
    preview = createPreview(started, log);
    context.subscriptions.push(workspace.onDidChangeConfiguration((change) => {
      if (!change.affectsConfiguration('onnx.layoutTimeout')) return;
      // The old runtime lays out until the new one is ready; then cached timeouts, measured
      // against the old budget, are forgotten.
      started.restart({ timeout: layoutTimeout() }).then(
        (tookOver) => { if (tookOver) preview.clear(); },
        (error) => log(`ONNX renderer failed to restart: ${describe(error)}`)
      );
    }));
  } catch (error) {
    log(`ONNX renderer failed to load: ${describe(error)}`);
    preview = createPreview({
      render: () => ({ status: 'unavailable', reason: 'the renderer failed to load; see the "ONNX Graph Preview" output' })
    }, log);
  }
  return { extendMarkdownIt: (md) => preview.extendMarkdownIt(md) };
}

export async function deactivate(): Promise<void> {
  await runtime?.dispose();
  runtime = undefined;
}

/** The configured budget in milliseconds, clamped to the range the setting declares. */
function layoutTimeout(): number {
  const seconds = workspace.getConfiguration('onnx').get<number>('layoutTimeout', 3);
  const clamped = Number.isFinite(seconds) ? Math.min(60, Math.max(0.5, seconds)) : 3;
  return Math.round(clamped * 1000);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.stack ?? error.message : String(error);
}
