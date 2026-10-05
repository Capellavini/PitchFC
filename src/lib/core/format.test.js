// node --test src/lib/core/format.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFormat, validateFormat, toMatchdayStart, describeFormat, FORMAT_TYPES } from "./format.js";

test("defaults are valid for every type, and have no season league (decision 2)", () => {
  for (const t of FORMAT_TYPES) {
    const f = defaultFormat(t);
    assert.equal(validateFormat(f).ok, true, t);
    assert.equal("season" in f, false);
    assert.equal(f.type, t);
  }
});

test("validateFormat: rejects non-objects and missing/unknown type", () => {
  assert.deepEqual(validateFormat(null).errors, ["not_object"]);
  assert.deepEqual(validateFormat({ v: 1 }).errors, ["bad_type"]);
  assert.deepEqual(validateFormat({ type: "league" }).errors, ["bad_type"]);
});

test("validateFormat: fills defaults, flags wrong values", () => {
  const r = validateFormat({ type: "custom", night: { teams: 4 } });
  assert.equal(r.ok, true);
  assert.equal(r.format.night.playersPerTeam, 5);
  assert.equal(r.format.night.teams, 4);
  const bad = validateFormat({ type: "custom", night: { teams: 9, schedule: "chaos" }, points: { win: 1, draw: 3, loss: 0 }, tiebreakers: ["pts", "pts"] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes("night.teams"));
  assert.ok(bad.errors.includes("night.schedule"));
  assert.ok(bad.errors.includes("points.order"));
  assert.ok(bad.errors.includes("tiebreakers"));
});

test("validateFormat: fixed schedule needs fixedGames; qualifiers ≤ teams", () => {
  assert.ok(validateFormat({ type: "custom", night: { schedule: "fixed" } }).errors.includes("night.fixedGames"));
  assert.ok(validateFormat({ type: "custom", night: { teams: 2 }, playoffs: { enabled: true, qualifiers: 4 } }).errors.includes("playoffs.qualifiers"));
});

test("toMatchdayStart mapping", () => {
  assert.deepEqual(toMatchdayStart(defaultFormat("avulso")), { mode: "avulsa" });
  const c = toMatchdayStart(defaultFormat("campeonato"));
  assert.equal(c.mode, "campeonato");
  assert.deepEqual(c.config.points, { win: 3, draw: 1, loss: 0 });
  const f = defaultFormat("custom");
  f.night.legs = 2; f.playoffs = { enabled: true, qualifiers: 4, byeTop: false, thirdPlace: true, penalties: true };
  f.night.teams = 4;
  const p = toMatchdayStart(f);
  assert.equal(p.mode, "personalizado");
  assert.equal(p.config.confrontos, "idaEVolta");
  assert.equal(p.config.faseFinal, true);
  assert.equal(p.config.finalistas, 4);
  assert.equal(p.config.thirdPlace, true);
  assert.deepEqual(toMatchdayStart({ type: "nope" }), { mode: "avulsa" });
});

test("describeFormat per language", () => {
  const f = defaultFormat("custom");
  f.night = { ...f.night, teams: 4, schedule: "round_robin" };
  f.playoffs = { enabled: true, qualifiers: 4, byeTop: false, thirdPlace: true, penalties: true };
  const pt = describeFormat(f, "pt");
  assert.match(pt, /Personalizado · 4 equipas de 5 · todos contra todos \(1 volta\) · jogos de 10 min · 3\/1\/0/);
  assert.match(pt, /desempate: DG, GM, confronto direto/);
  assert.match(pt, /meias-finais entre os 4 \+ 3\.º lugar/);
  assert.match(describeFormat(f, "ptbr"), /4 times de 5/);
  assert.match(describeFormat(f, "en"), /4 teams of 5 · round robin/);
  assert.match(describeFormat(defaultFormat("campeonato"), "pt"), /tabela da noite \(recomeça todas as semanas\)/);
  assert.equal(describeFormat({ type: "x" }), "—");
});
