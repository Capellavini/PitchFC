// PITCH Ligas — the Supertaça: last season's league champion against last season's cup winner, one game, played at the
// start of the new season. Proposed from the archive (the champions the direction confirmed when closing); if one team won
// both, the league's runner-up takes the other place.
import { addCompetition, addMatch, SetupError } from "./leagueSetup.js";

const latest = (state) => (state.data.seasons || []).slice().sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)))[0] || null;

/** { seasonId, seasonLabel, homeId, awayId, runnerUp } or null (no closed season, no cup, no champions, a Supertaça already created). */
export function supercupProposal(state) {
  const s = latest(state);
  if (!s) return null;
  const comps = state.data.competitions || [];
  if (!comps.some((c) => !c.closedSeasonId)) return null; // the new season has to exist
  if (comps.some((c) => c.supercupOf === s.id)) return null;
  const league = (s.competitions || []).find((c) => c.kind !== "cup" && c.champion);
  const cup = (s.competitions || []).find((c) => c.kind === "cup" && c.champion && c.champion.teamId);
  if (!league || !cup) return null;
  const has = (id) => (state.data.teams || []).some((t) => t.id === id);
  let away = cup.champion.teamId; let runnerUp = false;
  if (away === league.champion.teamId) {
    away = (league.table || []).find((r) => r.teamId !== league.champion.teamId)?.teamId || null;
    runnerUp = true;
  }
  if (!away || !has(league.champion.teamId) || !has(away)) return null;
  return { seasonId: s.id, seasonLabel: s.label, homeId: league.champion.teamId, awayId: away, runnerUp };
}

/** Creates the Supertaça as a one-game cup of the new season. */
export function createSupercup(state, { date, time = "20:00", venue = "" } = {}) {
  const p = supercupProposal(state);
  if (!p) throw new SetupError("nothing_to_add");
  const open = (state.data.competitions || []).filter((c) => !c.closedSeasonId);
  const season = open[0]?.season || "";
  let next = addCompetition(state, { name: `Supertaça ${season}`.trim(), short: "Supertaça", kind: "cup", season });
  const comp = next.data.competitions[next.data.competitions.length - 1];
  next = { ...next, data: { ...next.data, competitions: next.data.competitions.map((c) => (c.id === comp.id ? { ...c, supercupOf: p.seasonId } : c)) } };
  return addMatch(next, { competitionId: comp.id, homeId: p.homeId, awayId: p.awayId, date, time, venue, round: 1, roundName: "Supertaça" });
}
