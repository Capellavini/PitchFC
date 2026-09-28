import { ChevronRight } from "lucide-react";
import { C, S, T } from "../theme";

/**
 * ListRow — one row of a list INSIDE a card (spec §3: one card level
 * only; rows are separated by 1px C.border dividers, never nested cards).
 * ≥56px tall with a 40px leading slot, so it clears the 48px rule.
 *
 * Props:
 *  - leading   left node: <Avatar size={40}/>, or a lucide icon element.
 *  - title     primary line (16px/700 ≈ card title; ellipsised).
 *  - meta      secondary line (12px, C.text2; ellipsised).
 *  - right     right slot (Chip, value, BtnGhost compact, toggle…).
 *  - onClick   makes the whole row a button and adds a chevron after
 *              `right` (pass chevron={false} to hide it).
 *  - divider   draw the 1px top divider (default true; pass false — or
 *              rely on :first-child logic in your list — for row #1).
 *  - accent    "action required" state: 3px lime left edge.
 *  - style     overrides.
 *
 * e.g. <div style={{ ...cardStyle, padding: "0 16px" }}>
 *        {rows.map((r, i) => <ListRow key={r.id} divider={i > 0} leading={<Avatar …/>} title={r.nick} meta={r.pos} right={<Chip …/>} />)}
 *      </div>
 */
export default function ListRow({ leading, title, meta, right, onClick, chevron = true, divider = true, accent = false, style }) {
  const inner = (
    <>
      {leading && <div style={{ width: 40, minWidth: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.cardTitle - 1, fontWeight: 700, color: C.text1, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {meta && <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: S.sm }}>{right}</div>}
      {onClick && chevron && <ChevronRight size={18} color={C.text2} style={{ flexShrink: 0 }} />}
    </>
  );
  const base = {
    display: "flex", alignItems: "center", gap: S.md, width: "100%", minHeight: 56, boxSizing: "border-box",
    padding: `${S.md}px 0`, paddingLeft: accent ? S.md : 0,
    borderTop: divider ? `1px solid ${C.border}` : "none",
    borderLeft: accent ? `3px solid ${C.accent}` : "none",
    background: "none", textAlign: "left", color: "inherit", font: "inherit",
    ...style,
  };
  if (!onClick) return <div style={base}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} style={{ ...base, borderRight: "none", borderBottom: "none", cursor: "pointer" }}>
      {inner}
    </button>
  );
}
