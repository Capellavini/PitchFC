import test from "node:test";
import assert from "node:assert/strict";
import { leagueFantasyStanding } from "./leagueFantasy.js";

const built = (scores, me = "me", picked = 6) => ({
  me: { uuid: me },
  mySquad: { player_ids: Array.from({ length: picked }, (_, i) => `p${i}`) },
  seed: { squadSize: 6 },
  demo: { fantasyScores: scores.map(([participant_id, points]) => ({ participant_id, points })) },
});

test("standing: nobody has scored yet → no rank, nobody in the field", () => {
  assert.deepEqual(leagueFantasyStanding(built([])), { picked: true, points: 0, rank: null, of: 0 });
});

test("standing: the manager is ranked among everyone who scored", () => {
  const s = leagueFantasyStanding(built([["me", 12], ["a", 20], ["b", 5]]));
  assert.equal(s.rank, 2);
  assert.equal(s.of, 3);
  assert.equal(s.points, 12);
});

test("standing: a manager with no points still counts in the field (never '2.º de 1')", () => {
  const s = leagueFantasyStanding(built([["a", 20]]));
  assert.equal(s.points, 0);
  assert.equal(s.rank, 2);
  assert.equal(s.of, 2);
  assert.ok(s.rank <= s.of);
});

test("standing: an incomplete squad is reported as not picked", () => {
  assert.equal(leagueFantasyStanding(built([["a", 1]], "me", 3)).picked, false);
});
