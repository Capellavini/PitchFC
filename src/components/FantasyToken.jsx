import { Crown } from "lucide-react";
import { C, R, S, T } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";

/**
 * FantasyToken — one player on the Pitch Manager pitch (or the bench
 * strip below it): 2-initial Avatar (or photo), OVR chip under it, gold
 * crown badge for the captain, silver "V" for the vice-captain, nick, and
 * the last round's points chip. When `onClick` is set the whole token is
 * ONE ≥44px button that opens FantasyPlayerSheet — no tiny icon buttons.
 *
 * Props:
 *  - p, group         the player + roster (for the avatar colour).
 *  - captain          gold ring + crown badge.
 *  - vice             silver "V" badge (inherits ×2 if the captain doesn't play).
 *  - order            bench position (1 = first sub), number badge.
 *  - pts              round points (number) | null — hidden when null.
 *  - highlight        a good round → green points.
 *  - bench            dimmed.
 *  - onPitch          white nick with shadow (on the green pitch).
 *  - onClick          tap handler (omit for read-only).
 *  - connRole         "creator" | "finisher" — part of the round's Conexão:
 *                     a labelled pill (never only colour/arrow) + aria.
 */
export default function FantasyToken({ p, group, captain = false, vice = false, order = null, pts = null, highlight = false, bench = false, onPitch = true, onClick = null, connRole = null }) {
  const Tag = onClick ? "button" : "div";
  const ovr = computeOverall(p.position, p.attrs);
  const connLabel = connRole === "creator" ? t("Assistência") : connRole === "finisher" ? t("Golo") : null;
  const role = (captain ? ` · ${t("Capitão")}` : vice ? ` · ${t("Vice-capitão")}` : "") + (connLabel ? ` · ${t("Conexão")}: ${connLabel}` : "");
  const badge = { position: "absolute", top: -9, width: 24, height: 24, borderRadius: "50%", border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" };
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick || undefined} data-pid={p.uuid}
      aria-label={onClick ? `${order ? `${order}. ` : ""}${p.nick}${role}` : undefined}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, width: 76, minHeight: 44,
        background: "none", border: "none", padding: `${S.xs}px 0`, color: "inherit", font: "inherit",
        cursor: onClick ? "pointer" : "default", opacity: bench ? 0.85 : 1,
      }}>
      <div style={{ position: "relative", borderRadius: "50%", background: C.card, boxShadow: captain ? `0 0 0 3px ${C.gold}` : vice ? `0 0 0 2px ${C.silver}` : "0 2px 6px rgba(0,0,0,0.35)" }}>
        <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={false} injured={p.injured} size={52} />
        {captain && (
          <span aria-hidden style={{ ...badge, right: -9, background: C.gold }}>
            <Crown size={13} color={C.bg} fill={C.bg} />
          </span>
        )}
        {vice && !captain && (
          <span aria-hidden style={{ ...badge, right: -9, background: C.silver, color: C.bg, fontSize: T.min, fontWeight: 900 }}>V</span>
        )}
        {order != null && (
          <span aria-hidden style={{ ...badge, left: -9, background: C.surface, border: `1px solid ${C.border}`, color: C.text1, fontSize: T.min, fontWeight: 900 }}>{order}</span>
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
      {connLabel && (
        <span style={{ fontSize: T.min, fontWeight: 900, borderRadius: R.pill, padding: `1px ${S.sm}px`, background: C.accent, color: C.bg, letterSpacing: "0.04em", textTransform: "uppercase" }}>{connLabel}</span>
      )}
      {pts !== null && (
        <span style={{
          fontSize: T.min, fontWeight: 900, borderRadius: R.pill, padding: `1px ${S.sm}px`, fontVariantNumeric: "tabular-nums",
          background: C.bg, color: highlight ? C.green : pts < 0 ? C.red : C.text1,
        }}>
          {`${pts > 0 ? "+" : ""}${Math.round(pts)}`}
        </span>
      )}
    </Tag>
  );
}
