import { C, S, T, TOUCH, displayFont } from "../theme";

/**
 * PageHeader — top-of-screen title for a main tab: big italic display
 * title (the mockup's "Matchday" / "Compete" / "My Profile"), optional
 * subtitle, optional right-hand slot for a contextual action (group
 * chip, settings gear…). The 16px side margin comes from the tab's own
 * padding — this only owns the vertical rhythm (24 top / 16 bottom).
 *
 * Props: title (t()-wrapped), subtitle (node/string), right (node, kept
 * ≥44px tall), style (overrides).
 */
export default function PageHeader({ title, subtitle, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: S.md, padding: `${S.xl}px 0 ${S.lg}px`, ...style }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ ...displayFont, fontSize: T.title, lineHeight: 1.05, color: C.text1, margin: 0 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.xs }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min }}>{right}</div>}
    </div>
  );
}
