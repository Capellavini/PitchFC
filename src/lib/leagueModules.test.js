import test from "node:test";
import assert from "node:assert/strict";
import { MODULES, defaultModules, normalizeModules, moduleOn, setModule, dependentsOn, CORE_FEATURES } from "./leagueModules.js";
import { fairPlayTable } from "./leagueFairPlay.js";
import { emptyLeagueState, normalizeLeagueState, modOn, installLeagueData, loadExample, competitionTitle, COMPETITIONS, TEAMS } from "./leagueDemo.js";

test("a league starts with the core and only the light modules on", () => {
  const d = defaultModules();
  assert.equal(d.adjunto, true);
  assert.equal(d.fans, true);
  for (const heavy of ["fantasy", "fan_vote", "tactics", "compare", "var", "ovr", "fairplay", "sponsors"]) assert.equal(d[heavy], false, heavy);
  assert.ok(CORE_FEATURES.length >= 6);
  assert.equal(new Set(MODULES.map((m) => m.id)).size, MODULES.length, "ids are unique");
});

test("normalizeModules ignores unknown ids and non-booleans", () => {
  const n = normalizeModules({ fantasy: true, nonsense: true, var: "yes" });
  assert.equal(n.fantasy, true);
  assert.equal(n.var, false);
  assert.equal("nonsense" in n, false);
  assert.deepEqual(normalizeModules(null), defaultModules());
});

test("a module that requires another is off while the other is off", () => {
  const on = { ...defaultModules(), fans: false, fantasy: true, fan_vote: true };
  assert.equal(moduleOn(on, "fantasy"), false);
  assert.equal(moduleOn(on, "fan_vote"), false);
  assert.equal(moduleOn({ ...on, fans: true }, "fantasy"), true);
  assert.equal(moduleOn(on, "does-not-exist"), false);
});

test("turning a module off also turns off what depends on it; turning one on pulls its requirement", () => {
  const start = setModule(defaultModules(), "fantasy", true);
  assert.equal(start.fantasy, true);
  assert.deepEqual(dependentsOn(start, "fans").sort(), ["fantasy"]);
  const off = setModule(start, "fans", false);
  assert.equal(off.fantasy, false);
  const back = setModule({ ...defaultModules(), fans: false }, "fan_vote", true);
  assert.equal(back.fans, true);
  assert.equal(back.fan_vote, true);
});

test("a new league is empty and the registry mirrors the state it loaded", () => {
  const empty = emptyLeagueState();
  assert.deepEqual([empty.matches.length, empty.data.teams.length, empty.data.players.length, empty.data.competitions.length], [0, 0, 0, 0]);
  normalizeLeagueState(empty);
  assert.equal(TEAMS.length, 0);
  assert.equal(COMPETITIONS.length, 0);
  assert.equal(modOn("fantasy"), false);
  loadExample();
  assert.ok(TEAMS.length > 0);
  assert.equal(modOn("fantasy"), true, "the example switches the extras on");
  installLeagueData(empty.data, empty.modules);
  assert.equal(modOn("fantasy"), false);
});

test("persisted state from an older version falls back to an empty league", () => {
  const s = normalizeLeagueState({ version: 4, matches: [], logs: {} });
  assert.equal(s.data.teams.length, 0);
  assert.equal(s.viewer.role, "manager");
});

test("the sponsor shows in the competition title only while the module is on", () => {
  const comp = { id: "c", name: "1.ª Divisão", sponsor: "Liga RSTAR AFPCE" };
  installLeagueData({ league: { name: "X" }, competitions: [], teams: [], players: [] }, { sponsors: false });
  assert.equal(competitionTitle(comp), "1.ª Divisão");
  installLeagueData({ league: { name: "X" }, competitions: [], teams: [], players: [] }, { sponsors: true });
  assert.equal(competitionTitle(comp), "Liga RSTAR AFPCE · 1.ª Divisão");
  assert.equal(competitionTitle({ id: "d", name: "Taça" }), "Taça");
});

test("fair play = yellows × 1 + reds × 3, fewest first, only the given teams", () => {
  const players = [{ id: "a1", teamId: "a" }, { id: "a2", teamId: "a" }, { id: "b1", teamId: "b" }, { id: "c1", teamId: "c" }];
  const stats = { a1: { yellows: 2, reds: 0 }, a2: { yellows: 1, reds: 1 }, b1: { yellows: 5, reds: 0 }, c1: { yellows: 9, reds: 9 } };
  const rows = fairPlayTable(["a", "b"], players, stats);
  assert.deepEqual(rows.map((r) => [r.teamId, r.yellows, r.reds, r.total]), [["b", 5, 0, 5], ["a", 3, 1, 6]]);
  assert.deepEqual(fairPlayTable(["x"], players, stats), [{ teamId: "x", yellows: 0, reds: 0, total: 0 }]);
});
