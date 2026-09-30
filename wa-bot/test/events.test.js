import test from "node:test";
import assert from "node:assert/strict";
import { decide, decideMatchAwards } from "../src/events.js";

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
  assert.equal(e[0].key, "milestone:g1:10:once");
});
test("jump 9 -> 13 coalesces to the highest threshold (12)", () => {
  const e = run({ prev: 9, confirmed: 13 });
  assert.equal(e.length, 1);
  assert.equal(e[0].key, "milestone:g1:12:once");
});
test("full game loses one -> spot_opened", () => {
  assert.deepEqual(kinds({ prev: 10, confirmed: 9 }), ["spot_opened"]);
});
test("8 -> 7 is not news", () => {
  assert.deepEqual(kinds({ prev: 8, confirmed: 7 }), []);
});
test("waitlist 12 -> 11: still full, a waitlister was auto-promoted", () => {
  assert.deepEqual(kinds({ prev: 12, confirmed: 11 }), ["promoted"]);
});
test("promoted key changes with the bucket, so consecutive promotions each get announced", () => {
  const key = (confirmed, now) => run({ prev: 12, confirmed, now })[0].key;
  const a = key(11, new Date("2026-09-24T18:00:00Z"));
  const b = key(10, new Date("2026-09-24T18:11:00Z")); // different bucket, different transition
  assert.notEqual(a, b);
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

test("thresholds scale with group size (80% / full / waitlist just started / waitlist growing)", () => {
  assert.deepEqual(milestoneThresholds(10), [8, 10, 11, 12, 15]);
  assert.deepEqual(milestoneThresholds(14), [12, 14, 15, 17, 21]);
  assert.deepEqual(milestoneThresholds(2), [2, 3]); // tiny groups collapse duplicates
});
test("7 -> 8 in a 10-spot group fires the 80% milestone", () => {
  const e = run({ prev: 7, confirmed: 8 });
  assert.deepEqual(e.map((x) => x.key), ["milestone:g1:8:once"]);
});
test("5 -> 9 coalesces to the 80% milestone once", () => {
  assert.equal(run({ prev: 5, confirmed: 9 }).length, 1);
});
test("recurring games reuse the same row: milestone key includes cycle_opened_at so next week's crossing isn't seen as a dupe of last week's", () => {
  const week1 = run({ prev: 7, confirmed: 8, game: { cycle_opened_at: "2026-09-15T17:00:00Z" } });
  const week2 = run({ prev: 7, confirmed: 8, game: { cycle_opened_at: "2026-09-22T17:00:00Z" } });
  assert.notEqual(week1[0].key, week2[0].key);
  const sameCycleAgain = run({ prev: 7, confirmed: 8, game: { cycle_opened_at: "2026-09-15T17:00:00Z" } });
  assert.equal(week1[0].key, sameCycleAgain[0].key);
});
test("day-of reminder: game day from 08:30 Lisbon until kickoff", () => {
  const gameToday = { scheduled_at: "2026-09-24T19:00:00Z" }; // 20:00 Lisbon (UTC+1 in September)
  const at = (iso) => decide({ game: game(gameToday), spots: 10, confirmed: 10, prev: 10, now: new Date(iso) }).map((e) => e.kind);
  assert.deepEqual(at("2026-09-24T07:00:00Z"), []);           // 08:00 Lisbon: too early
  assert.deepEqual(at("2026-09-24T07:29:00Z"), []);           // 08:29 Lisbon: still too early
  assert.deepEqual(at("2026-09-24T07:30:00Z"), ["matchday"]); // 08:30 Lisbon: right on time
  assert.deepEqual(at("2026-09-24T09:30:00Z"), ["matchday"]); // 10:30 Lisbon
  assert.deepEqual(at("2026-09-24T19:30:00Z"), []);           // after kickoff
});
test("post-game: fresh matchday yields one keyed message, old ones nothing", () => {
  const md = { id: "m1", created_at: "2026-09-24T17:00:00Z" };
  assert.deepEqual(decidePostGame({ matchday: md, now }).map((e) => e.key), ["postgame:m1"]);
  assert.deepEqual(decidePostGame({ matchday: { ...md, created_at: "2026-09-20T17:00:00Z" }, now }), []);
});
test("match awards: nothing before 2h, one message from 2h to 12h, nothing after", () => {
  const md = (createdAt) => ({ id: "m1", created_at: createdAt });
  assert.deepEqual(decideMatchAwards({ matchday: md("2026-09-24T17:00:00Z"), now }), []); // 1h old: too soon
  assert.deepEqual(
    decideMatchAwards({ matchday: md("2026-09-24T16:00:00Z"), now }).map((e) => e.key),
    ["match_awards:m1"] // exactly 2h old
  );
  assert.deepEqual(
    decideMatchAwards({ matchday: md("2026-09-24T10:00:00Z"), now }).map((e) => e.key),
    ["match_awards:m1"] // 8h old, still within the window
  );
  assert.deepEqual(decideMatchAwards({ matchday: md("2026-09-20T17:00:00Z"), now }), []); // days old
});
test("render: pt, en and pt+en (Goodweather) all include the link", () => {
  const ctx = { game: game(), spots: 10, confirmed: 8, link: "https://x/?join=abc" };
  const pt = render("milestone", ctx, "pt"), en = render("milestone", ctx, "en"), both = render("milestone", ctx, "pt+en");
  assert.match(pt, /faltam 2 vagas/); assert.match(en, /2 spots left/);
  assert.equal(both, `${pt}\n\n${en}`);
  assert.ok([pt, en, both].every((t) => t.includes("https://x/?join=abc")));
});
test("render: promoted tags the auto-promoted player by phone digits", () => {
  const ctx = { confirmed: 10, spots: 10, promoted: { nick: "Vini", phoneDigits: "351912345678", jid: "351912345678@s.whatsapp.net" } };
  assert.match(render("promoted", ctx, "pt"), /@351912345678 estás dentro!/);
  assert.match(render("promoted", ctx, "ptbr"), /@351912345678 você tá dentro!/);
  assert.match(render("promoted", ctx, "en"), /@351912345678 you're in!/);
});
test("render: promoted with nobody resolved still announces the count, just no tag", () => {
  const t = render("promoted", { confirmed: 10, spots: 10, promoted: null }, "en");
  assert.doesNotMatch(t, /@/);
  assert.match(t, /automatically filled from the waiting list/);
});
test("render: post-game lists scores, top scorer and MVP link", () => {
  const md = { mvp_open: true, summary: { matches: [{ n: 1, homeName: "Azuis", awayName: "Brancos", homeGoals: 3, awayGoals: 2 }], lines: [{ nick: "Liminha", goals: 2 }, { nick: "Diogo", goals: 1 }] } };
  const t = render("postgame", { matchday: md, link: "L" }, "en");
  assert.match(t, /Game 1: Azuis 3-2 Brancos/); assert.ok(t.includes("Top scorer: Liminha (2 goals)")); assert.match(t, /Vote for the MVP: L/);
});
test("render: match_awards lists top scorer and top assist independently, never says 'tonight'", () => {
  const md = { summary: { lines: [
    { nick: "Carlão", goals: 3, assists: 0 },
    { nick: "Liminha", goals: 1, assists: 2 },
    { nick: "Tiago", goals: 0, assists: 2 },
  ] } };
  const pt = render("match_awards", { matchday: md }, "pt");
  assert.match(pt, /Artilheiro: Carlão \(3 golos\)/);
  assert.match(pt, /Maior assistente: Liminha, Tiago \(2 assistências\)/); // tie, both named
  assert.ok(!/noite/i.test(pt)); // games aren't always at night
  const en = render("match_awards", { matchday: md }, "en");
  assert.match(en, /Top scorer: Carlão \(3 goals\)/);
  assert.match(en, /Most assists: Liminha, Tiago \(2 assists\)/);
});
test("render: match_awards falls back gracefully when nobody scored", () => {
  const t = render("match_awards", { matchday: { summary: { lines: [] } } }, "en");
  assert.match(t, /No goals logged for this match/);
});
