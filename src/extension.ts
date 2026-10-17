import type { ExtensionContext } from 'vscode';
import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import { window, workspace } from 'vscode';
import { createPreview } from './preview';

export async function activate(context: ExtensionContext): Promise<{ extendMarkdownIt(md: MarkdownIt): MarkdownIt }> {
  // Unrecognised fence attributes and the reader's notes never surface in the preview; they are
  // reported here so an author who suspects a typo has somewhere to look.
  const channel = window.createOutputChannel('ONNX Graph Preview');
  context.subscriptions.push(channel);
  const preview = await createPreview(context.asAbsolutePath('dist'), (line) => channel.appendLine(line), {
    timeout: () => layoutTimeout()
  });
  context.subscriptions.push({ dispose: () => preview.dispose() });
  // A cached timeout would otherwise outlive the budget it was measured against.
  context.subscriptions.push(workspace.onDidChangeConfiguration((change) => {
    if (change.affectsConfiguration('onnx.layoutTimeout')) preview.clear();
  }));
  return { extendMarkdownIt: (md) => preview.extendMarkdownIt(md) };
}

/** The configured budget in milliseconds, clamped to the range the setting declares. */
function layoutTimeout(): number {
  const seconds = workspace.getConfiguration('onnx').get<number>('layoutTimeout', 3);
  const clamped = Number.isFinite(seconds) ? Math.min(60, Math.max(0.5, seconds)) : 3;
  return Math.round(clamped * 1000);
}
