import { C, displayFont } from "../theme";

/**
 * TeamCrest — a team crest drawn in pure CSS (shield shape + initials).
 * Shared by PITCH products (Rivals mocks, Ligas). `color` must be a C token
 * (hex). Decorative: callers describe the team in text next to it.
 */
export default function TeamCrest({ initials, color, size = 56 }) {
  return (
    <div aria-hidden style={{
      width: size, height: size * 1.14, flexShrink: 0,
      clipPath: "polygon(50% 0, 100% 12%, 100% 58%, 50% 100%, 0 58%, 0 12%)",
      background: `linear-gradient(160deg, ${color} 0%, ${color}B3 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      paddingBottom: size * 0.12, boxSizing: "border-box",
    }}>
      <span style={{ ...displayFont, fontSize: size * 0.36, color: C.bg, lineHeight: 1 }}>{initials}</span>
    </div>
  );
}
