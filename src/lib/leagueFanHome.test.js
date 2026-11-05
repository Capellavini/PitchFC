import test from "node:test";
import assert from "node:assert/strict";
import { loadExample, deriveLeague, ROLE_ACCOUNTS, normalizeLeagueState, emptyLeagueState } from "./leagueDemo.js";
import { fanHome } from "./leagueFanHome.js";

const seed = () => { const state = loadExample(); return { state, derived: deriveLeague(state) }; };
const who = { accountId: ROLE_ACCOUNTS.fan.accountId };

test("a fan sees their supported team: position, form and next game", () => {
  const { state, derived } = seed();
  const h = fanHome(state, derived, who);
  assert.equal(h.supportId, state.prefs.supportTeamId);
  assert.ok(h.position >= 0 && h.row.id === h.supportId);
  assert.ok(h.next && ["scheduled", "live", "postponed"].includes(h.next.state));
  assert.ok(Array.isArray(h.form));
});

test("the vote is offered until the fan has voted", () => {
  const { state, derived } = seed();
  const h = fanHome(state, derived, who);
  assert.ok(h.voteMatch, "a vote is open in the demo");
  assert.equal(h.myVote, null);
  const voted = { ...state, fanVotes: { ...state.fanVotes, [h.voteMatch.id]: { [who.accountId]: "t2p1" } } };
  assert.equal(fanHome(voted, derived, who).myVote, "t2p1");
});

test("highlights, the current round and recent results come from official data", () => {
  const { state, derived } = seed();
  const h = fanHome(state, derived, who);
  assert.ok(h.topScorer && h.topScorer.value > 0);
  assert.ok(h.roundMatches.length > 0 && h.roundMatches.every((m) => m.round === h.round));
  assert.ok(h.recent.length > 0 && h.recent.length <= 3);
});

test("the card reads the Pitch Manager: official points with the Conexão, and the position among managers", () => {
  const { state, derived } = seed();
  const h = fanHome(state, derived, who);
  // example league: the seeded squad is in place; round 1 is the only official round (47 + 3 of the Conexão)
  assert.deepEqual(h.fantasy, { picked: true, points: 50, rank: 1, of: 6 });
  // the retired preview picks no longer drive the card
  assert.deepEqual(fanHome({ ...state, fantasy: { [who.accountId]: ["t1p1"] } }, derived, who).fantasy, h.fantasy);
});

test("with the Pitch Manager module off the card has nothing to show", () => {
  const { state, derived } = seed();
  const off = { ...state, modules: { ...state.modules, fantasy: false } };
  // the registry mirrors the state's modules, so install them the way the app does
  normalizeLeagueState(off);
  try { assert.deepEqual(fanHome(off, derived, who).fantasy, { picked: false, points: 0, rank: null, of: 0 }); } finally { normalizeLeagueState(state); }
});

test("followed teams always include the supported one, once", () => {
  const { state, derived } = seed();
  const h = fanHome({ ...state, prefs: { ...state.prefs, followTeamIds: [state.prefs.supportTeamId, "t3"] } }, derived, who);
  assert.deepEqual(h.followIds, [state.prefs.supportTeamId, "t3"]);
});

test("a brand-new league: the card does not crash and the fan has no squad", () => {
  const empty = emptyLeagueState();
  const state = { ...empty, modules: { ...empty.modules, fantasy: true } };
  normalizeLeagueState(state);
  try {
    const h = fanHome(state, deriveLeague(state), who);
    assert.deepEqual([h.fantasy.picked, h.fantasy.points], [false, 0]);
  } finally { loadExample(); }
});
