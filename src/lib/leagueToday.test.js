import test from "node:test";
import assert from "node:assert/strict";
import { loadExample, deriveLeague, teamById, COMPETITION, CUP } from "./leagueDemo.js";
import { leagueToday, roundRecapText } from "./leagueToday.js";

const seed = () => { const state = loadExample(); return { state, derived: deriveLeague(state) }; };
const section = (today, id) => today.sections.find((s) => s.competition.id === id);

test("the league runs two competitions and each has its own current round", () => {
  const { state, derived } = seed();
  const today = leagueToday(state, derived);
  assert.deepEqual(today.sections.map((s) => s.competition.id), [COMPETITION.id, CUP.id]);
  const league = section(today, COMPETITION.id);
  assert.equal(league.round, 2);
  assert.equal(league.total, 3);
  assert.equal(league.official, 1);
  const cup = section(today, CUP.id);
  assert.equal(cup.roundName, "Meias-finais");
  assert.equal(cup.total, 2);
  assert.equal(cup.official, 0);
});

test("the merged queue is ordered by urgency and tagged with its competition", () => {
  const { state, derived } = seed();
  const { items } = leagueToday(state, derived);
  const kinds = items.map((i) => i.kind);
  assert.ok(kinds.indexOf("contest") < kinds.indexOf("homologate"));
  assert.equal(items.find((i) => i.kind === "contest").matchId, "m6");
  const cupResult = items.find((i) => i.kind === "homologate" && i.matchId === "c1");
  assert.equal(cupResult.competitionId, CUP.id);
  assert.ok(items.every((i) => i.competitionId));
});

test("scope narrows the queue to one competition", () => {
  const { state, derived } = seed();
  const cupOnly = leagueToday(state, derived, { scope: CUP.id });
  assert.deepEqual(cupOnly.sections.map((s) => s.competition.id), [CUP.id]);
  assert.ok(cupOnly.items.every((i) => i.competitionId === CUP.id));
  assert.ok(cupOnly.items.some((i) => i.kind === "homologate" && i.matchId === "c1"));
});

test("the league table ignores cup matches", () => {
  const { derived } = seed();
  // 4 league games are official after round 2 (m1, m2, m3, m5): 2 appearances each. The cup adds none.
  assert.equal(derived.table.reduce((n, r) => n + r.j, 0), 8);
});

test("a scheduled match with no call-up asks for it, once per team", () => {
  const { state } = seed();
  const moved = { ...state, matches: state.matches.map((m) => (m.round === 3 || m.competitionId === CUP.id ? m : { ...m, state: "homologated" })) };
  const today = leagueToday(moved, deriveLeague(moved), { scope: COMPETITION.id });
  assert.equal(section(today, COMPETITION.id).round, 3);
  const lineups = today.items.filter((i) => i.kind === "lineup");
  assert.equal(lineups.length, 6); // 3 matches × 2 teams, none called up in the seed
  assert.equal(new Set(lineups.map((i) => i.key)).size, 6);
});

test("a finished round is done and the recap lists only official results of that competition", () => {
  const { state, derived } = seed();
  const round1 = { ...state, matches: state.matches.filter((m) => m.competitionId === COMPETITION.id && m.round === 1) };
  const today = leagueToday(round1, derived);
  assert.equal(today.done, true);
  const text = roundRecapText({ round: 1, matches: state.matches, scores: derived.scores, teamById, leagueName: "Liga", competitionId: COMPETITION.id });
  assert.match(text, /Jornada 1/);
  assert.equal(text.split("\n").filter((l) => /\d–\d/.test(l)).length, 3);
  // the cup semi-final is provisional → not in any recap yet
  assert.equal(roundRecapText({ round: 1, matches: state.matches, scores: derived.scores, teamById, leagueName: "Liga", competitionId: CUP.id }), "");
});
