import { C, displayFont } from "../theme";

/** Top-of-screen title for a main tab: big italic display title (the
 *  mockup's "Matchday" / "Compete" / "My Profile" headers), optional
 *  subtitle, optional right-hand slot for a contextual action (group
 *  switcher, settings gear…). 16px side margin comes from the tab's
 *  own padding — this only owns the vertical rhythm (24 top / 16 bottom). */
export default function PageHeader({ title, subtitle, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "24px 0 16px", ...style }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...displayFont, fontSize: 30, lineHeight: 1.05, color: C.text1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", minHeight: 44 }}>{right}</div>}
    </div>
  );
}
