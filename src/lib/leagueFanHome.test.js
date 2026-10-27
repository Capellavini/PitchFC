import test from "node:test";
import assert from "node:assert/strict";
import { buildLeagueDemoSeed, deriveLeague, ROLE_ACCOUNTS } from "./leagueDemo.js";
import { fanHome } from "./leagueFanHome.js";

const seed = () => { const state = buildLeagueDemoSeed(); return { state, derived: deriveLeague(state) }; };
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

test("a fan with no Fantasy squad has no points yet", () => {
  const { state, derived } = seed();
  const h = fanHome({ ...state, fantasy: {} }, derived, who);
  assert.deepEqual(h.fantasy, { picked: false, points: 0 });
});

test("followed teams always include the supported one, once", () => {
  const { state, derived } = seed();
  const h = fanHome({ ...state, prefs: { ...state.prefs, followTeamIds: [state.prefs.supportTeamId, "t3"] } }, derived, who);
  assert.deepEqual(h.followIds, [state.prefs.supportTeamId, "t3"]);
});
