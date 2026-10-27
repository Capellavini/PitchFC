import { C, S, T } from "../../theme";
import { parseAdjuntoText } from "../../lib/adjuntoText";

/** Renders an Adjunto reply: short paragraphs, bullet lists and bold, all as
 *  React text (never HTML). Same look for guided and model replies. */
export default function AdjuntoText({ text, color = C.text1 }) {
  const blocks = parseAdjuntoText(text);
  const parts = (ps) => ps.map((p, i) => (p.bold ? <strong key={i} style={{ fontWeight: 800 }}>{p.text}</strong> : <span key={i}>{p.text}</span>));
  return (
    <div style={{ fontSize: T.body, lineHeight: 1.5, color, overflowWrap: "anywhere" }}>
      {blocks.map((b, i) => (b.type === "ul" ? (
        <ul key={i} style={{ margin: `${S.xs}px 0`, paddingLeft: S.lg, display: "flex", flexDirection: "column", gap: 2 }}>
          {b.items.map((it, k) => <li key={k}>{parts(it)}</li>)}
        </ul>
      ) : (
        <p key={i} style={{ margin: i ? `${S.sm}px 0 0` : 0 }}>{parts(b.parts)}</p>
      )))}
    </div>
  );
}
