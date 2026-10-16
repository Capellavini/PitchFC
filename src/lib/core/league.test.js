// node --test src/lib/core/league.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendEvent, activeEvents, corrections, matchScore, standings, playerStats, discipline,
  transition, canTransition, setOfficialMvp, castFanVote, tallyFanVotes, fanVoteOpen,
  fantasyPlayerPoints, validateFantasyPicks, LeagueError, DEMO_RULES, FANTASY_DEMO_RULES,
  canEditTactics, setTactics,
} from "./league.js";

const TEAMS = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }, { id: "D", name: "D" }];
const COMP = { id: "comp", teams: TEAMS };
const PLAYERS = [
  { id: "a1", teamId: "A", position: "AVA", price: 7 }, { id: "a2", teamId: "A", position: "MED", price: 6 },
  { id: "b1", teamId: "B", position: "DEF", price: 5 }, { id: "b2", teamId: "B", position: "GR", price: 5 },
  { id: "c1", teamId: "C", position: "AVA", price: 7 }, { id: "d1", teamId: "D", position: "MED", price: 4 },
];

let seq = 0;
const ev = (matchId, type, teamId, extra = {}) => ({ id: `e${++seq}`, matchId, type, teamId, recordedBy: "test", recordedAt: "2026-10-01T10:00:00Z", ...extra });
const match = (id, homeId, awayId, state = "homologated", extra = {}) => ({ id, competitionId: "comp", round: 1, homeId, awayId, state, ...extra });
const build = (events) => events.reduce((log, e) => appendEvent(log, e), []);
const logsOf = (pairs) => Object.fromEntries(pairs);

test("points and table: 3/1/0, goal difference order", () => {
  const m1 = match("m1", "A", "B"), m2 = match("m2", "C", "D");
  const logs = logsOf([
    ["m1", build([ev("m1", "goal", "A", { playerId: "a1" }), ev("m1", "goal", "A", { playerId: "a1" })])],
    ["m2", build([ev("m2", "goal", "C", { playerId: "c1" }), ev("m2", "goal", "D", { playerId: "d1" })])],
  ]);
  const t = standings(COMP, [m1, m2], logs);
  assert.deepEqual(t.map((r) => [r.id, r.pts, r.gd]), [["A", 3, 2], ["C", 1, 0], ["D", 1, 0], ["B", 0, -2]]);
  assert.equal(t[0].j, 1);
});

test("h2h tiebreak (pts, gd, gf, h2h): level on pts/gd/gf, the direct match decides", () => {
  const ms = [match("u1", "A", "B"), match("u2", "A", "D"), match("u3", "B", "D"), match("u4", "C", "A"), match("u5", "C", "B")];
  const logs = logsOf([
    ["u1", build([ev("u1", "goal", "B")])], // A 0-1 B → B wins the direct match
    ["u2", build([ev("u2", "goal", "A"), ev("u2", "goal", "A")])], // A 2-0 D
    ["u3", build([ev("u3", "goal", "B"), ev("u3", "goal", "B")])], // B 2-0 D
    ["u4", build([ev("u4", "goal", "A")])], // C 0-1 A
    ["u5", build([ev("u5", "goal", "C")])], // C 1-0 B
  ]);
  // A and B: W2 L1, GM 3, GS 1, 6 pts — tied until h2h.
  const t = standings(COMP, ms, logs);
  assert.deepEqual(t.slice(0, 2).map((r) => [r.id, r.pts, r.gd, r.gf]), [["B", 6, 2, 3], ["A", 6, 2, 3]]);
  // Without h2h in the chain they stay in input order (A before B).
  const noH2h = standings({ ...COMP, tiebreakers: ["pts", "gd", "gf"] }, ms, logs);
  assert.deepEqual(noH2h.slice(0, 2).map((r) => r.id), ["A", "B"]);
});

test("own goal counts for the benefiting team, not as the player's goal", () => {
  const m = match("m1", "A", "B");
  const log = build([ev("m1", "own_goal", "A", { playerId: "b1" }), ev("m1", "goal", "B", { playerId: "b1" })]);
  assert.deepEqual(matchScore(log, m), { home: 1, away: 1, shootout: null, walkover: false });
  const s = playerStats([m], { m1: log });
  assert.equal(s.b1.goals, 1);
  assert.equal(s.b1.ownGoals, 1);
});

test("unknown scorer: team scores, nobody's tally grows", () => {
  const m = match("m1", "A", "B");
  const log = build([ev("m1", "goal", "A", { playerId: null })]);
  assert.equal(matchScore(log, m).home, 1);
  const s = playerStats([m], { m1: log });
  assert.deepEqual(Object.keys(s), []);
  assert.equal(standings(COMP, [m], { m1: log })[0].id, "A");
});

test("shootout goals are excluded from the score and from scorers", () => {
  const m = match("m1", "A", "B");
  const log = build([
    ev("m1", "goal", "A", { playerId: "a1" }), ev("m1", "goal", "B", { playerId: "b1" }),
    ev("m1", "shootout_goal", "A", { playerId: "a1" }), ev("m1", "shootout_goal", "A", { playerId: "a2" }),
  ]);
  const sc = matchScore(log, m);
  assert.equal(sc.home, 1); assert.equal(sc.away, 1);
  assert.deepEqual(sc.shootout, { home: 2, away: 0 });
  const s = playerStats([m], { m1: log });
  assert.equal(s.a1.goals, 1);
  assert.equal(s.a1.shootoutGoals, 1);
  const t = standings(COMP, [m], { m1: log });
  assert.equal(t.find((r) => r.id === "A").d, 1);
});

test("assists only count when recorded", () => {
  const m = match("m1", "A", "B");
  const log = build([ev("m1", "goal", "A", { playerId: "a1", assistId: "a2" }), ev("m1", "goal", "A", { playerId: "a1" })]);
  const s = playerStats([m], { m1: log });
  assert.equal(s.a1.goals, 2); assert.equal(s.a2.assists, 1); assert.equal(s.a1.assists, 0);
  assert.equal(DEMO_RULES.assistPolicy, "recorded_only");
});

test("correction supersedes an event with mandatory reason and recomputes table + scorers", () => {
  const m = match("m1", "A", "B");
  const g = ev("m1", "goal", "A", { playerId: "a1" });
  let log = build([g]);
  assert.equal(standings(COMP, [m], { m1: log })[0].id, "A");
  assert.throws(() => appendEvent(log, ev("m1", "goal", "B", { playerId: "b1", supersedes: g.id })), (e) => e instanceof LeagueError && e.code === "reason_required");
  // The goal was actually B's (wrong team recorded)
  log = appendEvent(log, ev("m1", "goal", "B", { playerId: "b1", supersedes: g.id, voidReason: "Equipa errada no registo" }));
  assert.deepEqual([matchScore(log, m).home, matchScore(log, m).away], [0, 1]);
  const t = standings(COMP, [m], { m1: log });
  assert.equal(t[0].id, "B");
  const s = playerStats([m], { m1: log });
  assert.equal(s.a1?.goals ?? 0, 0);
  assert.equal(s.b1.goals, 1);
  assert.equal(corrections(log).length, 1);
  assert.equal(corrections(log)[0].replaced.id, g.id);
  // A second correction of the same original is a conflict, not a silent overwrite
  assert.throws(() => appendEvent(log, ev("m1", "void", null, { supersedes: g.id, voidReason: "x" })), (e) => e.code === "already_superseded");
});

test("void annuls without replacement", () => {
  const m = match("m1", "A", "B");
  const g = ev("m1", "goal", "A", { playerId: "a1" });
  const log = appendEvent(build([g]), ev("m1", "void", null, { supersedes: g.id, voidReason: "Golo anulado (fora de jogo)" }));
  assert.equal(activeEvents(log).length, 0);
  assert.equal(matchScore(log, m).home, 0);
});

test("idempotent resend: same id never duplicates a goal", () => {
  const m = match("m1", "A", "B");
  const g = ev("m1", "goal", "A", { playerId: "a1" });
  const once = build([g]);
  const twice = appendEvent(once, { ...g });
  assert.equal(twice, once);
  assert.equal(matchScore(twice, m).home, 1);
  assert.equal(playerStats([m], { m1: twice }).a1.goals, 1);
});

test("provisional results stay out of the official table unless asked", () => {
  const off = match("m1", "A", "B", "homologated");
  const prov = match("m2", "C", "D", "ended_provisional");
  const rev = match("m3", "A", "C", "in_review");
  const logs = {
    m1: build([ev("m1", "goal", "A", { playerId: "a1" })]),
    m2: build([ev("m2", "goal", "C", { playerId: "c1" })]),
    m3: build([ev("m3", "goal", "C", { playerId: "c1" })]),
  };
  const official = standings(COMP, [off, prov, rev], logs);
  assert.equal(official.find((r) => r.id === "C").j, 0);
  assert.equal(playerStats([off, prov, rev], logs).c1, undefined);
  const live = standings(COMP, [off, prov, rev], logs, { includeProvisional: true });
  assert.equal(live.find((r) => r.id === "C").pts, 6);
  assert.equal(playerStats([off, prov, rev], logs, { includeProvisional: true }).c1.goals, 2);
});

test("state machine guards by role and requires reasons", () => {
  const m = match("m1", "A", "B", "scheduled");
  assert.equal(canTransition("scheduled", "live", "captain"), false);
  assert.throws(() => transition(m, "live", { role: "captain" }), (e) => e.code === "forbidden_transition");
  const live = transition(m, "live", { role: "manager", by: "gestor" });
  const ended = transition(live, "ended_provisional", { role: "manager" });
  assert.throws(() => transition(ended, "homologated", { role: "captain" }), (e) => e.code === "forbidden_transition");
  assert.throws(() => transition(ended, "in_review", { role: "captain", teamId: "A" }), (e) => e.code === "reason_required");
  assert.throws(() => transition(ended, "in_review", { role: "captain", teamId: "C", reason: "x" }), (e) => e.code === "not_your_match");
  const contested = transition(ended, "in_review", { role: "captain", teamId: "B", reason: "Golo em fora de jogo" });
  assert.equal(contested.contest.teamId, "B");
  const hom = transition(contested, "homologated", { role: "manager", by: "gestor" });
  assert.equal(hom.state, "homologated");
  assert.deepEqual(hom.history.map((h) => h.to), ["live", "ended_provisional", "in_review", "homologated"]);
  const wo = transition(m, "walkover", { role: "manager", reason: "Equipa B não compareceu", winnerId: "A" });
  assert.deepEqual(matchScore([], wo), { home: DEMO_RULES.walkoverGoals, away: 0, shootout: null, walkover: true });
});

test("fans' vote is separate from the official MVP", () => {
  let m = match("m1", "A", "B", "ended_provisional");
  assert.throws(() => setOfficialMvp(m, "a1", { role: "fan" }), (e) => e.code === "forbidden_mvp");
  m = setOfficialMvp(m, "a1", { role: "manager", by: "gestor" });
  let votes = castFanVote({}, m, "acc1", "b1");
  votes = castFanVote(votes, m, "acc2", "b1");
  votes = castFanVote(votes, m, "acc1", "a2"); // changed vote: still one per account
  const tally = tallyFanVotes(votes, "m1");
  assert.equal(tally.total, 2);
  assert.deepEqual(tally.rows.map((r) => [r.playerId, r.votes]), [["a2", 1], ["b1", 1]]);
  assert.equal(m.officialMvp.playerId, "a1"); // unaffected by the fans
  const closed = { ...m, fanVoteClosed: true };
  assert.equal(fanVoteOpen(closed), false);
  assert.throws(() => castFanVote(votes, closed, "acc3", "b1"), (e) => e.code === "vote_closed");
  assert.throws(() => castFanVote(votes, match("s", "A", "B", "scheduled"), "acc3", "b1"), (e) => e.code === "vote_closed");
});

test("discipline: yellow accumulation and red suspension (demo rules), served next match", () => {
  const ms = [1, 2, 3, 4].map((r) => ({ ...match(`m${r}`, "A", "B"), round: r }));
  const logs = {
    m1: build([ev("m1", "card_yellow", "A", { playerId: "a1" }), ev("m1", "card_red", "B", { playerId: "b1" })]),
    m2: build([ev("m2", "card_yellow", "A", { playerId: "a1" })]),
    m3: build([ev("m3", "card_yellow", "A", { playerId: "a1" })]),
    m4: [],
  };
  const d = discipline(ms, logs, PLAYERS);
  assert.equal(d.b1.reds, 1); assert.equal(d.b1.served, 1); assert.equal(d.b1.pending, 0);
  assert.equal(d.a1.yellows, 3); assert.equal(d.a1.triggered, 1); assert.equal(d.a1.served, 1); assert.equal(d.a1.pending, 0);
  const d3 = discipline(ms.slice(0, 3), logs, PLAYERS);
  assert.equal(d3.a1.pending, 1); // banned for the next match
});

test("tactical board: captain own team only, manager any, suspended / not-called rejected", () => {
  const m = { ...match("m1", "A", "B", "scheduled"), lineups: { A: ["a1", "a2"] } };
  const board = { formation: "2-3-1", slots: { "gk-0": "a1", "fwd-0": "a2" } };
  assert.equal(canEditTactics(m, "captain", "A", "A"), true);
  assert.equal(canEditTactics(m, "captain", "B", "A"), false);
  assert.equal(canEditTactics(m, "fan", "A"), false);
  assert.equal(canEditTactics({ ...m, state: "homologated" }, "manager", "A"), false);
  assert.throws(() => setTactics(m, "B", board, { role: "captain", myTeamId: "A" }), (e) => e.code === "forbidden_tactics");
  assert.throws(() => setTactics(m, "A", board, { role: "captain", myTeamId: "A", suspendedIds: ["a2"] }), (e) => e.code === "tactics_suspended");
  assert.throws(() => setTactics(m, "A", { slots: { "gk-0": "a1", "def-0": "a1" } }, { role: "manager" }), (e) => e.code === "tactics_duplicate");
  assert.throws(() => setTactics(m, "A", { slots: { "gk-0": "b9" } }, { role: "manager" }), (e) => e.code === "tactics_not_called");
  const saved = setTactics(m, "A", board, { role: "captain", myTeamId: "A", by: "cap" });
  assert.deepEqual(saved.tactics.A.slots, board.slots);
  assert.equal(saved.tactics.A.by, "cap");
});

test("fantasy preview scores from events with the demo rules", () => {
  const m = { ...match("m1", "A", "B"), lineups: { A: ["a1", "a2"], B: ["b1", "b2"] }, officialMvp: { playerId: "a1" } };
  const log = build([ev("m1", "goal", "A", { playerId: "a1", assistId: "a2" }), ev("m1", "card_yellow", "B", { playerId: "b1" })]);
  const P = FANTASY_DEMO_RULES.points;
  assert.equal(fantasyPlayerPoints(PLAYERS[0], [m], { m1: log }).total, P.appearance + P.goal.AVA + P.officialMvp);
  assert.equal(fantasyPlayerPoints(PLAYERS[1], [m], { m1: log }).total, P.appearance + P.assist + P.cleanSheet.MED);
  assert.equal(fantasyPlayerPoints(PLAYERS[2], [m], { m1: log }).total, P.appearance + P.yellow);
  assert.deepEqual(validateFantasyPicks(["a1", "a2", "b1", "b2", "c1"], PLAYERS), []);
  assert.ok(validateFantasyPicks(["a1", "a2", "b1"], PLAYERS).includes("squad_size"));
  const pricey = PLAYERS.map((p) => ({ ...p, price: 10 }));
  assert.ok(validateFantasyPicks(["a1", "a2", "b1", "b2", "c1"], pricey).includes("over_budget"));
});
