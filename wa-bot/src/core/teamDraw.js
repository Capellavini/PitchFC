// GENERATED from src/lib/core — do not edit; run npm run sync:core
// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// Team draw. Players are the app's player objects ({ id, position, attrs });
// ids are whatever the roster uses — hashId(uuid) ints in cloud mode — and
// are what end up in teams[].players (games.teams).
import { ovrOf, POSITIONS, TEAM_NAMES, TEAM_PALETTE } from "./overall.js";

const MAX_SWAP_ITERATIONS = 200;
const JITTER = 1.5; // ± OVR points of noise so equal rosters don't always draw identically

const lookup = (byId) => {
  if (typeof byId === "function") return byId;
  if (byId instanceof Map) return (id) => byId.get(id);
  return (id) => byId?.[id];
};

const emptyTeams = (n) => Array.from({ length: n }, (_, i) => ({
  id: `t${i + 1}`, name: TEAM_NAMES[i], color: TEAM_PALETTE[i], players: [],
}));

const snakeDeal = (order, teams) => {
  const n = teams.length;
  order.forEach((p, idx) => {
    const round = Math.floor(idx / n);
    const slot = idx % n;
    const ti = round % 2 === 0 ? slot : n - 1 - slot;
    teams[ti].players.push(p.id);
  });
  return teams;
};

/** Average OVR of a drawn team ({ players: [id] }) — null when empty.
 *  Unrounded (helpers.teamOverall rounds for display). byId: function,
 *  Map or plain object id → player. Every player counts with its computed
 *  OVR, peer-rated (ratingsCount ≥ 3) or not. */
export function teamOvr(team, byId) {
  const get = lookup(byId);
  const ps = (team?.players ?? []).map(get).filter(Boolean);
  if (!ps.length) return null;
  return ps.reduce((s, p) => s + ovrOf(p), 0) / ps.length;
}

/** max − min team OVR (0 with fewer than two non-empty teams). */
export function ovrSpread(teams, byId) {
  const vals = teams.map((t) => teamOvr(t, byId)).filter((v) => v != null);
  return vals.length < 2 ? 0 : Math.max(...vals) - Math.min(...vals);
}

/** New teams array with players aId and bId exchanged (no-op if either is
 *  missing or both are on the same team). */
export function applySwap(teams, aId, bId) {
  const ta = teams.findIndex((t) => t.players.includes(aId));
  const tb = teams.findIndex((t) => t.players.includes(bId));
  if (ta < 0 || tb < 0 || ta === tb) return teams;
  return teams.map((t, i) => {
    if (i === ta) return { ...t, players: t.players.map((id) => (id === aId ? bId : id)) };
    if (i === tb) return { ...t, players: t.players.map((id) => (id === bId ? aId : id)) };
    return t;
  });
}

/** "These two can't play together": if aId and bId share a team, swap one
 *  of them with a player from another team — same position preferred —
 *  choosing the swap that leaves the smallest OVR spread. Team sizes are
 *  kept. Returns teams unchanged if they're already apart. */
export function separatePair(teams, aId, bId, byId) {
  const get = lookup(byId);
  const home = teams.findIndex((t) => t.players.includes(aId) && t.players.includes(bId));
  if (home < 0) return teams;
  let best = null;
  for (const moving of [aId, bId]) {
    const pos = get(moving)?.position;
    teams.forEach((t, ti) => {
      if (ti === home) return;
      const candidates = t.players.filter((id) => id !== aId && id !== bId);
      const samePos = candidates.filter((id) => get(id)?.position === pos);
      (samePos.length ? samePos : candidates).forEach((other) => {
        const next = applySwap(teams, moving, other);
        const spread = ovrSpread(next, get);
        const tier = samePos.length ? 0 : 1;
        if (!best || tier < best.tier || (tier === best.tier && spread < best.spread - 1e-9)) best = { next, spread, tier };
      });
    });
  }
  return best ? best.next : teams;
}

/** Local improvement: repeatedly apply a same-position swap between two
 *  teams while it reduces the OVR spread (capped at maxIterations). With
 *  an rng, each step takes a random improving swap rather than the best
 *  one, so re-draws land on different (still balanced) splits. */
export function balanceTeams(teams, byId, { rng = null, maxIterations = MAX_SWAP_ITERATIONS } = {}) {
  const get = lookup(byId);
  let current = teams;
  let spread = ovrSpread(current, get);
  for (let it = 0; it < maxIterations && spread > 0; it++) {
    const improving = [];
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        for (const a of current[i].players) {
          for (const b of current[j].players) {
            if ((get(a)?.position ?? null) !== (get(b)?.position ?? null)) continue;
            const next = applySwap(current, a, b);
            const s = ovrSpread(next, get);
            if (s < spread - 1e-9) improving.push({ next, spread: s });
          }
        }
      }
    }
    if (!improving.length) break;
    const pick = rng
      ? improving[Math.floor(rng() * improving.length)]
      : improving.reduce((best, c) => (c.spread < best.spread ? c : best));
    current = pick.next;
    spread = pick.spread;
  }
  return current;
}

/** Draw `players` into nTeams (clamped 2–6) teams: [{ id: "t1", name,
 *  color, players: [id] }].
 *  - balance "ovr" (default): goalkeepers first, then each position
 *    bucket sorted by OVR (± small jitter) and snake-dealt, then
 *    same-position swaps while they shrink max−min team OVR. Players with
 *    an unknown position are dealt last.
 *  - balance "random": the original draw — shuffle, order by position,
 *    snake-deal (players without a known position are left out, as before). */
export function drawTeams(players, nTeams = 2, { rng = Math.random, balance = "ovr", jitter = JITTER } = {}) {
  const n = Math.max(2, Math.min(6, nTeams));
  const teams = emptyTeams(n);
  if (balance === "random") {
    const shuffled = [...players].sort(() => rng() - 0.5);
    const order = POSITIONS.flatMap((pos) => shuffled.filter((p) => p.position === pos));
    return snakeDeal(order, teams);
  }
  const keyed = players.map((p) => ({ p, k: ovrOf(p) + (rng() * 2 - 1) * jitter }));
  const byKey = (list) => list.sort((a, b) => b.k - a.k).map((x) => x.p);
  const order = [
    ...POSITIONS.flatMap((pos) => byKey(keyed.filter((x) => x.p.position === pos))),
    ...byKey(keyed.filter((x) => !POSITIONS.includes(x.p.position))),
  ];
  const byId = new Map(players.map((p) => [p.id, p]));
  const balanced = balanceTeams(snakeDeal(order, teams), byId, { rng });
  // Shuffle which squad wears which bib, so a re-draw doesn't always hand
  // the top-OVR player to "Coletes".
  const squads = balanced.map((t) => t.players);
  for (let i = squads.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [squads[i], squads[j]] = [squads[j], squads[i]];
  }
  return balanced.map((t, i) => ({ ...t, players: squads[i] }));
}
