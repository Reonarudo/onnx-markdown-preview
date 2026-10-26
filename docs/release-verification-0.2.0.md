# Release verification — ONNX Graph Preview 0.2.0

Verified 2026-10-26. Extension ID `ReoX86.onnx-graph-preview`.

## What was released

- Migration commit `5954b83`: graphs are drawn by onnx-renderer 1.0.0
  (`https://github.com/Reonarudo/onnx-renderer/releases/download/v1.0.0/reonarudo-onnx-renderer-1.0.0.tgz`,
  lockfile integrity equal to the release's), shipped under the VSIX's `node_modules`.
- CI green on `5954b83` on Linux, Windows, macOS and the VS Code 1.101.0 job
  ([run](https://github.com/Reonarudo/onnx-markdown-preview/actions/runs/40226355533)).
- Tag `v0.2.0` → `release.yml` published the
  [GitHub Release](https://github.com/Reonarudo/onnx-markdown-preview/releases/tag/v0.2.0)
  with the VSIX and `SHA256SUMS`
  ([run](https://github.com/Reonarudo/onnx-markdown-preview/actions/runs/40250391778)).

## The release asset

- `onnx-graph-preview-0.2.0.vsix`: **697 435 bytes, 57 files**, SHA-256
  `e20f883cdd8a977df54abfe21c07c0eef77faabb72e908333f8bcac42a9b39df` (matches `SHA256SUMS`). 0.1.2 was 586 069 bytes.
- `npm run test:package -- <asset>` (layout checks, then the real-host test): **PASS** on
  VS Code 1.143.0 and 1.101.0.
- Published unchanged with `npx vsce publish --packagePath <asset>`, so the Marketplace and
  GitHub carry the same bytes.

## Marketplace

- Listing: 0.2.0 has engine `^1.101.0`; 0.1.2 and 0.1.0 keep `^1.95.0`.
- Install by ID into an isolated `--extensions-dir` with VS Code 1.143.0's CLI: 0.2.0; every
  file equals the release asset's, and `package.json` differs only by the added `__metadata`.
- `scripts/test-extension.mjs` with `ONNX_EXTENSION_PATH` set to the installed copy:
  **PASS** on VS Code 1.143.0 and 1.101.0.
- VS Code 1.95.0 installing by ID gets 0.1.2.
