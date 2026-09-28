import { C, R, S, T, displayFont } from "../theme";

function TeamPanel({ team, edgeColor, side }) {
  const edge = `4px solid ${team.color ?? edgeColor}`;
  return (
    <div style={{
      flex: 1, minWidth: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card,
      [side === "left" ? "borderLeft" : "borderRight"]: edge,
      padding: `${S.md}px ${S.md}px ${S.lg}px`, textAlign: "center", boxSizing: "border-box",
    }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {team.name}
      </div>
      <div style={{ ...displayFont, fontSize: 64, lineHeight: 1, marginTop: S.sm, color: C.text1, fontVariantNumeric: "tabular-nums" }}>
        {team.score ?? 0}
      </div>
      {team.sub && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.sub}</div>}
    </div>
  );
}

/**
 * ScoreBlock — the live/final score hero (mockup "ALPHA 3 | BRAVO 2"):
 * two team panels side by side, name + huge display-italic score. Left
 * panel has a lime edge, right panel a blue edge (overridable per team).
 *
 * Props:
 *  - home    { name, score, color?, sub? } — left panel (lime edge).
 *  - away    { name, score, color?, sub? } — right panel (blue edge).
 *            `color` overrides the edge (e.g. the drawn team's colour);
 *            `sub` is a small line under the score (e.g. scorers).
 *  - center  optional node between the panels (timer "12:40", "FT",
 *            a LIVE pill). Kept narrow; omit for just a gap.
 *  - style   container overrides.
 */
export default function ScoreBlock({ home, away, center, style }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: S.sm, ...style }}>
      <TeamPanel team={home} edgeColor={C.accent} side="left" />
      {center != null && (
        <div style={{ flexShrink: 0, maxWidth: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.xs, fontSize: T.meta, fontWeight: 800, color: C.text2, textAlign: "center" }}>
          {center}
        </div>
      )}
      <TeamPanel team={away} edgeColor={C.blue} side="right" />
    </div>
  );
}
