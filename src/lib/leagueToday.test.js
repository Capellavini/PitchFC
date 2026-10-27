import test from "node:test";
import assert from "node:assert/strict";
import { buildLeagueDemoSeed, deriveLeague, teamById } from "./leagueDemo.js";
import { leagueToday, roundRecapText } from "./leagueToday.js";

const seed = () => { const state = buildLeagueDemoSeed(); return { state, derived: deriveLeague(state) }; };

test("current round surfaces contest then homologation, in urgency order", () => {
  const { state, derived } = seed();
  const today = leagueToday(state, derived);
  assert.equal(today.round, 2);
  assert.equal(today.total, 3);
  assert.equal(today.official, 1);
  assert.equal(today.done, false);
  const kinds = today.items.map((i) => i.kind);
  assert.ok(kinds.indexOf("contest") < kinds.indexOf("homologate"));
  assert.equal(today.items.find((i) => i.kind === "contest").matchId, "m6");
  assert.equal(today.items.find((i) => i.kind === "homologate").matchId, "m4");
});

test("a scheduled match with no call-up asks for it, once per team", () => {
  const { state, derived } = seed();
  const moved = { ...state, matches: state.matches.map((m) => (m.round === 3 ? m : { ...m, state: "homologated" })) };
  const today = leagueToday(moved, deriveLeague(moved));
  assert.equal(today.round, 3);
  const lineups = today.items.filter((i) => i.kind === "lineup");
  assert.equal(lineups.length, 6); // 3 matches × 2 teams, none called up in the seed
  assert.equal(new Set(lineups.map((i) => i.key)).size, 6);
  assert.ok(derived);
});

test("a suspended athlete in a call-up is flagged", () => {
  const { state } = seed();
  const m = state.matches.find((x) => x.round === 3);
  const lineupId = "t3p2"; // sent off in m3 → suspension still pending
  const withLineup = { ...state, matches: state.matches.map((x) => (x.round !== 3 ? { ...x, state: "homologated" } : x.id === m.id ? { ...x, lineups: { [x.homeId]: [lineupId], [x.awayId]: ["z"] } } : x)) };
  const derived = deriveLeague(withLineup);
  const flagged = leagueToday(withLineup, derived).items.filter((i) => i.kind === "suspended");
  const suspendedNow = Object.values(derived.discipline).some((d) => d.playerId === lineupId && d.pending > 0);
  assert.equal(flagged.length > 0, suspendedNow && [m.homeId, m.awayId].includes("t3"));
});

test("a finished round is done and the recap lists only official results", () => {
  const { state, derived } = seed();
  const today = leagueToday({ ...state, matches: state.matches.filter((m) => m.round === 1) }, derived);
  assert.equal(today.done, true);
  const text = roundRecapText({ round: 1, matches: state.matches, scores: derived.scores, teamById, leagueName: "Liga" });
  assert.match(text, /Jornada 1/);
  assert.equal(text.split("\n").filter((l) => /\d–\d/.test(l)).length, 3);
  assert.equal(roundRecapText({ round: 2, matches: state.matches.filter((m) => !["m5"].includes(m.id) && m.round === 2), scores: derived.scores, teamById, leagueName: "Liga" }), "");
});
