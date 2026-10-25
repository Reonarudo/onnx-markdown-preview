// Run test/extension/index.cjs inside a real VS Code, isolated from the user's profile.
// ONNX_EXTENSION_PATH points at the extension to load: an unpacked VSIX
// (scripts/test-package.mjs) or an installed copy; without it, this repo.
// VSCODE_EXECUTABLE uses a local VS Code instead of downloading one.
import { runTests } from '@vscode/test-electron';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Inherited from a VS Code terminal or agent, this would start the test VS Code as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE;
const root = await mkdtemp(join(tmpdir(), 'onnx-host-'));
const workspace = join(root, 'workspace');
await mkdir(workspace);
try {
  await runTests({
    ...(process.env.VSCODE_EXECUTABLE
      ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE }
      : { version: process.env.VSCODE_VERSION ?? 'stable' }),
    extensionDevelopmentPath: resolve(process.env.ONNX_EXTENSION_PATH ?? '.'),
    extensionTestsPath: resolve('test/extension/index.cjs'),
    launchArgs: [workspace, `--user-data-dir=${join(root, 'user')}`, `--extensions-dir=${join(root, 'extensions')}`,
      '--skip-welcome', '--skip-release-notes', '--disable-updates', '--disable-extensions']
  });
} finally {
  await rm(root, { recursive: true, force: true });
}
