import test from "node:test";
import assert from "node:assert/strict";
import { decide } from "../src/events.js";

const now = new Date("2026-09-24T18:00:00Z"); // Thursday
const game = (o = {}) => ({
  id: "g1", status: "open", spots: 10,
  scheduled_at: "2026-09-26T19:00:00Z",
  created_at: "2026-09-24T17:30:00Z", ...o,
});
const run = (o) => decide({ game: game(o.game), spots: 10, confirmed: 5, prev: 5, now, ...o, game: game(o.game) });
const kinds = (o) => run(o).map((e) => e.kind);

test("fresh game seen for the first time -> game_open", () => {
  assert.deepEqual(kinds({ prev: null }), ["game_open", "game_poll"]);
});
test("old game seen for the first time (bot just installed) -> silent", () => {
  assert.deepEqual(kinds({ prev: null, game: { created_at: "2026-09-01T10:00:00Z" } }), []);
});
test("crossing 10 -> one milestone", () => {
  const e = run({ prev: 9, confirmed: 10 });
  assert.equal(e.length, 1);
  assert.equal(e[0].kind, "milestone");
  assert.equal(e[0].key, "milestone:g1:10");
});
test("jump 9 -> 13 coalesces to the highest threshold (12)", () => {
  const e = run({ prev: 9, confirmed: 13 });
  assert.equal(e.length, 1);
  assert.equal(e[0].key, "milestone:g1:12");
});
test("full game loses one -> spot_opened", () => {
  assert.deepEqual(kinds({ prev: 10, confirmed: 9 }), ["spot_opened"]);
});
test("8 -> 7 is not news", () => {
  assert.deepEqual(kinds({ prev: 8, confirmed: 7 }), []);
});
test("waitlist 12 -> 11 is not a spot (still full)", () => {
  assert.deepEqual(kinds({ prev: 12, confirmed: 11 }), []);
});
test("cancelled is urgent and exclusive", () => {
  const e = run({ game: { status: "cancelled" }, prev: 3, confirmed: 3 });
  assert.deepEqual(e.map((x) => [x.kind, x.urgent]), [["cancelled", true]]);
});
test("reminder inside 24h only while spots are open", () => {
  const soon = { scheduled_at: "2026-09-25T12:00:00Z" };
  assert.deepEqual(kinds({ game: soon, confirmed: 7, prev: 7 }), ["reminder"]);
  assert.deepEqual(kinds({ game: soon, confirmed: 10, prev: 10 }), []);
});
test("played games are ignored", () => {
  assert.deepEqual(kinds({ game: { status: "played" }, prev: 5, confirmed: 5 }), []);
});

import { milestoneThresholds, decidePostGame } from "../src/events.js";
import { render } from "../src/messages.js";

test("thresholds scale with group size (80% / full / waitlist)", () => {
  assert.deepEqual(milestoneThresholds(10), [8, 10, 12, 15]);
  assert.deepEqual(milestoneThresholds(14), [12, 14, 17, 21]);
  assert.deepEqual(milestoneThresholds(2), [2, 3]); // tiny groups collapse duplicates
});
test("7 -> 8 in a 10-spot group fires the 80% milestone", () => {
  const e = run({ prev: 7, confirmed: 8 });
  assert.deepEqual(e.map((x) => x.key), ["milestone:g1:8"]);
});
test("5 -> 9 coalesces to the 80% milestone once", () => {
  assert.equal(run({ prev: 5, confirmed: 9 }).length, 1);
});
test("day-of reminder: game day from 10:00 Lisbon until kickoff", () => {
  const gameToday = { scheduled_at: "2026-09-24T19:00:00Z" }; // 20:00 Lisbon (UTC+1 in September)
  const at = (iso) => decide({ game: game(gameToday), spots: 10, confirmed: 10, prev: 10, now: new Date(iso) }).map((e) => e.kind);
  assert.deepEqual(at("2026-09-24T08:00:00Z"), []);          // 09:00 Lisbon: too early
  assert.deepEqual(at("2026-09-24T09:30:00Z"), ["matchday"]); // 10:30 Lisbon
  assert.deepEqual(at("2026-09-24T19:30:00Z"), []);          // after kickoff
});
test("post-game: fresh matchday yields one keyed message, old ones nothing", () => {
  const md = { id: "m1", created_at: "2026-09-24T17:00:00Z" };
  assert.deepEqual(decidePostGame({ matchday: md, now }).map((e) => e.key), ["postgame:m1"]);
  assert.deepEqual(decidePostGame({ matchday: { ...md, created_at: "2026-09-20T17:00:00Z" }, now }), []);
});
test("render: pt, en and pt+en (Goodweather) all include the link", () => {
  const ctx = { game: game(), spots: 10, confirmed: 8, link: "https://x/?join=abc" };
  const pt = render("milestone", ctx, "pt"), en = render("milestone", ctx, "en"), both = render("milestone", ctx, "pt+en");
  assert.match(pt, /faltam 2 vagas/); assert.match(en, /2 spots left/);
  assert.equal(both, `${pt}\n\n${en}`);
  assert.ok([pt, en, both].every((t) => t.includes("https://x/?join=abc")));
});
test("render: post-game lists scores, top scorer and MVP link", () => {
  const md = { mvp_open: true, summary: { matches: [{ n: 1, homeName: "Azuis", awayName: "Brancos", homeGoals: 3, awayGoals: 2 }], lines: [{ nick: "Liminha", goals: 2 }, { nick: "Diogo", goals: 1 }] } };
  const t = render("postgame", { matchday: md, link: "L" }, "en");
  assert.match(t, /Game 1: Azuis 3-2 Brancos/); assert.ok(t.includes("Top scorer: Liminha (2 goals)")); assert.match(t, /Vote for the MVP: L/);
});
