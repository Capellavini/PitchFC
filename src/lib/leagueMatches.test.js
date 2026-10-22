import test from "node:test";
import assert from "node:assert/strict";
import { leagueDemoOp, emptyLeagueOrgState, normCompetitionPage } from "./leagueCloud.js";
import {
  uiMatchState, normMatches, normMatchPage, eventToCloud, newCloudEventId, provisionalStandings, roundRobinRounds, matchPermissions,
  buildDirectory, rankingRows, cardRows, disciplineRows, normStandings, pendingWork, timelineEventToDemo,
} from "./leagueMatches.js";
import { formatProfile, onFieldOf, FORMAT_PRESETS } from "./leagueFormat.js";

test("uiMatchState maps server statuses to the UI vocabulary", () => {
  assert.equal(uiMatchState("unscheduled", "none"), "unscheduled");
  assert.equal(uiMatchState("finished", "provisional"), "ended_provisional");
  assert.equal(uiMatchState("finished", "submitted"), "in_review");
  assert.equal(uiMatchState("finished", "homologated"), "homologated");
  assert.equal(uiMatchState("abandoned", "provisional"), "abandoned");
  assert.equal(uiMatchState("abandoned", "homologated"), "homologated");
  assert.equal(uiMatchState("postponed", "none"), "postponed");
});

test("roundRobinRounds: complete, one game per team per round, numbered (even, odd, double)", () => {
  for (const n of [2, 4, 5, 6, 7]) {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const fx = roundRobinRounds(ids);
    assert.equal(fx.length, (n * (n - 1)) / 2, `n=${n}`);
    const pairs = new Set(fx.map((f) => [f.home_team_id, f.away_team_id].sort().join("|")));
    assert.equal(pairs.size, fx.length);
    const perRound = {};
    for (const f of fx) for (const t of [f.home_team_id, f.away_team_id]) {
      const k = `${f.round}:${t}`; assert.ok(!perRound[k], `team twice in round ${k}`); perRound[k] = 1;
    }
  }
  const dbl = roundRobinRounds(["a", "b", "c", "d"], true);
  assert.equal(dbl.length, 12);
  assert.equal(new Set(dbl.map((f) => `${f.home_team_id}>${f.away_team_id}`)).size, 12);
  assert.equal(Math.max(...dbl.map((f) => f.round)), 6);
  assert.deepEqual(roundRobinRounds(["a"]), []);
});

test("eventToCloud: add / correct / void / post-submission", () => {
  assert.deepEqual(eventToCloud({ id: "e1", type: "card_yellow", teamId: "A", playerId: "p" }).data.type, "yellow");
  const g = eventToCloud({ id: "e2", type: "goal", teamId: "A", playerId: null, assistId: "x", minute: "12" }).data;
  assert.equal(g.action, "add"); assert.equal(g.player_id, null); assert.equal(g.assist_player_id, "x"); assert.equal(g.minute, 12);
  assert.equal(eventToCloud({ id: "e3", type: "own_goal", teamId: "A", assistId: "x" }).data.assist_player_id, null);
  assert.equal(eventToCloud({ id: "e4", type: "goal", teamId: "A", supersedes: "e2" }).error, "reason_required");
  const c = eventToCloud({ id: "e4", type: "goal", teamId: "A", supersedes: "e2", voidReason: " autor " }).data;
  assert.equal(c.action, "correct"); assert.equal(c.reason, "autor");
  assert.deepEqual(eventToCloud({ id: "e5", type: "void", supersedes: "e2", voidReason: "x" }).data, { id: "e5", action: "void", supersedes: "e2", reason: "x" });
  assert.equal(eventToCloud({ id: "e6", type: "goal", teamId: "A" }, { post: true }).error, "reason_required");
  assert.equal(eventToCloud({ id: "e6", type: "goal", teamId: "A", voidReason: "r" }, { post: true }).data.source, "correction");
  assert.equal(eventToCloud({ id: "e7", type: "shootout_goal", teamId: "A" }).error, "invalid_event");
  assert.match(newCloudEventId(() => 0.5), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(timelineEventToDemo({ id: "x", type: "period" }, "m"), null);
  assert.equal(timelineEventToDemo({ id: "x", type: "second_yellow", team_id: "A", player_id: "p" }, "m").type, "card_second_yellow");
});

test("provisionalStandings adds pending results on top of the official table and re-ranks", () => {
  const rows = [
    { id: "A", name: "A", j: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3 },
    { id: "B", name: "B", j: 1, w: 0, d: 0, l: 1, gf: 0, ga: 2, gd: -2, pts: 0 },
    { id: "C", name: "C", j: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: -3 }, // W.O./adjustment already in pts
  ];
  const out = provisionalStandings(rows, [{ homeId: "B", awayId: "C", home: 4, away: 1 }, { homeId: "A", awayId: "C", home: null, away: null }]);
  assert.deepEqual(out.map((r) => r.id), ["A", "B", "C"]);
  const b = out.find((r) => r.id === "B");
  assert.deepEqual([b.j, b.w, b.gf, b.ga, b.gd, b.pts], [2, 1, 4, 3, 1, 3]);
  assert.equal(out.find((r) => r.id === "C").pts, -3);
  const tie = provisionalStandings([{ id: "X", name: "X", j: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }, { id: "Y", name: "Y", j: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }],
    [{ homeId: "X", awayId: "Y", home: 1, away: 1 }]);
  assert.ok(tie.every((r) => r.rank === 1 && r.tieUnresolved));
  assert.equal(rows[1].j, 1, "input not mutated");
});

test("formatProfile: futsal / F5 / F7 / F11", () => {
  const fs = formatProfile("5v5", "futsal", 40);
  assert.deepEqual([fs.onField, fs.outfield, fs.label, fs.rollingSubs, fs.tacticsSupported, fs.halves.minutes], [5, 4, "Futsal", true, true, 20]);
  const f7 = formatProfile("7v7", "futebol", 50);
  assert.deepEqual([f7.onField, f7.label, f7.rollingSubs, f7.halves.minutes], [7, "Futebol 7", false, 25]);
  const f11 = formatProfile("11v11", "futebol");
  assert.deepEqual([f11.outfield, f11.tacticsSupported, f11.callupMax, f11.halves.minutes], [10, true, 22, 45]);
  assert.equal(onFieldOf("bad"), 7);
  assert.ok(FORMAT_PRESETS.some((p) => p.modality === "futsal" && p.format === "5v5"));
});

// ── End-to-end over the local mirror (same payloads as the RPCs) ──
const admin = { id: "owner", name: "Rita", isAdmin: true };
const capA = { id: "capA", name: "Capitão A", isAdmin: false };
function run(s, op, args, actor = admin, now) {
  const r = leagueDemoOp(s, op, args, actor, now);
  if (r.error) throw new Error(`${op}: ${r.error}`);
  return r;
}
function fail(s, op, args, actor, code) {
  const r = leagueDemoOp(s, op, args, actor);
  assert.equal(r.error, code, `${op} should fail with ${code}`);
}
function setup() {
  let s = emptyLeagueOrgState();
  s = run(s, "create_league", { name: "AFPCE" }).state;
  const lid = s.leagues[0].id;
  s = run(s, "update_league", { leagueId: lid, fields: { visibility: "public", status: "active" } }).state;
  s = run(s, "create_competition", { leagueId: lid, fields: { name: "Futsal Sénior", format: "5v5", modality: "futsal", matchDurationMin: 40 }, rules: { squad: { min: 1, max: 14 }, mvp: { official_by: ["manager"], fan_vote: true } } }).state;
  const cid = s.competitions[0].id;
  s = run(s, "publish_regulation", { competitionId: cid, version: 1 }).state;
  s = run(s, "set_competition_status", { competitionId: cid, status: "registration_open" }).state;
  const lk = run(s, "create_registration_link", { competitionId: cid }); s = lk.state; const token = lk.data.token;
  const teams = [["A", ["a1", "a2", "a3", "a4", "a5", "a6"]], ["B", ["b1", "b2", "b3", "b4", "b5"]], ["C", ["c1", "c2", "c3", "c4", "c5"]]];
  for (const [id, players] of teams) {
    const team = { id, name: `Equipa ${id}`, role: "captain", memberIds: players };
    const reg = run(s, "register_team", { token, team }, capA);
    s = reg.state;
    s = run(s, "submit_squad", { registrationId: reg.data.registrationId, team, players: players.map((p, i) => ({ playerId: p, name: p.toUpperCase(), shirtNumber: i + 1 })) }, capA).state;
    s = run(s, "decide_squad", { registrationId: reg.data.registrationId, version: 1, decision: "approve" }).state;
  }
  return { s, lid, cid };
}

test("mirror: fixtures → live súmula → homologation → standings, rankings, discipline, awards", () => {
  let { s, cid } = setup();
  const ph = run(s, "create_phase", { competitionId: cid }); s = ph.state;
  fail(s, "create_fixtures", { phaseId: ph.data.phase_id, fixtures: roundRobinRounds(["A", "B"]) }, admin, "invalid_fixtures");
  s = run(s, "create_fixtures", { phaseId: ph.data.phase_id, fixtures: roundRobinRounds(["A", "B", "C"]) }).state;
  fail(s, "create_fixtures", { phaseId: ph.data.phase_id, fixtures: roundRobinRounds(["A", "B", "C"]) }, admin, "fixtures_exist");
  let list = normMatches(run(s, "competition_matches_staff", { competitionId: cid }).data);
  assert.equal(list.length, 3);
  assert.ok(list.every((m) => m.state === "unscheduled" && m.seq === 0));
  assert.equal(pendingWork(list).toSchedule.length, 3);

  const m = list.find((x) => [x.homeId, x.awayId].includes("A") && [x.homeId, x.awayId].includes("B"));
  const kickoff = new Date(Date.now() + 30 * 60e3).toISOString();
  fail(s, "schedule_match", { matchId: m.id, kickoffAt: kickoff }, capA, "match_not_found");
  s = run(s, "schedule_match", { matchId: m.id, kickoffAt: kickoff, venue: { name: "Pavilhão de Espinho" } }).state;
  let page = normMatchPage(run(s, "match_page", { matchId: m.id }).data);
  assert.equal(page.match.state, "scheduled");
  assert.equal(page.competition.format, "5v5");
  assert.equal(page.competition.modality, "futsal");
  let perms = matchPermissions(page, { signedIn: true });
  assert.ok(perms.start && perms.schedule && perms.walkover && !perms.addEvent);

  // The captain (not staff) sees no operator actions but can set the formation.
  const capPage = normMatchPage(run(s, "match_page", { matchId: m.id, myTeams: [{ id: "A", role: "captain" }] }, capA).data);
  const capPerms = matchPermissions(capPage, { signedIn: true });
  assert.ok(!capPerms.start && !capPerms.addEvent && !capPerms.homologate);
  assert.ok(capPerms.formation("A") && !capPerms.formation("B"));
  s = run(s, "save_match_formation", { matchId: m.id, teamId: "A", formation: "2-1-1", slots: { "gk-0": "a1", "def-0": "a2", "def-1": "a3", "mid-0": "a4", "fwd-0": "a5" }, visibility: "published", baseVersion: null, myTeams: [{ id: "A", role: "captain" }] }, capA).state;
  fail(s, "save_match_formation", { matchId: m.id, teamId: "A", formation: "2-1-1", slots: {}, baseVersion: null, myTeams: [{ id: "A", role: "captain" }] }, capA, "stale_formation");

  // Team sheet (ficha) + live.
  const home = m.homeId, away = m.awayId;
  s = run(s, "set_league_lineup", { matchId: m.id, teamId: "A", playerIds: ["a1", "a2", "a3", "a4", "a5", "a6"] }).state;
  fail(s, "set_league_lineup", { matchId: m.id, teamId: "A", playerIds: ["b1"] }, admin, "player_not_in_squad");
  let seq = normMatchPage(run(s, "match_page", { matchId: m.id }).data).match.seq;
  fail(s, "set_match_phase", { matchId: m.id, phase: "live", expectedSeq: seq - 1 }, admin, "stale_seq");
  s = run(s, "set_match_phase", { matchId: m.id, phase: "live", expectedSeq: seq }).state;
  const g1 = eventToCloud({ id: "11111111-1111-4111-8111-111111111111", type: "goal", teamId: "A", playerId: "a5", assistId: "a4", minute: 3 }).data;
  s = run(s, "record_match_event", { matchId: m.id, event: g1 }).state;
  assert.equal(run(s, "record_match_event", { matchId: m.id, event: g1 }).data.duplicate, true, "idempotent replay");
  fail(s, "record_match_event", { matchId: m.id, event: { ...g1, id: "x2", player_id: "b1" } }, admin, "player_not_in_squad");
  s = run(s, "record_match_event", { matchId: m.id, event: eventToCloud({ id: "e-red", type: "card_red", teamId: "B", playerId: "b2", minute: 10 }).data }).state;
  s = run(s, "record_match_event", { matchId: m.id, event: eventToCloud({ id: "e-og", type: "own_goal", teamId: "A", playerId: "b3", minute: 15 }).data }).state;
  // correction: the own goal becomes a goal by a2
  s = run(s, "record_match_event", { matchId: m.id, event: eventToCloud({ id: "e-fix", type: "goal", teamId: "A", playerId: "a2", supersedes: "e-og", voidReason: "Revisto com os capitães" }).data }).state;
  fail(s, "record_match_event", { matchId: m.id, event: eventToCloud({ id: "e-fix2", type: "void", supersedes: "e-og", voidReason: "x" }).data }, admin, "stale_event");
  page = normMatchPage(run(s, "match_page", { matchId: m.id }).data);
  assert.deepEqual([page.score.home, page.score.away], home === "A" ? [2, 0] : [0, 2]);
  assert.equal(page.log.length, 3);
  assert.equal(page.score.state, "live");

  // Provisional table shows the live result; official doesn't.
  let official = normStandings(run(s, "competition_standings", { competitionId: cid }).data);
  assert.ok(official.rows.every((r) => r.pts === 0));
  const prov = provisionalStandings(official.rows, [{ homeId: home, awayId: away, home: page.score.home, away: page.score.away }], official);
  assert.equal(prov[0].id, "A"); assert.equal(prov[0].pts, 3);

  seq = page.match.seq;
  s = run(s, "set_match_phase", { matchId: m.id, phase: "finished", expectedSeq: seq }).state;
  page = normMatchPage(run(s, "match_page", { matchId: m.id }).data);
  assert.equal(page.match.state, "ended_provisional");
  perms = matchPermissions(page, { signedIn: true, rules: { mvp: { official_by: ["manager"], fan_vote: true } } });
  assert.ok(perms.homologate && perms.submit && perms.officialMvp && perms.openFanVote && !perms.end);
  assert.ok(pendingWork(normMatches(run(s, "competition_matches", { competitionId: cid }).data)).toHomologate.length === 1);
  s = run(s, "homologate_match", { matchId: m.id, expectedSeq: page.match.seq }).state;

  official = normStandings(run(s, "competition_standings", { competitionId: cid }).data);
  assert.equal(official.rows[0].id, "A"); assert.equal(official.rows[0].pts, 3); assert.equal(official.pending, 0);
  const stats = run(s, "competition_player_stats", { competitionId: cid }).data.items.map((x) => ({ playerId: x.player_id, name: x.name, teamId: x.team_id, apps: x.apps, goals: x.goals, assists: x.assists, yellows: x.yellows, reds: x.reds, photo: null }));
  assert.equal(rankingRows(stats, "goals").length, 2);
  assert.equal(rankingRows(stats, "assists")[0].player.id, "a4");
  assert.equal(stats.find((x) => x.playerId === "a6").apps, 1, "bench player on the ficha appears");
  assert.equal(cardRows(stats)[0].r, 1);

  // Discipline: the red opens a PENDING case; it blocks only once confirmed.
  let cases = run(s, "list_discipline_cases", { competitionId: cid }).data.items;
  assert.equal(cases.length, 1); assert.equal(cases[0].status, "pending");
  fail(s, "decide_discipline_case", { caseId: cases[0].case_id, decision: "confirm", matches: 1, reason: "" }, admin, "reason_required");
  s = run(s, "decide_discipline_case", { caseId: cases[0].case_id, decision: "confirm", matches: 1, reason: "Vermelho direto" }).state;
  const disc = run(s, "competition_discipline", { competitionId: cid }).data;
  assert.equal(disc.suspended.length, 1);
  const rows = disciplineRows(stats, { suspended: disc.suspended.map((x) => ({ playerId: x.player_id, teamId: x.team_id, matches: x.matches, served: x.served, name: x.name })) });
  assert.equal(rows.b2.pending, 1); assert.equal(rows.b2.reds, 1);
  const next = normMatches(run(s, "competition_matches", { competitionId: cid }).data).find((x) => [x.homeId, x.awayId].includes("B") && x.id !== m.id);
  s = run(s, "schedule_match", { matchId: next.id, kickoffAt: kickoff }).state;
  fail(s, "set_league_lineup", { matchId: next.id, teamId: "B", playerIds: ["b1", "b2"] }, admin, "player_suspended");

  // Awards: official MVP (manager) and the fans' vote, separate.
  s = run(s, "award_official_mvp", { matchId: m.id, playerId: "a5" }).state;
  fail(s, "award_official_mvp", { matchId: m.id, playerId: "a4" }, admin, "reason_required");
  s = run(s, "open_fan_vote", { matchId: m.id, hours: 24 }).state;
  const fan = { id: "fan1", name: "Adepto", isAdmin: false };
  // the fan can't see a private comp? league is public → can vote
  s = run(s, "cast_fan_vote", { matchId: m.id, playerId: "a2" }, fan).state;
  page = normMatchPage(run(s, "match_page", { matchId: m.id }, fan).data);
  assert.equal(page.fanVote.state, "open"); assert.equal(page.fanVote.items.length, 0, "tally hidden while open");
  assert.equal(page.officialMvp.playerId, "a5");
  assert.ok(matchPermissions(page, { signedIn: true }).vote);
  s = run(s, "close_fan_vote_demo", { matchId: m.id }).state;
  page = normMatchPage(run(s, "match_page", { matchId: m.id }, fan).data);
  assert.equal(page.fanVote.state, "closed"); assert.equal(page.fanVote.items[0].playerId, "a2");

  // Dispute by the losing captain, decided by the authority.
  const capB = { id: "capB", name: "Capitão B", isAdmin: false };
  const d = run(s, "open_dispute", { matchId: m.id, reason: "O segundo golo foi fora de tempo", myTeams: [{ id: "B", role: "captain" }] }, capB);
  s = d.state;
  const inbox = run(s, "competition_disputes", { competitionId: cid, status: "open" }).data;
  assert.equal(inbox.items.length, 1); assert.ok(inbox.items[0].can_decide);
  s = run(s, "decide_dispute", { disputeId: d.data.dispute_id, decision: "rejected", note: "Lance dentro do tempo" }).state;
  assert.equal(run(s, "competition_disputes", { competitionId: cid, status: "open" }).data.items.length, 0);

  // W.O. + point adjustment feed the official table.
  const wo = normMatches(run(s, "competition_matches_staff", { competitionId: cid }).data).find((x) => [x.homeId, x.awayId].includes("C") && [x.homeId, x.awayId].includes("A"));
  s = run(s, "record_walkover", { matchId: wo.id, absentTeamId: "C", reason: "Não compareceu", expectedSeq: wo.seq }).state;
  s = run(s, "adjust_points", { competitionId: cid, teamId: "C", points: -1, reason: "Falta de comparência" }).state;
  official = normStandings(run(s, "competition_standings", { competitionId: cid }).data);
  assert.equal(official.rows.find((r) => r.id === "A").pts, 6);
  assert.equal(official.rows.find((r) => r.id === "C").pts, -1);
  assert.equal(official.adjustments.length, 1);
});

test("mirror: team sheets in match_page by role, competition_page league id, adjustment ids", () => {
  let { s, lid, cid } = setup();
  const comp = normCompetitionPage(run(s, "competition_page", { leagueSlug: s.leagues[0].slug, competitionSlug: s.competitions[0].slug }).data);
  assert.equal(comp.leagueId, lid);
  const ph = run(s, "create_phase", { competitionId: cid }); s = ph.state;
  s = run(s, "create_fixtures", { phaseId: ph.data.phase_id, fixtures: roundRobinRounds(["A", "B", "C"]) }).state;
  const m = normMatches(run(s, "competition_matches", { competitionId: cid }).data).find((x) => [x.homeId, x.awayId].includes("A") && [x.homeId, x.awayId].includes("B"));
  s = run(s, "schedule_match", { matchId: m.id, kickoffAt: new Date(Date.now() + 60e3).toISOString() }).state;
  s = run(s, "set_league_lineup", { matchId: m.id, teamId: "A", playerIds: ["a1", "a2"] }).state;
  const staff = normMatchPage(run(s, "match_page", { matchId: m.id }).data);
  assert.deepEqual(staff.lineups.A.players.map((p) => p.id), ["a1", "a2"]);
  assert.equal(staff.lineups.A.players[0].number, 1);
  assert.equal(staff.lineups.B.count, 0);
  const capB = normMatchPage(run(s, "match_page", { matchId: m.id, myTeams: [{ id: "B", role: "captain" }] }, { id: "capB", isAdmin: false }).data);
  assert.equal(capB.lineups.A, null, "the other team sheet is hidden");
  assert.ok(capB.lineups.B);
  const fan = normMatchPage(run(s, "match_page", { matchId: m.id }, { id: "fan", isAdmin: false }).data);
  assert.deepEqual(fan.lineups, { A: null, B: null });
  s = run(s, "adjust_points", { competitionId: cid, teamId: "B", points: -2, reason: "Atraso na ficha" }).state;
  const adj = normStandings(run(s, "competition_standings", { competitionId: cid }).data).adjustments[0];
  assert.ok(adj.id);
  s = run(s, "revoke_point_adjustment", { adjustmentId: adj.id, reason: "Engano" }).state;
  assert.equal(normStandings(run(s, "competition_standings", { competitionId: cid }).data).adjustments.length, 0);
});

test("buildDirectory + permissions for a fan (read-only)", () => {
  const dir = buildDirectory([{ team: { id: "A", name: "Marés FC" }, squad: [{ playerId: "p1", name: "Rui", shirtNumber: 9 }] }], ["c1"]);
  assert.equal(dir.teamById.A.short, "MF"); assert.equal(dir.teamById.A.color, "c1"); assert.equal(dir.playerById.p1.number, 9);
  const live = { match: { id: "m", homeId: "A", awayId: "B", matchStatus: "live", resultStatus: "none" }, myRole: null, canHomologate: false, score: {} };
  const p = matchPermissions(live, { signedIn: true });
  assert.ok(!p.addEvent && !p.end && !p.schedule && !p.dispute && !p.vote);
});
