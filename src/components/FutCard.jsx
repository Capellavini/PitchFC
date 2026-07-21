import { C, displayFont } from "../theme";
import { ini, computeOverall, POSITION_ABBR, ATTR_LABELS } from "../lib/helpers";
import { t, getLang } from "../lib/i18n";

// Tier tint fades into C.card so the cards sit on the navy palette.
// "icon" (>= 86) is the FIFA-legend look: champagne gold, light rays,
// glow and an ornate inner frame.
const TIERS = {
  icon:   { color: "#F2DA8A", bg: `linear-gradient(155deg, #4A3D1E 0%, #2C2715 45%, ${C.card} 92%)`, label: "LENDA",  rayAlpha: "0E", glowAlpha: "30" },
  gold:   { color: C.gold,   bg: `linear-gradient(155deg, #2D2818 0%, ${C.card} 75%)`,               label: "OURO",   rayAlpha: "07", glowAlpha: "1E" },
  silver: { color: C.silver, bg: `linear-gradient(155deg, #242C3A 0%, ${C.card} 75%)`,               label: "PRATA",  rayAlpha: "06", glowAlpha: "18" },
  bronze: { color: C.bronze, bg: `linear-gradient(155deg, #2C231B 0%, ${C.card} 75%)`,               label: "BRONZE", rayAlpha: "06", glowAlpha: "18" },
};

const tierFor = (overall) =>
  overall >= 86 ? TIERS.icon : overall >= 80 ? TIERS.gold : overall >= 70 ? TIERS.silver : TIERS.bronze;

/** FIFA/FUT-style player card. `player` needs attrs/position/club/nationality.
 *  `ratingsCount`, when passed, gates the numbers: below 3 real peer
 *  ratings the card stays visible but the overall/attributes show "?"/"–"
 *  instead of numbers (nothing to compute them from yet — no self-rating). */
export default function FutCard({ player, width = 260, ratingsCount }) {
  const locked = ratingsCount != null && ratingsCount < 3;
  const overall = locked ? 0 : computeOverall(player.position, player.attrs);
  const tier = locked ? TIERS.bronze : tierFor(overall);
  const isIcon = tier === TIERS.icon;
  const flag = (player.nationality || "🌍").split(" ")[0];
  const scale = width / 260;

  const overlay = { position: "absolute", inset: 0, borderRadius: 20 * scale, pointerEvents: "none" };

  return (
    <div style={{
      width, padding: 18 * scale, borderRadius: 20 * scale,
      background: tier.bg, border: `1.5px solid ${tier.color}${isIcon ? "88" : "55"}`,
      boxShadow: `0 0 ${(isIcon ? 60 : 40) * scale}px ${tier.color}${isIcon ? "30" : "18"}`,
      position: "relative", overflow: "hidden", flexShrink: 0,
    }}>
      {/* light rays */}
      <div style={{ ...overlay, background: `repeating-linear-gradient(115deg, transparent 0 ${14 * scale}px, ${tier.color}${tier.rayAlpha} ${14 * scale}px ${17 * scale}px)` }} />
      {/* glow behind the photo */}
      <div style={{ ...overlay, background: `radial-gradient(circle at 66% 26%, ${tier.color}${tier.glowAlpha}, transparent 58%)` }} />
      {/* shine sweep */}
      <div style={{ ...overlay, background: "linear-gradient(120deg, transparent 32%, rgba(255,255,255,0.07) 46%, transparent 58%)" }} />
      {/* ornate inner frame */}
      <div style={{ ...overlay, inset: 6 * scale, borderRadius: 15 * scale, border: `1px solid ${tier.color}${isIcon ? "55" : "2E"}` }} />
      {/* pitch-line watermark */}
      <svg viewBox="0 0 260 160" style={{ position: "absolute", inset: 0, width: "100%", opacity: 0.05 }}>
        <circle cx="130" cy="80" r="50" fill="none" stroke={tier.color} strokeWidth="1.5" />
        <line x1="130" y1="0" x2="130" y2="160" stroke={tier.color} strokeWidth="1.5" />
      </svg>

      <div style={{ display: "flex", gap: 12 * scale, position: "relative" }}>
        {/* Left column: overall + position + flag + club */}
        <div style={{ textAlign: "center", minWidth: 52 * scale }}>
          <div style={{ ...displayFont, fontSize: 40 * scale, color: tier.color, lineHeight: 1, textShadow: isIcon ? `0 0 ${14 * scale}px ${tier.color}66` : "none" }}>{locked ? "?" : overall}</div>
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
            <img src={player.photo} alt={player.nick} style={{
              width: 104 * scale, height: 104 * scale, borderRadius: 16 * scale, objectFit: "cover",
              border: `${isIcon ? 2 : 1.5}px solid ${tier.color}${isIcon ? "AA" : "66"}`,
              boxShadow: isIcon ? `0 0 ${18 * scale}px ${tier.color}44` : "none",
            }} />
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
          {player.club}{player.age ? ` · ${player.age} ${t("anos")}` : ""} · {getLang() === "en"
            ? `${t(player.foot || "—").toLowerCase()} foot`
            : `pé ${(player.foot || "—").toLowerCase()}`}
        </div>
      </div>

      <div style={{ height: 1, background: `${tier.color}33`, marginBottom: 10 * scale }} />

      {/* Attributes 3×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 * scale, position: "relative" }}>
        {Object.keys(ATTR_LABELS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5 * scale }}>
            <span style={{ ...displayFont, fontSize: 17 * scale, color: tier.color }}>{locked ? "–" : (player.attrs?.[k] ?? 60)}</span>
            <span style={{ fontSize: 9 * scale, fontWeight: 700, color: C.text2, letterSpacing: "0.05em" }}>{ATTR_LABELS[k]}</span>
          </div>
        ))}
      </div>

      {/* Locked caption — how many ratings still needed */}
      {locked && (
        <div style={{ textAlign: "center", marginTop: 8 * scale, position: "relative" }}>
          <span style={{ fontSize: 9 * scale, fontWeight: 700, color: C.text3 }}>
            {ratingsCount}/3 {t("avaliações")}
          </span>
        </div>
      )}

      {/* Legend ribbon */}
      {isIcon && (
        <div style={{ textAlign: "center", marginTop: 10 * scale, position: "relative" }}>
          <span style={{ fontSize: 9 * scale, fontWeight: 900, letterSpacing: "0.35em", color: tier.color }}>
            ★ {tier.label} ★
          </span>
        </div>
      )}
    </div>
  );
}
