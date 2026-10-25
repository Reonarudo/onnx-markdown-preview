/** Models the tests share. */

/** A dense graph: every one of 16 inputs feeds every one of 16 Sum nodes, 256 edges that take ELK most of a second. */
export const DENSE = (() => {
  const inputs = Array.from({ length: 16 }, (_, i) => `float[1] i${i}`).join(', ');
  const outputs = Array.from({ length: 16 }, (_, i) => `float[1] o${i}`).join(', ');
  const nodes = Array.from({ length: 16 }, (_, i) => `  o${i} = Sum (${Array.from({ length: 16 }, (_, j) => `i${j}`).join(', ')})`);
  return `dense (${inputs}) => (${outputs}) {\n${nodes.join('\n')}\n}`;
})();
