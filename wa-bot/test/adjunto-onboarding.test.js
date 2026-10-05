import { test } from "node:test";
import assert from "node:assert/strict";
import { start, step } from "../src/adjunto/onboarding.js";
import { validateFormat } from "../src/core/format.js";

/** Feed answers; returns the last result. */
function run(answers, lang = "pt") {
  let s = start(lang).state, r;
  for (const a of answers) { r = step(s, a, lang); s = r.state; }
  return r;
}

test("avulso goes straight to the summary, then saves", () => {
  const r = run(["1", "sim"]);
  assert.equal(r.done.type, "avulso");
  assert.equal(r.state, null);
  assert.equal(validateFormat(r.done).ok, true);
  assert.match(r.reply, /Formato guardado: 📐 Avulso/);
});

test("campeonato asks only points + tiebreakers (night table, no season league)", () => {
  let s = start().state;
  let r = step(s, "2", "pt"); assert.equal(r.state.step, "points");
  r = step(r.state, "3/1/0", "pt"); assert.equal(r.state.step, "tiebreakers");
  r = step(r.state, "ok", "pt"); assert.equal(r.state.step, "summary");
  assert.match(r.reply, /tabela da noite \(recomeça todas as semanas\)/);
  assert.doesNotMatch(r.reply, /época/);
  r = step(r.state, "sim", "pt");
  assert.equal(r.done.type, "campeonato");
  assert.equal("season" in r.done, false);
});

test("personalizado: every step, round robin, semis + 3rd place", () => {
  const r = run(["3", "4", "5", "1", "2", "12", "3 1 0", "3 1 2", "3", "sim", "não", "sim"]);
  assert.equal(r.done.type, "custom");
  assert.deepEqual(r.done.night, { teams: 4, playersPerTeam: 5, schedule: "round_robin", legs: 2, fixedGames: null, winnerStays: { maxConsecutive: 2, onDraw: "both_off" }, gameMinutes: 12, goalCap: null });
  assert.deepEqual(r.done.tiebreakers, ["pts", "h2h", "gd", "gf"]);
  assert.deepEqual(r.done.playoffs, { enabled: true, qualifiers: 4, byeTop: false, thirdPlace: true, penalties: false });
});

test("personalizado: winner stays asks max in a row + goal cap; fixed asks N", () => {
  const ws = run(["3", "ok", "ok", "2", "3", "8", "2", "ok", "ok", "1", "sim"]);
  assert.equal(ws.done.night.schedule, "winner_stays");
  assert.equal(ws.done.night.winnerStays.maxConsecutive, 3);
  assert.equal(ws.done.night.goalCap, 2);
  const fx = run(["3", "3", "5", "3", "6", "10", "ok", "ok", "1", "sim"]);
  assert.equal(fx.done.night.fixedGames, 6);
});

test("invalid input re-asks the same step (hint after 2 misses)", () => {
  let s = start().state;
  let r = step(s, "banana", "pt");
  assert.equal(r.invalid, true);
  assert.equal(r.state.step, "type");
  assert.match(r.reply, /^Não percebi/);
  r = step(r.state, "batata", "pt");
  assert.match(r.reply, /sair/);
  r = step(r.state, "3", "pt");
  r = step(r.state, "9", "pt"); // 9 teams: out of range
  assert.equal(r.state.step, "teams");
});

test("top-4 play-off impossible with 2 teams", () => {
  let s = start().state;
  for (const a of ["3", "2", "5", "4", "ok", "ok", "ok"]) s = step(s, a, "pt").state;
  assert.equal(s.step, "playoffs");
  const r = step(s, "3", "pt");
  assert.equal(r.invalid, true);
});

test("restart mid-way, summary 'não' restarts, 'sair' leaves", () => {
  let s = start().state;
  s = step(s, "3", "pt").state; s = step(s, "4", "pt").state;
  let r = step(s, "recomeçar", "pt");
  assert.equal(r.state.step, "type");
  assert.deepEqual(r.state.draft, {});
  r = run(["1", "não"]);
  assert.equal(r.state.step, "type");
  r = run(["3", "sair"]);
  assert.equal(r.state, null);
  assert.equal(r.done, null);
});

test("PT-BR and EN wording", () => {
  assert.match(start("ptbr").reply, /toda semana/);
  assert.match(step(start("en").state, "3", "en").reply, /How many teams/);
});
