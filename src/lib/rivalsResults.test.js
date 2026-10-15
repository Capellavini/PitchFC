import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoResultOp, demoReadResults, demoRivalResultMove, decorateDemoMatch, resultView, matchFeedItems, matchesAwaitingResult,
  teamRecord, headToHead, teamPlayerStats, myCareer, normResult, normAvailability, normScout, normH2H, normCareer, normTop,
  resultOutcome, toHomeAway, MAX_REVISIONS,
} from "./rivalsResults.js";
import { normMatch, matchesFromChallenges } from "./rivalsChallenges.js";
import { normRecord, emptyRecord, nextTeamMatch } from "./rivals.js";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const KICK = new Date(NOW - 2 * 3600e3).toISOString(); // already kicked off
const LATER = new Date(NOW + 48 * 3600e3).toISOString();

const mem = (teamId, playerId, role = "player", position = "Médio") => ({ teamId, playerId, nick: playerId, name: playerId, photoUrl: null, position, role, status: "active", joinedAt: "2026-09-01T00:00:00Z" });
const ana = { id: "ana", nick: "Ana" };   // captain A (home)
const vasco = { id: "vasco", nick: "Vasco" }; // vice A
const rui = { id: "rui", nick: "Rui" };    // player A
const paulo = { id: "paulo", nick: "Paulo" }; // captain B (away)
const bruno = { id: "bruno", nick: "Bruno" }; // player B
const carla = { id: "carla", nick: "Carla" }; // nobody

function fixture(kickoffAt = KICK) {
  return {
    teams: [{ id: "A", name: "Alfa", slug: "alfa" }, { id: "B", name: "Beta", slug: "beta" }, { id: "C", name: "Gama", slug: "gama" }],
    members: [
      mem("A", "ana", "captain"), mem("A", "vasco", "vice", "Defesa"), mem("A", "rui"),
      mem("B", "paulo", "captain"), mem("B", "bruno", "player", "Avançado"),
      mem("C", "zed", "captain"),
    ],
    challenges: [{ id: "ch1", updatedAt: "2026-10-01T00:00:00Z" }],
    matches: [{ id: "m1", challengeId: "ch1", homeTeamId: "A", awayTeamId: "B", kickoffAt, matchStatus: "scheduled", resultStatus: "none", officialHomeScore: null, officialAwayScore: null, confirmedRevision: null }],
    results: [], availability: [], lineups: [], playerStats: [],
  };
}
// Run an op that must succeed.
const run = (s, op, args, me, now = NOW) => {
  const r = demoResultOp(s, op, args, me, now);
  assert.ok(!r.error, `${op} failed: ${r.error}`);
  return r;
};
const fail = (s, op, args, me, code, now = NOW) => {
  const r = demoResultOp(s, op, args, me, now);
  assert.equal(r.error, code, `${op} expected ${code}, got ${r.error ?? "ok"}`);
  assert.equal(r.state, undefined);
};
const matchOf = (s, id = "m1") => s.matches.find((m) => m.id === id);

test("call-up: members answer before kickoff; non-members, bad status and after-kickoff are refused", () => {
  const s = fixture(LATER);
  const r = run(s, "set_match_availability", { matchId: "m1", status: "yes" }, rui);
  assert.deepEqual(r.data, { matchId: "m1", teamId: "A", status: "yes" });
  const again = run(r.state, "set_match_availability", { matchId: "m1", status: "maybe" }, rui);
  assert.equal(again.state.availability.length, 1); // upsert, not a second row
  assert.equal(again.state.availability[0].status, "maybe");
  fail(s, "set_match_availability", { matchId: "m1", status: "yes" }, carla, "not_team_member");
  fail(s, "set_match_availability", { matchId: "m1", status: "sim" }, rui, "invalid_status");
  fail(fixture(), "set_match_availability", { matchId: "m1", status: "yes" }, rui, "too_late");
  fail(s, "set_match_availability", { matchId: "nope", status: "yes" }, rui, "match_not_found");
  // the other team's answers are never visible to me
  const b = run(again.state, "set_match_availability", { matchId: "m1", status: "no" }, bruno);
  const read = demoReadResults(b.state, "get_match_availability", { matchId: "m1" }, rui).data;
  assert.equal(read.items.length, 3);
  assert.deepEqual(read.counts, { yes: 0, no: 0, maybe: 1, pending: 2 });
  assert.equal(demoReadResults(b.state, "get_match_availability", { matchId: "m1" }, carla).error, "not_team_member");
});

test("lineup: leaders only, own active members only, ≤ 22, replaces", () => {
  const s = fixture(LATER);
  fail(s, "set_match_lineup", { matchId: "m1", playerIds: ["rui"] }, rui, "not_team_leader");
  fail(s, "set_match_lineup", { matchId: "m1", playerIds: ["rui"] }, carla, "not_team_member");
  fail(s, "set_match_lineup", { matchId: "m1", playerIds: ["bruno"] }, ana, "invalid_lineup"); // other team
  fail(s, "set_match_lineup", { matchId: "m1", playerIds: ["rui", "rui"] }, ana, "invalid_lineup");
  fail(s, "set_match_lineup", { matchId: "m1", playerIds: Array.from({ length: 23 }, (_, i) => `p${i}`) }, ana, "invalid_lineup");
  const a = run(s, "set_match_lineup", { matchId: "m1", playerIds: ["ana", "rui"] }, vasco); // vice may
  assert.deepEqual(a.data, { matchId: "m1", teamId: "A", count: 2, statsRemoved: 0 });
  const b = run(a.state, "set_match_lineup", { matchId: "m1", playerIds: ["vasco"] }, ana);
  assert.equal(b.state.lineups.filter((l) => l.teamId === "A").length, 1);
  // each team's lineup is separate and the opponent's is hidden until the match is played
  const bl = run(b.state, "set_match_lineup", { matchId: "m1", playerIds: ["paulo"] }, paulo);
  assert.equal(demoReadResults(bl.state, "get_match_lineup", { matchId: "m1" }, ana).data.items.length, 1);
  // …and it can still be edited after kickoff (the squad sheet is filled in afterwards)
  assert.equal(run(fixture(), "set_match_lineup", { matchId: "m1", playerIds: ["ana"] }, ana).data.count, 1);
});

test("report → only the OTHER team confirms; nothing is official before that", () => {
  const s = fixture();
  fail(s, "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, rui, "not_team_leader");
  fail(fixture(LATER), "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana, "too_early");
  fail(s, "report_match_result", { matchId: "m1", homeScore: 100, awayScore: 2 }, ana, "invalid_score");
  fail(s, "report_match_result", { matchId: "m1", homeScore: -1, awayScore: 2 }, ana, "invalid_score");
  fail(s, "report_match_result", { matchId: "m1", homeScore: 1.5, awayScore: 2 }, ana, "invalid_score");
  const rep = run(s, "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2, note: "  jogo limpo " }, ana);
  assert.equal(rep.data.revision, 1);
  assert.equal(rep.data.kind, "report");
  assert.equal(rep.data.status, "proposed");
  assert.equal(rep.data.note, "jogo limpo");
  assert.equal(matchOf(rep.state).resultStatus, "reported");
  assert.equal(matchOf(rep.state).officialHomeScore, null);
  assert.equal(teamRecord(rep.state, "A").played, 0); // provisional ≠ official
  fail(rep.state, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 1 }, paulo, "result_exists");
  // the reporter can't confirm (or contest) their own; their vice neither
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, ana, "own_proposal");
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, vasco, "own_proposal");
  fail(rep.state, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 0, awayScore: 0 }, ana, "own_proposal");
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, bruno, "not_team_leader");
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, carla, "not_team_member");
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 7 }, paulo, "stale_revision");
  const ok = run(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo);
  assert.equal(ok.data.status, "confirmed");
  const m = matchOf(ok.state);
  assert.equal(m.officialHomeScore, 3);
  assert.equal(m.officialAwayScore, 2);
  assert.equal(m.resultStatus, "confirmed");
  assert.equal(m.matchStatus, "played");
  assert.equal(m.confirmedRevision, 1);
  assert.equal(teamRecord(ok.state, "A").wins, 1);
  assert.equal(teamRecord(ok.state, "B").losses, 1);
  assert.equal(run(ok.state, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).data.alreadyConfirmed, true); // idempotent
  assert.equal(demoResultOp(ok.state, "confirm_match_result", { matchId: "m1", revision: 2 }, paulo, NOW).error, "no_open_proposal");
});

test("withdraw: only the proposer's leader; first report → back to none and can be re-reported", () => {
  const rep = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana);
  fail(rep.state, "withdraw_result_proposal", { matchId: "m1", revision: 1 }, paulo, "not_proposer"); // a leader of the OTHER team
  fail(rep.state, "withdraw_result_proposal", { matchId: "m1", revision: 1 }, bruno, "not_team_leader");
  fail(rep.state, "withdraw_result_proposal", { matchId: "m1", revision: 1 }, carla, "not_team_member");
  fail(rep.state, "withdraw_result_proposal", { matchId: "m1", revision: 2 }, ana, "stale_revision");
  const w = run(rep.state, "withdraw_result_proposal", { matchId: "m1", revision: 1 }, vasco);
  assert.equal(w.data.status, "withdrawn");
  assert.equal(w.data.match.resultStatus, "none"); // the mutation also answers with the match summary
  assert.equal(matchOf(w.state).resultStatus, "none");
  // a repeated withdraw is idempotent (already_withdrawn) and changes nothing
  const again0 = run(w.state, "withdraw_result_proposal", { matchId: "m1", revision: 1 }, ana);
  assert.equal(again0.data.alreadyWithdrawn, true);
  assert.deepEqual(again0.state, w.state);
  fail(w.state, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo, "no_open_proposal");
  const again = run(w.state, "report_match_result", { matchId: "m1", homeScore: 2, awayScore: 2 }, paulo);
  assert.equal(again.data.revision, 2); // revisions are never reused
});

test("contest → counter revision; same score refused; confirming the counter ends it; ≥ 4 revisions → needs_help", () => {
  let s = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  fail(s, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 3, awayScore: 2 }, paulo, "same_score");
  const c = run(s, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 2, awayScore: 2, note: "foi empate" }, paulo);
  assert.equal(c.data.revision, 2);
  assert.equal(c.data.kind, "counter");
  assert.equal(c.data.reportedByTeamId, "B");
  assert.equal(matchOf(c.state).resultStatus, "disputed");
  assert.deepEqual(c.state.results.map((r) => r.status), ["disputed", "proposed"]);
  assert.equal(matchOf(c.state).officialHomeScore, null);
  // now it's A's turn to answer, and B can't confirm its own counter
  fail(c.state, "confirm_match_result", { matchId: "m1", revision: 2 }, paulo, "own_proposal");
  fail(c.state, "confirm_match_result", { matchId: "m1", revision: 1 }, ana, "stale_revision"); // old revision
  // A counters again → revision 3; a contest that would create the 4th revision of the chain → needs_help
  s = run(c.state, "contest_match_result", { matchId: "m1", revision: 2, homeScore: 3, awayScore: 1 }, ana).state;
  assert.equal(s.results.length, MAX_REVISIONS - 1);
  fail(s, "contest_match_result", { matchId: "m1", revision: 3, homeScore: 1, awayScore: 1 }, paulo, "needs_help");
  // …but the other team can still simply confirm the last proposal
  const done = run(s, "confirm_match_result", { matchId: "m1", revision: 3 }, paulo);
  assert.equal(matchOf(done.state).officialHomeScore, 3);
  assert.equal(done.state.results.filter((r) => r.status === "confirmed").length, 1);
  // contested revisions stay "disputed" (history as it happened), only a previously CONFIRMED one is superseded
  assert.equal(done.state.results.filter((r) => r.status === "disputed").length, 2);
  // a repeated confirm is idempotent
  const dup = run(done.state, "confirm_match_result", { matchId: "m1", revision: 3 }, paulo);
  assert.equal(dup.data.alreadyConfirmed, true);
  assert.deepEqual(dup.state, done.state);
});

test("withdrawing a counter re-opens the revision it contested (a dispute never dead-ends)", () => {
  let s = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  s = run(s, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 2, awayScore: 2 }, paulo).state;
  assert.equal(matchOf(s).resultStatus, "disputed");
  const w = run(s, "withdraw_result_proposal", { matchId: "m1", revision: 2 }, paulo);
  assert.deepEqual(w.state.results.map((r) => r.status), ["proposed", "withdrawn"]);
  assert.equal(matchOf(w.state).resultStatus, "reported");
  // A's original report is open again, waiting for B
  fail(w.state, "confirm_match_result", { matchId: "m1", revision: 1 }, ana, "own_proposal");
  assert.equal(run(w.state, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).data.status, "confirmed");
  // in a correction chain the match stays confirmed throughout
  let c = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  c = run(c, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).state;
  c = run(c, "propose_result_correction", { matchId: "m1", homeScore: 2, awayScore: 3 }, paulo).state;
  c = run(c, "contest_match_result", { matchId: "m1", revision: 2, homeScore: 4, awayScore: 3 }, ana).state;
  assert.equal(matchOf(c).resultStatus, "confirmed"); // 'disputed' is only for the FIRST report
  const cw = run(c, "withdraw_result_proposal", { matchId: "m1", revision: 3 }, ana);
  assert.equal(matchOf(cw.state).resultStatus, "confirmed");
  assert.deepEqual(cw.state.results.map((r) => r.status), ["confirmed", "proposed", "withdrawn"]);
  // the chain counts only revisions AFTER the last confirmed one: here 2 (correction + counter) → one more contest is fine
  const more = run(cw.state, "contest_match_result", { matchId: "m1", revision: 2, homeScore: 1, awayScore: 1 }, ana);
  assert.equal(more.data.revision, 4);
});

test("a player who leads both teams may propose but never confirms his own proposal", () => {
  const s = fixture();
  const both = { ...s, members: [...s.members, mem("B", "ana", "vice")] };
  const rep = run(both, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana);
  assert.equal(rep.data.reportedByTeamId, "A"); // the HOME team is used
  fail(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, ana, "own_proposal");
  fail(rep.state, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 0, awayScore: 0 }, ana, "own_proposal");
  // another leader of B can
  assert.equal(run(rep.state, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).data.status, "confirmed");
});

test("lineup drops stats of removed players; opponent lineup shows first names only; scout needs a live match", () => {
  let s = run(fixture(), "set_match_lineup", { matchId: "m1", playerIds: ["ana", "rui"] }, ana).state;
  s = run(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 2, assists: 0 }, { playerId: "ana", goals: 1, assists: 1 }] }, ana).state;
  const r = run(s, "set_match_lineup", { matchId: "m1", playerIds: ["ana"] }, ana);
  assert.equal(r.data.statsRemoved, 1);
  assert.deepEqual(r.state.playerStats.map((x) => x.playerId), ["ana"]);
  // B's lineup as seen by A once the match is played: first name only
  let p = { ...s, members: s.members.map((m) => (m.playerId === "bruno" ? { ...m, name: "Bruno Almeida" } : m)) };
  p = run(p, "set_match_lineup", { matchId: "m1", playerIds: ["bruno"] }, paulo).state;
  p = run(p, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana).state;
  p = run(p, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).state;
  const seen = demoReadResults(p, "get_match_lineup", { matchId: "m1" }, ana).data.items;
  assert.equal(seen.find((x) => x.playerId === "bruno").name, "Bruno");
  assert.equal(demoReadResults(p, "get_match_lineup", { matchId: "m1" }, paulo).data.items.find((x) => x.playerId === "bruno").name, "Bruno Almeida");
  // scout on a not-played match
  const np = run(fixture(), "mark_match_not_played", { matchId: "m1" }, ana).state;
  assert.equal(demoReadResults(np, "scout_opponent", { matchId: "m1" }, ana).error, "scout_unavailable");
});

test("correction keeps the official score (and every metric) until the other team confirms", () => {
  let s = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  s = run(s, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).state;
  fail(s, "propose_result_correction", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana, "same_score");
  fail(s, "propose_result_correction", { matchId: "m1", homeScore: 3, awayScore: 3 }, bruno, "not_team_leader");
  const cor = run(s, "propose_result_correction", { matchId: "m1", homeScore: 2, awayScore: 3, note: "marcámos mal" }, paulo);
  assert.equal(cor.data.kind, "correction");
  assert.equal(cor.data.revision, 2);
  // unchanged while pending
  assert.equal(matchOf(cor.state).officialHomeScore, 3);
  assert.equal(teamRecord(cor.state, "A").wins, 1);
  assert.equal(teamRecord(cor.state, "B").losses, 1);
  // result_status stays 'confirmed' during the correction: the UI reads the open revision instead
  assert.equal(matchOf(cor.state).resultStatus, "confirmed");
  assert.equal(cor.data.match.resultStatus, "confirmed");
  fail(cor.state, "propose_result_correction", { matchId: "m1", homeScore: 0, awayScore: 0 }, ana, "proposal_open");
  fail(fixture(), "propose_result_correction", { matchId: "m1", homeScore: 0, awayScore: 0 }, ana, "result_not_confirmed");
  fail(cor.state, "confirm_match_result", { matchId: "m1", revision: 2 }, paulo, "own_proposal");
  // withdrawing the correction restores "confirmed" and the score stands
  const back = run(cor.state, "withdraw_result_proposal", { matchId: "m1", revision: 2 }, paulo);
  assert.equal(matchOf(back.state).resultStatus, "confirmed");
  assert.equal(matchOf(back.state).officialHomeScore, 3);
  // confirming it supersedes the previous confirmed revision and flips the record
  const ok = run(cor.state, "confirm_match_result", { matchId: "m1", revision: 2 }, ana);
  assert.equal(matchOf(ok.state).officialHomeScore, 2);
  assert.equal(matchOf(ok.state).confirmedRevision, 2);
  assert.deepEqual(ok.state.results.map((r) => r.status), ["superseded", "confirmed"]);
  assert.equal(teamRecord(ok.state, "A").losses, 1);
  assert.equal(teamRecord(ok.state, "B").wins, 1);
  // a correction can also be contested (counter revision), the official score still stands
  const c2 = run(cor.state, "contest_match_result", { matchId: "m1", revision: 2, homeScore: 4, awayScore: 3 }, ana);
  assert.equal(matchOf(c2.state).officialHomeScore, 3);
  assert.equal(teamRecord(c2.state, "A").wins, 1);
});

test("not played: leader, after kickoff, nothing reported; never a loss", () => {
  fail(fixture(LATER), "mark_match_not_played", { matchId: "m1" }, ana, "too_early");
  fail(fixture(), "mark_match_not_played", { matchId: "m1" }, rui, "not_team_leader");
  const rep = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana);
  fail(rep.state, "mark_match_not_played", { matchId: "m1" }, ana, "not_played_blocked");
  const np = run(fixture(), "mark_match_not_played", { matchId: "m1", reason: "chuva" }, paulo);
  assert.equal(matchOf(np.state).matchStatus, "not_played");
  assert.equal(matchOf(np.state).notPlayedReason, "chuva");
  const rec = teamRecord(np.state, "B");
  assert.equal(rec.played, 0);
  assert.equal(rec.losses, 0);
  assert.equal(rec.notPlayed, 1);
  fail(np.state, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana, "match_not_scheduled");
});

test("stats: leader only, after kickoff, own lineup (or squad), 0–30; replaces", () => {
  const s = run(fixture(), "set_match_lineup", { matchId: "m1", playerIds: ["ana", "rui"] }, ana).state;
  fail(fixture(LATER), "set_match_player_stats", { matchId: "m1", stats: [] }, ana, "too_early");
  fail(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 1, assists: 0 }] }, rui, "not_team_leader");
  fail(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "vasco", goals: 1, assists: 0 }] }, ana, "invalid_stats"); // not in lineup
  fail(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 31, assists: 0 }] }, ana, "invalid_stats");
  fail(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 1, assists: -1 }] }, ana, "invalid_stats");
  fail(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 1, assists: 0 }, { playerId: "rui", goals: 1, assists: 0 }] }, ana, "invalid_stats");
  const a = run(s, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 2, assists: 1 }, { playerId: "ana", goals: 1, assists: 0 }] }, ana);
  assert.equal(a.data.count, 2);
  const b = run(a.state, "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "rui", goals: 3, assists: 0 }] }, vasco);
  assert.equal(b.state.playerStats.length, 1);
  // with no lineup any active member is allowed
  const open = run(fixture(), "set_match_player_stats", { matchId: "m1", stats: [{ playerId: "vasco", goals: 0, assists: 2 }] }, ana);
  assert.equal(open.data.count, 1);
});

test("player numbers only come from CONFIRMED matches; records/form/streak/h2h/career derive from them", () => {
  // Three confirmed meetings A vs B (W, W, L for A) + one still provisional.
  let s = fixture();
  const mk = (id, daysAgo) => ({ id, challengeId: "ch1", homeTeamId: "A", awayTeamId: "B", kickoffAt: new Date(NOW - daysAgo * 864e5).toISOString(), matchStatus: "scheduled", resultStatus: "none", officialHomeScore: null, officialAwayScore: null, confirmedRevision: null });
  s = { ...s, matches: [mk("m1", 0.1), mk("m2", 20), mk("m3", 10), mk("m4", 1)] };
  const play = (st, id, h, a, withLineup = true) => {
    if (withLineup) st = run(st, "set_match_lineup", { matchId: id, playerIds: ["ana", "rui"] }, ana).state;
    if (withLineup) st = run(st, "set_match_player_stats", { matchId: id, stats: [{ playerId: "rui", goals: h, assists: 1 }] }, ana).state;
    st = run(st, "report_match_result", { matchId: id, homeScore: h, awayScore: a }, ana).state;
    return run(st, "confirm_match_result", { matchId: id, revision: st.results.filter((r) => r.matchId === id).length }, paulo).state;
  };
  s = play(s, "m2", 4, 0); // W (oldest)
  s = play(s, "m3", 2, 1); // W
  s = play(s, "m4", 1, 3); // L (newest confirmed)
  // m1 provisional: reported but not confirmed, with goals entered
  s = run(s, "set_match_lineup", { matchId: "m1", playerIds: ["ana"] }, ana).state;
  s = run(s, "report_match_result", { matchId: "m1", homeScore: 9, awayScore: 0 }, ana).state;

  const rec = teamRecord(s, "A");
  assert.equal(rec.played, 3);
  assert.deepEqual([rec.wins, rec.draws, rec.losses], [2, 0, 1]);
  assert.deepEqual([rec.goalsFor, rec.goalsAgainst, rec.goalDiff], [7, 4, 3]);
  assert.deepEqual(rec.form, ["L", "W", "W"]); // newest first, provisional m1 excluded
  assert.deepEqual(rec.streak, { type: "L", n: 1 });
  assert.deepEqual(rec.biggestWin, { opponent: "Beta", score: "4-0" });
  assert.equal(rec.cleanSheets, 1);
  const recB = teamRecord(s, "B");
  assert.deepEqual(recB.form, ["W", "L", "L"]);
  assert.deepEqual(recB.streak, { type: "W", n: 1 });

  const h = headToHead(s, "A", "B");
  assert.equal(h.played, 3);
  assert.equal(h.confrontoN, 4);
  assert.deepEqual([h.wins, h.draws, h.losses], [2, 0, 1]);
  assert.equal(h.last.score, "1-3");
  assert.equal(headToHead(s, "A", "C").confrontoN, 1);

  const stats = teamPlayerStats(s, "A");
  const rui_ = stats.find((p) => p.playerId === "rui");
  assert.equal(rui_.appearances, 3); // m1's lineup doesn't count
  assert.equal(rui_.goals, 4 + 2 + 1);
  assert.equal(rui_.assists, 3);
  assert.equal(stats.find((p) => p.playerId === "ana").appearances, 3);
  assert.equal(stats[0].playerId, "rui"); // sorted by goals

  const career = myCareer(s, "rui");
  assert.equal(career.length, 1);
  assert.deepEqual([career[0].appearances, career[0].goals, career[0].assists, career[0].wins, career[0].losses], [3, 7, 3, 2, 1]);
  assert.equal(myCareer(s, "carla").length, 0);
});

test("cancellations and late cancellations are counted separately and are not losses", () => {
  let s = fixture(LATER);
  s = { ...s, matches: [
    { ...s.matches[0], id: "c1", matchStatus: "cancelled", cancelledByTeamId: "A", cancelledAt: new Date(NOW).toISOString(), kickoffAt: new Date(NOW + 3 * 3600e3).toISOString() },
    { ...s.matches[0], id: "c2", matchStatus: "cancelled", cancelledByTeamId: "A", cancelledAt: new Date(NOW - 5 * 864e5).toISOString(), kickoffAt: new Date(NOW + 2 * 864e5).toISOString() },
  ] };
  const rec = teamRecord(s, "A");
  assert.deepEqual([rec.played, rec.losses, rec.cancellations, rec.lateCancellations], [0, 0, 2, 1]);
  assert.equal(teamRecord(s, "B").cancellations, 0);
});

test("scout: only members of the match, only the opponent, derived stats; OVR comes from attrs", () => {
  const s = run(fixture(), "set_match_lineup", { matchId: "m1", playerIds: ["paulo", "bruno"] }, paulo).state;
  const r = demoReadResults(s, "scout_opponent", { matchId: "m1" }, ana);
  assert.ok(!r.error);
  const scout = normScout(r.data);
  assert.equal(scout.team.id, "B");
  assert.deepEqual(scout.items.map((p) => p.playerId).sort(), ["bruno", "paulo"]);
  assert.ok(scout.items.every((p) => Number.isInteger(p.ovr) && p.ovr > 0 && p.attrs));
  assert.equal(scout.h2h.confrontoN, 1);
  assert.equal(demoReadResults(s, "scout_opponent", { matchId: "m1" }, carla).error, "not_team_member");
  // no phone/email anywhere in the payload
  assert.ok(!JSON.stringify(r.data.items).match(/phone|email/i));
});

test("resultView: phases, who can do what, help after 4 revisions or 7 days", () => {
  const view = (s, team, leader, now = NOW) => {
    const m = normMatch(decorateDemoMatch(s, s.matches[0], team, "x"));
    return resultView(m, { myTeamId: team, leader, now });
  };
  let s = fixture(LATER);
  assert.equal(view(s, "A", true).phase, "before");
  assert.equal(view(s, "A", true).canReport, false);
  s = fixture();
  assert.equal(view(s, "A", true).phase, "ready");
  assert.equal(view(s, "A", true).canReport, true);
  assert.equal(view(s, "A", false).canReport, false); // members never see leader actions
  s = run(s, "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  const mine = view(s, "A", true);
  assert.equal(mine.phase, "reported");
  assert.equal(mine.byMe, true);
  assert.equal(mine.canRespond, false);
  assert.equal(mine.canWithdraw, true);
  assert.equal(mine.waitingOnOther, true);
  assert.deepEqual([mine.open.mine, mine.open.theirs], [3, 2]);
  const theirs = view(s, "B", true);
  assert.equal(theirs.canRespond, true);
  assert.equal(theirs.canContest, true);
  assert.equal(theirs.canWithdraw, false);
  assert.deepEqual([theirs.open.mine, theirs.open.theirs], [2, 3]); // the away team sees its own score first
  assert.equal(view(s, "B", false).canRespond, false);
  assert.equal(theirs.needsHelp, false);
  assert.equal(view(s, "B", true, NOW + 8 * 864e5).needsHelp, true);
  s = run(s, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 2, awayScore: 2 }, paulo).state;
  assert.equal(view(s, "A", true).phase, "disputed");
  s = run(s, "confirm_match_result", { matchId: "m1", revision: 2 }, ana).state;
  const done = view(s, "A", true);
  assert.equal(done.phase, "confirmed");
  assert.equal(done.official.outcome, "D");
  assert.equal(done.canCorrect, true);
  assert.equal(view(s, "A", false).canCorrect, false);
  s = run(s, "propose_result_correction", { matchId: "m1", homeScore: 3, awayScore: 2 }, ana).state;
  const cor = view(s, "A", true);
  assert.equal(cor.phase, "correction");
  assert.equal(cor.official.outcome, "D"); // still the old official result
  assert.equal(cor.waitingOnOther, true);
  assert.equal(view(s, "B", true).canRespond, true);
  // three revisions already → a contest would create the 4th: blocked, "Fala connosco", confirming still possible
  let s4 = run(fixture(), "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana).state;
  s4 = run(s4, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 0, awayScore: 0 }, paulo).state;
  assert.equal(view(s4, "A", true).canContest, true);
  assert.equal(view(s4, "A", true).needsHelp, false);
  s4 = run(s4, "contest_match_result", { matchId: "m1", revision: 2, homeScore: 2, awayScore: 0 }, ana).state;
  const stuck = view(s4, "B", true);
  assert.equal(stuck.canContest, false);
  assert.equal(stuck.canRespond, true);
  assert.equal(stuck.stuck, true);
  assert.equal(stuck.needsHelp, true);
  // after a confirmation the chain is shorter than the total, so the UI doesn't pre-block (the server decides)
  const settled4 = run(s4, "confirm_match_result", { matchId: "m1", revision: 3 }, paulo).state;
  const corr = run(settled4,"propose_result_correction", { matchId: "m1", homeScore: 5, awayScore: 5 }, ana).state;
  assert.equal(view(corr, "B", true).canContest, true);
  assert.equal(view(corr, "B", true).phase, "correction");
});

test("feed items: confirm-waiting first, then report-nudges, then recent confirmed results", () => {
  const matches = (s, team = "A", role = "captain") => matchesFromChallenges([{
    id: "ch1", myTeamId: team, myRole: role, challenger: { id: "A", name: "Alfa" }, challenged: { id: "B", name: "Beta" },
    match: normMatch(decorateDemoMatch(s, s.matches[0], team, "x")),
  }]);
  const s0 = fixture();
  assert.deepEqual(matchFeedItems(matches(s0), NOW).map((i) => i.kind), ["result_report"]);
  assert.deepEqual(matchFeedItems(matches(s0, "A", "player"), NOW), []); // members get no leader nudge
  const s1 = run(s0, "report_match_result", { matchId: "m1", homeScore: 2, awayScore: 1 }, ana).state;
  assert.deepEqual(matchFeedItems(matches(s1, "A"), NOW), []); // the reporter waits: nothing to do
  const waiting = matchFeedItems(matches(s1, "B", "vice"), NOW);
  assert.equal(waiting[0].kind, "result_confirm");
  assert.equal(waiting[0].needsAction, true);
  assert.equal(waiting[0].opponent.name, "Alfa");
  const s2 = run(s1, "confirm_match_result", { matchId: "m1", revision: 1 }, paulo).state;
  const done = matchFeedItems(matches(s2, "A", "player"), NOW);
  assert.deepEqual(done.map((i) => i.kind), ["result_confirmed"]);
  assert.deepEqual(matchFeedItems(matches(s2, "A", "player"), NOW + 6 * 864e5), []);
  // matchesAwaitingResult drives the Matchday list
  assert.equal(matchesAwaitingResult(matches(s0), [{ id: "A" }], NOW).length, 1);
  assert.equal(matchesAwaitingResult(matches(s2), [{ id: "A" }], NOW).length, 0);
});

test("the demo rival confirms what MY team proposes (report, counter, correction), never its own", () => {
  const user = ["A"];
  const s0 = fixture();
  assert.equal(demoRivalResultMove(s0, "m1", user, NOW), null); // nothing open
  const rep = run(s0, "report_match_result", { matchId: "m1", homeScore: 3, awayScore: 1 }, ana).state;
  const mv = demoRivalResultMove(rep, "m1", user, NOW);
  assert.equal(mv.action, "confirmed");
  assert.equal(matchOf(mv.state).officialHomeScore, 3);
  // it filled its own sheet: lineup + exactly the goals it conceded-to-itself (1)
  assert.ok(mv.state.lineups.some((l) => l.teamId === "B"));
  assert.equal(mv.state.playerStats.filter((r) => r.teamId === "B").reduce((n, r) => n + r.goals, 0), 1);
  assert.equal(demoRivalResultMove(mv.state, "m1", user, NOW), null);
  // the rival's own report waits for me
  const rr = demoResultOp(s0, "demo_rival_reports", { matchId: "m1" }, ana, NOW, { userTeamIds: user });
  assert.ok(!rr.error);
  assert.equal(rr.data.reportedByTeamId, "B");
  assert.equal(demoRivalResultMove(rr.state, "m1", user, NOW), null);
  const contested = run(rr.state, "contest_match_result", { matchId: "m1", revision: 1, homeScore: 0, awayScore: 0 }, ana).state;
  assert.equal(demoRivalResultMove(contested, "m1", user, NOW).action, "confirmed"); // counter accepted
});

test("demo_advance_match moves a future kickoff into the past (demo only helper)", () => {
  const s = fixture(LATER);
  fail(s, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana, "too_early");
  const adv = run(s, "demo_advance_match", { matchId: "m1" }, ana);
  assert.ok(Date.parse(matchOf(adv.state).kickoffAt) < NOW);
  run(adv.state, "report_match_result", { matchId: "m1", homeScore: 1, awayScore: 0 }, ana);
});

test("normalisers accept the contract's snake_case and the demo's camelCase", () => {
  const r = normResult({ match_id: "m", revision: 2, kind: "counter", status: "proposed", home_score: "3", away_score: 1, reported_by_team_id: "B", note: null, created_at: "t" });
  assert.deepEqual([r.revision, r.homeScore, r.awayScore, r.reportedByTeamId], [2, 3, 1, "B"]);
  const av = normAvailability({ items: [{ player_id: "p", nick: "Rui", status: "yes", photo_url: "u", updated_at: "x" }, { player_id: "q", nick: "Zé", status: null }], counts: { yes: 1, no: 0, maybe: 0, pending: 1 } });
  assert.equal(av.items[0].photoUrl, "u");
  assert.deepEqual(av.counts, { yes: 1, no: 0, maybe: 0, pending: 1 });
  assert.deepEqual(normAvailability({ items: [{ playerId: "p", status: "no" }, { playerId: "q", status: null }] }).counts, { yes: 0, no: 1, maybe: 0, pending: 1 });
  const rec = normRecord({ played: 5, wins: 3, draws: 1, losses: 1, gf: 12, ga: 7, gd: 5, form: ["W", "D"], streak: { type: "W", n: 2 }, biggest_win: { opponent: "X", score: "4-0" }, clean_sheets: 2, cancellations: 1, late_cancellations: 1, not_played: 0 });
  assert.deepEqual([rec.goalsFor, rec.goalsAgainst, rec.goalDiff, rec.cleanSheets, rec.lateCancellations], [12, 7, 5, 2, 1]);
  assert.deepEqual(rec.streak, { type: "W", n: 2 });
  assert.deepEqual(normRecord({ played: 1, wins: 1 }, ["W"]).form, ["W"]); // team_profile.form override
  assert.deepEqual(emptyRecord().streak, { type: null, n: 0 });
  const h = normH2H({ played: 2, wins: 1, draws: 1, losses: 0, gf: 5, ga: 3, last: { kickoff_at: "t", score: "2-2" }, confronto_n: 3 });
  assert.equal(h.confrontoN, 3);
  assert.equal(h.last.score, "2-2");
  assert.equal(normH2H(null).confrontoN, 1);
  const sc = normScout({ team: { id: "T", name: "Beta" }, record: { played: 1 }, h2h: { played: 0 }, items: [{ player_id: "p", nick: "Bru", position: "Avançado", attrs: { rem: 90, rit: 90, dri: 90, pas: 90, fis: 90, def: 90 }, appearances: 2, goals: 3, assists: 1 }] });
  assert.equal(sc.items[0].ovr, 90);
  assert.equal(sc.items[0].goals, 3);
  assert.deepEqual(normCareer({ items: [{ team_id: "t", name: "N", slug: "n", appearances: 4, goals: 2, assists: 1, wins: 3, draws: 0, losses: 1 }] }).items[0].wins, 3);
  assert.deepEqual(normTop([{ nick: "Rui", n: 5 }]), [{ nick: "Rui", n: 5 }]);
  assert.deepEqual(normTop(undefined), []);
});

test("normMatch reads the PR6 additions and stays backward compatible without them", () => {
  const bare = normMatch({ id: "m", home_team_id: "A", away_team_id: "B", kickoff_at: KICK, agreed_version: 1, match_status: "scheduled", result_status: "none" });
  assert.equal(bare.result.status, "none");
  assert.equal(bare.result.openRevision, null);
  assert.equal(bare.myAvailability, null);
  assert.deepEqual(bare.availabilityCounts, { yes: 0, no: 0, maybe: 0, pending: 0 });
  const full = normMatch({
    id: "m", home_team_id: "A", away_team_id: "B", kickoff_at: KICK, agreed_version: 1, match_status: "scheduled", result_status: "reported",
    result: { status: "reported", official_home_score: null, official_away_score: null, revisions_count: 1,
      open_revision: { revision: 1, kind: "report", status: "proposed", home_score: 2, away_score: 1, reported_by_team_id: "A", created_at: "2026-10-14T10:00:00Z" } },
    my_availability: "maybe", availability_counts: { yes: 4, no: 1, maybe: 1, pending: 2 }, lineup_count: 7, stats_recorded: true,
  });
  assert.equal(full.result.openRevision.homeScore, 2);
  assert.equal(full.result.revisionsCount, 1);
  assert.equal(full.myAvailability, "maybe");
  assert.equal(full.availabilityCounts.pending, 2);
  assert.equal(full.lineupCount, 7);
  assert.equal(full.statsRecorded, true);
  // next-match picks the RSVP up for the Jogar tab
  const next = nextTeamMatch([{ ...full, kickoffAt: LATER, homeTeamId: "A", awayTeamId: "B", challengeId: "ch1" }], [{ id: "A", name: "Alfa", role: "captain" }], NOW);
  assert.equal(next.myRsvp, "maybe");
  assert.equal(next.challengeId, "ch1");
  assert.equal(next.myRole, "captain");
  assert.equal(next.kickoffPassed, false);
});

test("helpers: outcome and home/away orientation", () => {
  assert.equal(resultOutcome(2, 1), "W");
  assert.equal(resultOutcome(1, 1), "D");
  assert.equal(resultOutcome(0, 3), "L");
  const m = { homeTeamId: "A", awayTeamId: "B" };
  assert.deepEqual(toHomeAway(m, "A", 3, 1), { homeScore: 3, awayScore: 1 });
  assert.deepEqual(toHomeAway(m, "B", 3, 1), { homeScore: 1, awayScore: 3 });
});
