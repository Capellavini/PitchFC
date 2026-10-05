// node --test src/lib/core/insights.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { teamInsights, lateConfirmers, displayOvr } from "./insights.js";

const P = (id, uuid, position, extra = {}) => ({ id, uuid, position, attrs: {}, ...extra });

// 5 matchdays where A and B were together and won 4 of 5 matches.
const day = (date, aWin) => ({
  date,
  summary: {
    teamResults: [{ name: "Coletes", players: ["ua", "ub"], wins: aWin ? 1 : 0 }, { name: "Sem coletes", players: ["uc"], wins: aWin ? 0 : 1 }],
    matches: [{ homeName: "Coletes", awayName: "Sem coletes", homeGoals: aWin ? 2 : 0, awayGoals: aWin ? 0 : 1 }],
    lines: [],
  },
});

test("together insight needs ≥4 games and ≥75% wins", () => {
  const players = new Map([[1, P(1, "ua", "Médio")], [2, P(2, "ub", "Defesa")], [3, P(3, "uc", "Avançado")]]);
  const teams = [{ id: "t1", players: [1, 2] }, { id: "t2", players: [3] }];
  const four = [day("d1", true), day("d2", true), day("d3", true), day("d4", true), day("d5", false)];
  const ins = teamInsights(teams, players, four);
  const tog = ins.find((i) => i.kind === "together");
  assert.deepEqual(tog, { kind: "together", teamId: "t1", a: 1, b: 2, games: 5, wins: 4 });
  const three = teamInsights(teams, players, four.slice(0, 3));
  assert.equal(three.find((i) => i.kind === "together"), undefined);
  const loser = teamInsights(teams, players, [day("d1", true), day("d2", false), day("d3", false), day("d4", true)]);
  assert.equal(loser.find((i) => i.kind === "together"), undefined);
  assert.equal(ins.at(-1).kind, "ovr_gap");
});

test("gk_missing only when some GR exists", () => {
  const players = { 1: P(1, "a", "Guarda-redes"), 2: P(2, "b", "Defesa"), 3: P(3, "c", "Defesa") };
  const ins = teamInsights([{ id: "t1", players: [1, 2] }, { id: "t2", players: [3] }], players, []);
  assert.deepEqual(ins.filter((i) => i.kind === "gk_missing"), [{ kind: "gk_missing", teamId: "t2" }]);
  const none = teamInsights([{ id: "t1", players: [2] }, { id: "t2", players: [3] }], players, []);
  assert.equal(none.some((i) => i.kind === "gk_missing"), false);
});

test("displayOvr flags unrated (<3 ratings)", () => {
  assert.equal(displayOvr({ position: "Médio", attrs: {}, ratingsCount: 2 }).rated, false);
  assert.equal(displayOvr({ position: "Médio", attrs: {}, ratingsCount: 3 }).rated, true);
  assert.equal(displayOvr({ position: "Médio", attrs: {} }).ovr, 60);
});

test("lateConfirmers: insufficient data under 3 cycles", () => {
  const log = [{ player_id: "p", cycle_opened_at: "c1", status: "confirmed", at: "2026-10-01T10:00:00Z", kickoff: "2026-10-03T20:00:00Z" }];
  assert.deepEqual(lateConfirmers(log), { insufficient: true, cycles: 1 });
});

test("lateConfirmers: median hours + late %", () => {
  const row = (p, c, at, ko) => ({ player_id: p, cycle_opened_at: c, status: "confirmed", at, kickoff: ko });
  const log = [
    row("ze", "c1", "2026-09-13T14:00:00Z", "2026-09-13T20:00:00Z"), // 6h
    row("ze", "c2", "2026-09-20T16:00:00Z", "2026-09-20T20:00:00Z"), // 4h
    row("ze", "c3", "2026-09-27T12:00:00Z", "2026-09-27T20:00:00Z"), // 8h
    row("rui", "c1", "2026-09-10T20:00:00Z", "2026-09-13T20:00:00Z"), // 72h
    row("rui", "c2", "2026-09-17T20:00:00Z", "2026-09-20T20:00:00Z"),
    row("rui", "c2", "2026-09-19T20:00:00Z", "2026-09-20T20:00:00Z"), // later re-confirm ignored
  ];
  const r = lateConfirmers(log);
  assert.equal(r.insufficient, false);
  assert.equal(r.cycles, 3);
  assert.deepEqual(r.rows[0], { playerId: "ze", medianHoursBefore: 6, latePct: 100, confirmations: 3 });
  assert.deepEqual(r.rows[1], { playerId: "rui", medianHoursBefore: 72, latePct: 0, confirmations: 2 });
});
