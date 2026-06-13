import { Trophy, Target, Sparkles } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import Avatar from "./Avatar";

const MEDAL = ["#E8C547", "#C0C8D0", "#C9824F"]; // gold / silver / bronze

/** Season-at-a-glance below the game: most wins, top scorers, top
 *  assisters. Reads from the same player rows the app renders. */
export default function StatsSummary({ group }) {
  const board = (field) =>
    [...group]
      .map((p) => ({ p, v: p[field] || 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3);

  const columns = [
    { key: "wins",    label: "Vitórias",     Icon: Trophy,   color: C.gold,   rows: board("wins") },
    { key: "goals",   label: "Artilheiros",  Icon: Target,   color: C.accent, rows: board("goals") },
    { key: "assists", label: "Assistências", Icon: Sparkles, color: C.blue,   rows: board("assists") },
  ];

  const empty = columns.every((c) => c.rows.length === 0);

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Resumo da época</div>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 14 }}>Líderes do grupo</div>

      {empty ? (
        <div style={{ textAlign: "center", padding: "14px 0", fontSize: 12, color: C.text3 }}>
          Ainda sem dados — joga e termina um dia de jogo para começar a contar. ⚽
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {columns.map(({ key, label, Icon, color, rows }) => (
            <div key={key} style={{ background: C.surface, borderRadius: 12, padding: "10px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginBottom: 10 }}>
                <Icon size={12} color={color} />
                <span style={{ fontSize: 10, fontWeight: 800, color: C.text2, letterSpacing: "0.02em" }}>{label}</span>
              </div>
              {rows.length === 0 ? (
                <div style={{ textAlign: "center", fontSize: 11, color: C.text3, padding: "8px 0" }}>—</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rows.map(({ p, v }, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...displayFont, fontSize: 12, width: 10, color: MEDAL[i] || C.text3 }}>{i + 1}</span>
                      <Avatar name={p.name} color={playerColor(group, p)} size={22} fontSize={8} isMe={p.isMe} photo={p.photo} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: p.isMe ? 800 : 500, color: p.isMe ? C.accent : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
                      <span style={{ ...displayFont, fontSize: 13, color }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
