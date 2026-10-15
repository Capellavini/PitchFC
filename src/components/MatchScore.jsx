import { C, S, T, displayFont } from "../theme";
import TeamBadge from "./TeamBadge";

/** Crest · name  L – R  name · crest. The Rivals result screens always put
 *  MY team on the left (so "3–2" reads as 3 for us), whichever side is home.
 *  `provisional` draws the score muted + dashed: it isn't official yet.
 *  The whole thing reads as one sentence to a screen reader. */
export default function MatchScore({ left, right, leftScore, rightScore, provisional = false, big = false }) {
  const size = big ? 46 : 36;
  return (
    <div role="group" aria-label={`${left?.name ?? ""} ${leftScore}, ${right?.name ?? ""} ${rightScore}`}
      style={{ display: "flex", alignItems: "center", gap: S.sm }}>
      {[left, right].map((tm, i) => (
        <div key={tm?.id || i} style={{ flex: 1, minWidth: 0, order: i ? 2 : 0, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: S.xs }}><TeamBadge team={tm} size={size} /></div>
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text1, overflowWrap: "anywhere" }}>{tm?.name}</div>
        </div>
      ))}
      <div style={{
        order: 1, ...displayFont, fontSize: big ? 40 : 30, lineHeight: 1, flexShrink: 0, fontVariantNumeric: "tabular-nums",
        color: provisional ? C.text2 : C.text1, padding: `${S.sm}px ${S.md}px`, borderRadius: 12,
        border: provisional ? `1px dashed ${C.text3}` : `1px solid transparent`,
      }}>
        {leftScore}<span aria-hidden style={{ color: C.text2, margin: `0 ${S.xs}px` }}>–</span>{rightScore}
      </div>
    </div>
  );
}
