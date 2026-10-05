import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAdjunto } from "../src/adjunto/proactive.js";

// 2026-10-08 is a Thursday. Lisbon = UTC+1 in October.
const at = (iso) => new Date(iso);
const link = { id: "L1", prefs: {}, linked_at: "2026-10-01T10:00:00Z" };
const game = (kickoffIso, extra = {}) => ({ id: "G1", status: "open", scheduled_at: kickoffIso, created_at: "2026-10-04T10:00:00Z", cycle_opened_at: "2026-10-05T16:00:00Z", teams_confirmed: false, live_matchday: null, ...extra });
const kinds = (evs) => evs.map((e) => e.kind);
const base = { link, spots: 10, confirmed: 5, now: at("2026-10-08T14:00:00Z"), game: game("2026-10-10T19:00:00Z") }; // T-53h

test("P1 status at T-48h..24h, 10–21h Lisbon, <80% full; none outside", () => {
  const now = at("2026-10-09T10:00:00Z"); // 11:00 Lisbon, T-33h
  assert.deepEqual(kinds(decideAdjunto({ ...base, now })), ["adj_status"]);
  assert.deepEqual(kinds(decideAdjunto({ ...base, now, confirmed: 8 })), []); // already 80%
  assert.deepEqual(kinds(decideAdjunto({ ...base, now: at("2026-10-09T21:30:00Z"), confirmed: 3 })), []); // 22:30 Lisbon (not P1; too few for teams)
  assert.deepEqual(kinds(decideAdjunto(base)), []); // T-53h
  const key = decideAdjunto({ ...base, now })[0].key;
  assert.equal(key, "adj:status:L1:G1:2026-10-05T16:00:00Z"); // cycle-keyed
});

test("P2 at T-26h..24h, suppressed after a P1 action", () => {
  const now = at("2026-10-09T17:30:00Z"); // T-25.5h, 18:30 Lisbon
  assert.ok(kinds(decideAdjunto({ ...base, now, confirmed: 9 })).includes("adj_hint"));
  assert.ok(!kinds(decideAdjunto({ ...base, now, confirmed: 9, p1Acted: true })).includes("adj_hint"));
});

test("P3 game day from 10:00 Lisbon, not full", () => {
  const g = game("2026-10-10T19:00:00Z");
  assert.ok(kinds(decideAdjunto({ ...base, game: g, now: at("2026-10-10T09:30:00Z") })).includes("adj_gameday"));
  assert.ok(!kinds(decideAdjunto({ ...base, game: g, now: at("2026-10-10T08:30:00Z") })).includes("adj_gameday")); // 09:30 Lisbon
});

test("P4 spot opened is urgent and bypasses the daily cap", () => {
  const now = at("2026-10-10T09:30:00Z");
  const evs = decideAdjunto({ ...base, now, prevConfirmed: 10, confirmed: 9, sentToday: 3 });
  assert.deepEqual(kinds(evs), ["adj_spot"]);
  assert.equal(evs[0].urgent, true);
  assert.deepEqual(kinds(decideAdjunto({ ...base, now, prevConfirmed: 9, confirmed: 8, sentToday: 3 })), []); // was not full
});

test("P5 teams at T-24h (not 'when full'), short or full, never when confirmed or live", () => {
  const now = at("2026-10-09T20:00:00Z"); // T-23h, 21:00 Lisbon
  const short = decideAdjunto({ ...base, now, confirmed: 7 }).find((e) => e.kind === "adj_teams");
  assert.equal(short.full, false);
  assert.equal(decideAdjunto({ ...base, now, confirmed: 10 }).find((e) => e.kind === "adj_teams").full, true);
  assert.ok(!kinds(decideAdjunto({ ...base, now, confirmed: 10, game: game("2026-10-10T19:00:00Z", { teams_confirmed: true }) })).includes("adj_teams"));
  assert.ok(!kinds(decideAdjunto({ ...base, now: at("2026-10-09T10:00:00Z"), confirmed: 10 })).includes("adj_teams")); // T-33h
  assert.ok(!kinds(decideAdjunto({ ...base, now, confirmed: 3 })).includes("adj_teams")); // fewer than 4
  const lead = { ...link, prefs: { teamsLeadHours: 48 } };
  assert.ok(kinds(decideAdjunto({ ...base, link: lead, now: at("2026-10-09T10:00:00Z"), confirmed: 10 })).includes("adj_teams"));
  assert.ok(kinds(decideAdjunto({ ...base, now, confirmed: 10, teamsWaiting: true })).includes("adj_teams_full"));
});

test("no 'confirmations opened' DM ever (decision 8)", () => {
  const fresh = game("2026-10-12T19:00:00Z", { created_at: "2026-10-08T13:00:00Z" });
  const evs = decideAdjunto({ ...base, game: fresh, confirmed: 0, prevConfirmed: null });
  assert.equal(evs.some((e) => /open/.test(e.kind)), false);
});

test("quiet hours hold everything; pause stops everything; daily cap", () => {
  const night = at("2026-10-09T23:30:00Z"); // 00:30 Lisbon
  assert.deepEqual(decideAdjunto({ ...base, now: night, confirmed: 7, prevConfirmed: 10 }), []);
  assert.deepEqual(decideAdjunto({ ...base, link: { ...link, prefs: { proactive: false } }, now: at("2026-10-09T10:00:00Z") }), []);
  assert.deepEqual(decideAdjunto({ ...base, now: at("2026-10-09T10:00:00Z"), sentToday: 3 }), []);
});

test("no DM about something the organizer did <10 min ago", () => {
  const now = at("2026-10-09T10:00:00Z");
  assert.deepEqual(decideAdjunto({ ...base, now, lastOwnActionAt: "2026-10-09T09:55:00Z" }), []);
  assert.deepEqual(kinds(decideAdjunto({ ...base, now, lastOwnActionAt: "2026-10-09T09:30:00Z" })), ["adj_status"]);
});

test("P7 summary ≤30 min after commit; P8 forgot to end; P9 format nudge", () => {
  const now = at("2026-10-10T21:20:00Z");
  const evs = decideAdjunto({ ...base, game: null, now, matchdays: [{ id: "M1", created_at: "2026-10-10T21:00:00Z" }, { id: "M0", created_at: "2026-10-03T22:00:00Z" }] });
  assert.deepEqual(kinds(evs), ["adj_summary"]);
  assert.equal(evs[0].key, "adj:summary:L1:M1");
  const live = game("2026-10-10T19:00:00Z", { live_matchday: { mode: "avulsa", matches: [] } });
  // kickoff+4h30 = 00:30 Lisbon → quiet hours hold it
  assert.deepEqual(decideAdjunto({ ...base, game: live, now: at("2026-10-10T23:30:00Z"), quietStart: 23, quietEnd: 9 }).length, 0);
  assert.ok(kinds(decideAdjunto({ ...base, game: live, now: at("2026-10-10T23:30:00Z"), quietStart: 3, quietEnd: 4 })).includes("adj_unfinished"));
  assert.ok(kinds(decideAdjunto({ ...base, game: null, formatSet: false, now: at("2026-10-08T14:00:00Z") })).includes("adj_format_nudge"));
});

test("P6 group stage done (personalizado with play-off)", () => {
  const g = (concluded) => game("2026-10-10T19:00:00Z", { live_matchday: { mode: "personalizado", config: { faseFinal: true, finalistas: 2 },
    matches: [{ homeId: "t1", awayId: "t2", events: [], concluded }, { homeId: "t2", awayId: "t3", events: [], concluded: true }] } });
  assert.ok(kinds(decideAdjunto({ ...base, game: g(true), now: at("2026-10-10T20:00:00Z") })).includes("adj_groupstage"));
  assert.ok(!kinds(decideAdjunto({ ...base, game: g(false), now: at("2026-10-10T20:00:00Z") })).includes("adj_groupstage"));
});
