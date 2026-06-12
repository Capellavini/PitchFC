import { C, displayFont } from "../theme";
import { ini, computeOverall, POSITION_ABBR, ATTR_LABELS } from "../lib/helpers";

const TIERS = {
  gold:   { color: C.gold,   bg: "linear-gradient(160deg, #2B2410 0%, #18181E 70%)",   label: "OURO"   },
  silver: { color: C.silver, bg: "linear-gradient(160deg, #23262B 0%, #18181E 70%)",   label: "PRATA"  },
  bronze: { color: C.bronze, bg: "linear-gradient(160deg, #2A1E14 0%, #18181E 70%)",   label: "BRONZE" },
};

/** FIFA/FUT-style player card. `player` needs attrs/position/club/nationality. */
export default function FutCard({ player, width = 260 }) {
  const overall = computeOverall(player.position, player.attrs);
  const tier = TIERS[overall >= 80 ? "gold" : overall >= 70 ? "silver" : "bronze"];
  const flag = (player.nationality || "🌍").split(" ")[0];
  const scale = width / 260;

  return (
    <div style={{
      width, padding: 18 * scale, borderRadius: 20 * scale,
      background: tier.bg, border: `1.5px solid ${tier.color}55`,
      boxShadow: `0 0 ${40 * scale}px ${tier.color}18`,
      position: "relative", overflow: "hidden", flexShrink: 0,
    }}>
      {/* pitch-line watermark */}
      <svg viewBox="0 0 260 160" style={{ position: "absolute", inset: 0, width: "100%", opacity: 0.05 }}>
        <circle cx="130" cy="80" r="50" fill="none" stroke={tier.color} strokeWidth="1.5" />
        <line x1="130" y1="0" x2="130" y2="160" stroke={tier.color} strokeWidth="1.5" />
      </svg>

      <div style={{ display: "flex", gap: 12 * scale, position: "relative" }}>
        {/* Left column: overall + position + flag + club */}
        <div style={{ textAlign: "center", minWidth: 52 * scale }}>
          <div style={{ ...displayFont, fontSize: 40 * scale, color: tier.color, lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: 13 * scale, fontWeight: 800, color: C.text1, letterSpacing: "0.06em" }}>
            {POSITION_ABBR[player.position] ?? "MED"}
          </div>
          <div style={{ height: 1, background: `${tier.color}44`, margin: `${7 * scale}px 4px` }} />
          <div style={{ fontSize: 20 * scale, lineHeight: 1.3 }}>{flag}</div>
          <div style={{
            margin: `${6 * scale}px auto 0`, width: 26 * scale, height: 26 * scale, borderRadius: 8 * scale,
            background: `${tier.color}1A`, border: `1px solid ${tier.color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10 * scale, fontWeight: 900, color: tier.color,
          }}>
            {ini(player.club || "FC")}
          </div>
        </div>

        {/* Photo / initials */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {player.photo ? (
            <img src={player.photo} alt={player.nick} style={{ width: 104 * scale, height: 104 * scale, borderRadius: 16 * scale, objectFit: "cover", border: `1.5px solid ${tier.color}66` }} />
          ) : (
            <div style={{ width: 104 * scale, height: 104 * scale, borderRadius: 16 * scale, background: `${tier.color}12`, border: `1.5px solid ${tier.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 * scale, fontWeight: 900, color: tier.color }}>
              {ini(player.name)}
            </div>
          )}
        </div>
      </div>

      {/* Name bar */}
      <div style={{ textAlign: "center", margin: `${12 * scale}px 0 ${10 * scale}px`, position: "relative" }}>
        <div style={{ ...displayFont, fontSize: 19 * scale, color: C.text1, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {player.nick}
        </div>
        <div style={{ fontSize: 10 * scale, color: C.text2 }}>
          {player.club}{player.age ? ` · ${player.age} anos` : ""} · pé {(player.foot || "—").toLowerCase()}
        </div>
      </div>

      <div style={{ height: 1, background: `${tier.color}33`, marginBottom: 10 * scale }} />

      {/* Attributes 3×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 * scale, position: "relative" }}>
        {Object.keys(ATTR_LABELS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 * scale }}>
            <span style={{ ...displayFont, fontSize: 17 * scale, color: tier.color }}>{player.attrs?.[k] ?? 60}</span>
            <span style={{ fontSize: 9 * scale, fontWeight: 700, color: C.text2, letterSpacing: "0.05em" }}>{ATTR_LABELS[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
