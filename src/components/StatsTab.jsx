import { Star, Check, Shield } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { TOTAL_GAMES } from "../data";
import { playerColor } from "../lib/helpers";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

export default function StatsTab({ group, history, lastMatchday, mvpVote, setMvpVote, statMode, setStatMode }) {
  const byGoals   = [...group].sort((a, b) => b.goals - a.goals);
  const byAssists = [...group].sort((a, b) => b.assists - a.assists);
  const byMvps    = [...group].sort((a, b) => b.mvps - a.mvps);
  const lists  = { goals: byGoals, assists: byAssists, mvps: byMvps };
  const fields = { goals: "goals", assists: "assists", mvps: "mvps" };
  const list = lists[statMode].slice(0, 8);

  // MVP candidates: who played the last matchday; fallback to confirmed.
  const candidates = (lastMatchday?.playerIds ?? group.filter((p) => p.status === "confirmed").map((p) => p.id))
    .map((id) => group.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 9);
  const voteOpen = mvpVote.open;

  // Per-player stat lines of the last matchday, sorted by contribution.
  const matchdayLines = lastMatchday
    ? Object.entries(lastMatchday.playerStats)
        .map(([id, s]) => ({ player: group.find((p) => p.id === Number(id)), ...s }))
        .filter((x) => x.player)
        .sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists))
    : [];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>Stats</div>
        <div style={{ fontSize: 13, color: C.text2 }}>Temporada · {TOTAL_GAMES + (history.length - 5)} jogos</div>
      </div>

      {/* LAST MATCHDAY — games + per-player stats */}
      {lastMatchday && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>ÚLTIMO DIA DE JOGO · {lastMatchday.date.toUpperCase()}</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: matchdayLines.length ? 14 : 0 }}>
            {lastMatchday.matches.map((m) => (
              <div key={m.n} style={{ background: C.surface, borderRadius: 12, padding: "10px 12px", textAlign: "center", flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: 4 }}>JOGO {m.n}</div>
                <div style={{ ...displayFont, fontSize: 20 }}>
                  <span style={{ color: C.accent }}>{m.homeGoals ?? m.scoreA}</span>
                  <span style={{ color: C.text3 }}> – </span>
                  <span style={{ color: C.blue }}>{m.awayGoals ?? m.scoreB}</span>
                </div>
                {(m.homeName || m.awayName) && (
                  <div style={{ fontSize: 9, color: C.text3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.homeName} vs {m.awayName}
                  </div>
                )}
              </div>
            ))}
          </div>
          {matchdayLines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {matchdayLines.map(({ player, goals, assists, cleanSheets }) => (
                <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={player.name} color={playerColor(group, player)} size={28} fontSize={10} isMe={player.isMe} photo={player.photo} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: player.isMe ? 800 : 500, color: player.isMe ? C.accent : C.text1 }}>{player.nick}</span>
                  <span style={{ fontSize: 12, color: C.text2, display: "flex", gap: 10 }}>
                    {goals > 0 && <span>⚽ {goals}</span>}
                    {assists > 0 && <span>🎯 {assists}</span>}
                    {cleanSheets > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Shield size={11} color={C.green} /> {cleanSheets}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MVP VOTING — post-game flow */}
      {voteOpen ? (
        <div style={{
          background: `linear-gradient(135deg, ${C.card} 0%, rgba(200,255,0,0.05) 100%)`,
          border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: 18, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={14} color={C.accent} />
              <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: "0.06em" }}>VOTAÇÃO MVP</span>
            </div>
            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>Fecha em 18h</span>
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>
            {lastMatchday ? `Dia de jogo de ${lastMatchday.date}` : "Último jogo"} — quem foi o melhor em campo?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {candidates.map((p) => {
              const selected = mvpVote.votedFor === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setMvpVote({ ...mvpVote, votedFor: selected ? null : p.id })}
                  style={{
                    background: selected ? C.accentDim : C.surface,
                    border: `1.5px solid ${selected ? C.accent : C.border}`,
                    borderRadius: 12, padding: "10px 6px", cursor: "pointer", textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: selected ? C.accent : C.text1 }}>{p.nick}</div>
                  <div style={{ fontSize: 9, color: C.text3, marginTop: 2 }}>{p.position}</div>
                  {selected && <div style={{ fontSize: 10, color: C.accent, marginTop: 3 }}>✓ o teu voto</div>}
                </button>
              );
            })}
          </div>
          {mvpVote.votedFor && (
            <BtnPrimary onClick={() => setMvpVote({ ...mvpVote, open: false })} style={{ width: "100%", marginTop: 12 }}>
              Confirmar Voto
            </BtnPrimary>
          )}
        </div>
      ) : (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Star size={18} color={C.accent} />
          <div style={{ flex: 1, fontSize: 13, color: C.text2 }}>Voto registado! Resultado quando a votação fechar.</div>
        </div>
      )}

      {/* LEADERBOARD */}
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["goals", "⚽ Golos"], ["assists", "🎯 Assists"], ["mvps", "⭐ MVPs"]].map(([m, label]) => {
          const active = statMode === m;
          return (
            <button key={m} onClick={() => setStatMode(m)} style={{ flex: 1, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: "none", borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
        {list.map((p, i) => {
          const value = p[fields[statMode]];
          const max = list[0][fields[statMode]] || 1;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: p.isMe ? C.accentDim : C.card, border: `1px solid ${p.isMe ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : i === 1 ? C.text2 : i === 2 ? C.orange : C.text3 }}>{i + 1}</span>
              <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={10} isMe={p.isMe} photo={p.photo} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>{p.nick}</div>
                <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4, width: "85%" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: p.isMe ? C.accent : playerColor(group, p), width: `${(value / max) * 100}%` }} />
                </div>
              </div>
              <span style={{ ...displayFont, fontSize: 17, color: p.isMe ? C.accent : C.text1 }}>{value}</span>
            </div>
          );
        })}
      </div>

      {/* HISTORY */}
      <SectionLabel>HISTÓRICO DE JOGOS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {history.map((g) => {
          const mvp = group.find((p) => p.id === g.mvpId);
          return (
            <div key={g.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
              <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                <div style={{ ...displayFont, fontSize: 16 }}>{g.result}</div>
                <div style={{ fontSize: 10, color: C.text2 }}>{g.date}</div>
              </div>
              <div style={{ width: 1, height: 30, background: C.border }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.text2 }}>{g.confirmed} jogadores{g.games ? ` · ${g.games} jogos` : ""}</div>
                {mvp ? (
                  <div style={{ fontSize: 12, marginTop: 1 }}>⭐ MVP: <span style={{ fontWeight: 700 }}>{mvp.nick}</span></div>
                ) : (
                  <div style={{ fontSize: 12, marginTop: 1, color: C.text3 }}>⭐ MVP: votação a decorrer</div>
                )}
              </div>
              <div style={{ fontSize: 11 }}>
                {g.allPaid ? <span style={{ color: C.green }}>Pago <Check size={10} style={{ display: "inline" }} /></span> : <span style={{ color: C.orange }}>Pendente</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
