// node --test src/lib/core/teamDraw.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawTeams, teamOvr, ovrSpread, applySwap, separatePair } from "./teamDraw.js";
import { hashId } from "./ids.js";
import { ovrOf, TEAM_NAMES, TEAM_PALETTE } from "./overall.js";

// Deterministic PRNG for seeded draws.
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const out = (rit, rem, pas, dri, def, fis) => ({ rit, rem, pas, dri, def, fis });
const gk = (div, man, kic, ref, spd, pos) => ({ div, man, kic, ref, spd, pos });
const uuid = (i) => `0000000${i}-aaaa-4bbb-8ccc-${String(i).padStart(12, "0")}`;

// A realistic Saturday 5v5: 2 GR, 3 DEF, 3 MED, 2 AVA, OVR ~58–90, some
// with fewer than 3 peer ratings (they still count with computed OVR).
const ROSTER_10 = [
  { position: "Guarda-redes", attrs: gk(82, 78, 70, 85, 60, 80), ratingsCount: 5 },
  { position: "Guarda-redes", attrs: gk(64, 62, 60, 66, 58, 63), ratingsCount: 1 },
  { position: "Defesa", attrs: out(72, 55, 74, 64, 84, 82), ratingsCount: 4 },
  { position: "Defesa", attrs: out(65, 50, 66, 58, 78, 80), ratingsCount: 0 },
  { position: "Defesa", attrs: out(60, 45, 58, 52, 66, 64), ratingsCount: 3 },
  { position: "Médio", attrs: out(78, 74, 84, 79, 66, 75), ratingsCount: 6 },
  { position: "Médio", attrs: out(70, 68, 75, 72, 60, 70), ratingsCount: 2 },
  { position: "Médio", attrs: out(62, 60, 64, 63, 55, 61) },
  { position: "Avançado", attrs: out(89, 94, 78, 88, 45, 85), ratingsCount: 5 },
  { position: "Avançado", attrs: out(70, 72, 60, 68, 40, 66), ratingsCount: 3 },
].map((p, i) => ({ ...p, uuid: uuid(i + 1), id: hashId(uuid(i + 1)), name: `P${i + 1}` }));
const byId = new Map(ROSTER_10.map((p) => [p.id, p]));

const allIds = (teams) => teams.flatMap((t) => t.players).sort((a, b) => a - b);
const gkCount = (team) => team.players.filter((id) => byId.get(id).position === "Guarda-redes").length;

test("ids are hashId(uuid) integers and every player is drawn exactly once", () => {
  const teams = drawTeams(ROSTER_10, 2, { rng: mulberry32(1) });
  assert.deepEqual(allIds(teams), ROSTER_10.map((p) => p.id).sort((a, b) => a - b));
  for (const id of allIds(teams)) assert.ok(Number.isInteger(id) && id >= 0);
  assert.deepEqual(teams.map((t) => t.id), ["t1", "t2"]);
  assert.deepEqual(teams.map((t) => t.name), TEAM_NAMES.slice(0, 2));
  assert.deepEqual(teams.map((t) => t.color), TEAM_PALETTE.slice(0, 2));
  assert.deepEqual(teams.map((t) => t.players.length), [5, 5]);
});

test("OVR-balanced: spread < 2 and one GR per team across 200 seeds", () => {
  let worst = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const teams = drawTeams(ROSTER_10, 2, { rng: mulberry32(seed) });
    const spread = ovrSpread(teams, byId);
    worst = Math.max(worst, spread);
    assert.ok(spread < 2, `seed ${seed}: spread ${spread.toFixed(2)}`);
    assert.deepEqual(teams.map(gkCount), [1, 1], `seed ${seed}`);
    assert.deepEqual(teams.map((t) => t.players.length), [5, 5]);
  }
  assert.ok(worst < 2);
});

test("OVR-balanced beats the random draw on average", () => {
  let ovr = 0, rnd = 0;
  for (let seed = 1; seed <= 200; seed++) {
    ovr += ovrSpread(drawTeams(ROSTER_10, 2, { rng: mulberry32(seed) }), byId);
    rnd += ovrSpread(drawTeams(ROSTER_10, 2, { rng: mulberry32(seed), balance: "random" }), byId);
  }
  assert.ok(ovr < rnd, `${ovr} vs ${rnd}`);
});

test("re-draws vary (not one fixed split)", () => {
  const splits = new Set();
  for (let seed = 1; seed <= 50; seed++) splits.add(JSON.stringify(drawTeams(ROSTER_10, 2, { rng: mulberry32(seed) }).map((t) => t.players)));
  assert.ok(splits.size > 1);
});

test("≤1 GR per team with 3 teams and 3 GRs; nTeams clamped to 2–6", () => {
  const extraGk = { position: "Guarda-redes", attrs: gk(70, 70, 70, 70, 70, 70), id: hashId(uuid(99)) };
  const roster = [...ROSTER_10, extraGk, { position: "Médio", attrs: out(70, 70, 70, 70, 70, 70), id: hashId(uuid(98)) }];
  const map = new Map(roster.map((p) => [p.id, p]));
  for (let seed = 1; seed <= 50; seed++) {
    const teams = drawTeams(roster, 3, { rng: mulberry32(seed) });
    assert.equal(teams.length, 3);
    for (const t of teams) assert.equal(t.players.filter((id) => map.get(id).position === "Guarda-redes").length, 1);
  }
  assert.equal(drawTeams(ROSTER_10, 1).length, 2);
  assert.equal(drawTeams(ROSTER_10, 9).length, 6);
});

test("players with an unknown position are still drawn in ovr mode", () => {
  const roster = [...ROSTER_10, { id: 777, name: "Sem posição" }];
  assert.ok(allIds(drawTeams(roster, 2, { rng: mulberry32(3) })).includes(777));
});

test("balance: 'random' reproduces the original shuffle + position snake", () => {
  // Original PitchApp drawTeams, verbatim apart from the injected rng.
  const POS = ["Guarda-redes", "Defesa", "Médio", "Avançado"];
  const legacy = (playing, n, rng) => {
    const shuffled = [...playing].sort(() => rng() - 0.5);
    const order = POS.flatMap((pos) => shuffled.filter((p) => p.position === pos));
    const teams = Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: TEAM_NAMES[i], color: TEAM_PALETTE[i], players: [] }));
    order.forEach((p, idx) => {
      const round = Math.floor(idx / n);
      const slot = idx % n;
      teams[round % 2 === 0 ? slot : n - 1 - slot].players.push(p.id);
    });
    return teams;
  };
  for (let seed = 1; seed <= 30; seed++) {
    for (const n of [2, 3]) {
      assert.deepEqual(drawTeams(ROSTER_10, n, { rng: mulberry32(seed), balance: "random" }), legacy(ROSTER_10, n, mulberry32(seed)));
    }
  }
});

test("teamOvr: average of computed OVRs, null when empty; accepts fn/Map/object", () => {
  const [a, b] = ROSTER_10;
  const team = { players: [a.id, b.id] };
  const expected = (ovrOf(a) + ovrOf(b)) / 2;
  assert.equal(teamOvr(team, byId), expected);
  assert.equal(teamOvr(team, (id) => byId.get(id)), expected);
  assert.equal(teamOvr(team, Object.fromEntries(byId)), expected);
  assert.equal(teamOvr({ players: [] }, byId), null);
});

test("applySwap exchanges two players across teams, no-op on same team", () => {
  const teams = [{ id: "t1", players: [1, 2] }, { id: "t2", players: [3, 4] }];
  assert.deepEqual(applySwap(teams, 2, 3).map((t) => t.players), [[1, 3], [2, 4]]);
  assert.equal(applySwap(teams, 1, 2), teams);
  assert.equal(applySwap(teams, 1, 99), teams);
  assert.deepEqual(teams.map((t) => t.players), [[1, 2], [3, 4]]); // not mutated
});

test("separatePair splits a pair, keeps sizes, prefers same position and minimal spread", () => {
  const teams = drawTeams(ROSTER_10, 2, { rng: mulberry32(7) });
  const [x, y] = teams[0].players;
  const next = separatePair(teams, x, y, byId);
  const together = next.some((t) => t.players.includes(x) && t.players.includes(y));
  assert.equal(together, false);
  assert.deepEqual(next.map((t) => t.players.length), teams.map((t) => t.players.length));
  assert.deepEqual(allIds(next), allIds(teams));
  // already apart → unchanged
  const z = teams[1].players[0];
  assert.equal(separatePair(teams, x, z, byId), teams);
});

test("re-sortear (option A): ≥3 distinct balanced splits across 30 draws, all within tolerance or the best", () => {
  const key = (teams) => teams.map((t) => [...t.players].sort((a, b) => a - b).join(",")).sort().join("|");
  const splits = new Set();
  for (let s = 0; s < 30; s++) {
    const teams = drawTeams(ROSTER_10, 2, { rng: mulberry32(1000 + s) });
    assert.ok(ovrSpread(teams, byId) <= 2 + 1e-9, `spread ${ovrSpread(teams, byId)} > 2`);
    splits.add(key(teams));
  }
  assert.ok(splits.size >= 3, `only ${splits.size} distinct splits`);
});
