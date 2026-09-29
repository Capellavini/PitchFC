import { C, S, T } from "../theme";

/**
 * SectionLabel — small uppercase eyebrow above a section/card group.
 * 12px (spec §3 meta size, never below 11), C.text2 for contrast.
 *
 * Props: children (t()-wrapped text), right (optional node aligned
 * right, e.g. a "Ver tudo" link), style (overrides).
 */
export default function SectionLabel({ children, right, style }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm,
      fontSize: T.meta, color: C.text2, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: S.md, ...style,
    }}>
      <span style={{ minWidth: 0 }}>{children}</span>
      {right && <span style={{ flexShrink: 0, textTransform: "none", letterSpacing: 0 }}>{right}</span>}
    </div>
  );
}
