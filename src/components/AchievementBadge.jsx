import { Lock } from "lucide-react";
import { C } from "../theme";

// Same four-tier language as the FUT card (bronze/silver/gold/legend),
// so an unlocked "Rei da Noite" badge reads with the same weight as an
// 86+ overall player card.
const TIER = {
  legend: { color: "#F2DA8A", glow: "#F2DA8A30" },
  gold:   { color: C.gold,   glow: `${C.gold}1E` },
  silver: { color: C.silver, glow: `${C.silver}18` },
  bronze: { color: C.bronze, glow: `${C.bronze}18` },
};

export default function AchievementBadge({ tier, icon: Icon, name, unlocked, selected, onClick, size = 58 }) {
  const s = TIER[tier] ?? TIER.bronze;
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      background: "none", border: "none", cursor: "pointer", padding: 0, width: size + 16,
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", position: "relative",
        background: unlocked ? `radial-gradient(circle at 50% 35%, ${s.glow}, ${C.card} 72%)` : C.card,
        border: `1.5px solid ${unlocked ? `${s.color}66` : C.border}`,
        boxShadow: unlocked ? `0 0 ${size * 0.3}px ${s.glow}${selected ? ", 0 0 0 2px " + s.color + "55" : ""}` : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: unlocked ? 1 : 0.5,
      }}>
        <Icon size={size * 0.42} color={unlocked ? s.color : C.text3} strokeWidth={2} />
        {!unlocked && (
          <div style={{
            position: "absolute", bottom: -2, right: -2, width: size * 0.34, height: size * 0.34, borderRadius: "50%",
            background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Lock size={size * 0.19} color={C.text3} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: unlocked ? C.text1 : C.text3, textAlign: "center", lineHeight: 1.2 }}>
        {name}
      </div>
    </button>
  );
}
