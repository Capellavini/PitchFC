import { useState } from "react";
import { Shuffle, RotateCcw } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { splitWaitlist } from "../lib/helpers";
import { t } from "../lib/i18n";
import Matchday from "./Matchday";
import MatchTimer from "./MatchTimer";
import MatchSummary from "./MatchSummary";

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

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Matchday</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{t("Sorteio, cronómetro e marcação ao vivo.")}</div>
      </div>

      {/* TEAM DRAW */}
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

      {/* MATCH TIMER */}
      <MatchTimer />

      {/* LIVE MATCHDAY */}
      <Matchday {...matchdayProps} group={group} teams={teams} canManage={canManageTeams} />

      {/* MATCHDAY SUMMARY (current/last games) */}
      <MatchSummary matchday={matchdayProps.matchday} lastMatchday={lastMatchday} teams={teams} group={group} />
    </div>
  );
}
