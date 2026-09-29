import { Cross } from "lucide-react";
import { C } from "../theme";
import { ini } from "../lib/helpers";
import { t } from "../lib/i18n";

/** Self-reported injury badge — shown on top of any Avatar wherever a
 *  player appears (Grupo, Jogo, Manager, Stats…), not just their own
 *  profile. Scales with the avatar so it stays legible at small sizes. */
function InjuredBadge({ size }) {
  const badge = Math.max(12, size * 0.42);
  return (
    <span style={{
      position: "absolute", top: -badge * 0.22, right: -badge * 0.22, width: badge, height: badge, borderRadius: badge / 2,
      background: C.red, border: `${Math.max(1, badge * 0.12)}px solid ${C.bg}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
    }}>
      <Cross size={badge * 0.55} color="#fff" strokeWidth={2.5} />
    </span>
  );
}

/**
 * Avatar — circular player avatar (spec §3: most players have NO photo,
 * so the initials version must look good on its own).
 *
 * Props:
 *  - name      full name → up to 2 initials.
 *  - color     per-player hex colour (AVATAR_PALETTE / playerColor) —
 *              drives the tinted fill, ring and initials. Must be a hex
 *              string (an alpha suffix is appended).
 *  - size      px diameter (default 36).
 *  - fontSize  initials size; defaults to ~40% of `size`.
 *  - isMe      lime ring (the viewer themselves).
 *  - photo     image URL — replaces the initials.
 *  - injured   red cross badge top-right.
 */
export default function Avatar({ name, color = C.blue, size = 36, fontSize, isMe, photo, injured }) {
  const ringW = size >= 56 ? 2 : 1.5;
  const border = `${ringW}px solid ${isMe ? C.accent : `${color}AA`}`;
  const round = { width: size, height: size, borderRadius: "50%", boxSizing: "border-box" };
  if (photo) {
    return (
      <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
        <img src={photo} alt={name} title={injured ? t("Lesionado") : undefined} style={{
          ...round, objectFit: "cover", border, display: "block",
        }} />
        {injured && <InjuredBadge size={size} />}
      </div>
    );
  }
  return (
    <div title={injured ? t("Lesionado") : undefined} aria-label={name} style={{
      ...round, position: "relative", flexShrink: 0,
      background: `${color}2E`,
      border,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: fontSize ?? Math.max(9, Math.round(size * 0.4)),
      fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1,
      color,
    }}>
      {ini(name || "?")}
      {injured && <InjuredBadge size={size} />}
    </div>
  );
}
