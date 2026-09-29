import { Crown } from "lucide-react";
import { C, R, S, T } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";

/**
 * FantasyToken — one player on the Pitch Manager pitch (or the bench
 * strip below it): 2-initial Avatar (or photo), OVR chip under it, gold
 * crown badge for the captain, nick, and the last round's points chip.
 * When `onClick` is set the whole token is ONE ≥44px button that opens
 * FantasyPlayerSheet (captain / bench) — no tiny icon buttons per player.
 *
 * Props:
 *  - p, group         the player + roster (for the avatar colour).
 *  - captain          gold ring + crown badge.
 *  - pts              round points (number) | null — hidden when null.
 *  - highlight        points came from a goal/assist → green points (a good round).
 *  - bench            dimmed, "não pontua" instead of points.
 *  - onPitch          white nick with shadow (on the green pitch).
 *  - onClick          tap handler (omit for read-only).
 */
export default function FantasyToken({ p, group, captain = false, pts = null, highlight = false, bench = false, onPitch = true, onClick = null }) {
  const Tag = onClick ? "button" : "div";
  const ovr = computeOverall(p.position, p.attrs);
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick || undefined}
      aria-label={onClick ? `${p.nick}${captain ? ` · ${t("Capitão")}` : ""}` : undefined}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, width: 76, minHeight: 44,
        background: "none", border: "none", padding: `${S.xs}px 0`, color: "inherit", font: "inherit",
        cursor: onClick ? "pointer" : "default", opacity: bench ? 0.8 : 1,
      }}>
      <div style={{ position: "relative", borderRadius: "50%", background: C.card, boxShadow: captain ? `0 0 0 3px ${C.gold}` : "0 2px 6px rgba(0,0,0,0.35)" }}>
        <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={false} injured={p.injured} size={52} />
        {captain && (
          <span aria-hidden style={{ position: "absolute", top: -9, right: -9, width: 24, height: 24, borderRadius: "50%", background: C.gold, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Crown size={13} color={C.bg} fill={C.bg} />
          </span>
        )}
        <span title="OVR" style={{
          position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
          minWidth: 26, height: 18, padding: `0 ${S.xs + 1}px`, boxSizing: "border-box", borderRadius: R.pill,
          background: C.surface, border: `1px solid ${C.border}`, color: C.text1,
          fontSize: T.min, fontWeight: 900, lineHeight: "16px", textAlign: "center", fontVariantNumeric: "tabular-nums",
        }}>{ovr}</span>
      </div>
      <span style={{
        marginTop: S.xs + 2, fontSize: T.meta, fontWeight: 800, maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: onPitch ? C.onPitch : C.text1, textShadow: onPitch ? "0 1px 3px rgba(0,0,0,0.9)" : "none",
      }}>{p.nick}</span>
      {bench ? (
        pts !== null && <span style={{ fontSize: T.min, fontWeight: 700, color: C.text2 }}>{t("não pontua")}</span>
      ) : pts !== null && (
        <span style={{
          fontSize: T.min, fontWeight: 900, borderRadius: R.pill, padding: `1px ${S.sm}px`, fontVariantNumeric: "tabular-nums",
          background: C.bg, color: highlight ? C.green : C.text1,
        }}>
          {`${pts > 0 ? "+" : ""}${Math.round(pts)}`}
        </span>
      )}
    </Tag>
  );
}
