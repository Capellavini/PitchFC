import { C } from "../theme";

/**
 * Illustrative phone frame for the landing hero. The screen inside is
 * drawn from design tokens (never a raster screenshot), so it can't drift
 * from the real UI's palette. `width` is the outer frame width.
 */
export default function LandingPhone({ width = 232, tilt = 0, style, children }) {
  return (
    <div aria-hidden style={{
      width, flex: "none", borderRadius: 32, border: `6px solid ${C.border}`, background: C.bg,
      overflow: "hidden", boxShadow: `0 28px 60px ${C.bg}CC`, transform: `rotate(${tilt}deg)`,
      ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
        <div style={{ width: 64, height: 6, borderRadius: 3, background: C.border }} />
      </div>
      <div style={{ padding: "6px 12px 16px" }}>{children}</div>
    </div>
  );
}
