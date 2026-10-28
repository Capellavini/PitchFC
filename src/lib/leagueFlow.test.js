// The league is one event log: everything the athlete, the table, the
// discipline list, Fantasy and the Adjunto show is derived from it. These
// tests follow ONE match through its life and check that every screen's data
// moves together at the right moment (provisional → official → corrected).
import test from "node:test";
import assert from "node:assert/strict";
import { appendEvent, transition, fantasyTeamPoints, setOfficialMvp } from "./core/league.js";
import { loadExample, deriveLeague, PLAYERS, teamById } from "./leagueDemo.js";
import { leagueToday } from "./leagueToday.js";
import { teamHome } from "./leagueTeamHome.js";
import { fanHome } from "./leagueFanHome.js";
import { adjuntoBrief } from "./leagueAdjuntoGuide.js";

const MANAGER = { role: "manager", by: "Gestor (teste)" };
const squad = (teamId) => PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id);

/** m7 (round 3, t1 Marés – t4 Atlético) goes live with a goal, an assist and a
 *  yellow card, and ends provisionally. */
function playedMatch() {
  const state = loadExample();
  const m0 = state.matches.find((m) => m.id === "m7");
  assert.equal(m0.state, "scheduled");
  const lineups = { [m0.homeId]: squad(m0.homeId), [m0.awayId]: squad(m0.awayId) };
  let m = transition({ ...m0, lineups }, "live", { ...MANAGER, at: "2026-10-17T17:00:00Z" });
  let log = [];
  const add = (e) => { log = appendEvent(log, { matchId: "m7", recordedBy: "Mesa (teste)", recordedAt: "2026-10-17T17:30:00Z", ...e }); };
  add({ id: "e1", type: "goal", teamId: "t1", playerId: "t1p7", assistId: "t1p4", minute: 10 });
  add({ id: "e2", type: "card_yellow", teamId: "t4", playerId: "t4p3", minute: 20 });
  m = transition(m, "ended_provisional", { ...MANAGER, at: "2026-10-17T18:00:00Z" });
  return { state: { ...state, matches: state.matches.map((x) => (x.id === "m7" ? m : x)), logs: { ...state.logs, m7: log } }, log };
}

test("provisional result: shown with a mark, never in the official numbers", () => {
  const { state } = playedMatch();
  const d = deriveLeague(state);
  const before = deriveLeague(loadExample());
  const g = (x, id, k) => x[id]?.[k] || 0;
  assert.equal(g(d.stats, "t1p7", "goals"), g(before.stats, "t1p7", "goals"), "scorer official goals unchanged");
  assert.equal(g(d.statsProvisional, "t1p7", "goals"), g(before.statsProvisional, "t1p7", "goals") + 1, "scorer provisional goals +1");
  assert.equal(g(d.statsProvisional, "t1p4", "assists"), g(before.statsProvisional, "t1p4", "assists") + 1, "assist provisional +1");
  assert.deepEqual(d.table.map((r) => r.pts), before.table.map((r) => r.pts), "official table unchanged");
  assert.ok(d.tableProvisional.find((r) => r.id === "t1").pts > before.table.find((r) => r.id === "t1").pts, "provisional table counts it");
});

test("it appears in the Gestor's queue until it is homologated, then leaves it", () => {
  const { state } = playedMatch();
  const open = leagueToday(state, deriveLeague(state));
  assert.ok(open.items.some((i) => i.kind === "homologate" && i.matchId === "m7"));
  assert.match(adjuntoBrief(open).text, /resultados por homologar/);
  const done = homologate(state);
  const after = leagueToday(done, deriveLeague(done));
  assert.ok(!after.items.some((i) => i.matchId === "m7"));
});

function homologate(state) {
  return { ...state, matches: state.matches.map((m) => (m.id === "m7" ? transition(m, "homologated", { ...MANAGER, at: "2026-10-18T10:00:00Z" }) : m)) };
}

test("homologation moves every number at once: athlete, table, discipline, Fantasy, team and fan home", () => {
  const { state } = playedMatch();
  const before = deriveLeague(state);
  const done = homologate(state);
  const d = deriveLeague(done);

  // athlete history: the goal and the assist are now in the official stats and in the games played
  const g = (x, id, k) => x[id]?.[k] || 0;
  assert.equal(g(d.stats, "t1p7", "goals"), g(before.stats, "t1p7", "goals") + 1);
  assert.equal(g(d.stats, "t1p4", "assists"), g(before.stats, "t1p4", "assists") + 1);
  assert.ok((d.stats.t1p7.games || 0) > (before.stats.t1p7?.games || 0), "appearance counted once official");

  // table: Marés won 1–0 → +3 points
  const pts = (x, id) => x.table.find((r) => r.id === id).pts;
  assert.equal(pts(d, "t1"), pts(before, "t1") + 3);

  // discipline: the yellow is recorded on the player
  assert.equal(g(d.stats, "t4p3", "yellows"), g(before.stats, "t4p3", "yellows") + 1);

  // Fantasy: a squad with the scorer earns points only once official
  const picks = ["t1p7", "t1p4", "t2p1", "t3p1", "t5p1"];
  const fBefore = fantasyTeamPoints(picks, PLAYERS, state.matches, state.logs).total;
  const fAfter = fantasyTeamPoints(picks, PLAYERS, done.matches, done.logs).total;
  assert.ok(fAfter > fBefore, "Fantasy points follow the official goal");

  // the team's own home shows the result and no longer asks the captain to review it
  const captain = { teamId: "t1", playerId: "t1p5", accountId: "acc-t1p5", role: "captain" };
  assert.ok(teamHome(done, d, captain).recent.some((m) => m.id === "m7"));
  assert.ok(!teamHome(done, d, captain).queue.some((i) => i.kind === "contest" && i.matchId === "m7"));

  // the fan sees the scorer on the highlights
  assert.ok(fanHome(done, d, { accountId: "acc-adepto" }).topScorer.value >= 1);
});

test("a correction after homologation reopens the match, supersedes the goal and recalculates without duplicating", () => {
  const { state, log } = playedMatch();
  const done = homologate(state);
  // homologated matches are locked: the Gestor must reopen them with a reason first
  assert.throws(() => transition(done.matches.find((m) => m.id === "m7"), "homologated", MANAGER));
  const reopened = transition(done.matches.find((m) => m.id === "m7"), "in_review", { ...MANAGER, at: "2026-10-18T11:00:00Z", reason: "autor do golo errado" });
  const fixed = appendEvent(log, { id: "e3", matchId: "m7", type: "goal", teamId: "t1", playerId: "t1p6", assistId: null, minute: 10, supersedes: "e1", voidReason: "autor do golo errado", recordedBy: "Gestor (teste)", recordedAt: "2026-10-18T11:05:00Z" });
  const next = { ...done, matches: done.matches.map((m) => (m.id === "m7" ? transition(reopened, "homologated", { ...MANAGER, at: "2026-10-18T11:10:00Z" }) : m)), logs: { ...done.logs, m7: fixed } };
  const d = deriveLeague(next), was = deriveLeague(done);
  assert.equal(d.stats.t1p7?.goals || 0, (was.stats.t1p7?.goals || 0) - 1, "the wrong scorer loses exactly that goal");
  assert.equal(d.stats.t1p6.goals, (was.stats.t1p6?.goals || 0) + 1, "the right scorer gets exactly one");
  assert.equal(d.table.find((r) => r.id === "t1").gf, was.table.find((r) => r.id === "t1").gf, "team goals unchanged");
  assert.equal(next.matches.find((m) => m.id === "m7").history.length >= 4, true, "history keeps who reopened and re-homologated");
});

test("the official MVP is part of the athlete's record", () => {
  const { state } = playedMatch();
  const done = homologate(state);
  const withMvp = { ...done, matches: done.matches.map((m) => (m.id === "m7" ? setOfficialMvp(m, "t1p7", { role: "manager", by: "Gestor", at: "2026-10-18T12:00:00Z" }) : m)) };
  assert.equal(deriveLeague(withMvp).stats.t1p7.mvps, (deriveLeague(done).stats.t1p7?.mvps || 0) + 1);
  assert.equal(teamById.t1.name, "Marés FC");
});
