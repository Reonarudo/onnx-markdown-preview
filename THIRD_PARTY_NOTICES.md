# Third-party notices

The extension's original TypeScript, tests, build scripts, and artwork are MIT
licensed (see `LICENSE`). This does not relicense the software it ships.

## ONNX renderer

Models are read, laid out and drawn by
[onnx-renderer](https://github.com/Reonarudo/onnx-renderer) (MIT), shipped in
this extension under `node_modules/@reonarudo/onnx-renderer/`. It carries the
ONNX reader from [Netron](https://github.com/lutzroeder/netron) 9.3.1 by Lutz
Roeder (MIT), vendored unmodified with trimmed operator metadata, and a drawing
in the style of Netron's. Its own `THIRD_PARTY_NOTICES.md` and `licenses/`
directory give their provenance and licenses; keep them with any redistribution.

## elkjs (Eclipse Layout Kernel)

[`elkjs`](https://www.npmjs.com/package/elkjs), the JavaScript build of the Eclipse
Layout Kernel by Kiel University and the ELK contributors, places every node and
routes every edge. It is shipped unmodified under `node_modules/elkjs/` and used
under the **Eclipse Public License 2.0** (it is dual-licensed EPL-2.0 OR
GPL-3.0-or-later); the license is in `node_modules/elkjs/LICENSE.md`. Only
`lib/elk.bundled.js`, which the renderer loads, and `lib/elk-api.js` are shipped;
the package's other builds are left out. Source: <https://github.com/kieler/elkjs>
and <https://github.com/eclipse/elk>.

## xmldom

[`@xmldom/xmldom`](https://github.com/xmldom/xmldom), which the renderer uses to
build and serialise each graph, is shipped under `node_modules/@xmldom/xmldom/`
with its MIT license.

The exact versions are locked in `package-lock.json`.
