import { C, cardStyle, displayFont } from "../../theme";

const StatCard = ({ label, value, sub }) => (
  <div style={{ ...cardStyle, flex: 1, minWidth: 150 }}>
    <div style={{ ...displayFont, fontSize: 30 }}>{value}</div>
    <div style={{ fontSize: 12, color: C.text2, marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Bar = ({ label, value, max, color = C.accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
    <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
    <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
    <div style={{ width: 28, textAlign: "right", fontSize: 12, color: C.text2, flexShrink: 0 }}>{value}</div>
  </div>
);

/** Metrics skeleton — cheap numbers derivable from data we already load
 *  (fetchAdminData + leads). Placeholder for the real KPI set once Vini
 *  specifies exactly what "% de uso" etc. should mean. */
export default function AdminOverviewTab({ snapshot, leads }) {
  const { loading, error, groups, players, games } = snapshot;

  if (loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.red }}>Erro: {error}</div>;

  const ACTIVE_STATUSES = ["open", "full", "live"];
  const groupsWithActiveGame = new Set(games.filter((g) => ACTIVE_STATUSES.includes(g.status)).map((g) => g.group_id));
  const activePct = groups.length ? Math.round((groupsWithActiveGame.size / groups.length) * 100) : 0;
  const avgPlayers = groups.length ? (players.length / groups.length).toFixed(1) : "0";
  const gamesPlayed = games.filter((g) => g.status === "played").length;

  const byGroupSize = groups
    .map((g) => ({ name: g.name, count: players.filter((p) => p.group_id === g.id).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const maxGroupSize = byGroupSize[0]?.count ?? 1;

  const leadsByRole = {};
  (leads.rows ?? []).forEach((l) => { const r = l.role || "—"; leadsByRole[r] = (leadsByRole[r] || 0) + 1; });
  const maxLeadRole = Math.max(1, ...Object.values(leadsByRole));

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <StatCard label="Grupos" value={groups.length} />
        <StatCard label="Jogadores registados" value={players.length} sub={`${avgPlayers} por grupo em média`} />
        <StatCard label="Grupos ativos" value={`${activePct}%`} sub={`${groupsWithActiveGame.size} de ${groups.length} com jogo em aberto`} />
        <StatCard label="Jogos disputados" value={gamesPlayed} sub={`${games.length} jogos no total`} />
        <StatCard label="Leads (site /league)" value={leads.rows?.length ?? 0} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ ...cardStyle, flex: 2, minWidth: 320 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Jogadores por grupo</div>
          {byGroupSize.length === 0 ? (
            <div style={{ fontSize: 12, color: C.text3 }}>Sem grupos ainda.</div>
          ) : byGroupSize.map((g) => <Bar key={g.name} label={g.name} value={g.count} max={maxGroupSize} />)}
        </div>

        <div style={{ ...cardStyle, flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16 }}>Leads por perfil</div>
          {Object.keys(leadsByRole).length === 0 ? (
            <div style={{ fontSize: 12, color: C.text3 }}>Sem leads ainda.</div>
          ) : Object.entries(leadsByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
            <Bar key={role} label={role} value={count} max={maxLeadRole} color={C.blue} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: C.text3, lineHeight: 1.6 }}>
        Isto é a v1 das métricas — números baratos de calcular a partir dos dados que já carregamos.
        Manda a lista do que precisas ver aqui (ex.: retenção semana a semana, % de confirmação por jogo,
        conversão lead → conta) que eu adiciono.
      </div>
    </div>
  );
}
