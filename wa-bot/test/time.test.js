import test from "node:test";
import assert from "node:assert/strict";
import { lisbonMinutesOfDay, minutesFromHHMM, lisbonDateAt, nextLisbonWeekdayAt, lisbonWeekday } from "../src/time.js";

test("lisbonMinutesOfDay reads minute-of-day in Lisbon time, DST-correct", () => {
  assert.equal(lisbonMinutesOfDay(new Date("2026-09-24T07:30:00Z")), 8 * 60 + 30); // WEST, UTC+1 in September
  assert.equal(lisbonMinutesOfDay(new Date("2026-01-15T08:30:00Z")), 8 * 60 + 30); // WET, UTC+0 in January
});
test("minutesFromHHMM", () => {
  assert.equal(minutesFromHHMM("08:30"), 510);
  assert.equal(minutesFromHHMM("00:00"), 0);
  assert.equal(minutesFromHHMM("23:59"), 1439);
});
test("lisbonDateAt resolves a Lisbon wall-clock date+time to the correct UTC instant, both sides of DST", () => {
  assert.equal(lisbonDateAt("2026-01-15", "09:00").toISOString(), "2026-01-15T09:00:00.000Z"); // WET
  assert.equal(lisbonDateAt("2026-07-15", "09:00").toISOString(), "2026-07-15T08:00:00.000Z"); // WEST
});
test("nextLisbonWeekdayAt always lands on the requested weekday, at the requested time, in the future", () => {
  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    const d = nextLisbonWeekdayAt(weekday, "20:00");
    assert.ok(d.getTime() > Date.now());
    assert.equal(lisbonWeekday(d), weekday);
    assert.equal(lisbonMinutesOfDay(d), minutesFromHHMM("20:00"));
  }
});
