import { Trophy, Target, Sparkles } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import Avatar from "./Avatar";

const MEDAL = ["#E8C547", "#C0C8D0", "#C9824F"]; // gold / silver / bronze

/** Summary of the CURRENT matchday's games (live, local) or the last
 *  finished one (from the normalized lastMatchday): wins per TEAM, top
 *  scorers and top assisters — built from those matches. */
export default function MatchSummary({ matchday, lastMatchday, teams, group }) {
  const byId = (id) => group.find((p) => p.id === id);
  const live = Boolean(matchday);
  const source = matchday || lastMatchday;

  if (!source) {
    return (
      <div style={{ ...cardStyle, marginBottom: 14, textAlign: "center", padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Resumo das partidas</div>
        <div style={{ fontSize: 12, color: C.text3 }}>Inicia um dia de jogo para ver o resumo. ⚽</div>
      </div>
    );
  }

  let teamWins = [], scorerRows = [], assistRows = [], nGames = 0;

  if (live) {
    const tally = {}, sc = {}, as = {};
    (teams || []).forEach((t) => { tally[t.id] = { name: t.name, color: t.color, wins: 0 }; });
    matchday.matches.forEach((m) => {
      nGames++;
      const hg = m.events.filter((e) => e.teamId === m.homeId).length;
      const ag = m.events.filter((e) => e.teamId === m.awayId).length;
      if (hg > ag && tally[m.homeId]) tally[m.homeId].wins++;
      else if (ag > hg && tally[m.awayId]) tally[m.awayId].wins++;
      m.events.forEach((e) => {
        sc[e.scorerId] = (sc[e.scorerId] || 0) + 1;
        if (e.assistId) as[e.assistId] = (as[e.assistId] || 0) + 1;
      });
    });
    teamWins = Object.values(tally);
    const rows = (map) => Object.entries(map)
      .map(([id, v]) => { const p = byId(Number(id)) ?? byId(id); return p ? { nick: p.nick, photo: p.photo, isMe: p.isMe, color: playerColor(group, p), v } : null; })
      .filter(Boolean).sort((a, b) => b.v - a.v).slice(0, 3);
    scorerRows = rows(sc);
    assistRows = rows(as);
  } else {
    nGames = (lastMatchday.matches || []).length;
    teamWins = lastMatchday.teamResults || [];
    const fromLines = (field) => (lastMatchday.lines || [])
      .filter((l) => l[field] > 0)
      .map((l) => ({ nick: l.nick, photo: l.photo, isMe: l.isMe, color: l.color, v: l[field] }))
      .sort((a, b) => b.v - a.v).slice(0, 3);
    scorerRows = fromLines("goals");
    assistRows = fromLines("assists");
  }

  teamWins = [...teamWins].sort((a, b) => b.wins - a.wins);

  const playerColumns = [
    { label: "Artilheiros", Icon: Target, color: C.accent, rows: scorerRows },
    { label: "Assistências", Icon: Sparkles, color: C.blue, rows: assistRows },
  ];

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Resumo das partidas</div>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 800, color: live ? C.red : C.text3 }}>
          {live ? `${nGames} ${nGames === 1 ? "jogo" : "jogos"} · ao vivo` : `último dia${lastMatchday.date ? ` · ${lastMatchday.date}` : ""}`}
        </span>
      </div>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 14 }}>
        {source.mode === "campeonato" ? "Campeonato" : live ? "Avulsa" : "Resultado do último dia de jogo"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {/* Vitórias por equipa */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "10px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginBottom: 10 }}>
            <Trophy size={12} color={C.gold} />
            <span style={{ fontSize: 10, fontWeight: 800, color: C.text2 }}>Vitórias</span>
          </div>
          {teamWins.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: 11, color: C.text3, padding: "8px 0" }}>—</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teamWins.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: t.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span style={{ ...displayFont, fontSize: 14, color: t.color }}>{t.wins}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Artilheiros + Assistências */}
        {playerColumns.map(({ label, Icon, color, rows }) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: "10px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginBottom: 10 }}>
              <Icon size={12} color={color} />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.text2 }}>{label}</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ textAlign: "center", fontSize: 11, color: C.text3, padding: "8px 0" }}>—</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...displayFont, fontSize: 12, width: 10, color: MEDAL[i] || C.text3 }}>{i + 1}</span>
                    <Avatar name={r.nick} color={r.color || C.text2} size={22} fontSize={8} isMe={r.isMe} photo={r.photo} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: r.isMe ? 800 : 500, color: r.isMe ? C.accent : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nick}</span>
                    <span style={{ ...displayFont, fontSize: 13, color }}>{r.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
