import { useState, Fragment } from "react";
import { Play, Plus, Flag, Shield, Swords, Trophy, X } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";

const MODES = [
  { id: "avulsa",     Icon: Swords, label: "Avulsa",     hint: "Marca golos e assistências, sem tabela." },
  { id: "campeonato", Icon: Trophy, label: "Campeonato", hint: "Pontos, saldo de golos e classificação." },
];

/** Live matchday with 2–6 named teams. Each game (Jogo) is played
 *  between two chosen teams; you pick the scorer + assist per goal.
 *  'campeonato' adds a points/goal-difference standings table.
 *  Ending the matchday feeds season stats, history and MVP voting. */
export default function Matchday({ matchday, teams, group, onStart, onAddMatch, onGoal, onSetGoalkeeper, onEnd }) {
  const [pending, setPending] = useState(null);   // { matchId, teamId, scorerId? }
  const [mode, setMode] = useState("avulsa");
  const [composing, setComposing] = useState(null); // { homeId, awayId } when picking a new game

  const list = Array.isArray(teams) ? teams : [];
  const byId = (id) => group.find((p) => p.id === id);
  const teamById = (id) => list.find((t) => t.id === id);
  const teamPlayers = (teamId) => (teamById(teamId)?.players ?? []).map(byId).filter(Boolean);
  const teamName = (id) => teamById(id)?.name ?? "—";
  const teamColor = (id) => teamById(id)?.color ?? C.text2;

  // ── Not started yet ────────────────────────────────────
  if (!matchday) {
    return (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t("Dia de jogo")}</div>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
          {list.length >= 2 ? t("Escolhe o formato e começa a marcar os jogos.") : t("Sorteia as equipas para começar.")}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {MODES.map(({ id, Icon, label }) => {
            const active = mode === id;
            return (
              <button key={id} onClick={() => setMode(id)} style={{ flex: 1, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 8px", fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon size={14} /> {t(label)}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: 14 }}>{t(MODES.find((m) => m.id === mode).hint)}</div>

        <button
          onClick={() => onStart(mode)}
          disabled={list.length < 2}
          style={{ width: "100%", background: list.length >= 2 ? C.red : C.surface, color: list.length >= 2 ? C.text1 : C.text3, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: list.length >= 2 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Play size={15} /> {t("Começar dia de jogo")}
        </button>
      </div>
    );
  }

  const isCampeonato = matchday.mode === "campeonato";
  const goalsOf = (m, teamId) => m.events.filter((e) => e.teamId === teamId).length;

  const standings = () => {
    const tally = {};
    list.forEach((t) => { tally[t.id] = { ...t, w: 0, d: 0, l: 0, gf: 0, ga: 0 }; });
    matchday.matches.forEach((m) => {
      const H = tally[m.homeId], A = tally[m.awayId];
      if (!H || !A) return;
      const hg = goalsOf(m, m.homeId), ag = goalsOf(m, m.awayId);
      H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
      if (hg > ag) { H.w++; A.l++; } else if (ag > hg) { A.w++; H.l++; } else { H.d++; A.d++; }
    });
    return Object.values(tally)
      .map((t) => ({ ...t, j: t.w + t.d + t.l, gd: t.gf - t.ga, pts: t.w * 3 + t.d }))
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
  };

  const confirmGoal = (assistId) => {
    onGoal(pending.matchId, { teamId: pending.teamId, scorerId: pending.scorerId, assistId });
    setPending(null);
  };

  const startCompose = () => {
    if (list.length === 2) { onAddMatch(list[0].id, list[1].id); return; }
    setComposing({ homeId: list[0].id, awayId: list[1].id });
  };
  const confirmCompose = () => {
    if (composing.homeId === composing.awayId) return;
    onAddMatch(composing.homeId, composing.awayId);
    setComposing(null);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.red}55` }}>
      {/* live header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.red, animation: "pulse 1.2s infinite" }} />
        <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: C.red }}>{t("DIA DE JOGO · AO VIVO")}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 800, color: isCampeonato ? C.gold : C.text2, background: isCampeonato ? C.goldDim : C.surface, border: `1px solid ${isCampeonato ? `${C.gold}44` : C.border}`, borderRadius: 20, padding: "3px 9px" }}>
          {isCampeonato ? <Trophy size={11} /> : <Swords size={11} />}
          {isCampeonato ? t("CAMPEONATO") : t("AVULSA")}
        </span>
      </div>

      {/* classificação (campeonato) */}
      {isCampeonato && (
        <div style={{ background: C.surface, borderRadius: 14, padding: "12px 12px 6px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.gold, marginBottom: 10 }}>{t("CLASSIFICAÇÃO")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 44px 32px 28px", gap: 4, fontSize: 9, fontWeight: 700, color: C.text3, marginBottom: 6, textAlign: "center" }}>
            <span style={{ textAlign: "left" }}>{t("EQUIPA")}</span><span>{t("J")}</span><span>{t("V-E-D")}</span><span>{t("SG")}</span><span>{t("P")}</span>
          </div>
          {standings().map((r, i) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 24px 44px 32px 28px", gap: 4, alignItems: "center", fontSize: 12, padding: "6px 0", borderTop: i ? `1px solid ${C.border}` : "none", textAlign: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, textAlign: "left", overflow: "hidden" }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: r.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              </span>
              <span style={{ color: C.text2 }}>{r.j}</span>
              <span style={{ color: C.text2, fontSize: 10 }}>{r.w}-{r.d}-{r.l}</span>
              <span style={{ color: r.gd > 0 ? C.green : r.gd < 0 ? C.red : C.text2 }}>{r.gd > 0 ? "+" : ""}{r.gd}</span>
              <span style={{ ...displayFont, color: C.text1 }}>{r.pts}</span>
            </div>
          ))}
        </div>
      )}

      {/* matches */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
        {matchday.matches.map((m) => {
          const isPending = pending?.matchId === m.id;
          const sides = [m.homeId, m.awayId];
          return (
            <div key={m.id} style={{ background: C.surface, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: 8 }}>{t("JOGO")} {m.n}</div>

              {/* goalkeeper picker — rotates match to match, so it's
                  never assumed from the fixed position field */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Shield size={12} color={C.text3} style={{ flexShrink: 0 }} />
                {[["homeGkId", m.homeId], ["awayGkId", m.awayId]].map(([side, teamId]) => (
                  <select key={side} value={m[side] ?? ""}
                    onChange={(e) => onSetGoalkeeper(m.id, side, e.target.value ? Number(e.target.value) : null)}
                    style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 6px", fontSize: 11, color: m[side] ? C.text1 : C.text3, outline: "none" }}>
                    <option value="">{t("GR?")}</option>
                    {teamPlayers(teamId).map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
                  </select>
                ))}
              </div>

              {/* score row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ flex: 1, textAlign: "right", fontSize: 11, fontWeight: 800, color: teamColor(m.homeId), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamName(m.homeId)}</span>
                <span style={{ ...displayFont, fontSize: 28, whiteSpace: "nowrap" }}>
                  {goalsOf(m, m.homeId)} <span style={{ color: C.text3 }}>–</span> {goalsOf(m, m.awayId)}
                </span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: teamColor(m.awayId), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamName(m.awayId)}</span>
              </div>

              {/* events log */}
              {m.events.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {m.events.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, color: C.text2, textAlign: e.teamId === m.homeId ? "left" : "right" }}>
                      ⚽ <strong style={{ color: C.text1 }}>{byId(e.scorerId)?.nick}</strong>
                      {e.assistId && <span> ({"assist."} {byId(e.assistId)?.nick})</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* goal entry */}
              {isPending ? (
                <div style={{ background: C.card, borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 11, color: C.text2, marginBottom: 8 }}>
                    {pending.scorerId
                      ? t("Assistência de…")
                      : <>{t("Golo dos")} <strong style={{ color: teamColor(pending.teamId) }}>{teamName(pending.teamId)}</strong> {t("— quem marcou?")}</>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {teamPlayers(pending.teamId)
                      .filter((p) => p.id !== pending.scorerId)
                      .map((p) => (
                        <button key={p.id}
                          onClick={() => pending.scorerId ? confirmGoal(p.id) : setPending({ ...pending, scorerId: p.id })}
                          style={{ background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {p.nick}
                        </button>
                      ))}
                    {pending.scorerId && (
                      <button onClick={() => confirmGoal(null)} style={{ background: "none", color: C.text2, border: `1px dashed ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                        {t("Sem assistência")}
                      </button>
                    )}
                    <button onClick={() => setPending(null)} style={{ background: "none", color: C.text3, border: "none", fontSize: 12, cursor: "pointer" }}>{t("Cancelar")}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  {sides.map((tid) => (
                    <button key={tid} onClick={() => setPending({ matchId: m.id, teamId: tid })} style={{ flex: 1, background: `${teamColor(tid)}14`, color: teamColor(tid), border: `1px solid ${teamColor(tid)}44`, borderRadius: 10, padding: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      + {t("Golo")} {teamName(tid)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* new-game team picker (3+ teams) */}
      {composing && (
        <div style={{ background: C.surface, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t("Quem joga agora?")}</span>
            <button onClick={() => setComposing(null)} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}><X size={15} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {["homeId", "awayId"].map((side, idx) => (
              <Fragment key={side}>
                {idx === 1 && <span style={{ fontSize: 11, color: C.text3 }}>vs</span>}
                <select value={composing[side]} onChange={(e) => setComposing((c) => ({ ...c, [side]: e.target.value }))}
                  style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
                  {list.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Fragment>
            ))}
          </div>
          {composing.homeId === composing.awayId && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{t("Escolhe duas equipas diferentes.")}</div>}
          <button onClick={confirmCompose} disabled={composing.homeId === composing.awayId} style={{ width: "100%", marginTop: 10, background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: composing.homeId === composing.awayId ? 0.5 : 1 }}>
            {t("Criar jogo")}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={startCompose} style={{ flex: 1, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={15} /> {t("Novo jogo")}
        </button>
        <button onClick={onEnd} style={{ flex: 1, background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Flag size={15} /> {t("Terminar dia")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10, color: C.text3 }}>
        <Shield size={11} /> {t("Clean sheets do GR escolhido e das Defesas contam ao terminar o dia.")}
      </div>
    </div>
  );
}
