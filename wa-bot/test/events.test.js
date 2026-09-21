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
  assert.deepEqual(kinds({ prev: null }), ["game_open"]);
});
test("old game seen for the first time (bot just installed) -> silent", () => {
  assert.deepEqual(kinds({ prev: null, game: { created_at: "2026-09-01T10:00:00Z" } }), []);
});
test("crossing 10 -> one milestone", () => {
  const e = run({ prev: 9, confirmed: 10 });
  assert.equal(e.length, 1);
  assert.equal(e[0].kind, "milestone");
  assert.equal(e[0].ctx.confirmed, 10);
});
test("jump 9 -> 13 coalesces to the highest threshold (12)", () => {
  const e = run({ prev: 9, confirmed: 13 });
  assert.equal(e.length, 1);
  assert.equal(e[0].ctx.confirmed, 12);
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
