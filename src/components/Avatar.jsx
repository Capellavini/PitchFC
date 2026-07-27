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
      position: "absolute", top: -badge * 0.28, right: -badge * 0.28, width: badge, height: badge, borderRadius: badge / 2,
      background: C.red, border: `${Math.max(1, badge * 0.12)}px solid ${C.bg}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
    }}>
      <Cross size={badge * 0.55} color="#fff" strokeWidth={2.5} />
    </span>
  );
}

export default function Avatar({ name, color, size = 36, fontSize = 12, isMe, photo, injured }) {
  const border = `1.5px solid ${isMe ? C.accent : color}`;
  if (photo) {
    return (
      <div style={{ position: "relative", flexShrink: 0, width: size, height: size }}>
        <img src={photo} alt={name} title={injured ? t("Lesionado") : undefined} style={{
          width: size, height: size, borderRadius: size * 0.3,
          objectFit: "cover", border, display: "block",
        }} />
        {injured && <InjuredBadge size={size} />}
      </div>
    );
  }
  return (
    <div title={injured ? t("Lesionado") : undefined} style={{
      position: "relative", width: size, height: size, borderRadius: size * 0.3,
      background: isMe ? C.accentDim : `${color}18`,
      border,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: isMe ? C.accent : color, flexShrink: 0,
    }}>
      {ini(name)}
      {injured && <InjuredBadge size={size} />}
    </div>
  );
}
