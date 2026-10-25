import type MarkdownItConstructor from 'markdown-it';
type MarkdownIt = InstanceType<typeof MarkdownItConstructor>;
import type { RenderInput, RenderResult } from '@reonarudo/onnx-renderer';
import { parseAttributes, type FenceAttributes } from './attributes';

/** The class on every graph's root `<svg>`, so the preview stylesheet can select it. */
export const BASE_CLASS = 'onnx';

/**
 * `onnx`, alone or followed by an attribute block. First word only, case-sensitive.
 *
 * A fence whose block is malformed is still claimed: the attributes are dropped and the graph
 * renders bare, rather than falling through to another renderer as raw text.
 */
const CLAIMED = /^onnx(?:\s+\{|$)/;

/** One fence through the library: its body, and its `direction` attribute as written. */
export type Render = (input: RenderInput) => RenderResult;
export type Report = (message: string) => void;

/**
 * Claim `onnx` fences and draw each as one graph.
 *
 * Every fence we do not claim is delegated to whichever fence renderer was registered before us
 * (markdown-it's default, or another extension's, e.g. a Graphviz or SMILES preview).
 */
export function markdownPlugin(md: MarkdownIt, render: Render, report: Report = () => {}): MarkdownIt {
  const original = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const info = token.info.trim();
    if (!CLAIMED.test(info)) {
      return original
        ? original(tokens, index, options, env, self)
        : self.renderToken(tokens, index, options);
    }
    const { attributes, diagnostics } = parseAttributes(info);
    for (const diagnostic of diagnostics) {
      report(diagnostic);
    }
    const input: RenderInput = { source: token.content };
    if (attributes.direction !== undefined) input.direction = attributes.direction;
    let result: RenderResult;
    try {
      result = render(input);
    } catch (error) {
      // The renderer throws only for programmer errors, but a throw here would remove the whole
      // extension from the preview, so it degrades this fence alone.
      const cause = error instanceof Error ? error.message : String(error);
      report(`ONNX render failed: ${cause}`);
      return errorReport(md, `The graph renderer failed: ${cause}`);
    }
    if (result.status !== 'success') return errorReport(md, describe(result, token.content));
    return wrap(md, sized(withClass(md, result.output, attributes.class)), attributes);
  };
  return md;
}

/** Add the author's class, if any, beside the base class the drawing already carries. */
function withClass(md: MarkdownIt, svg: string, extra: string | undefined): string {
  if (!extra) return svg;
  return svg.replace(/^<svg class="onnx"/, `<svg class="${md.utils.escapeHtml(`${BASE_CLASS} ${extra}`)}"`);
}

/**
 * Give the graph its natural width. The renderer emits a `viewBox` and no size, so a small graph
 * would otherwise stretch to the preview column; its units are pixels, the same width the
 * extension drew before. The stylesheet still scales a wide one down.
 */
function sized(svg: string): string {
  const width = /^<svg\b[^>]*\sviewBox="[^"\s]+\s+[^"\s]+\s+([0-9.]+)\s/.exec(svg)?.[1];
  return width ? svg.replace(/^<svg class="[^"]*"/, (start) => `${start} width="${width}px"`) : svg;
}

function wrap(md: MarkdownIt, graph: string, attributes: FenceAttributes): string {
  const escape = md.utils.escapeHtml;
  let html = graph;
  if (attributes.alt !== undefined) {
    // `role="img"` sits inside the figure so that a caption stays outside the image role and
    // remains available to assistive technology.
    html = `<div role="img" aria-label="${escape(attributes.alt)}">${html}</div>`;
  }
  if (attributes.caption === undefined && attributes.align === undefined) {
    return html;
  }
  const classes = attributes.align
    ? `onnx-figure onnx-align-${attributes.align}`
    : 'onnx-figure';
  const caption = attributes.caption === undefined
    ? ''
    : `<figcaption>${escape(attributes.caption)}</figcaption>`;
  return `<figure class="${classes}">${html}${caption}</figure>`;
}

/** The text of the error report shown in place of a graph. */
function describe(result: Exclude<RenderResult, { status: 'success' }>, source: string): string {
  if (result.status === 'timeout') {
    const seconds = (result.budget / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 });
    return `Layout took longer than ${seconds} s (onnx.layoutTimeout). ` +
      'Split the model into several fences, or raise the limit.';
  }
  if (result.status === 'unavailable') {
    return `The graph renderer could not start: ${result.reason}. It will retry on the next render.`;
  }
  // Echo the line the reader names, with a caret under the column, so the author need not count.
  const lines = source.split('\n');
  const text = result.line !== undefined ? lines[result.line - 1]?.replace(/\r$/, '') : undefined;
  if (text === undefined || result.line === undefined) return result.message;
  const gutter = `${result.line} │ `;
  // Columns are 1-based. One past the end is allowed: that is where the reader points when a token
  // is missing.
  const column = Math.min(Math.max((result.column ?? 1) - 1, 0), text.length + 1);
  return `${result.message}\n\n${gutter}${text}\n${' '.repeat(gutter.length + column)}^`;
}

function errorReport(md: MarkdownIt, text: string): string {
  return `<div class="onnx-error" role="alert"><pre>${md.utils.escapeHtml(text)}</pre></div>\n`;
}
