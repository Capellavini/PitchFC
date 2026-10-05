// Season ranking formulas — one source of truth for Competir's Leaderboard
// and the compare-players screen (formerly all inline in StatsTab).
// Everything here is derived from data PitchApp already has (CLAUDE.md:
// compute, don't store): `group` rows carry season totals (goals, assists,
// mvps, wins, cleanSheets, epicSaves, gamesPlayed, position, attrs,
// ratingsCount), and `matchdaySummaries` is newest-first
// [{ date, summary: { lines, matches, teamResults } }].
import { computeOverall } from "./overall.js";

/** Goals from further off the pitch are rarer and count for more — a
 *  Guarda-redes goal is a story, an Avançado goal is the job. */
export const GOAL_WEIGHT = { "Avançado": 2, "Médio": 2.5, "Defesa": 3, "Guarda-redes": 4 };
const goalWeight = (p) => GOAL_WEIGHT[p.position] ?? 2;

export const playerKey = (p) => p.uuid ?? p.id;

/** Impacto — weighted composite: position-weighted goals, 1/assist,
 *  1/win, 3/MVP, 1/clean sheet. */
export const impactoOf = (p) =>
  (p.goals || 0) * goalWeight(p) + (p.assists || 0) + (p.wins || 0) + (p.mvps || 0) * 3 + (p.cleanSheets || 0);

/** Guarda-redes score — clean sheets ×3 + great saves. Not restricted to
 *  the position field: the GR rotates match to match, so it ranks whoever
 *  actually kept. */
export const gkScoreOf = (p) => (p.cleanSheets || 0) * 3 + (p.epicSaves || 0);

/** Fiabilidade % = matchdays played / matchdays the group held. */
export const reliabilityOf = (p, seasonDays) =>
  seasonDays ? Math.min(100, Math.round(((p.gamesPlayed || 0) / seasonDays) * 100)) : 0;

/** Forma — Impacto windowed to the last 5 days actually played (minus the
 *  MVP term, which lives outside the day summaries). */
export const recentDaysOf = (matchdaySummaries = []) => matchdaySummaries.slice(0, 5);

export function formaOf(p, recentDays) {
  const key = playerKey(p);
  return recentDays.reduce((sum, md) => {
    const line = (md.summary?.lines || []).find((l) => l.key === key);
    if (!line) return sum;
    return sum + (line.goals || 0) * goalWeight(p) + (line.assists || 0) + (line.wins || 0) + (line.cleanSheets || 0);
  }, 0);
}

/** 🔥 "Em fogo": recent per-day Forma ≥ 1.3× the season per-day Impacto. */
export function isHot(p, recentDays) {
  const key = playerKey(p);
  const seasonPerDay = (p.gamesPlayed || 0) > 0 ? impactoOf(p) / p.gamesPlayed : 0;
  const recentGames = recentDays.filter((md) => (md.summary?.lines || []).some((l) => l.key === key)).length;
  if (!recentGames || !seasonPerDay) return false;
  return formaOf(p, recentDays) / recentGames >= seasonPerDay * 1.3;
}

/** Players with a meaningful peer-rated OVR (3+ ratings, or no count known). */
export const ratedPlayers = (group) => group.filter((p) => !(p.ratingsCount != null && p.ratingsCount < 3));

/** Sobre-entrega: percentile by Impacto minus percentile by OVR, within
 *  the rated players. Returns a value function (p) => signed %. */
export function performanceGapFn(group) {
  const rated = ratedPlayers(group);
  const percentileRank = (list, valueOf) => {
    const sorted = [...list].sort((a, b) => valueOf(a) - valueOf(b));
    const pct = {};
    sorted.forEach((p, i) => { pct[p.id] = sorted.length > 1 ? (i / (sorted.length - 1)) * 100 : 50; });
    return pct;
  };
  const ovrPct = percentileRank(rated, (p) => computeOverall(p.position, p.attrs));
  const impactoPct = percentileRank(rated, impactoOf);
  return (p) => Math.round((impactoPct[p.id] ?? 0) - (ovrPct[p.id] ?? 0));
}

/** Weekly podium of one matchday — its top 3 contributors. summary.lines
 *  is already sorted (goals×2 + assists) by endMatchday; anyone with no
 *  goal, assist or clean sheet is left off. Shared by Competir's
 *  WeeklyPodium and Home's "podium" feed item. */
export function podiumTop3(lines = []) {
  return (lines || []).filter((l) => (l.goals || 0) + (l.assists || 0) + (l.cleanSheets || 0) > 0).slice(0, 3);
}

/** "Jogaram juntos": every selected key on the same team the same day.
 *  Only matchdays that snapshot rosters in teamResults can match. */
export function togetherStats(keys, matchdaySummaries = []) {
  let gamesTogether = 0, winsTogether = 0, goalsFor = 0, goalsAgainst = 0;
  matchdaySummaries.forEach((md) => {
    const team = (md.summary?.teamResults || []).find((tm) => keys.every((k) => tm.players?.includes(k)));
    if (!team) return;
    (md.summary?.matches || []).forEach((m) => {
      if (m.homeName === team.name) { gamesTogether++; goalsFor += m.homeGoals; goalsAgainst += m.awayGoals; }
      else if (m.awayName === team.name) { gamesTogether++; goalsFor += m.awayGoals; goalsAgainst += m.homeGoals; }
    });
    winsTogether += team.wins || 0;
  });
  return { gamesTogether, winsTogether, goalsFor, goalsAgainst };
}

/** Per-day team records (teams are redrawn every matchday, so there's no
 *  season team table): one row per team per day with goals for/against. */
export function dayTeamRows(matchdaySummaries = []) {
  const rows = [];
  matchdaySummaries.forEach((md) => {
    const colorByName = {};
    (md.summary?.teamResults ?? []).forEach((tr) => { colorByName[tr.name] = tr.color; });
    const byTeam = {};
    (md.summary?.matches ?? []).forEach((m) => {
      if (m.homeName && m.homeName !== "—") {
        byTeam[m.homeName] = byTeam[m.homeName] || { gf: 0, ga: 0 };
        byTeam[m.homeName].gf += m.homeGoals; byTeam[m.homeName].ga += m.awayGoals;
      }
      if (m.awayName && m.awayName !== "—") {
        byTeam[m.awayName] = byTeam[m.awayName] || { gf: 0, ga: 0 };
        byTeam[m.awayName].gf += m.awayGoals; byTeam[m.awayName].ga += m.homeGoals;
      }
    });
    Object.entries(byTeam).forEach(([name, s]) => rows.push({ name, date: md.date, color: colorByName[name] || null, ...s }));
  });
  return rows;
}
