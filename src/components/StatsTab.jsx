import { Star, Check, Shield } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const RANKS = [
  { n: 1, label: "1º lugar", color: C.gold },
  { n: 2, label: "2º lugar", color: C.silver },
  { n: 3, label: "3º lugar", color: C.bronze },
];

export default function StatsTab({ group, history, lastMatchday, mvp, statMode, setStatMode }) {
  const fields = { goals: "goals", assists: "assists", mvps: "mvps" };
  const list = [...group].sort((a, b) => (b[fields[statMode]] || 0) - (a[fields[statMode]] || 0)).slice(0, 8);
  const totalGames = history.reduce((s, h) => s + (h.games || 1), 0);
  const lines = lastMatchday?.lines ?? [];

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
        </div>
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

      {/* LEADERBOARD */}
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["goals", t("⚽ Golos")], ["assists", "🎯 Assists"], ["mvps", "⭐ MVPs"]].map(([m, label]) => {
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
          const value = p[fields[statMode]] || 0;
          const max = (list[0][fields[statMode]] || 0) || 1;
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
      <SectionLabel>{t("HISTÓRICO DE JOGOS")}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {history.map((g) => (
          <div key={g.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
            <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
              <div style={{ ...displayFont, fontSize: 16 }}>{g.result}</div>
              <div style={{ fontSize: 10, color: C.text2 }}>{g.date}</div>
            </div>
            <div style={{ width: 1, height: 30, background: C.border }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.text2 }}>{g.confirmed} {t("jogadores")}{g.games ? ` · ${g.games} ${t("jogos")}` : ""}</div>
              {g.mvpNick ? (
                <div style={{ fontSize: 12, marginTop: 1 }}>⭐ MVP: <span style={{ fontWeight: 700 }}>{g.mvpNick}</span></div>
              ) : (
                <div style={{ fontSize: 12, marginTop: 1, color: C.text3 }}>⭐ MVP: {t("votação a decorrer")}</div>
              )}
            </div>
            {typeof g.allPaid === "boolean" && (
              <div style={{ fontSize: 11 }}>
                {g.allPaid ? <span style={{ color: C.green }}>{t("Pago")} <Check size={10} style={{ display: "inline" }} /></span> : <span style={{ color: C.orange }}>{t("Pendente")}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
