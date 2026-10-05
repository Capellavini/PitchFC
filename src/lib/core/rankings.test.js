// node --test src/lib/core/rankings.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rankings from "./rankings.js";
import { computeOverall, ovrOf } from "./overall.js";
import { hashId } from "./ids.js";
import { rankingsSnapshot } from "./fixtures/snapshot.js";
import { ROSTER, SUMMARIES } from "./fixtures/fixtures.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/golden.json", import.meta.url), "utf8"));

test("regression: identical output to the pre-refactor src/lib/rankings.js", () => {
  assert.deepEqual(rankingsSnapshot(rankings), golden.rankings);
});

test("spot checks on the fixture roster", () => {
  const joao = ROSTER.find((p) => p.id === 2);
  // 21 goals × 2 (Avançado) + 5 assists + 10 wins + 5 MVP × 3
  assert.equal(rankings.impactoOf(joao), 42 + 5 + 10 + 15);
  assert.equal(rankings.gkScoreOf(ROSTER.find((p) => p.id === 4)), 6 * 3 + 9);
  assert.equal(rankings.reliabilityOf(joao, 20), 75);
  assert.deepEqual(rankings.ratedPlayers(ROSTER).map((p) => p.id), [1, 2, 3, 4, 6, 7, 9, 10, 11]);
  assert.deepEqual(rankings.togetherStats([1, 2], SUMMARIES), { gamesTogether: 4, winsTogether: 2, goalsFor: 6, goalsAgainst: 4 });
  assert.equal(rankings.podiumTop3(SUMMARIES[0].summary.lines).length, 3);
});

test("computeOverall: weights, GK set, missing attrs default to 60", () => {
  assert.equal(computeOverall("Avançado", { rit: 89, rem: 94, pas: 78, dri: 88, def: 45, fis: 85 }), 87);
  assert.equal(computeOverall("Guarda-redes", undefined), 60);
  assert.equal(computeOverall("???", { pas: 100, dri: 100, rit: 100, fis: 100, rem: 100, def: 100 }), 100);
  assert.equal(ovrOf({ position: "Médio" }), 60);
});

test("hashId: stable unsigned 32-bit int", () => {
  const id = hashId("3f8b2a10-1234-4abc-9def-0123456789ab");
  assert.equal(id, hashId("3f8b2a10-1234-4abc-9def-0123456789ab"));
  assert.ok(Number.isInteger(id) && id >= 0 && id < 2 ** 32);
  assert.equal(hashId(""), 0);
  assert.equal(hashId("a"), 97);
});
