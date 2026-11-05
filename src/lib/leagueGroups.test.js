import test from "node:test";
import assert from "node:assert/strict";
import { openRounds } from "./leagueGroups.js";
import { fmtKickoff } from "./leagueDemo.js";

const round = (n, states) => ({ round: n, matches: states.map((state, i) => ({ id: `${n}-${i}`, state })) });
const season = (done) => Array.from({ length: 38 }, (_, i) => round(i + 1, Array(10).fill(i < done ? "homologated" : "scheduled")));

test("a short competition opens every round", () => {
  const r = Array.from({ length: 6 }, (_, i) => round(i + 1, ["scheduled"]));
  assert.equal(openRounds(r).size, 6);
});

test("a long season opens only the first round that still has something to settle", () => {
  assert.deepEqual([...openRounds(season(11))], [12]);
  assert.deepEqual([...openRounds(season(0))], [1]);
});

test("a finished season opens its last round", () => {
  assert.deepEqual([...openRounds(season(38))], [38]);
});

test("a round with a single unsettled match is the one to open", () => {
  const r = season(20);
  r[4].matches[3].state = "ended_provisional";
  assert.deepEqual([...openRounds(r)], [5]);
});

test("fmtKickoff gives the same text on repeated calls (formatter cache) and per language", () => {
  const iso = "2026-11-28T15:00:00.000Z";
  const a = fmtKickoff(iso, "pt");
  assert.equal(fmtKickoff(iso, "pt"), a);
  assert.notEqual(fmtKickoff(iso, "en"), a);
  assert.equal(fmtKickoff("lixo", "pt"), "lixo");
});
