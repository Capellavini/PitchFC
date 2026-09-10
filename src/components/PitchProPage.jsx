import { useState } from "react";
import { Trophy, Users, Calendar, Table2, Gamepad2, Home as HomeIcon, ChevronLeft, Star, ArrowRightLeft, Wallet } from "lucide-react";
import { C, BRAND, cardStyle, displayFont } from "../theme";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

// ── Seed data — a clickable model of one competition, standing in for
//    the real thing until PITCH Pro has its own backend. Numbers are
//    deterministic (index-based), not random, so the page looks the same
//    on every load/demo. ───────────────────────────────────────────
const TEAM_NAMES = [
  "Deloitte FC", "Porto Expats", "Goodweather FC", "PwC United", "EY Rovers",
  "KPMG Athletic", "Santander Warriors", "BNP Paribas SC", "Vodafone Eagles",
  "Critical Software FC", "Farfetch United", "Talkdesk Titans", "Natixis Porto",
  "Mindera FC", "Sonae Sport", "Jerónimo Martins AC",
];
const ROUNDS_PLAYED = 10;
const ROUNDS_TOTAL = 15; // 16 teams, single round-robin -> 120 matches total

function seededTeam(name, i) {
  const ovr = 74 + ((i * 7) % 15);
  const w = Math.max(1, (ROUNDS_PLAYED - Math.floor(i / 2) - (i % 3)) % (ROUNDS_PLAYED + 1));
  const l = Math.min(Math.floor((i * 3) % 5), ROUNDS_PLAYED - w);
  const d = ROUNDS_PLAYED - w - l;
  const gf = 12 + ((i * 5) % 20);
  const ga = 8 + ((i * 3) % 14);
  return {
    id: i, name, ovr, played: w + d + l, w, d, l, gf, ga, gd: gf - ga, pts: w * 3 + d,
    color: ["#C8FF00", "#4895FF", "#FF9F0A", "#00D08A", "#A78BFA", "#FF6B9D", "#34D399", "#60A5FA"][i % 8],
  };
}
const TEAMS = TEAM_NAMES.map(seededTeam).sort((a, b) => b.pts - a.pts || b.gd - a.gd);

const POSITIONS = ["GR", "DEF", "DEF", "DEF", "MED", "MED", "MED", "AVA", "AVA"];
function seededSquad(teamId) {
  return Array.from({ length: 16 }, (_, i) => ({
    id: `${teamId}-${i}`,
    name: `Jogador ${i + 1}`,
    position: POSITIONS[i % POSITIONS.length],
    ovr: 68 + ((teamId * 3 + i * 5) % 22),
  }));
}

const TOP_SCORERS = [
  { nick: "R. Mendes", team: "Deloitte FC", value: 14 },
  { nick: "T. Alves", team: "Porto Expats", value: 12 },
  { nick: "Vinicius Capella", team: "Deloitte FC", value: 11 },
  { nick: "F. Nogueira", team: "EY Rovers", value: 10 },
  { nick: "J. Ribeiro", team: "Goodweather FC", value: 9 },
  { nick: "M. Costa", team: "PwC United", value: 9 },
];
const TOP_ASSISTS = [
  { nick: "B. Sousa", team: "KPMG Athletic", value: 10 },
  { nick: "Vinicius Capella", team: "Deloitte FC", value: 9 },
  { nick: "D. Pinto", team: "Vodafone Eagles", value: 8 },
  { nick: "L. Fonseca", team: "Santander Warriors", value: 7 },
  { nick: "P. Araújo", team: "Farfetch United", value: 7 },
];
const TOP_MVPS = [
  { nick: "R. Mendes", team: "Deloitte FC", value: 6 },
  { nick: "Vinicius Capella", team: "Deloitte FC", value: 5 },
  { nick: "T. Alves", team: "Porto Expats", value: 4 },
  { nick: "F. Nogueira", team: "EY Rovers", value: 3 },
];

const RECENT_RESULTS = [
  { home: "Deloitte FC", away: "Porto Expats", hg: 3, ag: 1, round: 10 },
  { home: "EY Rovers", away: "Goodweather FC", hg: 2, ag: 2, round: 10 },
  { home: "PwC United", away: "KPMG Athletic", hg: 1, ag: 0, round: 10 },
  { home: "Vodafone Eagles", away: "Santander Warriors", hg: 2, ag: 3, round: 10 },
];
const UPCOMING = [
  { home: "Goodweather FC", away: "Deloitte FC", date: "Sáb 20 Set · 18:00", venue: "Campo Municipal do Porto" },
  { home: "Farfetch United", away: "Talkdesk Titans", date: "Sáb 20 Set · 19:00", venue: "Nave Desportiva de Matosinhos" },
  { home: "Natixis Porto", away: "Mindera FC", date: "Dom 21 Set · 17:00", venue: "Campo Municipal do Porto" },
];

const PLAYER = {
  name: "Vinicius Capella", nick: "vinicius", ovr: 84, position: "Médio",
  career: [
    { club: "Goodweather FC", role: "Grupo casual", since: "2026" },
    { club: "Deloitte FC", role: "PITCH Pro · Corporate League Porto 2027", since: "2027" },
    { club: "Porto Summer Cup", role: "Torneio", since: "2027" },
  ],
  stats: { matches: 124, goals: 72, assists: 41, mvps: 14, titles: 2 },
};

const NAV = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "matches", label: "Matches", Icon: Calendar },
  { id: "table", label: "Table", Icon: Table2 },
  { id: "teams", label: "Teams", Icon: Users },
  { id: "players", label: "Players", Icon: Star },
  { id: "fantasy", label: "Fantasy", Icon: Gamepad2 },
];

const eyebrow = { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.accent };
const sectionTitle = { ...displayFont, fontSize: 17, marginBottom: 12 };

function StandingsTable({ teams, highlight }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
        <thead>
          <tr>
            {["#", "Equipa", "OVR", "J", "V", "E", "D", "GM", "GS", "SG", "P"].map((h) => (
              <th key={h} style={{ textAlign: h === "Equipa" ? "left" : "center", padding: "7px 8px", color: C.text3, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((tm, i) => (
            <tr key={tm.id} style={{ background: tm.name === highlight ? C.accentDim : "transparent" }}>
              <td style={{ padding: "7px 8px", textAlign: "center", color: i < 4 ? C.accent : C.text2, fontWeight: 800 }}>{i + 1}</td>
              <td style={{ padding: "7px 8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: tm.color, flexShrink: 0 }} />
                {tm.name}
              </td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.ovr}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.played}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.w}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.d}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.l}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.gf}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: C.text2 }}>{tm.ga}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", color: tm.gd >= 0 ? C.green : C.red }}>{tm.gd > 0 ? "+" : ""}{tm.gd}</td>
              <td style={{ padding: "7px 8px", textAlign: "center", ...displayFont, fontSize: 13 }}>{tm.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderList({ title, icon, rows }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon}<span style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div key={r.nick} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 16, color: i === 0 ? C.accent : C.text3, fontWeight: 800, fontSize: 11 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: r.nick === PLAYER.name ? 800 : 600, color: r.nick === PLAYER.name ? C.accent : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nick}</span>
            <span style={{ fontSize: 10.5, color: C.text3 }}>{r.team}</span>
            <span style={{ ...displayFont, fontSize: 14, flexShrink: 0 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamDetail({ team, onBack }) {
  const squad = seededSquad(team.id);
  const [sub, setSub] = useState("overview");
  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.text2, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14, padding: 0 }}>
        <ChevronLeft size={15} /> Teams
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `${team.color}22`, border: `2px solid ${team.color}`, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 18, color: team.color, flexShrink: 0 }}>
          {team.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: 19 }}>{team.name}</div>
          <div style={{ fontSize: 12, color: C.text2 }}>OVR {team.ovr} · {team.w}V-{team.d}E-{team.l}D · {team.pts} pts</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["overview", "squad", "matches", "stats"].map((id) => {
          const active = sub === id;
          return (
            <button key={id} onClick={() => setSub(id)}
              style={{ flex: 1, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 10, padding: "8px 6px", fontSize: 11.5, fontWeight: active ? 800 : 600, cursor: "pointer", textTransform: "capitalize" }}>
              {id}
            </button>
          );
        })}
      </div>
      {sub === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[["OVR", team.ovr], ["Golos", team.gf], ["Sofridos", team.ga], ["Pontos", team.pts]].map(([l, v]) => (
              <div key={l} style={{ background: C.surface, borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
                <div style={{ ...displayFont, fontSize: 17 }}>{v}</div>
                <div style={{ fontSize: 9, color: C.text2, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.text3, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Troféus</div>
            <div style={{ fontSize: 12.5, color: C.text2 }}>Corporate League Porto 2026 — Vice-campeão</div>
          </div>
        </div>
      )}
      {sub === "squad" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {squad.map((p) => (
            <div key={p.id} style={{ ...cardStyle, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.text3, width: 32 }}>{p.position}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <span style={{ ...displayFont, fontSize: 14, color: C.accent }}>{p.ovr}</span>
            </div>
          ))}
        </div>
      )}
      {sub === "matches" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RECENT_RESULTS.filter((m) => m.home === team.name || m.away === team.name).map((m, i) => (
            <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
              <span style={{ fontSize: 12.5 }}>{m.home}</span>
              <span style={{ ...displayFont, fontSize: 14 }}>{m.hg} – {m.ag}</span>
              <span style={{ fontSize: 12.5 }}>{m.away}</span>
            </div>
          ))}
          {!RECENT_RESULTS.some((m) => m.home === team.name || m.away === team.name) && (
            <div style={{ fontSize: 12.5, color: C.text3 }}>Sem resultados recentes nesta demo.</div>
          )}
        </div>
      )}
      {sub === "stats" && (
        <StandingsTable teams={[team]} />
      )}
    </div>
  );
}

export default function PitchProPage() {
  const [tab, setTab] = useState("home");
  const [selectedTeam, setSelectedTeam] = useState(null);

  const page = (children) => <div style={{ minHeight: "100vh", background: C.bg, color: C.text1, fontFamily: FONT, paddingBottom: 60 }}>{children}</div>;

  return page(
    <>
      {/* ── Hero ── */}
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 22 }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.bg, background: C.accent, borderRadius: 6, padding: "2px 7px" }}>PRO</span>
        </div>
        <div style={eyebrow}>Corporate League</div>
        <div style={{ ...displayFont, fontSize: "clamp(22px,4vw,30px)", marginTop: 4 }}>PITCH Corporate League Porto 2027</div>
        <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
          {[["16", "Teams"], ["320", "Players"], ["120", "Matches"], [`${ROUNDS_PLAYED}/${ROUNDS_TOTAL}`, "Rounds played"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ ...displayFont, fontSize: 20, color: C.accent }}>{v}</div>
              <div style={{ fontSize: 10, color: C.text2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sub-nav ── */}
      <div style={{ display: "flex", gap: 4, padding: "12px 12px 0", overflowX: "auto" }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => { setTab(id); setSelectedTeam(null); }}
              style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, background: active ? C.accentDim : "none", color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : "transparent"}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "16px 16px 0", maxWidth: 720, margin: "0 auto" }}>
        {tab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionTitle}>Próximos jogos</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {UPCOMING.map((m, i) => (
                  <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.home} <span style={{ color: C.text3, fontWeight: 400 }}>vs</span> {m.away}</div>
                      <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{m.date} · {m.venue}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={sectionTitle}>Últimos resultados</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {RECENT_RESULTS.map((m, i) => (
                  <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{m.home}</span>
                    <span style={{ ...displayFont, fontSize: 15, flexShrink: 0, margin: "0 10px" }}>{m.hg} – {m.ag}</span>
                    <span style={{ fontSize: 12.5, flex: 1, textAlign: "right" }}>{m.away}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={sectionTitle}>Classificação (top 5)</div>
              <StandingsTable teams={TEAMS.slice(0, 5)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <LeaderList title="Melhores marcadores" icon={<span>⚽</span>} rows={TOP_SCORERS.slice(0, 5)} />
              <LeaderList title="Melhores assistentes" icon={<span>🎯</span>} rows={TOP_ASSISTS} />
              <LeaderList title="MVPs da época" icon={<Star size={14} color={C.gold} />} rows={TOP_MVPS} />
            </div>

            <div style={{ ...cardStyle, textAlign: "center", background: `linear-gradient(135deg, ${C.card} 0%, ${C.accentDim} 100%)`, border: `1px solid ${C.accentBorder}` }}>
              <Trophy size={20} color={C.accent} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Destaque da jornada {ROUNDS_PLAYED}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>Deloitte FC 3–1 Porto Expats — R. Mendes marca dois e assume a artilharia</div>
            </div>
          </div>
        )}

        {tab === "matches" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionTitle}>Próxima jornada</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {UPCOMING.map((m, i) => (
                  <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{m.home} <span style={{ color: C.text3, fontWeight: 400 }}>vs</span> {m.away}</div>
                      <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{m.date} · {m.venue}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={sectionTitle}>Jornada {ROUNDS_PLAYED}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {RECENT_RESULTS.map((m, i) => (
                  <div key={i} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{m.home}</span>
                    <span style={{ ...displayFont, fontSize: 15, flexShrink: 0, margin: "0 10px" }}>{m.hg} – {m.ag}</span>
                    <span style={{ fontSize: 12.5, flex: 1, textAlign: "right" }}>{m.away}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "table" && (
          <div>
            <div style={sectionTitle}>Classificação</div>
            <StandingsTable teams={TEAMS} highlight="Deloitte FC" />
          </div>
        )}

        {tab === "teams" && (
          selectedTeam ? (
            <TeamDetail team={selectedTeam} onBack={() => setSelectedTeam(null)} />
          ) : (
            <div>
              <div style={sectionTitle}>Equipas</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {TEAMS.map((tm) => (
                  <button key={tm.id} onClick={() => setSelectedTeam(tm)}
                    style={{ ...cardStyle, textAlign: "left", cursor: "pointer", color: C.text1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${tm.color}22`, border: `1.5px solid ${tm.color}`, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 12, color: tm.color, marginBottom: 10 }}>
                      {tm.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>{tm.name}</div>
                    <div style={{ fontSize: 10.5, color: C.text2 }}>OVR {tm.ovr} · {tm.pts} pts</div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {tab === "players" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={sectionTitle}>Jogador em destaque</div>
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 27, background: C.accentDim, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 18, color: C.accent, flexShrink: 0 }}>
                    {PLAYER.nick.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...displayFont, fontSize: 17 }}>{PLAYER.name}</div>
                    <div style={{ fontSize: 12, color: C.text2 }}>@{PLAYER.nick} · {PLAYER.position} · OVR {PLAYER.ovr}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: C.text3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Career</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {PLAYER.career.map((c) => (
                    <div key={c.club} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700 }}>{c.club}</span>
                      <span style={{ color: C.text3 }}>{c.role} · {c.since}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {[["Jogos", PLAYER.stats.matches], ["Golos", PLAYER.stats.goals], ["Assist.", PLAYER.stats.assists], ["MVPs", PLAYER.stats.mvps], ["Títulos", PLAYER.stats.titles]].map(([l, v]) => (
                    <div key={l} style={{ background: C.surface, borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
                      <div style={{ ...displayFont, fontSize: 15 }}>{v}</div>
                      <div style={{ fontSize: 8.5, color: C.text2, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 12, lineHeight: 1.5 }}>
                  Mesmo PITCH ID do consumer — o histórico de grupos casuais (Goodweather FC) e de competições Pro
                  (Deloitte FC, Corporate League) vivem no mesmo perfil.
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <LeaderList title="Melhores marcadores" icon={<span>⚽</span>} rows={TOP_SCORERS} />
              <LeaderList title="Melhores assistentes" icon={<span>🎯</span>} rows={TOP_ASSISTS} />
            </div>
          </div>
        )}

        {tab === "fantasy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={sectionTitle}>Liga Fantasy — Corporate League Porto 2027</div>
            <div style={{ fontSize: 12.5, color: C.text2, marginBottom: 4, lineHeight: 1.6 }}>
              Corre sobre os 320 jogadores reais da competição, não só os de um grupo — qualquer colaborador das 16
              empresas pode participar, mesmo quem não joga.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              {[
                [<Wallet size={16} color={C.accent} />, "Orçamento", "€100M por escalação"],
                [<Users size={16} color={C.accent} />, "Jogadores", "GR·DEF·MED·AVA, preço variável"],
                [<ArrowRightLeft size={16} color={C.accent} />, "Transfers", "Janela semanal, capitão em dobro"],
              ].map(([Icon, title, desc], i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ marginBottom: 8 }}>{Icon}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 11, color: C.text2 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.text3, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Leaderboard (demo)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Ana Ferreira (PwC)", 812], ["Vinicius Capella (Deloitte)", 796], ["Ricardo Sá (EY)", 774], ["Marta Lopes (KPMG)", 751]].map(([name, pts], i) => (
                  <div key={name} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                    <span style={{ width: 16, fontSize: 11, fontWeight: 800, color: i === 0 ? C.accent : C.text3 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{name}</span>
                    <span style={{ ...displayFont, fontSize: 14 }}>{pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
