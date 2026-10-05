// node --test src/lib/core/standings.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as core from "./standings.js";
import { standingsSnapshot } from "./fixtures/snapshot.js";
import { MATCH_SETS, TEAM_IDS_3, TEAMS_3 } from "./fixtures/fixtures.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/golden.json", import.meta.url), "utf8"));

// The app's tournament.js / matchdayLive.js now delegate here; rebuild
// their old API on top of core exactly like the wrappers do.
const tournament = {
  computeStandings: (ids, matches) => core.computeTable(ids, matches),
  roundRobinFixtures: core.roundRobinFixtures,
  buildKnockoutRound1: core.buildKnockoutRound1,
  nextKnockoutRound: core.nextKnockoutRound,
  matchWinner: core.matchWinner,
};
const live = {
  goalsOf: core.goalsOf,
  playoffState: core.playoffState,
  standings: (teams, matches) => core.computeTable(teams, matches.filter((m) => m.stage !== "playoff" && !m.isBye)),
};

test("regression: identical output to the pre-refactor tournament/matchdayLive functions", () => {
  assert.deepEqual(standingsSnapshot({ tournament, live }), golden.standings);
});

test("regression: the app's own src/lib/tournament.js wrapper matches too", async () => {
  const appTournament = await import("../tournament.js");
  assert.deepEqual(standingsSnapshot({ tournament: appTournament, live }), golden.standings);
});

const goal = (teamId) => ({ teamId, scorerId: 1 });
const m = (homeId, awayId, hg, ag) => ({ homeId, awayId, events: [...Array(hg)].map(() => goal(homeId)).concat([...Array(ag)].map(() => goal(awayId))) });

test("custom points (e.g. 2/1/0)", () => {
  const table = core.computeTable(["a", "b"], [m("a", "b", 1, 0), m("a", "b", 0, 0)], { points: { win: 2, draw: 1, loss: 0 } });
  assert.deepEqual(table.map((r) => [r.id, r.pts]), [["a", 3], ["b", 1]]);
});

test("h2h: tied on points, decided by the match between them (before gd)", () => {
  // a and b both on 4 pts; a beat b 1-0, but b has the better gd (5-0 over c).
  const two = [m("a", "b", 1, 0), m("b", "c", 5, 0), m("a", "c", 0, 1), m("b", "d", 0, 0), m("a", "d", 0, 0)];
  const h2h = core.computeTable(["a", "b", "c", "d"], two, { tiebreakers: ["pts", "h2h", "gd", "gf"] });
  const plain = core.computeTable(["a", "b", "c", "d"], two);
  assert.equal(h2h.find((r) => r.id === "a").pts, h2h.find((r) => r.id === "b").pts);
  assert.deepEqual(plain.slice(0, 2).map((r) => r.id), ["b", "a"]);
  assert.deepEqual(h2h.slice(0, 2).map((r) => r.id), ["a", "b"]);
});

test("wins and ga_fewest tiebreakers", () => {
  // a: W,L (3 pts, 1 win); b: D,D,D (3 pts, 0 wins)
  const matches = [m("a", "x", 2, 0), m("a", "y", 0, 3), m("b", "x", 0, 0), m("b", "y", 1, 1), m("b", "z", 0, 0)];
  // y: W + D = 4 pts on top; then a and b level on 3.
  const byWins = core.computeTable(["b", "a", "x", "y", "z"], matches, { tiebreakers: ["pts", "wins"] });
  assert.deepEqual(byWins.slice(0, 3).map((r) => r.id), ["y", "a", "b"]);
  const byGa = core.computeTable(["a", "b", "x", "y", "z"], matches, { tiebreakers: ["pts", "ga_fewest"] });
  assert.deepEqual(byGa.slice(0, 3).map((r) => r.id), ["y", "b", "a"]); // b conceded 1, a conceded 3
});

test("lots: deterministic for a seed, can differ across seeds", () => {
  const draw = (seed) => core.computeTable(TEAM_IDS_3, MATCH_SETS.deadlock, { tiebreakers: ["pts", "gd", "gf", "lots"], seed }).map((r) => r.id);
  assert.deepEqual(draw("2026-10-05"), draw("2026-10-05"));
  const orders = new Set(Array.from({ length: 20 }, (_, i) => draw(i).join()));
  assert.ok(orders.size > 1);
});

test("team objects carry their fields onto rows; unknown tiebreaker throws", () => {
  const rows = core.computeTable(TEAMS_3, MATCH_SETS.simple);
  assert.equal(rows.find((r) => r.id === "t1").name, "Coletes");
  assert.throws(() => core.computeTable(TEAM_IDS_3, MATCH_SETS.deadlock, { tiebreakers: ["pts", "nope"] }), /Unknown tiebreaker/);
});
