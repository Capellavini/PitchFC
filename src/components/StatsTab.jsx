import { useState } from "react";
import { Star, Shield, Share2 } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import PostMatchCardModal from "./PostMatchCard";
import WorkoutCardModal from "./WorkoutCardModal";
import CardTemplatePicker from "./CardTemplatePicker";

const RANKS = [
  { n: 1, label: "1º lugar", color: C.gold },
  { n: 2, label: "2º lugar", color: C.silver },
  { n: 3, label: "3º lugar", color: C.bronze },
];

export default function StatsTab({ group, history, matchdaySummaries = [], lastMatchday, mvp, statMode, setStatMode, groupName, onCardGenerated, social }) {
  const totalGames = history.reduce((s, h) => s + (h.games || 1), 0);
  const lines = lastMatchday?.lines ?? [];
  const [cardStep, setCardStep] = useState(null); // null | 'pick' | 'match' | 'workout'
  const [comparePicks, setComparePicks] = useState([]); // season-stable keys, 2-4 players
  const togglePick = (key) => setComparePicks((cur) =>
    cur.includes(key) ? cur.filter((k) => k !== key) : (cur.length >= 4 ? cur : [...cur, key]));

  const me = group.find((p) => p.isMe);
  const myKey = me ? (me.uuid ?? me.id) : null;
  const iPlayed = Boolean(me) && (lastMatchday?.candidates ?? []).some((c) => c.key === myKey);
  const isMVP = Boolean(me) && mvp?.podium?.first === me.nick;

  // Per-player ranking categories — opens on "Impacto" (a simple weighted
  // composite), the rest are single-stat cuts. "Guarda-redes" isn't
  // restricted to the position field: the GR rotates match to match (see
  // Matchday.jsx), so it ranks whoever actually racked up clean
  // sheets/saves.
  const impactoOf = (p) => (p.goals || 0) * 2 + (p.assists || 0) + (p.wins || 0) + (p.mvps || 0) * 3 + (p.cleanSheets || 0);

  // Sobre-entrega/sub-entrega: where a player ranks by peer-rated OVR vs.
  // where they rank by actual Impacto, both as a percentile within the
  // group. A player rated 3rd-best but performing like the 10th-best is
  // "sub-entregando" — the gap is the only new number here, everything
  // it's built from (OVR, Impacto) already exists elsewhere. Players
  // without 3+ peer ratings have no meaningful OVR yet, so they're left
  // out of this one category rather than shown a misleading "0" gap.
  const ratedGroup = group.filter((p) => !(p.ratingsCount != null && p.ratingsCount < 3));
  const percentileRank = (list, valueOf) => {
    const sorted = [...list].sort((a, b) => valueOf(a) - valueOf(b));
    const pct = {};
    sorted.forEach((p, i) => { pct[p.id] = sorted.length > 1 ? (i / (sorted.length - 1)) * 100 : 50; });
    return pct;
  };
  const ovrPct = percentileRank(ratedGroup, (p) => computeOverall(p.position, p.attrs));
  const impactoPct = percentileRank(ratedGroup, impactoOf);
  const performanceGap = (p) => Math.round((impactoPct[p.id] ?? 0) - (ovrPct[p.id] ?? 0));

  const PLAYER_CATEGORIES = [
    { id: "geral", label: t("Impacto"), value: impactoOf,
      hint: t("Quem está mais completo esta época, tudo junto num só número: 2 pts por golo, 1 por assistência, 1 por vitória, 3 por MVP, 1 por clean sheet.") },
    { id: "goals", label: `⚽ ${t("Golos")}`, value: (p) => p.goals || 0, hint: t("Total de golos marcados na época.") },
    { id: "assists", label: "🎯 Assists", value: (p) => p.assists || 0, hint: t("Total de assistências na época.") },
    { id: "mvps", label: "⭐ MVPs", value: (p) => p.mvps || 0, hint: t("Vezes eleito MVP do dia.") },
    { id: "gk", label: `🧤 ${t("Guarda-redes")}`, value: (p) => (p.cleanSheets || 0) * 3 + (p.epicSaves || 0),
      hint: t("Clean sheets (valem 3×) e defesas espetaculares — conta quem defendeu de verdade, não só quem joga na baliza.") },
    { id: "gap", label: `📈 ${t("Sobre-entrega")}`, value: performanceGap, signed: true, noBar: true, suffix: "%", source: ratedGroup,
      hint: t("Compara o ranking de avaliação (OVR dos colegas) com o ranking real de Impacto. Positivo = rende mais do que esperavam; negativo = rende menos. Só entra quem já tem 3+ avaliações.") },
  ];
  // Teams are redrawn fresh every matchday (no persistent identity to sum
  // a season total over) — these stay per-day records, à la the Excel's
  // Hall of Fame sheet, not a season-long team table.
  const TEAM_CATEGORIES = [
    { id: "attackDay", label: `🔥 ${t("Melhor ataque (dia)")}`, hint: t("Mais golos marcados por uma equipa num único dia de jogo.") },
    { id: "defenseDay", label: `🛡️ ${t("Melhor defesa (dia)")}`, hint: t("Menos golos sofridos por uma equipa num único dia de jogo.") },
  ];
  const COMPARE_CATEGORY = { id: "compare", label: `🆚 ${t("Comparar jogadores")}`, hint: t("Escolhe 2 a 4 jogadores para comparar as stats e ver a % de vitórias quando jogam juntos.") };
  const ALL_CATEGORIES = [...PLAYER_CATEGORIES, ...TEAM_CATEGORIES, COMPARE_CATEGORY];
  const activeCat = PLAYER_CATEGORIES.find((c) => c.id === statMode);
  const activeMeta = ALL_CATEGORIES.find((c) => c.id === statMode);

  // "Jogaram juntos": needs EVERY selected player on the same team the
  // same day — only matchdays committed after teamResults started
  // snapshotting rosters carry this (see PitchApp.jsx endMatchday), so
  // older days just don't match and this reads as "no data yet", not an
  // error. Goals for/against come from that team's matches that day, same
  // source as "melhor ataque/defesa (dia)" below.
  const togetherStats = (keys) => {
    let gamesTogether = 0, winsTogether = 0, goalsFor = 0, goalsAgainst = 0;
    matchdaySummaries.forEach((md) => {
      const team = (md.summary?.teamResults || []).find((tm) => keys.every((k) => tm.players?.includes(k)));
      if (!team) return;
      (md.summary?.matches || []).forEach((m) => {
        if (m.homeName === team.name) { gamesTogether++; goalsFor += m.homeGoals; goalsAgainst += m.awayGoals; }
        else if (m.awayName === team.name) { gamesTogether++; goalsFor += m.awayGoals; goalsAgainst += m.homeGoals; }
      });
      winsTogether += team.wins || 0;
    });
    return { gamesTogether, winsTogether, goalsFor, goalsAgainst };
  };

  const dayTeamRows = [];
  matchdaySummaries.forEach((md) => {
    const matches = md.summary?.matches ?? [];
    const colorByName = {};
    (md.summary?.teamResults ?? []).forEach((tr) => { colorByName[tr.name] = tr.color; });
    const byTeam = {};
    matches.forEach((m) => {
      if (m.homeName && m.homeName !== "—") {
        byTeam[m.homeName] = byTeam[m.homeName] || { gf: 0, ga: 0 };
        byTeam[m.homeName].gf += m.homeGoals; byTeam[m.homeName].ga += m.awayGoals;
      }
      if (m.awayName && m.awayName !== "—") {
        byTeam[m.awayName] = byTeam[m.awayName] || { gf: 0, ga: 0 };
        byTeam[m.awayName].gf += m.awayGoals; byTeam[m.awayName].ga += m.homeGoals;
      }
    });
    Object.entries(byTeam).forEach(([name, s]) => dayTeamRows.push({ name, date: md.date, color: colorByName[name] || C.text2, ...s }));
  });
  const attackList = [...dayTeamRows].sort((a, b) => b.gf - a.gf).slice(0, 8);
  const defenseList = [...dayTeamRows].sort((a, b) => a.ga - b.ga).slice(0, 8);

  const playerList = activeCat ? [...(activeCat.source || group)].sort((a, b) => activeCat.value(b) - activeCat.value(a)).slice(0, 8) : [];
  const playerMax = activeCat && playerList[0] ? (activeCat.value(playerList[0]) || 1) : 1;

  // Assigning a candidate to a rank they already hold elsewhere moves
  // them (the DB rejects the same candidate at two ranks for one voter).
  const pickForRank = async (rank, key) => {
    if (mvp.myVotes[rank] === key) { await mvp.onClear(rank); return; }
    const otherRank = [1, 2, 3].find((r) => r !== rank && mvp.myVotes[r] === key);
    if (otherRank) await mvp.onClear(otherRank);
    await mvp.onVote(rank, key);
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Stats</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{t("Temporada")} · {totalGames} {totalGames === 1 ? t("jogo") : t("jogos")}</div>
      </div>

      {/* LAST MATCHDAY — games + per-player stats */}
      {lastMatchday && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>{t("ÚLTIMO DIA DE JOGO")} · {(lastMatchday.date || "").toUpperCase()}</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: lines.length ? 14 : 0 }}>
            {(lastMatchday.matches ?? []).map((m) => (
              <div key={m.n} style={{ background: C.surface, borderRadius: 12, padding: "10px 12px", textAlign: "center", flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: 4 }}>{t("JOGO")} {m.n}</div>
                <div style={{ ...displayFont, fontSize: 20 }}>
                  <span style={{ color: C.accent }}>{m.homeGoals}</span>
                  <span style={{ color: C.text3 }}> – </span>
                  <span style={{ color: C.blue }}>{m.awayGoals}</span>
                </div>
                {(m.homeName || m.awayName) && (
                  <div style={{ fontSize: 9, color: C.text3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.homeName} vs {m.awayName}
                  </div>
                )}
              </div>
            ))}
          </div>
          {lines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((l) => (
                <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={l.nick} color={l.color || C.text2} size={28} fontSize={10} isMe={l.isMe} photo={l.photo} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: l.isMe ? 800 : 500, color: l.isMe ? C.accent : C.text1 }}>{l.nick}</span>
                  <span style={{ fontSize: 12, color: C.text2, display: "flex", gap: 10 }}>
                    {l.goals > 0 && <span>⚽ {l.goals}</span>}
                    {l.assists > 0 && <span>🎯 {l.assists}</span>}
                    {l.cleanSheets > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Shield size={11} color={C.green} /> {l.cleanSheets}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {iPlayed && (
            <button onClick={() => setCardStep("pick")}
              style={{ width: "100%", marginTop: 14, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Share2 size={15} /> {t("Gerar o meu card")}
            </button>
          )}
        </div>
      )}

      {cardStep === "pick" && (
        <CardTemplatePicker onPick={setCardStep} onClose={() => setCardStep(null)} />
      )}
      {cardStep === "match" && me && (
        <PostMatchCardModal player={me} group={group} matchday={lastMatchday} groupName={groupName} isMVP={isMVP} onClose={() => setCardStep(null)} onGenerated={onCardGenerated} />
      )}
      {cardStep === "workout" && me && (
        <WorkoutCardModal me={me} groupName={groupName} lastMatchday={lastMatchday} social={social} onClose={() => setCardStep(null)} onGenerated={onCardGenerated} />
      )}

      {/* MVP VOTING — ranked top-3 ballot, feeds Fantasy League bonuses */}
      {mvp && (mvp.open ? (
        <div style={{ background: `linear-gradient(135deg, ${C.card} 0%, rgba(200,255,0,0.05) 100%)`, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Star size={14} color={C.accent} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: "0.06em" }}>{t("VOTAÇÃO MVP")}</span>
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>{t("Quem foram os 3 melhores em campo?")}</div>

          {RANKS.map(({ n: rank, label, color }) => (
            <div key={rank} style={{ marginBottom: rank < 3 ? 14 : 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 6 }}>{t(label)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {mvp.candidates.map((c) => {
                  const selected = mvp.myVotes[rank] === c.key;
                  const usedElsewhere = RANKS.some(({ n: r }) => r !== rank && mvp.myVotes[r] === c.key);
                  const votes = mvp.tally?.[c.key];
                  return (
                    <button key={c.key} onClick={() => pickForRank(rank, c.key)} disabled={usedElsewhere}
                      style={{ background: selected ? `${color}22` : C.surface, border: `1.5px solid ${selected ? color : C.border}`, borderRadius: 12, padding: "10px 6px", cursor: usedElsewhere ? "default" : "pointer", textAlign: "center", opacity: usedElsewhere ? 0.35 : 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: selected ? color : C.text1 }}>{c.nick}</div>
                      <div style={{ fontSize: 9, color: C.text3, marginTop: 2 }}>{t(c.position)}</div>
                      {votes > 0 && <div style={{ fontSize: 10, color: C.text2, marginTop: 3, fontWeight: 700 }}>{votes} {t("pts")}</div>}
                      {selected && <div style={{ fontSize: 10, color, marginTop: 3 }}>{t("✓ o teu voto")}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {mvp.canClose && (
            <BtnPrimary onClick={mvp.onClose} style={{ width: "100%", marginTop: 2 }}>{t("Fechar votação e revelar o pódio")}</BtnPrimary>
          )}
        </div>
      ) : mvp.podium?.first ? (
        <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.gold}55`, background: `linear-gradient(135deg, ${C.card} 0%, ${C.goldDim} 100%)` }}>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>{t("Pódio do último dia")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[["🥇", C.gold, mvp.podium.first], ["🥈", C.silver, mvp.podium.second], ["🥉", C.bronze, mvp.podium.third]]
              .filter(([, , nick]) => nick)
              .map(([medal, color, nick]) => (
                <div key={medal} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{medal}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color }}>{nick}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null)}

      {/* RANKINGS — opens on "Geral"; a dropdown picks the rest */}
      <select value={statMode} onChange={(e) => setStatMode(e.target.value)}
        style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px", fontSize: 14, fontWeight: 800, color: C.text1, outline: "none", marginBottom: 6 }}>
        {ALL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      {activeMeta?.hint && <div style={{ fontSize: 11, color: C.text3, marginBottom: 16 }}>{activeMeta.hint}</div>}

      {statMode === "compare" ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {group.map((p) => {
              const key = p.uuid ?? p.id;
              const picked = comparePicks.includes(key);
              return (
                <button key={p.id} onClick={() => togglePick(key)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: picked ? C.accentDim : C.card, border: `1px solid ${picked ? C.accentBorder : C.border}`, borderRadius: 20, padding: "5px 10px 5px 5px", cursor: "pointer" }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={24} fontSize={9} photo={p.photo} />
                  <span style={{ fontSize: 12, fontWeight: picked ? 800 : 600, color: picked ? C.accent : C.text1 }}>{p.nick}</span>
                </button>
              );
            })}
          </div>

          {comparePicks.length < 2 ? (
            <div style={{ fontSize: 12, color: C.text2 }}>{t("Escolhe pelo menos 2 jogadores.")}</div>
          ) : (() => {
            const { gamesTogether, winsTogether, goalsFor, goalsAgainst } = togetherStats(comparePicks);
            const pickedPlayers = comparePicks.map((k) => group.find((p) => (p.uuid ?? p.id) === k)).filter(Boolean);
            return (
              <div style={{ ...cardStyle }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                  {pickedPlayers.map((p) => (
                    <div key={p.id} style={{ textAlign: "center" }}>
                      <Avatar name={p.name} color={playerColor(group, p)} size={38} fontSize={12} photo={p.photo} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.text2, marginTop: 3, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</div>
                    </div>
                  ))}
                </div>

                {gamesTogether === 0 ? (
                  <div style={{ fontSize: 12, color: C.text3, textAlign: "center" }}>
                    {t("Ainda sem dias em que todos jogaram juntos na mesma equipa — passa a contar a partir do próximo dia de jogo.")}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {[
                      [t("Jogos juntos"), gamesTogether, C.text1],
                      [t("% Vitórias"), `${Math.round((winsTogether / gamesTogether) * 100)}%`, C.accent],
                      [t("Golos marcados"), goalsFor, C.green],
                      [t("Golos sofridos"), goalsAgainst, C.red],
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ background: C.surface, borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                        <div style={{ ...displayFont, fontSize: 24, color }}>{value}</div>
                        <div style={{ fontSize: 10, color: C.text2, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : activeCat ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          {playerList.length === 0 && (
            <div style={{ fontSize: 12, color: C.text2 }}>
              {activeCat.id === "gap" ? t("Ninguém tem ainda 3+ avaliações dos colegas para comparar.") : t("Ainda sem dados.")}
            </div>
          )}
          {playerList.map((p, i) => {
            const value = activeCat.value(p);
            const signPrefix = activeCat.signed && value > 0 ? "+" : "";
            const valueColor = activeCat.signed
              ? (value > 0 ? C.green : value < 0 ? C.red : C.text2)
              : (p.isMe ? C.accent : C.text1);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: p.isMe ? C.accentDim : C.card, border: `1px solid ${p.isMe ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : i === 1 ? C.text2 : i === 2 ? C.orange : C.text3 }}>{i + 1}</span>
                <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={10} isMe={p.isMe} photo={p.photo} injured={p.injured} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>{p.nick}</div>
                  {!activeCat.noBar && (
                    <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4, width: "85%" }}>
                      <div style={{ height: "100%", borderRadius: 2, background: p.isMe ? C.accent : playerColor(group, p), width: `${(value / playerMax) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span style={{ ...displayFont, fontSize: 17, color: valueColor }}>{signPrefix}{value}{activeCat.suffix || ""}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          {(statMode === "attackDay" ? attackList : defenseList).length === 0 && (
            <div style={{ fontSize: 12, color: C.text2 }}>{t("Ainda sem dias de jogo registados.")}</div>
          )}
          {(statMode === "attackDay" ? attackList : defenseList).map((r, i) => (
            <div key={`${r.name}-${r.date}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : i === 1 ? C.text2 : i === 2 ? C.orange : C.text3 }}>{i + 1}</span>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: r.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ fontSize: 10, color: C.text3 }}>{r.date}</div>
              </div>
              <span style={{ ...displayFont, fontSize: 17, color: C.text1 }}>{statMode === "attackDay" ? r.gf : r.ga}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
