// Pitch Manager in Ligas: league data → engine summary → the SAME engine
// (core/fantasyRules.js). Uses the real demo seed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leagueRounds, fantasyAthletes } from "./leagueFantasy.js";
import { buildLeagueDemoSeed, PLAYERS, TEAMS, POSITION_FULL, LEAGUE_FANTASY } from "./leagueDemo.js";
import { transition, appendEvent } from "./core/league.js";
import { scoreLineupWithConnection, connectionBonus, playerNightPoints, nightFacts, ownershipCap } from "./core/fantasyRules.js";

const seed = buildLeagueDemoSeed();
const rounds = leagueRounds({ matches: seed.matches, logs: seed.logs, players: PLAYERS, teams: TEAMS });
const positions = Object.fromEntries(PLAYERS.map((p) => [p.id, POSITION_FULL[p.position]]));
const r1 = rounds.find((r) => r.round === 1);

test("only a round whose matches are ALL official scores", () => {
  assert.deepEqual(rounds.map((r) => [r.round, r.official]), [[1, true], [2, false], [3, false]]);
  assert.deepEqual(r1.matchIds, ["m1", "m2", "m3"]);
});

test("events keep league ids, corrections are applied and non-engine events are left out", () => {
  const m1 = r1.summary.matches[0];
  const goals = m1.events.filter((e) => e.type === "goal");
  // the 38' goal was corrected to t1p8 (ast t1p7); the wrong t1p6 event is gone
  assert.ok(goals.some((e) => e.by === "t1p8" && e.ast === "t1p7" && e.min === 38));
  assert.ok(!goals.some((e) => e.by === "t1p6"));
  assert.ok(m1.events.every((e) => typeof e.id === "string" && e.id.startsWith("seed-")));
  // own goal credited to the benefiting side (Marés = home), cards never become events
  const og = m1.events.find((e) => e.type === "og");
  assert.deepEqual([og.by, og.side], ["t6p2", "h"]);
  assert.equal(m1.events.some((e) => e.type === "card_yellow"), false);
  // the unknown scorer stays unknown (m2, 21')
  assert.ok(r1.summary.matches[1].events.some((e) => e.by === null && e.min === 21));
  assert.deepEqual([m1.homeGoals, m1.awayGoals], [3, 1]);
  assert.equal(m1.homeGk, "t1p1");
});

test("the engine scores a league round: lineup + Conexão (9 → 11 from the corrected goal)", () => {
  const f = nightFacts(r1.summary);
  assert.ok(f.appeared.includes("t1p8") && f.appeared.includes("t5p8"));
  const my = LEAGUE_FANTASY.mySquad;
  const lineup = { starters: my.player_ids.filter((id) => !my.reserve_ids.includes(id)), bench: my.reserve_ids, captain: my.captain_id, vice: my.vice_captain_id, transferCost: 0 };
  const plain = scoreLineupWithConnection(lineup, r1.summary, positions);
  assert.equal(plain.connection.status, "none");
  const withPair = scoreLineupWithConnection({ ...lineup, connection: { creator: "t1p7", finisher: "t1p8" } }, r1.summary, positions);
  assert.equal(withPair.connection.status, "activated");
  assert.equal(withPair.connection.points, 3);
  assert.equal(withPair.total, plain.total + 3);
  assert.equal(withPair.connection.awardedEventIds.length, 1);
  // a goal by t1p7 assisted by t1p4 is a different pair → not inferred from the first
  assert.equal(connectionBonus({ creator: "t1p8", finisher: "t1p7" }, lineup.starters, r1.summary).points, 0);
});

test("a goal's points use the Pitch Manager table by position, not the old preview's", () => {
  // t1p7 (AVA): one goal (AVA 4) and one assist (AVA 3, the corrected 38' goal)
  const r = playerNightPoints("t1p7", r1.summary, positions.t1p7, {});
  assert.equal(r.items.goals.n, 1);
  assert.equal(r.items.goals.pts, 4);
  assert.equal(r.items.assists.n, 1);
  assert.equal(r.items.assists.pts, 3);
});

test("homologating round 2 makes it score, and a correction changes the result (no stored totals)", () => {
  let matches = seed.matches;
  const manager = { role: "manager", by: "Gestor", at: "2026-10-12T10:00:00.000Z" };
  for (const id of ["m4", "m6"]) matches = matches.map((m) => (m.id === id ? transition(m, "homologated", manager) : m));
  const after = leagueRounds({ matches, logs: seed.logs, players: PLAYERS, teams: TEAMS });
  assert.equal(after.find((r) => r.round === 2).official, true);
  assert.equal(after.find((r) => r.round === 2).summary.matches.length, 3);
  // a correction appended to m5's log changes that round's facts
  const logs = { ...seed.logs, m5: appendEvent(seed.logs.m5, { id: "fix-1", matchId: "m5", type: "goal", teamId: "t6", playerId: "t6p8", assistId: null, minute: 50, recordedBy: "t", recordedAt: "2026-10-12T10:00:00.000Z" }) };
  const fixed = leagueRounds({ matches, logs, players: PLAYERS, teams: TEAMS }).find((r) => r.round === 2);
  assert.equal(fixed.summary.lines.find((l) => l.key === "t6p8").goals, 1);
});

test("athletes come out in the shape the Pitch Manager UI reads", () => {
  const a = fantasyAthletes(PLAYERS, TEAMS, { t1p7: { goals: 2, assists: 0, mvps: 1, games: 2 } });
  const p = a.find((x) => x.uuid === "t1p7");
  assert.deepEqual([p.position, p.club, p.teamShort, p.goals, p.mvps, p.gamesPlayed], ["Avançado", "Marés FC", "MAR", 2, 1, 2]);
  assert.ok(a.every((x) => x.attrs && x.nick));
});

test("seed squads respect the ownership cap of a 6-manager league", () => {
  const cap = ownershipCap(LEAGUE_FANTASY.managers.length + 1);
  const counts = {};
  for (const ids of [LEAGUE_FANTASY.mySquad.player_ids, ...LEAGUE_FANTASY.managers.map((m) => m.player_ids)]) for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= cap, JSON.stringify(counts));
  assert.ok(Object.keys(counts).every((id) => PLAYERS.some((p) => p.id === id)));
});
