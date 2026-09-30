import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminIntentJson, statsBlock } from "../src/ask.js";

test("parseAdminIntentJson: create_game with a weekday+time", () => {
  const r = parseAdminIntentJson('{"action":"create_game","date":null,"weekday":6,"time":"20:00","lang":"pt"}');
  assert.deepEqual(r, { action: "create_game", date: null, weekday: 6, time: "20:00", lang: "pt" });
});
test("parseAdminIntentJson: create_game with an exact date", () => {
  const r = parseAdminIntentJson('{"action":"create_game","date":"2026-10-12","weekday":null,"time":"21:30","lang":"en"}');
  assert.deepEqual(r, { action: "create_game", date: "2026-10-12", weekday: null, time: "21:30", lang: "en" });
});
test("parseAdminIntentJson: cancel_game needs no date/time", () => {
  const r = parseAdminIntentJson('{"action":"cancel_game","date":null,"weekday":null,"time":null,"lang":"pt"}');
  assert.equal(r.action, "cancel_game");
});
test("parseAdminIntentJson: 'none' and garbage both yield null, never a half-formed action", () => {
  assert.equal(parseAdminIntentJson('{"action":"none","date":null,"weekday":null,"time":null,"lang":"pt"}'), null);
  assert.equal(parseAdminIntentJson("not json at all"), null);
  assert.equal(parseAdminIntentJson('{"action":"delete_everything"}'), null);
});
test("parseAdminIntentJson: missing lang defaults to pt, never crashes on a partial object", () => {
  const r = parseAdminIntentJson('{"action":"cancel_game"}');
  assert.equal(r.lang, "pt");
  assert.equal(r.date, null);
  assert.equal(r.weekday, null);
  assert.equal(r.time, null);
});

test("statsBlock: lists every player from the last matchday, not just the season top 5", () => {
  const players = Array.from({ length: 7 }, (_, i) => ({
    nick: `P${i}`, goals: 7 - i, assists: 0, mvps: 0, games_played: 1, wins: 0, clean_sheets: 0,
  }));
  const last = {
    played_on: "2026-09-27", total_goals: 5, n_games: 1,
    summary: { matches: [], lines: [
      { nick: "P0", goals: 3, assists: 1, cleanSheets: 0 },
      { nick: "P6", goals: 0, assists: 2, cleanSheets: 1 }, // outside the season top-5, still in the last-game roster
    ] },
  };
  const block = statsBlock({ players, last });
  assert.match(block, /Last matchday, every player who played:/);
  assert.match(block, /P0: 3 goals, 1 assists/);
  assert.match(block, /P6: 0 goals, 2 assists, 1 clean sheets/);
});
test("statsBlock: no last matchday, or one with nobody logged, never crashes and skips the roster line", () => {
  assert.doesNotMatch(statsBlock({ players: [], last: null }), /every player who played/);
  assert.doesNotMatch(statsBlock({ players: [], last: { played_on: "d", total_goals: 0, n_games: 0, summary: {} } }), /every player who played/);
});
