import { C, S, T, displayFont } from "../theme";

/**
 * StatTile — big display-italic number + small label, for rows of 3–4
 * stats (Perfil's "Jogos · Golos · Assist. · MVP", matchday recaps).
 * Transparent on purpose: put a row of tiles inside ONE card (or on the
 * page) — don't wrap each tile in its own card.
 *
 * Props:
 *  - value   number/string (e.g. 12, "87%", "—").
 *  - label   t()-wrapped caption (rendered uppercase, 12px, C.text2).
 *  - color   number colour (default C.text1; use semantic colours only
 *            with meaning, e.g. C.green for reliability ≥ 90%).
 *  - size    "md" (28px, default — fits 4 across a phone) | "lg" (40px).
 *  - sub     optional tiny line under the label (e.g. "+2 esta semana").
 *  - align   "center" (default) | "left".
 *  - style   overrides.
 *
 * Row pattern: <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>{tiles}</div>
 */
export default function StatTile({ value, label, color, size = "md", sub, align = "center", style }) {
  return (
    <div style={{ minWidth: 0, textAlign: align, padding: `${S.xs}px 0`, ...style }}>
      <div style={{ ...displayFont, fontSize: size === "lg" ? 40 : 28, lineHeight: 1, color: color ?? C.text1, fontVariantNumeric: "tabular-nums" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: S.xs + 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: T.min, color: C.text2, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
