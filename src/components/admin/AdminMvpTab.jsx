import { C, cardStyle, displayFont } from "../../theme";

const GoalBar = ({ label, current, target, format = (v) => v, unit }) => {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const met = current >= target;
  const color = met ? C.green : C.accent;
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.text2 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.text3 }}>Meta: {format(target)}{unit}</div>
      </div>
      <div style={{ ...displayFont, fontSize: 26, color, marginBottom: 8 }}>{format(current)}{unit}</div>
      <div style={{ height: 8, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>{Math.round(pct)}% da meta</div>
    </div>
  );
};

const weekStart = (iso) => {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
};
const fmtWeek = (ts) => new Date(ts).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

/** Last N week buckets (oldest first), each { ts, count } from a list of
 *  { at } rows bucketed by ISO week, counting either raw rows or distinct
 *  group ids per week depending on `distinctBy`. */
function weeklyBuckets(rows, atKey, weeks = 8, distinctBy = null) {
  const now = weekStart(new Date().toISOString());
  const buckets = Array.from({ length: weeks }, (_, i) => now - (weeks - 1 - i) * 7 * 86400000);
  const sets = new Map(buckets.map((ts) => [ts, distinctBy ? new Set() : { n: 0 }]));
  rows.forEach((r) => {
    const at = r[atKey];
    if (!at) return;
    const ws = weekStart(at);
    if (!sets.has(ws)) return;
    if (distinctBy) sets.get(ws).add(r[distinctBy]);
    else sets.get(ws).n += 1;
  });
  return buckets.map((ts) => ({ ts, count: distinctBy ? sets.get(ts).size : sets.get(ts).n }));
}

const WeeklyChart = ({ title, rows, atKey, distinctBy, caption }) => {
  const buckets = weeklyBuckets(rows, atKey, 8, distinctBy);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 320 }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {caption && <div style={{ fontSize: 11, color: C.text3, marginBottom: 14 }}>{caption}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
        {buckets.map((b) => (
          <div key={b.ts} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, color: C.text2 }}>{b.count}</div>
            <div style={{ width: "100%", height: Math.max(3, (b.count / max) * 80), background: C.accent, borderRadius: 4 }} />
            <div style={{ fontSize: 9, color: C.text3 }}>{fmtWeek(b.ts)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** The metrics Vini asked for by name (2026-07-29): growth toward
 *  12 groups / 200 users, avg users/group, % groups with results
 *  registered, % groups with Pitch Manager adoption, weekly group
 *  retention, weekly active players per group, weekly cards generated. */
export default function AdminMvpTab({ snapshot, fantasy, cards }) {
  const { loading, error, groups, players, matchdays, attendances } = snapshot;

  if (loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.red }}>Erro: {error}</div>;

  const avgPerGroup = groups.length ? players.length / groups.length : 0;

  const groupsWithResults = new Set((matchdays ?? []).map((m) => m.group_id));
  const resultsPct = groups.length ? (groupsWithResults.size / groups.length) * 100 : 0;

  const leagueGroupIds = new Set((fantasy?.leagues ?? []).map((l) => l.group_id));
  const managerPct = groups.length ? (leagueGroupIds.size / groups.length) * 100 : 0;

  const FOUR_DAYS = 4 * 86400000;
  const activeCutoff = Date.now() - FOUR_DAYS;
  // "Active" = opened the app (last_seen_at, login or magic link) OR
  // confirmed/declined a game (attendances.responded_at) — a player who
  // only ever responds via the magic link and never re-opens it still
  // clearly used the app, so last_seen_at alone undercounts them.
  const lastRespondedByPlayer = new Map();
  (attendances ?? []).forEach((a) => {
    if (!a.responded_at) return;
    const t = new Date(a.responded_at).getTime();
    if (t > (lastRespondedByPlayer.get(a.player_id) ?? 0)) lastRespondedByPlayer.set(a.player_id, t);
  });
  const activeByGroup = groups.map((g) => {
    const members = players.filter((p) => p.group_id === g.id);
    const active = members.filter((p) => {
      const seen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
      const responded = lastRespondedByPlayer.get(p.id) ?? 0;
      return Math.max(seen, responded) >= activeCutoff;
    }).length;
    return { name: g.name, active, total: members.length };
  }).sort((a, b) => b.active - a.active);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <GoalBar label="Grupos" current={groups.length} target={12} />
        <GoalBar label="Usuários" current={players.length} target={200} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <GoalBar label="Média de usuários por grupo" current={Number(avgPerGroup.toFixed(1))} target={12} />
        <GoalBar label="Grupos com resultados registados" current={Math.round(resultsPct)} target={70} unit="%" />
        <GoalBar label="Aderência ao Pitch Manager por grupo" current={Math.round(managerPct)} target={60} unit="%" />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <WeeklyChart title="Novos utilizadores por semana" rows={players.filter((p) => p.user_id)} atKey="created_at"
          caption="Contas reais criadas por semana (exclui jogadores avulsos sem conta)." />
        <WeeklyChart title="Retenção de grupos por semana" rows={matchdays ?? []} atKey="played_on" distinctBy="group_id"
          caption="Nº de grupos com pelo menos um resultado registado nessa semana." />
        <WeeklyChart title="Cards gerados por semana" rows={cards?.rows ?? []} atKey="created_at"
          caption="Conta a partir de hoje — histórico anterior à instrumentação não existe." />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Jogadores ativos por grupo</div>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: 14 }}>Abriu a app OU confirmou/recusou presença nos últimos 4 dias.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeByGroup.map((g) => (
            <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 160, flexShrink: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
              <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${g.total ? (g.active / g.total) * 100 : 0}%`, height: "100%", background: C.green, borderRadius: 4 }} />
              </div>
              <div style={{ width: 60, textAlign: "right", fontSize: 12, color: C.text2, flexShrink: 0 }}>{g.active}/{g.total}</div>
            </div>
          ))}
          {activeByGroup.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Sem grupos ainda.</div>}
        </div>
      </div>
    </div>
  );
}
