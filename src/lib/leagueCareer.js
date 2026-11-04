// PITCH Ligas — an athlete's career across seasons.
//
// Every closed season keeps, per competition, one compact row per athlete who played or scored
// ([playerId, games, goals, assists, yellows, reds, mvps], see leagueSeason.archiveCompetition). The athlete's id is
// the thread: it survives "Nova época" (the profile waits in the pool and returns with the same id), so the career
// is simply the sum of those rows, season by season, plus the season in progress.
import { countedMatches, playerStats } from "./core/league.js";

const blank = () => ({ games: 0, goals: 0, assists: 0, yellows: 0, reds: 0, mvps: 0 });
const KEYS = ["games", "goals", "assists", "yellows", "reds", "mvps"];
const add = (to, from) => { for (const k of KEYS) to[k] += from[k] || 0; return to; };

/** { rows: [{ seasonId, label, teamId, teamName, current, games, goals, assists, yellows, reds, mvps }], totals }.
 *  Oldest season first; the season in progress (if the athlete has played in it) is the last row. */
export function athleteCareer(state, playerId) {
  const rows = [];
  const seasons = (state.data.seasons || []).slice().sort((a, b) => String(a.closedAt).localeCompare(String(b.closedAt)));
  for (const s of seasons) {
    const sum = blank(); let found = false;
    for (const c of s.competitions || []) {
      const r = (c.stats || []).find((x) => x[0] === playerId);
      if (!r) continue;
      found = true;
      add(sum, { games: r[1], goals: r[2], assists: r[3], yellows: r[4], reds: r[5], mvps: r[6] });
    }
    if (!found) continue;
    const snap = (s.players || []).find((p) => p.id === playerId);
    const team = (s.teams || []).find((t) => t.id === snap?.teamId);
    rows.push({ seasonId: s.id, label: s.label, teamId: snap?.teamId || null, teamName: team?.name || "—", current: false, ...sum });
  }
  const open = (state.data.competitions || []).filter((c) => !c.closedSeasonId);
  if (open.length) {
    const ids = new Set(open.map((c) => c.id));
    const first = open.find((c) => c.kind !== "cup") || open[0];
    const mine = (state.matches || []).filter((m) => ids.has(m.competitionId || first.id));
    const st = playerStats(countedMatches(mine), state.logs || {})[playerId];
    if (st && KEYS.some((k) => st[k])) {
      const me = (state.data.players || []).find((p) => p.id === playerId);
      const team = (state.data.teams || []).find((t) => t.id === me?.teamId);
      rows.push({ seasonId: "current", label: first.season || "", teamId: me?.teamId || null, teamName: team?.name || "—", current: true, games: st.games, goals: st.goals, assists: st.assists, yellows: st.yellows, reds: st.reds, mvps: st.mvps });
    }
  }
  const totals = rows.reduce((t, r) => add(t, r), blank());
  return { rows, totals };
}
