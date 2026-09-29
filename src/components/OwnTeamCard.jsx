import { ChevronRight } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall, teamOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";

/** One teammate — Fantasy-style mini card: avatar (photo or initials),
 *  OVR badge, nick, position. The viewer gets the lime ring (isMe). */
function MiniPlayer({ p, group }) {
  const ovr = computeOverall(p.position, p.attrs);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} injured={p.injured} size={52} />
        <span title="OVR" style={{
          position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
          minWidth: 26, height: 18, padding: `0 ${S.xs + 1}px`, boxSizing: "border-box", borderRadius: R.pill,
          background: C.surface, border: `1px solid ${C.border}`, color: C.text1,
          fontSize: T.min, fontWeight: 900, lineHeight: "16px", textAlign: "center", fontVariantNumeric: "tabular-nums",
        }}>{ovr}</span>
      </div>
      <span style={{ marginTop: S.xs, fontSize: T.meta, fontWeight: p.isMe ? 900 : 700, color: C.text1, maxWidth: "100%", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.isMe ? t("Tu") : p.nick}
      </span>
      <span style={{ fontSize: T.min, color: C.text2, marginTop: -2 }}>{p.position === "Guarda-redes" ? t("GR") : t(p.position)}</span>
    </div>
  );
}

/**
 * OwnTeamCard — "A TUA EQUIPA": the hero at the top of Matchday once the
 * teams are confirmed and the viewer is on one, so "com quem jogo hoje"
 * is the first thing they see (it was in production before the redesign).
 * Read-only; same data for players, organizers and cloud mode (the
 * confirmed `teams` from games.teams).
 *
 * The team colour is data, not a CTA: it's the left edge + dot; the name
 * stays C.text1 so a lime/white team name keeps contrast in light mode.
 *
 * Props:
 *  - team            { id, name, color, players:[id] } — the viewer's team.
 *  - group           roster (resolve ids → players).
 *  - confirmedByName who confirmed the teams (meta line).
 *  - compact         one-line strip (name, OVR, overlapping avatars) for
 *                    the live scoring view, so the score stays above the fold.
 *  - onOpen          compact only: tap to jump to the full lineup.
 */
export default function OwnTeamCard({ team, group, confirmedByName, compact = false, onOpen = null }) {
  const players = team.players.map((id) => group.find((p) => p.id === id)).filter(Boolean);
  const ovr = teamOverall(team, group);

  if (compact) {
    const Tag = onOpen ? "button" : "div";
    return (
      <Tag type={onOpen ? "button" : undefined} onClick={onOpen || undefined} aria-label={onOpen ? `${t("A tua equipa")}: ${team.name}` : undefined}
        style={{
          ...cardStyle, width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: S.md,
          minHeight: 56, padding: `${S.sm}px ${S.lg}px`, marginBottom: S.lg, borderLeft: `3px solid ${team.color}`,
          textAlign: "left", color: "inherit", font: "inherit", cursor: onOpen ? "pointer" : "default",
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2 }}>{t("A tua equipa")}</div>
          <div style={{ fontSize: T.body + 1, fontWeight: 900, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {team.name}{ovr != null && <span style={{ fontSize: T.meta, fontWeight: 800, color: C.text2 }}> · OVR {ovr}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexShrink: 0 }}>
          {players.slice(0, 5).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i ? S.xxs : 0, borderRadius: "50%" }}>
              <Avatar name={p.name} color={playerColor(group, p)} photo={p.photo} isMe={p.isMe} size={28} />
            </div>
          ))}
          {players.length > 5 && (
            <span style={{ marginLeft: S.xs, alignSelf: "center", fontSize: T.meta, fontWeight: 800, color: C.text2 }}>+{players.length - 5}</span>
          )}
        </div>
        {onOpen && <ChevronRight size={18} color={C.text2} style={{ flexShrink: 0, marginLeft: -S.xs }} />}
      </Tag>
    );
  }

  return (
    <section aria-label={t("A tua equipa")} style={{ ...cardStyle, marginBottom: S.xl, borderLeft: `3px solid ${team.color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: S.md, marginBottom: S.lg }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.xs }}>
            {t("A tua equipa")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, minWidth: 0 }}>
            <span aria-hidden style={{ width: 14, height: 14, borderRadius: "50%", background: team.color, flexShrink: 0, border: `1px solid ${C.border}` }} />
            <span style={{ fontSize: T.h + 2, fontWeight: 900, color: C.text1, lineHeight: 1.15, overflowWrap: "anywhere" }}>{team.name}</span>
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>
            {players.length} {t(players.length === 1 ? "jogador" : "jogadores")}
          </div>
        </div>
        {ovr != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ ...displayFont, fontSize: 34, lineHeight: 1, color: C.text1, fontVariantNumeric: "tabular-nums" }}>{ovr}</div>
            <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", color: C.text2, marginTop: S.xs }}>OVR</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: S.md, rowGap: S.lg }}>
        {players.map((p) => <MiniPlayer key={p.id} p={p} group={group} />)}
      </div>

      {confirmedByName && (
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.lg, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
          {t("Confirmado por")} {confirmedByName}
        </div>
      )}
    </section>
  );
}
