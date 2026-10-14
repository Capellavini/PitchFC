import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSeed, demoOp } from "./rivals.js";
import {
  normTerms, termsToRpc, diffTerms, sameTerms, normChallenge, effectiveStatus, challengeView, inboxBuckets,
  pendingActionCount, challengesVisible, challengeInviteUrl, readChallengeToken, zonedParts, zonedToIso,
  formatCost, parseCost, validateTerms, responseDeadline, withChallengeSeed, demoChallengeOp, demoExpire,
  demoMyChallenges, demoChallengeInvite, demoRivalMove, demoIncomingChallenge, normChallengeInvite,
  previousTerms, currentTerms, DEMO_CHALLENGE_TOKEN, MAX_PENDING_PER_TEAM,
} from "./rivalsChallenges.js";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const H = 3600e3;
const ana = { id: "ana", nick: "Ana" };
const bruno = { id: "bruno", nick: "Bruno" };
const paulo = { id: "paulo", nick: "Paulo" };
const kick = (h) => new Date(NOW + h * H).toISOString();

const run = (s, op, args, me, now = NOW) => {
  const r = demoChallengeOp(s, op, args, me, now);
  assert.ok(!r.error, `${op} failed: ${r.error}`);
  return r;
};
// Base state: seed + Ana (team A), Bruno (team B), Paulo (team C).
function world() {
  let s = demoSeed(NOW);
  const mk = (me, name) => { const r = demoOp(s, "create_team", { name, fields: {} }, me, NOW); s = r.state; return r.data.teamId; };
  const A = mk(ana, "Leões"), B = mk(bruno, "Dragões"), C = mk(paulo, "Águias");
  return { s: withChallengeSeed(s, NOW), A, B, C };
}

test("terms: norm, wire mapping, diff", () => {
  const t = normTerms({ kickoff_at: kick(48), duration_min: "60", venue_name: "X", cost_cents: "500" });
  assert.equal(t.durationMin, 60);
  assert.equal(t.costCents, 500);
  assert.equal(t.note, null);
  assert.deepEqual(termsToRpc({ kickoffAt: "k", costCents: 0, note: "", bogus: 1 }), { kickoff_at: "k", cost_cents: 0, note: null });
  const a = { ...t, kickoffAt: "2026-10-20T18:00:00.000Z" };
  const b = { ...a, kickoffAt: "2026-10-20T18:00:00Z", venueName: " X " };
  assert.ok(sameTerms(a, b), "same instant + trimmed text are equal");
  assert.deepEqual(diffTerms(a, { ...a, costSplit: "loser", durationMin: 90 }), ["durationMin", "costSplit"]);
});

test("time zones: wall clock ↔ instant (DST-safe)", () => {
  assert.equal(zonedToIso("2026-07-10", "20:00", "Europe/Lisbon"), "2026-07-10T19:00:00.000Z");
  assert.equal(zonedToIso("2026-12-10", "20:00", "Europe/Lisbon"), "2026-12-10T20:00:00.000Z");
  assert.equal(zonedToIso("2026-12-10", "20:00", "America/Sao_Paulo"), "2026-12-10T23:00:00.000Z");
  assert.deepEqual(zonedParts("2026-07-10T19:00:00Z", "Europe/Lisbon"), { date: "2026-07-10", time: "20:00" });
  assert.equal(zonedToIso("bad", "20:00"), null);
});

test("cost + links + deadline", () => {
  assert.equal(parseCost("60,5"), 6050);
  assert.equal(parseCost(""), null);
  assert.ok(Number.isNaN(parseCost("abc")));
  assert.match(formatCost(6000, "EUR"), /60/);
  assert.equal(challengeInviteUrl("tok123456", "https://x.pt"), "https://x.pt/?desafio=tok123456");
  assert.equal(readChallengeToken("?desafio=abcd1234abcd"), "abcd1234abcd");
  assert.equal(readChallengeToken("?desafio=<x>"), null);
  assert.equal(responseDeadline(kick(72), NOW), new Date(NOW + 24 * H).toISOString());
  assert.equal(responseDeadline(kick(10), NOW), new Date(NOW + 8 * H).toISOString());
  assert.equal(challengesVisible({ rivalsOn: false, flagOn: true }), false);
  assert.equal(challengesVisible({ rivalsOn: true, teamCount: 1 }), true);
  assert.equal(challengesVisible({ rivalsOn: true }), false);
});

test("validateTerms mirrors the SQL checks", () => {
  const ok = { kickoffAt: kick(48), timezone: "Europe/Lisbon", format: "7v7", durationMin: 60, fieldResponsible: "challenger", currency: "EUR", costSplit: "split", costCents: 6000 };
  assert.equal(validateTerms(ok, NOW), null);
  assert.equal(validateTerms({ ...ok, kickoffAt: kick(2) }, NOW), "kickoff_too_soon");
  assert.equal(validateTerms({ ...ok, kickoffAt: kick(24 * 200) }, NOW), "kickoff_too_far");
  assert.equal(validateTerms({ ...ok, costSplit: "winner" }, NOW), "invalid_split");
  assert.equal(validateTerms({ ...ok, durationMin: 10 }, NOW), "invalid_duration");
  assert.equal(validateTerms({ ...ok, costCents: -1 }, NOW), "invalid_cost");
});

test("demo: create → counter flips turn → stale refused → accept → one match", () => {
  let { s, A, B } = world();
  let r = run(s, "create_challenge", { fromTeamId: A, toTeamId: B, terms: { kickoffAt: kick(72), venueName: "Campo" }, clientRef: "ref-00000001" }, ana);
  s = r.state;
  const id = r.data.challengeId;
  assert.equal(run(s, "create_challenge", { fromTeamId: A, toTeamId: B, terms: { kickoffAt: kick(72) }, clientRef: "ref-00000001" }, ana).data.created, false);
  assert.equal(demoChallengeOp(s, "create_challenge", { fromTeamId: B, toTeamId: A, terms: { kickoffAt: kick(50) } }, bruno, NOW).error, "pair_open_challenge");
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: id, version: 1, action: "accept" }, ana, NOW).error, "not_your_turn");
  assert.equal(demoChallengeOp(s, "counter_challenge", { challengeId: id, baseVersion: 1, terms: { venueName: "Campo" } }, bruno, NOW).error, "no_changes");
  s = run(s, "counter_challenge", { challengeId: id, baseVersion: 1, terms: { kickoffAt: kick(96) } }, bruno).state;
  let ch = s.challenges.find((c) => c.id === id);
  assert.equal(ch.turnTeamId, A);
  assert.equal(ch.versions[0].outcome, "countered");
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: id, version: 2, action: "accept" }, bruno, NOW).error, "not_your_turn");
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: id, version: 1, action: "accept" }, ana, NOW).error, "stale_version");
  r = run(s, "respond_challenge", { challengeId: id, version: 2, action: "accept" }, ana);
  s = r.state;
  const again = run(s, "respond_challenge", { challengeId: id, version: 2, action: "accept" }, ana);
  assert.equal(again.data.matchId, r.data.matchId);
  assert.ok(again.data.alreadyAgreed);
  assert.equal(s.matches.filter((m) => m.challengeId === id).length, 1);
  const m = s.matches.find((x) => x.challengeId === id);
  assert.equal(m.fieldStatus, "unconfirmed");
  assert.equal(m.resultStatus, "none");
  assert.equal(m.kickoffAt, kick(96));

  // field + change + cancel (never a loss)
  assert.equal(demoChallengeOp(s, "set_field_status", { matchId: m.id, status: "confirmed" }, bruno, NOW).error, "not_field_responsible");
  s = run(s, "set_field_status", { matchId: m.id, status: "confirmed" }, ana).state;
  s = run(s, "propose_match_change", { matchId: m.id, baseVersion: 2, terms: { kickoffAt: kick(120) } }, bruno).state;
  assert.equal(demoChallengeOp(s, "propose_match_change", { matchId: m.id, baseVersion: 3, terms: { durationMin: 90 } }, bruno, NOW).error, "change_pending");
  ch = s.challenges.find((c) => c.id === id);
  assert.equal(previousTerms(ch, 3).version, 2, "a change is compared with the agreed version");
  s = run(s, "respond_match_change", { matchId: m.id, version: 3, action: "accept" }, ana).state;
  const m2 = s.matches.find((x) => x.id === m.id);
  assert.equal(m2.kickoffAt, kick(120));
  assert.equal(m2.fieldStatus, "unconfirmed", "new kickoff resets the field");
  s = run(s, "cancel_challenge", { challengeId: id, reason: "Chuva" }, bruno).state;
  const m3 = s.matches.find((x) => x.id === m.id);
  assert.equal(m3.matchStatus, "cancelled");
  assert.equal(m3.resultStatus, "none");
  assert.equal(m3.officialHomeScore, null);
});

test("demo: claimable link claimed once; preview states", () => {
  let { s, A, B, C } = world();
  const r = run(s, "create_challenge", { fromTeamId: A, toTeamId: null, terms: { kickoffAt: kick(48) } }, ana);
  s = r.state;
  const tok = r.data.token;
  assert.equal(demoChallengeInvite(s, tok, null, NOW).status, "pending");
  assert.deepEqual(demoChallengeInvite(s, tok, "bruno", NOW).viewer.eligibleTeams.map((t) => t.id), [B]);
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: r.data.challengeId, version: 1, action: "accept", asTeamId: B }, bruno, NOW).error, "invalid_token");
  s = run(s, "respond_challenge", { challengeId: r.data.challengeId, version: 1, action: "accept", asTeamId: B, token: tok }, bruno).state;
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: r.data.challengeId, version: 1, action: "accept", asTeamId: C, token: tok }, paulo, NOW).error, "challenge_claimed");
  assert.equal(demoChallengeInvite(s, tok, "paulo", NOW).status, "claimed");
  assert.equal(demoChallengeInvite(s, "nope", null, NOW).status, "not_found");
  assert.equal(demoChallengeInvite(s, DEMO_CHALLENGE_TOKEN, "ana", NOW).mode, "claimable", "seeded demo link");
});

test("demo: expiry is lazy + persisted; anti-spam", () => {
  let { s, A, C } = world();
  const r = run(s, "create_challenge", { fromTeamId: A, toTeamId: C, terms: { kickoffAt: kick(10) } }, ana);
  s = r.state;
  const later = NOW + 9 * H;
  assert.equal(demoChallengeOp(s, "respond_challenge", { challengeId: r.data.challengeId, version: 1, action: "accept" }, paulo, later).error, "challenge_expired");
  assert.equal(effectiveStatus(s.challenges.find((c) => c.id === r.data.challengeId), later), "expired");
  const e = demoExpire(s, later);
  assert.equal(e.challenges.find((c) => c.id === r.data.challengeId).status, "expired");
  for (let i = 0; i < MAX_PENDING_PER_TEAM; i += 1) s = run(s, "create_challenge", { fromTeamId: C, toTeamId: null, terms: { kickoffAt: kick(48 + i) } }, paulo).state;
  assert.equal(demoChallengeOp(s, "create_challenge", { fromTeamId: C, toTeamId: null, terms: { kickoffAt: kick(80) } }, paulo, NOW).error, "too_many_pending");
});

test("views, buckets, rival simulation, incoming challenge", () => {
  let { s, A } = world();
  s = demoIncomingChallenge(s, A, NOW);
  let mine = demoMyChallenges(s, "ana", NOW);
  assert.equal(mine.length, 1);
  let v = challengeView(mine[0], NOW);
  assert.equal(v.bucket, "received");
  assert.equal(v.nextAction, "respond");
  assert.equal(pendingActionCount(mine, NOW), 1);

  const r = run(s, "create_challenge", { fromTeamId: A, toTeamId: "demo-t-mu", terms: { kickoffAt: kick(72) } }, ana);
  s = r.state;
  const move = demoRivalMove(s, r.data.challengeId, [A], NOW);
  assert.equal(move.action, "countered");
  s = move.state;
  mine = demoMyChallenges(s, "ana", NOW);
  const sent = mine.find((c) => c.id === r.data.challengeId);
  v = challengeView(sent, NOW);
  assert.equal(v.stage, "respond");
  assert.equal(v.bucket, "sent");
  s = run(s, "respond_challenge", { challengeId: sent.id, version: 2, action: "accept" }, ana).state;
  const agreed = demoMyChallenges(s, "ana", NOW).find((c) => c.id === sent.id);
  assert.equal(challengeView(agreed, NOW).nextAction, "confirm_field");
  assert.equal(currentTerms(agreed).kickoffAt, agreed.match.kickoffAt);
  assert.equal(challengeView(agreed, Date.parse(agreed.match.kickoffAt) + 1).bucket, "history");
  const b = inboxBuckets(demoMyChallenges(s, "ana", NOW), NOW);
  assert.equal(b.received.length + b.sent.length + b.history.length, 2);
});

test("normChallenge / normChallengeInvite read the RPC shapes", () => {
  const ch = normChallenge({
    id: "c1", mode: "directed", status: "pending", current_version: 1, turn_team_id: "b", expires_at: kick(5),
    challenger: { id: "a", name: "A", captain_nick: "Ana" }, challenged: { id: "b", name: "B" }, my_team_id: "b", my_role: "captain",
    versions: [{ version: 1, kind: "proposal", proposed_by_team_id: "a", kickoff_at: kick(30), duration_min: 60 }], match: null,
  }, NOW);
  assert.equal(ch.challenger.captainNick, "Ana");
  assert.equal(ch.versions[0].durationMin, 60);
  assert.equal(challengeView(ch, NOW).nextAction, "respond");
  const inv = normChallengeInvite({ status: "pending", mode: "claimable", challenge_id: "c", current_version: 1, terms: { kickoff_at: kick(30) }, viewer: { logged_in: true, eligible_teams: [{ id: "t", name: "T", role: "vice" }] } });
  assert.equal(inv.viewer.eligibleTeams[0].role, "vice");
  assert.equal(normChallengeInvite({ status: "not_found" }).status, "not_found");
});


test("an accepted challenge reaches team Jogar/Matchday once with the opponent", async () => {
  const { matchesFromChallenges } = await import("./rivalsChallenges.js");
  const { nextTeamMatch } = await import("./rivals.js");
  const now = Date.parse("2026-10-13T12:00:00Z");
  const a = { id: "a", name: "Coletes", timezone: "Europe/Lisbon" };
  const b = { id: "b", name: "Galácticos", timezone: "Europe/Lisbon" };
  const c = { id: "c", myTeamId: "a", challenger: a, challenged: b, match: {
    id: "m", homeTeamId: "a", awayTeamId: "b", kickoffAt: "2026-10-13T20:00:00Z", matchStatus: "scheduled",
  } };
  const matches = matchesFromChallenges([c, { ...c, myTeamId: "b" }, { id: "pending", match: null }]);
  assert.equal(matches.length, 1);
  assert.equal(nextTeamMatch(matches, [a], now).opponent.name, "Galácticos");
  assert.equal(nextTeamMatch(matches, [b], now).opponent.name, "Coletes");
  assert.equal(nextTeamMatch(matches, [a], now).isToday, true);
  assert.equal(nextTeamMatch(matchesFromChallenges([{ ...c, match: { ...c.match, matchStatus: "cancelled" } }]), [a], now), null);
});
