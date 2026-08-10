import { useState } from "react";
import { Star, Shield, Share2 } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
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

  const me = group.find((p) => p.isMe);
  const myKey = me ? (me.uuid ?? me.id) : null;
  const iPlayed = Boolean(me) && (lastMatchday?.candidates ?? []).some((c) => c.key === myKey);
  const isMVP = Boolean(me) && mvp?.podium?.first === me.nick;

  // Per-player ranking categories — opens on "Geral" (a simple weighted
  // composite), the rest are single-stat cuts. "Guarda-redes" isn't
  // restricted to the position field: the GR rotates match to match (see
  // Matchday.jsx), so it ranks whoever actually racked up clean
  // sheets/saves. "Fiabilidade" reuses the season's real game count, not
  // the old fixed demo constant.
  const PLAYER_CATEGORIES = [
    { id: "geral", label: t("Geral"), value: (p) => (p.goals || 0) * 2 + (p.assists || 0) + (p.wins || 0) + (p.mvps || 0) * 3 + (p.cleanSheets || 0) },
    { id: "goals", label: `⚽ ${t("Golos")}`, value: (p) => p.goals || 0 },
    { id: "assists", label: "🎯 Assists", value: (p) => p.assists || 0 },
    { id: "mvps", label: "⭐ MVPs", value: (p) => p.mvps || 0 },
    { id: "gk", label: `🧤 ${t("Guarda-redes")}`, value: (p) => (p.cleanSheets || 0) * 3 + (p.epicSaves || 0) },
    { id: "reliability", label: `📅 ${t("Fiabilidade")}`, value: (p) => (totalGames ? Math.round(((p.gamesPlayed || 0) / totalGames) * 100) : 0), suffix: "%" },
  ];
  // Teams are redrawn fresh every matchday (no persistent identity to sum
  // a season total over) — these stay per-day records, à la the Excel's
  // Hall of Fame sheet, not a season-long team table.
  const TEAM_CATEGORIES = [
    { id: "attackDay", label: `🔥 ${t("Melhor ataque (dia)")}` },
    { id: "defenseDay", label: `🛡️ ${t("Melhor defesa (dia)")}` },
  ];
  const activeCat = PLAYER_CATEGORIES.find((c) => c.id === statMode);

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

  const playerList = activeCat ? [...group].sort((a, b) => activeCat.value(b) - activeCat.value(a)).slice(0, 8) : [];
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

      {/* RANKINGS — opens on "Geral"; scroll the chips for the rest */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 2 }}>
        {[...PLAYER_CATEGORIES, ...TEAM_CATEGORIES].map((c) => {
          const active = statMode === c.id;
          return (
            <button key={c.id} onClick={() => setStatMode(c.id)}
              style={{ flexShrink: 0, background: active ? C.accent : C.card, color: active ? C.bg : C.text2, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 20, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
              {c.label}
            </button>
          );
        })}
      </div>

      {activeCat ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
          {playerList.length === 0 && <div style={{ fontSize: 12, color: C.text2 }}>{t("Ainda sem dados.")}</div>}
          {playerList.map((p, i) => {
            const value = activeCat.value(p);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: p.isMe ? C.accentDim : C.card, border: `1px solid ${p.isMe ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : i === 1 ? C.text2 : i === 2 ? C.orange : C.text3 }}>{i + 1}</span>
                <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={10} isMe={p.isMe} photo={p.photo} injured={p.injured} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>{p.nick}</div>
                  <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4, width: "85%" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: p.isMe ? C.accent : playerColor(group, p), width: `${(value / playerMax) * 100}%` }} />
                  </div>
                </div>
                <span style={{ ...displayFont, fontSize: 17, color: p.isMe ? C.accent : C.text1 }}>{value}{activeCat.suffix || ""}</span>
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
