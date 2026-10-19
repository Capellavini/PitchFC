// Shared-vector tests for the Pitch Manager v2 rules. The same JSON runs
// through the plpgsql functions in supabase/tests/fantasy_v2_check.sql —
// this file also proves the copy embedded there is byte-for-byte the
// fixture, and that FANTASY_V2 equals the migration's fantasy_v2_rules().
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FANTASY_V2, nightFacts, playerNightPoints, scoreLineup, ownershipCap, priceFromForm,
  transferState, nextFreeTransfers, seasonStandings, posCode,
} from "./fantasyRules.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const V = JSON.parse(readFileSync(join(here, "fixtures", "fantasyVectors.json"), "utf8"));

test("nights: per-player points match the shared vectors", () => {
  for (const v of V.nights) {
    const summary = V.summaries[v.summary];
    for (const [id, pts] of Object.entries(v.expected)) {
      assert.equal(playerNightPoints(id, summary, V.positions[id], v.podium).pts, pts, `${v.name} · ${id}`);
    }
  }
});

test("lineups: totals, effective captain, auto-subs and contributions match", () => {
  for (const v of V.lineups) {
    const r = scoreLineup(v.lineup, V.summaries[v.summary], V.positions, v.podium);
    assert.equal(r.total, v.expected.total, `${v.name} · total`);
    assert.equal(r.transferCost, v.expected.transferCost, `${v.name} · transferCost`);
    assert.equal(r.captain, v.expected.captain, `${v.name} · captain`);
    const subs = Object.fromEntries(r.players.filter((p) => p.subFor).map((p) => [p.id, p.subFor]));
    assert.deepEqual(subs, v.expected.subs, `${v.name} · subs`);
    const pts = Object.fromEntries(r.players.map((p) => [p.id, p.pts]));
    assert.deepEqual(pts, v.expected.players, `${v.name} · players`);
  }
});

test("prices, ownership cap and transfers match", () => {
  for (const v of V.prices) assert.equal(priceFromForm(v.form, v.base, v.scale), v.expected, JSON.stringify(v.form));
  for (const [n, cap] of V.ownershipCap) assert.equal(ownershipCap(n), cap, `cap(${n})`);
  for (const v of V.transfers) {
    const s = transferState(v.locked, v.current, v.free);
    assert.equal(s.made, v.expected.made);
    assert.equal(s.cost, v.expected.cost);
    assert.equal(nextFreeTransfers(v.locked, v.free, s.made), v.expected.nextFree);
  }
});

test("night facts: no-shows are confirmed candidates who never appeared", () => {
  const f = nightFacts(V.summaries.nightA);
  assert.deepEqual(f.noShows, ["m3"]);
  assert.equal(f.games.length, 3);
  assert.equal(posCode("Avançado"), "AVA");
  assert.equal(posCode(undefined), "MED");
});

test("demo-style numeric ids score the same as string ids", () => {
  const s = { teamResults: [{ name: "A", players: [1] }, { name: "B", players: [2] }],
    matches: [{ homeName: "A", awayName: "B", homeGoals: 1, awayGoals: 0, homeGk: 1, awayGk: 2, events: [{ side: "h", type: "goal", by: 1 }] }],
    lines: [{ key: "1", goals: 1 }], candidates: [{ key: 1 }, { key: 2 }] };
  // GR goal 8 + played 2 + CS(GR) 4 + win 1
  assert.equal(playerNightPoints("1", s, "Guarda-redes").pts, 15);
});

test("season standings: window filter + shared ranks", () => {
  const rounds = [{ id: "r1", kickoff_at: "2026-10-03T19:00:00Z" }, { id: "r2", kickoff_at: "2026-11-07T19:00:00Z" }];
  const scores = [
    { participant_id: "a", round_id: "r1", points: 10 }, { participant_id: "b", round_id: "r1", points: 10 },
    { participant_id: "c", round_id: "r1", points: 4 }, { participant_id: "a", round_id: "r2", points: 50 },
  ];
  const rows = seasonStandings(scores, rounds, { starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-11-01T00:00:00Z" });
  assert.deepEqual(rows.map((r) => [r.participant_id, r.points, r.rank]), [["a", 10, 1], ["b", 10, 1], ["c", 4, 3]]);
});

test("parity: FANTASY_V2 equals the migration's fantasy_v2_rules() constant", () => {
  const dir = join(root, "supabase", "migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_fantasy_v2_foundation.sql"));
  assert.ok(file, "fantasy v2 migration present");
  const sql = readFileSync(join(dir, file), "utf8").replace(/\r\n/g, "\n");
  const m = sql.match(/-- RULES:BEGIN\n\s*select '([\s\S]*?)'::jsonb\n-- RULES:END/);
  assert.ok(m, "rules block found");
  assert.deepEqual(JSON.parse(m[1]), JSON.parse(JSON.stringify(FANTASY_V2)));
});

test("parity: the vectors embedded in fantasy_v2_check.sql are the fixture", () => {
  const sql = readFileSync(join(root, "supabase", "tests", "fantasy_v2_check.sql"), "utf8").replace(/\r\n/g, "\n");
  const m = sql.match(/-- VECTORS:BEGIN\n[\s\S]*?\$vec\$([\s\S]*?)\$vec\$[\s\S]*?-- VECTORS:END/);
  assert.ok(m, "vectors block found");
  assert.deepEqual(JSON.parse(m[1]), V);
});
