import test from "node:test";
import assert from "node:assert/strict";
import { buildLeagueDemoSeed, deriveLeague, ROLE_ACCOUNTS } from "./leagueDemo.js";
import { teamHome } from "./leagueTeamHome.js";

const seed = () => { const state = buildLeagueDemoSeed(); return { state, derived: deriveLeague(state) }; };
const who = (role) => ({ teamId: ROLE_ACCOUNTS[role].teamId, playerId: ROLE_ACCOUNTS[role].playerId, accountId: ROLE_ACCOUNTS[role].accountId, role });

test("the captain gets the team's duties; the athlete does not", () => {
  const { state, derived } = seed();
  const cap = teamHome(state, derived, who("captain"));
  const ath = teamHome(state, derived, who("athlete"));
  assert.ok(cap.queue.some((i) => i.kind === "lineup"), "captain: call-up missing");
  assert.ok(cap.queue.some((i) => i.kind === "contest"), "captain: provisional result to review");
  assert.ok(!ath.queue.some((i) => ["lineup", "contest", "banned_in_lineup"].includes(i.kind)));
});

test("the queue is ordered by urgency and every item names a match", () => {
  const { state, derived } = seed();
  const { queue } = teamHome(state, derived, who("captain"));
  const kinds = queue.map((i) => i.kind);
  assert.ok(kinds.indexOf("lineup") < kinds.indexOf("contest"));
  assert.ok(queue.every((i) => i.matchId && i.key));
});

test("a vote already cast leaves the queue", () => {
  const { state, derived } = seed();
  const w = who("athlete");
  const voteItem = teamHome(state, derived, w).queue.find((i) => i.kind === "vote");
  assert.ok(voteItem, "athlete: fan vote open");
  const voted = { ...state, fanVotes: { ...state.fanVotes, [voteItem.matchId]: { [w.accountId]: "t2p1" } } };
  assert.ok(!teamHome(voted, derived, w).queue.some((i) => i.kind === "vote"));
});

test("the team knows its next game, recent results and table position", () => {
  const { state, derived } = seed();
  const h = teamHome(state, derived, who("captain"));
  assert.ok(h.next);
  assert.ok(["scheduled", "live", "postponed"].includes(h.next.state));
  assert.ok(h.recent.length > 0);
  assert.ok(h.position >= 0);
  assert.equal(h.row.id, "t1");
});
