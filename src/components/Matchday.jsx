import { useState } from "react";
import { Play, Plus, Flag, Shield } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import BtnPrimary from "./BtnPrimary";

const TEAM_LABEL = { a: "COLETES", b: "S/ COLETES" };
const TEAM_COLOR = { a: C.accent, b: C.blue };

/** Live matchday: score the night's games (Jogo 1, Jogo 2…) with
 *  per-goal scorer + assist. Ending the matchday feeds season stats,
 *  history and opens MVP voting. */
export default function Matchday({ matchday, teams, group, onStart, onAddMatch, onGoal, onEnd }) {
  // pending goal flow: pick scorer → pick assist
  const [pending, setPending] = useState(null); // { matchId, team, scorerId? }

  const byId = (id) => group.find((p) => p.id === id);
  const teamPlayers = (team) => (teams?.[team] ?? []).map(byId).filter(Boolean);

  // ── Not started yet ────────────────────────────────────
  if (!matchday) {
    return (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Dia de jogo</div>
            <div style={{ fontSize: 11, color: C.text2 }}>
              {teams ? "Equipas sorteadas — começa a marcar os jogos" : "Faz o sorteio de equipas para começar"}
            </div>
          </div>
          <button
            onClick={onStart}
            disabled={!teams}
            style={{
              background: teams ? C.red : C.surface, color: teams ? C.text1 : C.text3,
              border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800,
              cursor: teams ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Play size={14} /> Começar
          </button>
        </div>
      </div>
    );
  }

  const goalsOf = (m, team) => m.events.filter((e) => e.team === team).length;

  const pickScorer = (matchId, team) => setPending({ matchId, team });

  const confirmGoal = (assistId) => {
    onGoal(pending.matchId, { team: pending.team, scorerId: pending.scorerId, assistId });
    setPending(null);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.red}55` }}>
      {/* live header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.red, animation: "pulse 1.2s infinite" }} />
        <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: C.red }}>DIA DE JOGO · AO VIVO</span>
      </div>

      {/* matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {matchday.matches.map((m) => {
          const isPending = pending?.matchId === m.id;
          return (
            <div key={m.id} style={{ background: C.surface, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: 8 }}>
                JOGO {m.n}
              </div>

              {/* score row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10 }}>
                <span style={{ flex: 1, textAlign: "right", fontSize: 11, fontWeight: 800, color: TEAM_COLOR.a }}>{TEAM_LABEL.a}</span>
                <span style={{ ...displayFont, fontSize: 30 }}>
                  {goalsOf(m, "a")} <span style={{ color: C.text3 }}>–</span> {goalsOf(m, "b")}
                </span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: TEAM_COLOR.b }}>{TEAM_LABEL.b}</span>
              </div>

              {/* events log */}
              {m.events.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {m.events.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text2, textAlign: e.team === "a" ? "left" : "right" }}>
                      ⚽ <strong style={{ color: C.text1 }}>{byId(e.scorerId)?.nick}</strong>
                      {e.assistId && <span> (assist. {byId(e.assistId)?.nick})</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* goal entry */}
              {isPending ? (
                <div style={{ background: C.card, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>
                    {pending.scorerId
                      ? "Assistência de…"
                      : <>Golo dos <strong style={{ color: TEAM_COLOR[pending.team] }}>{TEAM_LABEL[pending.team]}</strong> — quem marcou?</>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {teamPlayers(pending.team)
                      .filter((p) => p.id !== pending.scorerId)
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            pending.scorerId
                              ? confirmGoal(p.id)
                              : setPending({ ...pending, scorerId: p.id })
                          }
                          style={{ background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          {p.nick}
                        </button>
                      ))}
                    {pending.scorerId && (
                      <button onClick={() => confirmGoal(null)} style={{ background: "none", color: C.text2, border: `1px dashed ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                        Sem assistência
                      </button>
                    )}
                    <button onClick={() => setPending(null)} style={{ background: "none", color: C.text3, border: "none", fontSize: 12, cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {["a", "b"].map((t) => (
                    <button key={t} onClick={() => pickScorer(m.id, t)} style={{ flex: 1, background: `${TEAM_COLOR[t]}14`, color: TEAM_COLOR[t], border: `1px solid ${TEAM_COLOR[t]}44`, borderRadius: 10, padding: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      + Golo {TEAM_LABEL[t].toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onAddMatch} style={{ flex: 1, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> Novo jogo
        </button>
        <button onClick={onEnd} style={{ flex: 1, background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Flag size={15} /> Terminar dia
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10, color: C.text3 }}>
        <Shield size={11} /> Clean sheets de GR e Defesas contam ao terminar o dia.
      </div>
    </div>
  );
}
