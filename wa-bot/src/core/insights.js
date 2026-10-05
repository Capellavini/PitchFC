// GENERATED from src/lib/core — do not edit; run npm run sync:core
// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// Numbers-only insights about a team proposal and confirmation habits.
// No prose here: callers (the app, the WhatsApp Treinador Adjunto) turn
// these records into text, so every number shown comes from code.
import { ovrOf } from "./overall.js";
import { playerKey, togetherStats, isHot, recentDaysOf } from "./rankings.js";
import { ovrSpread } from "./teamDraw.js";

/** Insights for drawn teams ([{ id, name, players: [id] }]).
 *  playersById: Map/object id → player (app shape: { id, uuid, position,
 *  attrs, …season totals }). summaries: newest-first [{ date, summary }].
 *  Returns records:
 *   { kind: "together", teamId, a, b, games, wins }   same team, ≥minGames together, win rate ≥ minWinRate
 *   { kind: "hot", teamId, id }                         rankings.isHot
 *   { kind: "gk_missing", teamId }                      no Guarda-redes on a team (only if someone is a GR)
 *   { kind: "ovr_gap", spread }                         max − min team OVR (1 decimal), always present */
export function teamInsights(teams, playersById, summaries = [], { minGames = 4, minWinRate = 0.75 } = {}) {
  const get = playersById instanceof Map ? (id) => playersById.get(id) : (id) => playersById?.[id];
  const out = [];
  const recent = recentDaysOf(summaries);
  const anyGk = teams.some((t) => t.players.some((id) => get(id)?.position === "Guarda-redes"));
  for (const t of teams) {
    const ps = t.players.map(get).filter(Boolean);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const s = togetherStats([playerKey(ps[i]), playerKey(ps[j])], summaries);
        if (s.gamesTogether >= minGames && s.winsTogether / s.gamesTogether >= minWinRate) {
          out.push({ kind: "together", teamId: t.id, a: ps[i].id, b: ps[j].id, games: s.gamesTogether, wins: s.winsTogether });
        }
      }
    }
    for (const p of ps) if (isHot(p, recent)) out.push({ kind: "hot", teamId: t.id, id: p.id });
    if (anyGk && ps.length && !ps.some((p) => p.position === "Guarda-redes")) out.push({ kind: "gk_missing", teamId: t.id });
  }
  out.push({ kind: "ovr_gap", spread: Math.round(ovrSpread(teams, get) * 10) / 10 });
  return out;
}

/** Display OVR of one player: { ovr, rated } — rated = 3+ peer ratings
 *  (or no count known, like rankings.ratedPlayers). Unrated shows "70?". */
export function displayOvr(p) {
  return { ovr: ovrOf(p), rated: !(p?.ratingsCount != null && p.ratingsCount < 3) };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** "Who usually confirms late", from attendance_log rows
 *  [{ player_id, cycle_opened_at, status, at, kickoff }].
 *  A cycle = distinct (cycle_opened_at ?? kickoff). Each player's FIRST
 *  confirmation per cycle counts. late = confirmed < lateHours before
 *  kickoff. Fewer than minCycles logged → { insufficient: true, cycles }.
 *  Otherwise { insufficient: false, cycles, rows: [{ playerId,
 *  medianHoursBefore, latePct, confirmations }] } sorted latest first,
 *  only players with ≥2 confirmations. */
export function lateConfirmers(log = [], { minCycles = 3, lateHours = 24 } = {}) {
  const cycleOf = (r) => String(r.cycle_opened_at ?? r.kickoff ?? "");
  const cycles = new Set(log.map(cycleOf).filter(Boolean));
  if (cycles.size < minCycles) return { insufficient: true, cycles: cycles.size };
  const first = new Map(); // player|cycle -> row
  for (const r of log) {
    if (r.status !== "confirmed" || !r.kickoff) continue;
    const k = `${r.player_id}|${cycleOf(r)}`;
    const prev = first.get(k);
    if (!prev || new Date(r.at) < new Date(prev.at)) first.set(k, r);
  }
  const byPlayer = new Map();
  for (const r of first.values()) {
    const h = (new Date(r.kickoff) - new Date(r.at)) / 36e5;
    if (!byPlayer.has(r.player_id)) byPlayer.set(r.player_id, []);
    byPlayer.get(r.player_id).push(h);
  }
  const rows = [...byPlayer.entries()]
    .filter(([, hs]) => hs.length >= 2)
    .map(([playerId, hs]) => ({
      playerId,
      medianHoursBefore: Math.round(median(hs)),
      latePct: Math.round((hs.filter((h) => h < lateHours).length / hs.length) * 100),
      confirmations: hs.length,
    }))
    .sort((a, b) => a.medianHoursBefore - b.medianHoursBefore);
  return { insufficient: false, cycles: cycles.size, rows };
}
