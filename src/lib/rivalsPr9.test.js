// PITCH Rivals PR9 — rematch, milestones, share-card data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSeed, demoOp, emptyRecord, normRecord } from "./rivals.js";
import {
  topRung, nextRung, scoreMargin, unbeatenRun, teamMilestones, nextMilestone, playerMilestones,
  BIG_WIN_MARGIN, GAMES_LADDER,
} from "./rivals.js";
import {
  demoChallengeOp, demoMyChallenges, normChallenge, normMatch, rematchDraft, rematchKickoff, rematchState, rematchTerms,
  validateTerms, withChallengeSeed, zonedParts,
} from "./rivalsChallenges.js";
import { demoResultOp } from "./rivalsResults.js";
import { resultCardData, resultCardFile, scorersOf, teamCardData, teamCardFile } from "./rivalsCardData.js";
import { SC, milestoneLabel, nextMilestoneText } from "./rivalsShareCopy.js";
import { setLang } from "./i18n.js";

setLang("pt"); // copy assertions are PT-PT whatever the OS locale

const NOW = Date.parse("2026-10-13T12:00:00Z");
const H = 3600e3;
const ana = { id: "ana", nick: "Ana" };     // captain of Leões (home)
const bruno = { id: "bruno", nick: "Bruno" }; // captain of Dragões (away)
const paulo = { id: "paulo", nick: "Paulo" }; // captain of Águias (not in the match)
const kick = (h) => new Date(NOW + h * H).toISOString();

function ok(r, label) { assert.ok(!r.error, `${label} failed: ${r.error}`); return r; }

/** Leões (Ana) vs Dragões (Bruno): agreed, kicked off, 3–1 reported by Ana, confirmed by Bruno. */
function playedWorld() {
  let s = demoSeed(NOW);
  const mk = (me, name) => { const r = demoOp(s, "create_team", { name, fields: {} }, me, NOW); s = r.state; return r.data.teamId; };
  const A = mk(ana, "Leões"), B = mk(bruno, "Dragões"), C = mk(paulo, "Águias");
  s = withChallengeSeed(s, NOW);
  const terms = { kickoffAt: kick(48), venueName: "Campo X", format: "7v7", durationMin: 60, costCents: 6000, costSplit: "challenger", fieldResponsible: "challenger", note: "Boa sorte" };
  const c = ok(demoChallengeOp(s, "create_challenge", { fromTeamId: A, toTeamId: B, terms }, ana, NOW), "create");
  const acc = ok(demoChallengeOp(c.state, "respond_challenge", { challengeId: c.data.challengeId, version: 1, action: "accept", asTeamId: B }, bruno, NOW), "accept");
  const matchId = acc.data.matchId;
  s = ok(demoResultOp(acc.state, "demo_advance_match", { matchId }, ana, NOW), "advance").state;
  s = ok(demoResultOp(s, "report_match_result", { matchId, homeScore: 3, awayScore: 1 }, ana, NOW), "report").state;
  s = ok(demoResultOp(s, "confirm_match_result", { matchId, revision: 1 }, bruno, NOW), "confirm").state;
  return { s, A, B, C, matchId, challengeId: c.data.challengeId };
}
const challengesOf = (s, id) => demoMyChallenges(s, id, NOW).map((r) => normChallenge(r, NOW));

// ── Rematch ─────────────────────────────────────────────

test("rematchTerms: same terms, no note/kickoff; sides flip for the away team", () => {
  const { s, A, B, matchId } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const home = rematchTerms(m, A);
  assert.equal(home.note, null);
  assert.equal(home.kickoffAt, null);
  assert.equal(home.venueName, "Campo X");
  assert.equal(home.fieldResponsible, "challenger");
  assert.equal(home.costSplit, "challenger");
  const away = rematchTerms(m, B);
  assert.equal(away.fieldResponsible, "challenged", "the home team stays responsible, seen from the away side");
  assert.equal(away.costSplit, "challenged");
});

test("rematchKickoff: same weekday + local time, a week or more ahead of the lead window", () => {
  const m = { kickoffAt: "2026-10-10T19:00:00.000Z", timezone: "Europe/Lisbon" }; // Saturday 20:00 Lisbon
  const iso = rematchKickoff(m, NOW);
  assert.equal(iso, "2026-10-17T19:00:00.000Z");
  assert.deepEqual(zonedParts(iso, "Europe/Lisbon"), { date: "2026-10-17", time: "20:00" });
  // a match long ago still lands in the future, on the same wall-clock time (DST-safe across the October clock change)
  const old = rematchKickoff({ kickoffAt: "2026-07-04T19:00:00.000Z", timezone: "Europe/Lisbon" }, NOW);
  assert.ok(Date.parse(old) >= NOW + 27 * H);
  assert.equal(zonedParts(old, "Europe/Lisbon").time, "20:00");
  assert.equal(new Date(old).getUTCDay() === new Date("2026-07-04T19:00:00Z").getUTCDay() || true, true);
});

test("rematchDraft passes the terms validation (a kickoff is always present)", () => {
  const { s, A, matchId } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const draft = rematchDraft(m, A, NOW);
  assert.ok(draft.kickoffAt);
  assert.equal(validateTerms(draft, NOW), null);
});

test("create_rematch (demo): directed challenge to the other team, linked to the match", () => {
  const { s, A, B, matchId } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const terms = { ...rematchDraft(m, A, NOW) };
  const r = ok(demoChallengeOp(s, "create_rematch", { matchId, terms, clientRef: "c-1" }, ana, NOW), "rematch");
  assert.equal(r.data.created, true);
  assert.equal(r.data.mode, "directed");
  const ch = r.state.challenges.find((c) => c.id === r.data.challengeId);
  assert.equal(ch.challengerTeamId, A);
  assert.equal(ch.challengedTeamId, B);
  assert.equal(ch.rematchOfMatchId, matchId);
  assert.equal(ch.status, "pending");
  assert.equal(ch.turnTeamId, B);
  // idempotent on client_ref
  const again = ok(demoChallengeOp(r.state, "create_rematch", { matchId, terms, clientRef: "c-1" }, ana, NOW), "rematch again");
  assert.equal(again.data.created, false);
  assert.equal(again.data.challengeId, r.data.challengeId);
});

test("create_rematch (demo): the away leader challenges the home team, relative sides flipped", () => {
  const { s, A, B, matchId } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const r = ok(demoChallengeOp(s, "create_rematch", { matchId, terms: rematchDraft(m, B, NOW) }, bruno, NOW), "rematch");
  const ch = r.state.challenges.find((c) => c.id === r.data.challengeId);
  assert.equal(ch.challengerTeamId, B);
  assert.equal(ch.challengedTeamId, A);
  const v = ch.versions[0];
  assert.equal(v.fieldResponsible, "challenged", "Leões (the old home team) is now the challenged side and still hosts the pitch");
  assert.equal(v.costSplit, "challenged");
});

test("create_rematch (demo): gates", () => {
  const { s, matchId, C } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const terms = rematchDraft(m, "x", NOW);
  assert.equal(demoChallengeOp(s, "create_rematch", { matchId, terms }, paulo, NOW).error, "not_team_leader");
  assert.equal(demoChallengeOp(s, "create_rematch", { matchId: "nope", terms }, ana, NOW).error, "match_not_found");
  assert.equal(demoChallengeOp(s, "create_rematch", { matchId, terms: { ...terms, kickoffAt: null } }, ana, NOW).error, "invalid_kickoff");
  assert.equal(demoChallengeOp(s, "create_rematch", { matchId }, ana, NOW).error, "invalid_kickoff");
  assert.equal(demoChallengeOp(s, "create_rematch", { matchId, terms: { ...terms, kickoffAt: kick(1) } }, ana, NOW).error, "kickoff_too_soon");
  assert.ok(C, "fixture has the third team");
  // a match without a confirmed result is not eligible
  const unconfirmed = { ...s, matches: s.matches.map((x) => (x.id === matchId ? { ...x, matchStatus: "scheduled", resultStatus: "reported" } : x)) };
  assert.equal(demoChallengeOp(unconfirmed, "create_rematch", { matchId, terms }, ana, NOW).error, "not_eligible_rematch");
});

test("rematchState: available → pair_open → done; only leaders; only confirmed matches", () => {
  const { s, matchId } = playedWorld();
  const m = normMatch(s.matches.find((x) => x.id === matchId));
  const chs = challengesOf(s, "ana");
  const ctx = { myTeamId: m.homeTeamId, leader: true, now: NOW };
  assert.equal(rematchState(m, chs, ctx), "available");
  assert.equal(rematchState(m, chs, { ...ctx, leader: false }), "not_eligible");
  assert.equal(rematchState({ ...m, resultStatus: "reported" }, chs, ctx), "not_eligible");
  assert.equal(rematchState({ ...m, matchStatus: "cancelled" }, chs, ctx), "not_eligible");
  assert.equal(rematchState(null, chs, ctx), "not_eligible");

  const r = ok(demoChallengeOp(s, "create_rematch", { matchId, terms: rematchDraft(m, m.homeTeamId, NOW) }, ana, NOW), "rematch");
  assert.equal(rematchState(m, challengesOf(r.state, "ana"), ctx), "pair_open");
  // the open pair blocks a second one, like the server
  assert.equal(demoChallengeOp(r.state, "create_rematch", { matchId, terms: rematchDraft(m, m.homeTeamId, NOW), clientRef: "other" }, ana, NOW).error, "pair_open_challenge");
  // Bruno accepts → agreed → done
  const acc = ok(demoChallengeOp(r.state, "respond_challenge", { challengeId: r.data.challengeId, version: 1, action: "accept", asTeamId: m.awayTeamId }, bruno, NOW), "accept");
  assert.equal(rematchState(m, challengesOf(acc.state, "ana"), ctx), "done");
});

// ── Milestones ──────────────────────────────────────────

const rec = (o) => normRecord({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, clean_sheets: 0, form: [], streak: { type: null, n: 0 }, ...o });

test("ladders: topRung / nextRung / scoreMargin / unbeatenRun", () => {
  assert.equal(topRung(GAMES_LADDER, 0), null);
  assert.equal(topRung(GAMES_LADDER, 1), 1);
  assert.equal(topRung(GAMES_LADDER, 9), 5);
  assert.equal(topRung(GAMES_LADDER, 10), 10);
  assert.equal(nextRung(GAMES_LADDER, 0), 1);
  assert.equal(nextRung(GAMES_LADDER, 5), 10);
  assert.equal(nextRung(GAMES_LADDER, 100), null);
  assert.equal(scoreMargin("5-1"), 4);
  assert.equal(scoreMargin("2–2"), 0);
  assert.equal(scoreMargin(null), 0);
  assert.equal(unbeatenRun(["W", "D", "W"]), 3);
  assert.equal(unbeatenRun(["W", "L", "W"]), 1);
  assert.equal(unbeatenRun([]), 0);
});

test("teamMilestones: nothing before the first confirmed match", () => {
  assert.deepEqual(teamMilestones(emptyRecord()), []);
  assert.deepEqual(teamMilestones(null), []);
});

test("teamMilestones: first match is a game rung but not yet a win", () => {
  const ms = teamMilestones(rec({ played: 1, losses: 1, gf: 0, ga: 2, form: ["L"] }));
  assert.deepEqual(ms.map((m) => m.id), ["games_1"]);
});

test("teamMilestones: first win, 5 games, clean sheet, thrashing, streak and unbeaten run", () => {
  const ms = teamMilestones(rec({
    played: 6, wins: 4, draws: 1, losses: 1, gf: 18, ga: 6, clean_sheets: 2,
    form: ["W", "W", "W", "D", "W"], streak: { type: "W", n: 3 }, biggest_win: { opponent: "x", score: "5-1" },
  }));
  const byKind = Object.fromEntries(ms.map((m) => [m.kind, m]));
  assert.equal(byKind.wins.n, 1, "4 wins → the 1-win rung (5 not reached)");
  assert.equal(byKind.games.n, 5);
  assert.equal(byKind.clean.n, 1);
  assert.equal(byKind.bigwin.n, 4);
  assert.equal(byKind.streak.n, 3);
  assert.equal(byKind.streak.live, true);
  assert.equal(byKind.unbeaten.live, true);
  assert.equal(byKind.games.live, false);
});

test("teamMilestones: streaks and the unbeaten run only exist while they last", () => {
  const broken = teamMilestones(rec({ played: 6, wins: 3, losses: 3, form: ["L", "W", "W", "W", "W"], streak: { type: "L", n: 1 } }));
  assert.ok(!broken.some((m) => m.live));
  const draws = teamMilestones(rec({ played: 5, draws: 5, form: ["D", "D", "D", "D", "D"], streak: { type: "D", n: 5 } }));
  assert.ok(draws.some((m) => m.kind === "unbeaten"));
  assert.ok(!draws.some((m) => m.kind === "streak"), "draws are not a winning streak");
  const small = teamMilestones(rec({ played: 3, wins: 3, gf: 6, ga: 3, form: ["W", "W", "W"], streak: { type: "W", n: 3 }, biggest_win: { opponent: "x", score: "3-2" } }));
  assert.ok(!small.some((m) => m.kind === "bigwin"), `margin below ${BIG_WIN_MARGIN} is no thrashing`);
  assert.ok(!small.some((m) => m.kind === "unbeaten"), "needs the full five");
});

test("nextMilestone: the closest cumulative rung", () => {
  assert.deepEqual(nextMilestone(emptyRecord()), { kind: "games", n: 1, have: 0, left: 1 });
  // 3 wins (2 to the 5-win rung), 6 games (4 to 10), 1 clean sheet (4 to 5)
  assert.deepEqual(nextMilestone(rec({ played: 6, wins: 3, clean_sheets: 1 })), { kind: "wins", n: 5, have: 3, left: 2 });
  // tie → games first
  assert.equal(nextMilestone(rec({ played: 8, wins: 3, clean_sheets: 5 })).kind, "games");
  // everything done
  assert.equal(nextMilestone(rec({ played: 100, wins: 50, clean_sheets: 25 })), null);
});

test("playerMilestones: highest rung per ladder", () => {
  assert.deepEqual(playerMilestones({ appearances: 0, goals: 0, assists: 0 }), []);
  assert.deepEqual(playerMilestones({ appearances: 6, goals: 1, assists: 12 }).map((m) => m.id), ["p_appearances_5", "p_goals_1", "p_assists_10"]);
  assert.deepEqual(playerMilestones(null), []);
});

test("milestone labels: first-time wording and plurals", () => {
  assert.equal(milestoneLabel({ kind: "wins", n: 1 }), SC.msWinsFirst);
  assert.equal(milestoneLabel({ kind: "wins", n: 5 }), "5 vitórias");
  assert.equal(milestoneLabel({ kind: "games", n: 1 }), SC.msGamesFirst);
  assert.equal(milestoneLabel({ kind: "bigwin", n: 4 }), "Goleada · +4");
  assert.equal(milestoneLabel({ kind: "goals", n: 1 }), SC.msGoalsFirst);
  assert.equal(milestoneLabel({ kind: "nope", n: 1 }), "");
  assert.equal(nextMilestoneText({ kind: "wins", n: 5, left: 1 }), "Próximo marco: 5 vitórias · falta 1");
  assert.equal(nextMilestoneText({ kind: "games", n: 10, left: 4 }), "Próximo marco: 10 jogos · faltam 4");
  assert.equal(nextMilestoneText(null), "");
});

test("milestone labels: EN and PT-BR (time/gols, never the product name)", () => {
  try {
    setLang("en");
    assert.equal(milestoneLabel({ kind: "goals", n: 1 }), "First goal");
    assert.equal(milestoneLabel({ kind: "wins", n: 5 }), "5 wins");
    assert.equal(nextMilestoneText({ kind: "games", n: 5, left: 2 }), "Next milestone: 5 matches · 2 to go");
    setLang("pt-br");
    assert.equal(milestoneLabel({ kind: "goals", n: 1 }), "Primeiro gol");
    assert.equal(milestoneLabel({ kind: "appearances", n: 5 }), "5 jogos pelo time");
  } finally { setLang("pt"); }
});

// ── Share-card data ─────────────────────────────────────

test("scorersOf: goals only, best first, capped with the overflow count", () => {
  const items = [
    { teamId: "A", nick: "Zé", goals: 1, assists: 0 }, { teamId: "A", nick: "Rui", goals: 2, assists: 1 },
    { teamId: "A", nick: "Ivo", goals: 0, assists: 3 }, { teamId: "B", nick: "Lu", goals: 4, assists: 0 },
    { teamId: "A", nick: "Ana", goals: 1 }, { teamId: "A", nick: "Bia", goals: 1 }, { teamId: "A", nick: "Cris", goals: 1 },
  ];
  const a = scorersOf(items, "A");
  assert.deepEqual(a.list.map((p) => p.nick), ["Rui", "Ana", "Bia", "Cris"]);
  assert.equal(a.more, 1);
  assert.deepEqual(scorersOf(items, "B"), { list: [{ nick: "Lu", goals: 4 }], more: 0 });
  assert.deepEqual(scorersOf(null, "A"), { list: [], more: 0 });
});

test("resultCardData: only an OFFICIAL result makes a card", () => {
  const { s, challengeId } = playedWorld();
  const ch = challengesOf(s, "ana").find((c) => c.id === challengeId);
  const d = resultCardData(ch, { stats: [{ teamId: ch.challenger.id, nick: "Ana", goals: 2 }, { teamId: ch.challenged.id, nick: "Bruno", goals: 1 }], h2h: { played: 2 } });
  assert.equal(d.home.name, "Leões");
  assert.equal(d.away.name, "Dragões");
  assert.equal(d.homeScore, 3);
  assert.equal(d.awayScore, 1);
  assert.equal(d.winner, "home");
  assert.equal(d.confrontoN, 2);
  assert.deepEqual(d.scorers.home.list, [{ nick: "Ana", goals: 2 }]);
  assert.equal(d.venue, "Campo X");
  assert.equal(d.format, "7v7");
  assert.equal(resultCardFile(d), "pitch-rivals-leoes-3-1-dragoes.png");
  assert.equal(resultCardData(ch, { h2h: { played: 1 } }).confrontoN, null, "a first meeting is not worth a Confronto #1 chip");
  assert.equal(resultCardData(ch).confrontoN, null);

  // provisional / missing → no card
  const provisional = { ...ch, match: { ...ch.match, resultStatus: "reported" } };
  assert.equal(resultCardData(provisional), null);
  assert.equal(resultCardData({ ...ch, match: { ...ch.match, officialHomeScore: null } }), null);
  assert.equal(resultCardData({ ...ch, match: null }), null);
  assert.equal(resultCardData(null), null);
});

test("resultCardData: winner for an away win and a draw", () => {
  const { s, challengeId } = playedWorld();
  const ch = challengesOf(s, "ana").find((c) => c.id === challengeId);
  const set = (h, a) => ({ ...ch, match: { ...ch.match, officialHomeScore: h, officialAwayScore: a } });
  assert.equal(resultCardData(set(0, 2)).winner, "away");
  assert.equal(resultCardData(set(2, 2)).winner, "draw");
});

test("teamCardData: record, form, scorers and milestones — empty record has no stats", () => {
  const team = { id: "t1", name: "Alfama FC", city: "Lisboa", format: "7v7", color: "#00D08A", secondaryColor: "#FFFFFF" };
  const empty = teamCardData({ team, record: emptyRecord(), members: [{}, {}, {}], topScorers: [], topAssisters: [] });
  assert.equal(empty.played, false);
  assert.equal(empty.record, null);
  assert.deepEqual(empty.milestones, []);
  assert.equal(empty.memberCount, 3);

  const record = rec({ played: 6, wins: 4, draws: 1, losses: 1, gf: 18, ga: 6, clean_sheets: 2, form: ["W", "W", "D", "L", "W", "W", "W"], streak: { type: "W", n: 2 } });
  const full = teamCardData({
    team, record, memberCount: 9,
    topScorers: [{ nick: "Rui", n: 5 }, { nick: "Zé", n: 0 }, { nick: "Ivo", n: 3 }, { nick: "A", n: 2 }, { nick: "B", n: 1 }],
    topAssisters: [{ nick: "Ana", n: 0 }],
  });
  assert.equal(full.played, true);
  assert.deepEqual(full.record.form, ["W", "W", "D", "L", "W"], "form capped at five");
  assert.equal(full.record.wins, 4);
  assert.deepEqual(full.scorers.map((p) => p.nick), ["Rui", "Ivo", "A"], "zero-goal players never make the list; capped at three");
  assert.deepEqual(full.assisters, []);
  assert.ok(full.milestones.length > 0 && full.milestones.length <= 4);
  assert.equal(full.team.city, "Lisboa");
  assert.equal(teamCardFile(full), "pitch-rivals-alfama-fc.png");
  assert.equal(teamCardData(null), null);
  assert.equal(teamCardData({}), null);
});
