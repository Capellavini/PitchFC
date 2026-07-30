import { useState } from "react";
import { Shuffle, RotateCcw } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { splitWaitlist, ini, playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Matchday from "./Matchday";
import MatchTimer from "./MatchTimer";
import MatchSummary from "./MatchSummary";

/** One player in the lineup — same visual language as the Pitch Manager
 *  pitch (photo/initials circle, OVR badge, name below), just off the
 *  green background since this isn't a formation. */
function LineupCard({ p, group, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 68 }}>
      <div style={{
        width: 54, height: 54, borderRadius: 27, flexShrink: 0, position: "relative",
        background: p.photo ? C.surface : `${playerColor(group, p)}22`,
        border: `2.5px solid ${p.isMe ? C.accent : playerColor(group, p)}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 800, color: playerColor(group, p),
        boxShadow: p.isMe ? `0 0 0 3px ${C.accentDim}` : "none",
      }}>
        {p.photo ? <img src={p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 24 }} /> : ini(p.name)}
        <span style={{ position: "absolute", bottom: -6, left: -6, fontSize: 9, fontWeight: 800, color: C.bg, background: C.accent, borderRadius: 7, padding: "1px 5px", border: `1px solid ${C.card}` }}>
          {computeOverall(p.position, p.attrs)}
        </span>
      </div>
      <span style={{ fontSize: 11, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1, maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
    </div>
  );
}

/** Everything about the live day itself — team draw, timer, live
 *  scoring and the running summary — split out of "Jogo" (which keeps
 *  just confirmation + payments) so the two concerns don't compete for
 *  space. Reacts to matchdayProps.matchday: shows the draw/start screen
 *  before kickoff, the live view once "Começar dia de jogo" is pressed. */
export default function MatchdayTab({ group, game, teams, drawTeams, onClearTeams, renameTeam, movePlayer, canManageTeams, matchdayProps, lastMatchday }) {
  const [numTeams, setNumTeams] = useState(teams?.length || 2);
  const confirmed = group.filter((p) => p.status === "confirmed");
  const { playing } = splitWaitlist(confirmed, game.spots);
  const resolveTeam = (ids) => ids.map((id) => group.find((p) => p.id === id)).filter(Boolean);

  // Players (not organizer/assistant) see just their own lineup once the
  // draw is made — the full manage-every-team grid stays for whoever can
  // actually redraw/rename/move players. Falls back to the grid if this
  // player isn't in any team yet (e.g. sat out this round).
  const me = group.find((p) => p.isMe);
  const myTeam = teams?.find((tm) => tm.players.includes(me?.id));
  const showOwnLineup = !canManageTeams && teams && myTeam;

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Matchday</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{t("Sorteio, cronómetro e marcação ao vivo.")}</div>
      </div>

      {/* OWN LINEUP — players see just their team, Fantasy-card style */}
      {showOwnLineup ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: myTeam.color, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text2 }}>{t("A TUA EQUIPA")}</span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: myTeam.color }}>{myTeam.name}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
            {resolveTeam(myTeam.players).map((p) => <LineupCard key={p.id} p={p} group={group} />)}
          </div>
        </div>
      ) : (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Sorteio de Equipas")}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>
            {!canManageTeams ? t("Só o organizador (ou o auxiliar) pode sortear e renomear.") : playing.length < 2 ? t("Faltam confirmações para sortear") : t("Escolhe quantas equipas e sorteia — depois podes renomear.")}
          </div>
        </div>

        {/* number of teams — organizer/assistant only */}
        {canManageTeams && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.text2 }}>{t("Equipas:")}</span>
            {[2, 3, 4, 5, 6].map((n) => {
              const active = numTeams === n;
              const disabled = n > playing.length;
              return (
                <button key={n} onClick={() => !disabled && setNumTeams(n)} disabled={disabled}
                  style={{ width: 32, height: 32, borderRadius: 9, background: active ? C.accent : C.surface, color: active ? C.bg : disabled ? C.text3 : C.text1, border: `1px solid ${active ? C.accent : C.border}`, fontSize: 13, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }}>
                  {n}
                </button>
              );
            })}
            <button
              onClick={() => drawTeams(numTeams)}
              disabled={playing.length < 2}
              style={{
                marginLeft: "auto", background: playing.length >= 2 ? C.accent : C.accentDim,
                color: playing.length >= 2 ? C.bg : C.accent, border: `1px solid ${C.accentBorder}`,
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800,
                cursor: playing.length >= 2 ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Shuffle size={14} /> {teams ? t("Re-sortear") : t("Sortear")}
            </button>
          </div>
        )}

        {canManageTeams && teams && (
          <button onClick={onClearTeams}
            style={{ width: "100%", marginBottom: 12, background: "none", color: C.text2, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RotateCcw size={13} /> {t("Limpar sorteio")}
          </button>
        )}

        {teams && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {teams.map((tm) => (
              <div key={tm.id} style={{ background: C.surface, borderRadius: 12, padding: 12, minWidth: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: tm.color, flexShrink: 0 }} />
                  {canManageTeams ? (
                    <input
                      value={tm.name}
                      onChange={(e) => renameTeam(tm.id, e.target.value)}
                      style={{ flex: 1, minWidth: 0, background: "none", border: "none", borderBottom: `1px dashed ${C.border}`, color: tm.color, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", outline: "none", padding: "2px 0" }}
                    />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, color: tm.color, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {resolveTeam(tm.players).map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: tm.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: p.isMe ? 800 : 500, color: p.isMe ? C.accent : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
                      {canManageTeams && teams.length > 1 ? (
                        <select
                          value={tm.id}
                          onChange={(e) => movePlayer(p.id, e.target.value)}
                          title="Mover de equipa"
                          style={{ marginLeft: "auto", background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 9, padding: "1px 2px", outline: "none", maxWidth: 70 }}
                        >
                          {teams.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 9, color: C.text3, marginLeft: "auto" }}>{p.position.slice(0, 3).toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                  {tm.players.length === 0 && <span style={{ fontSize: 11, color: C.text3 }}>{t("sem jogadores")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* MATCH TIMER */}
      <MatchTimer />

      {/* LIVE MATCHDAY */}
      <Matchday {...matchdayProps} group={group} teams={teams} canManage={canManageTeams} />

      {/* MATCHDAY SUMMARY (current/last games) */}
      <MatchSummary matchday={matchdayProps.matchday} lastMatchday={lastMatchday} teams={teams} group={group} />
    </div>
  );
}
