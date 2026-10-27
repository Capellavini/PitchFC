// Adjunto replies are light text: short paragraphs, "- " bullets and **bold**.
// Both the guided replies and the model's replies go through this parser, so
// the screen renders one format and never injects HTML. Pure.

const INLINE = /\*\*([^*]+)\*\*/g;

/** "a **b** c" → [{text:"a "},{text:"b",bold:true},{text:" c"}] */
export function inline(line) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out.length ? out : [{ text: "" }];
}

/**
 * @param {string} text
 * @returns {({type: "p", parts: object[]} | {type: "ul", items: object[][]})[]}
 *   Consecutive bullet lines share one list; a heading mark (#) becomes a
 *   bold paragraph; stray markdown (backticks, links) is flattened to text.
 */
export function parseAdjuntoText(text) {
  const clean = String(text ?? "").replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\r/g, "");
  const blocks = [];
  for (const raw of clean.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet && !line.startsWith("**")) {
      const last = blocks[blocks.length - 1];
      const item = inline(bullet[1]);
      if (last?.type === "ul") last.items.push(item); else blocks.push({ type: "ul", items: [item] });
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    blocks.push({ type: "p", parts: heading ? [{ text: heading[1].replace(/\*\*/g, ""), bold: true }] : inline(line) });
  }
  return blocks;
}
