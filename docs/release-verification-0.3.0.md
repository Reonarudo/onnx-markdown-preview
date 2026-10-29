# ONNX Graph Preview 0.3.0 verification

Release: the view toggle on every claimed fence (source-toggle spec in `onnx-markdown-preview`). Publisher: ReoX86.
Source tag: `v0.3.0` (`bfbd0287f4b8f701357f7c6212cc4dfc7741554b`).

- GitHub release: https://github.com/Reonarudo/onnx-markdown-preview/releases/tag/v0.3.0, built by `release.yml` from the tag (https://github.com/Reonarudo/onnx-markdown-preview/actions/runs/40857420184): lint, build, 34 unit tests, packaging and the packaged-VSIX host test under Xvfb.
- VSIX: `onnx-graph-preview-0.3.0.vsix`, **701 662 bytes, 58 files** (0.2.0: 697 435 bytes; the growth is `media/preview.js` and the toggle's stylesheet).
- SHA-256: `f1f8bcecf2958431d5ed82c7f13757e312df212ea47e0b13e30fc4d4e7c60461`.
- CI passed on Linux, Windows, macOS and the VS Code 1.101.0 minimum-version job: https://github.com/Reonarudo/onnx-markdown-preview/actions/runs/40857420157
- The release asset was downloaded, checked against the release's `SHA256SUMS`, and passed `npm run test:package -- <asset>` on VS Code 1.144.0 (2026-10-29).
- `npm run test:preview` on the tagged commit: **8 live checks passed** on VS Code 1.144.0 (2026-10-29), the required line for the first release carrying the toggle (spec 9.7).
- The manual checklist (spec 9.5: three themes, copy-button row, RTL container, focus ring, scroll sync, the extension's quirks) was done on `examples/view-toggle.md` in a development window and accepted by the user on 2026-10-29.

## Marketplace

Published on 2026-10-29 with `npx vsce publish --packagePath <release asset>`, so the Marketplace and GitHub carry the same bytes:
https://marketplace.visualstudio.com/items?itemName=ReoX86.onnx-graph-preview

- Listing: 0.3.0 has engine `^1.101.0`; 0.2.0 keeps `^1.101.0` and the older releases `^1.95.0`.
- Installed by ID (`ReoX86.onnx-graph-preview@0.3.0`) into an isolated temporary profile with VS Code 1.139.0's CLI. The installed files equal the release asset; `package.json` differs only by the `__metadata` the installer adds.

The normal profile was not modified.
