import { C, S, TOUCH, BRAND } from "../theme";

/**
 * TopBar — app header shown above every main tab: PITCH logo left,
 * icon actions / avatar right (spec §2 Home: bell + avatar, NO group
 * selector here). Owns its own 16px side padding; 56px tall.
 *
 * Props:
 *  - actions      [{ Icon, label, onClick, badge? }] → 44×44 icon
 *                 buttons (lucide Icon, t()-wrapped `label` used as
 *                 aria-label; `badge` = red dot, or a number ≤ 99).
 *  - right        any extra node after the actions (e.g. an <Avatar>
 *                 wrapped in a 44px button that opens Perfil).
 *  - onLogoClick  optional (e.g. go Home).
 *  - style        overrides.
 */
export default function TopBar({ actions = [], right, onLogoClick, style }) {
  const logo = <img src={BRAND.logo} alt="PITCH" style={{ height: 24, display: "block" }} />;
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, minHeight: 56, padding: `${S.xs}px ${S.lg}px 0`, boxSizing: "border-box", ...style }}>
      {onLogoClick ? (
        <button type="button" onClick={onLogoClick} aria-label="PITCH" style={{ background: "none", border: "none", padding: 0, minHeight: TOUCH.min, display: "flex", alignItems: "center", cursor: "pointer" }}>{logo}</button>
      ) : logo}
      <div style={{ display: "flex", alignItems: "center", gap: S.xs }}>
        {actions.map(({ Icon, label, onClick, badge }, i) => (
          <button key={label ?? i} type="button" onClick={onClick} aria-label={label} title={label} style={{
            position: "relative", width: TOUCH.min, height: TOUCH.min, borderRadius: "50%",
            background: "none", border: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: C.text1,
          }}>
            <Icon size={22} strokeWidth={1.9} />
            {Boolean(badge) && (
              typeof badge === "number" ? (
                <span style={{ position: "absolute", top: 6, right: 4, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, boxSizing: "border-box", background: C.red, color: C.text1, border: `2px solid ${C.bg}`, fontSize: 9, fontWeight: 800, lineHeight: "12px", textAlign: "center" }}>
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : (
                <span style={{ position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: "50%", background: C.red, border: `2px solid ${C.bg}` }} />
              )
            )}
          </button>
        ))}
        {right}
      </div>
    </header>
  );
}
