import { C, cardStyle } from "../theme";

/** "Action required" card — Home's next-action stack and the top of
 *  Matchday pre-match. One primary CTA (lime), an optional quiet
 *  secondary action. Lime left edge marks it as needing the player
 *  (brief §20: action required = lime edge/icon). */
export default function NextActionCard({ Icon, eyebrow, title, subtitle, primaryLabel, onPrimary, secondaryLabel, onSecondary, style }) {
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${C.accent}`, marginBottom: 12, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        {Icon && (
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={19} color={C.accent} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.accent, marginBottom: 4 }}>{eyebrow}</div>}
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onPrimary}
          style={{ flex: 1, minHeight: 44, background: C.accent, color: C.bg, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {primaryLabel}
        </button>
        {secondaryLabel && (
          <button onClick={onSecondary}
            style={{ minHeight: 44, padding: "0 16px", background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
