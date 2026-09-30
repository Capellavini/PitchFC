import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminIntentJson } from "../src/ask.js";

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
