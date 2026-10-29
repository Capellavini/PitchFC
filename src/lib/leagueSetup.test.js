import test from "node:test";
import assert from "node:assert/strict";
import {
  setLeagueInfo, addCompetition, addTeam, setTeamCompetitions, removeTeam, parseRoster, addPlayers, removePlayer, setCaptain,
  scheduleRounds, generateFixtures, addMatch, setupSteps, zonedIso, SetupError,
} from "./leagueSetup.js";
import { emptyLeagueState, deriveLeague, normalizeLeagueState } from "./leagueDemo.js";
import { appendEvent, transition } from "./core/league.js";
import { leagueToday } from "./leagueToday.js";
import { adjuntoBrief } from "./leagueAdjuntoGuide.js";

const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof SetupError && e.code === code, code);

function league() {
  let s = emptyLeagueState();
  s = setLeagueInfo(s, { name: "  Liga   Teste ", city: "Espinho" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 2, sponsor: "Liga X" });
  const comp = s.data.competitions[0].id;
  for (const name of ["Alfa FC", "Beta Unidos", "Gama Clube"]) s = addTeam(s, { name, venue: `Campo ${name[0]}`, competitionIds: [comp] });
  return { s, comp };
}

test("a brand-new league needs every step; the steps tick off as it is built", () => {
  let s = emptyLeagueState();
  assert.deepEqual(setupSteps(s).map((x) => x.done), [false, false, false, false, false]);
  const { s: built, comp } = league();
  assert.deepEqual(setupSteps(built).map((x) => x.id + ":" + x.done), ["league:true", "competition:true", "teams:true", "players:false", "calendar:false"]);
  assert.equal(built.data.league.name, "Liga Teste", "spaces are collapsed");
  assert.equal(built.data.competitions[0].id, "cp-1-divisao");
  assert.deepEqual(built.data.competitions[0].teamIds.length, 3);
  assert.equal(built.data.competitions[0].legs, 2);
  void comp;
});

test("validation: names, duplicates, kinds", () => {
  const s = emptyLeagueState();
  throwsCode(() => setLeagueInfo(s, { name: " " }), "name_required");
  throwsCode(() => addCompetition(s, { name: "x" }), "name_required");
  const { s: b } = league();
  throwsCode(() => addTeam(b, { name: "alfa fc" }), "duplicate_team");
  assert.equal(addCompetition(s, { name: "Taça", kind: "nonsense" }).data.competitions[0].kind, "league");
  assert.equal(addCompetition(s, { name: "Taça", kind: "cup" }).data.competitions[0].legs, undefined);
});

test("team ids are unique and kit colours cycle", () => {
  let { s } = league();
  s = addTeam(s, { name: "Alfa  F.C." });
  const ids = s.data.teams.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(s.data.teams[0].short, "AF");
  assert.notEqual(s.data.teams[0].color, s.data.teams[1].color);
});

test("rosters: numbers, positions and Excel tabs; one captain by default; unique numbers", () => {
  assert.deepEqual(parseRoster("10 Rui Silva\n7;Tiago Pinto;AVA\n\tNuno Lopes DEF\nA").errors.map((e) => e.line), [4]);
  assert.deepEqual(parseRoster("10\tRui Silva\tGR").rows, [{ name: "Rui Silva", number: 10, position: "GR" }]);
  let { s } = league();
  const alfa = s.data.teams[0].id;
  s = addPlayers(s, alfa, "1 Rui Silva GR\n9 Tiago Pinto AVA\nNuno Lopes");
  const squad = s.data.players.filter((p) => p.teamId === alfa);
  assert.equal(squad.length, 3);
  assert.equal(squad.filter((p) => p.captain).length, 1);
  assert.equal(squad.find((p) => p.name === "Nuno Lopes").position, "MED");
  assert.ok(squad[0].attrs.div !== undefined, "goalkeepers get goalkeeper attributes");
  throwsCode(() => addPlayers(s, alfa, "9 Outro Nove"), "duplicate_number");
  throwsCode(() => addPlayers(s, alfa, "  "), "nothing_to_add");
  s = setCaptain(s, alfa, squad[1].id);
  assert.deepEqual(s.data.players.filter((p) => p.teamId === alfa && p.captain).map((p) => p.id), [squad[1].id]);
});

test("round robin: odd teams get a bye, legs repeat with home/away swapped", () => {
  const rounds = scheduleRounds(["a", "b", "c"], 2);
  assert.equal(rounds.length, 6, "3 teams × 2 legs = 3 rounds per leg");
  assert.ok(rounds.every((r) => r.length === 1), "one match per round, one team rests");
  const pairs = rounds.flat().map((f) => [f.homeId, f.awayId].sort().join("-"));
  assert.deepEqual([...new Set(pairs)].sort(), ["a-b", "a-c", "b-c"]);
  const first = rounds.slice(0, 3).flat(); const second = rounds.slice(3).flat();
  assert.deepEqual(second.map((f) => [f.awayId, f.homeId]), first.map((f) => [f.homeId, f.awayId]));
  assert.equal(scheduleRounds(["a", "b", "c", "d"], 3).length, 9);
  assert.deepEqual(scheduleRounds(["a"], 1), []);
});

test("generating the calendar creates every match once, in the league's time zone", () => {
  let { s, comp } = league();
  s = generateFixtures(s, { competitionId: comp, startDate: "2026-11-07", times: ["15:00", "18:00"] });
  assert.equal(s.matches.length, 6);
  assert.equal(s.data.competitions[0].rounds, 6);
  assert.deepEqual(s.matches.map((m) => m.round), [1, 2, 3, 4, 5, 6]);
  assert.equal(s.matches[0].kickoff, "2026-11-07T15:00:00.000Z", "winter: Lisbon = UTC");
  assert.equal(s.matches[1].kickoff, "2026-11-14T15:00:00.000Z");
  assert.ok(s.matches.every((m) => m.state === "scheduled" && m.venue));
  throwsCode(() => generateFixtures(s, { competitionId: comp, startDate: "2026-11-07" }), "calendar_exists");
  assert.equal(zonedIso("2026-07-04", "15:00"), "2026-07-04T14:00:00.000Z", "summer: Lisbon = UTC+1");
});

test("a generated league plays through: results make the table, the registry stays in step", () => {
  let { s, comp } = league();
  s = generateFixtures(s, { competitionId: comp, startDate: "2026-11-07" });
  normalizeLeagueState(s); // mirrors it into the registry (the screens read it there)
  const m = s.matches[0];
  let log = [];
  log = appendEvent(log, { id: "e1", matchId: m.id, type: "goal", teamId: m.homeId, playerId: null, minute: 5, recordedBy: "t", recordedAt: m.kickoff });
  let match = transition(m, "live", { role: "manager", by: "t", at: m.kickoff });
  match = transition(match, "ended_provisional", { role: "manager", by: "t", at: m.kickoff });
  match = transition(match, "homologated", { role: "manager", by: "t", at: m.kickoff });
  const played = { ...s, matches: s.matches.map((x) => (x.id === m.id ? match : x)), logs: { [m.id]: log } };
  const d = deriveLeague(played);
  const rows = d.tables[comp];
  assert.equal(rows.length, 3);
  assert.equal(rows.find((r) => r.id === m.homeId).pts, 3);
  assert.equal(rows.find((r) => r.id === m.awayId).pts, 0);
  assert.equal(d.table, rows, "the primary table is the first league competition");
});

test("a cup tie can be added by hand and its teams enter the cup", () => {
  let { s } = league();
  s = addCompetition(s, { name: "Taça", kind: "cup" });
  const cup = s.data.competitions[1].id; const [a, b] = s.data.teams;
  s = addMatch(s, { competitionId: cup, homeId: a.id, awayId: b.id, date: "2026-12-05", time: "10:00", round: 1, roundName: "Meias-finais" });
  assert.equal(s.matches.length, 1);
  assert.equal(s.matches[0].roundName, "Meias-finais");
  assert.equal(s.matches[0].venue, a.venue, "defaults to the home team's ground");
  assert.deepEqual(s.data.competitions[1].teamIds.sort(), [a.id, b.id].sort());
  throwsCode(() => addMatch(s, { competitionId: cup, homeId: a.id, awayId: a.id, date: "2026-12-05", time: "10:00" }), "two_different_teams");
  throwsCode(() => addMatch(s, { competitionId: cup, homeId: a.id, awayId: b.id, date: "", time: "10:00" }), "date_required");
});

test("things with history can't be removed or moved out from under their matches", () => {
  let { s, comp } = league();
  s = addPlayers(s, s.data.teams[0].id, "1 Rui Silva");
  const pid = s.data.players[0].id;
  s = generateFixtures(s, { competitionId: comp, startDate: "2026-11-07" });
  throwsCode(() => removeTeam(s, s.data.teams[0].id), "has_matches");
  throwsCode(() => setTeamCompetitions(s, s.data.teams[0].id, []), "team_has_matches");
  const lined = { ...s, matches: s.matches.map((m, i) => (i === 0 ? { ...m, lineups: { x: [pid] } } : m)) };
  throwsCode(() => removePlayer(lined, pid), "player_has_history");
  assert.equal(removePlayer(s, pid).data.players.length, 0);
  assert.equal(removeTeam(emptyLeagueState(), "nope").data.teams.length, 0, "removing what isn't there is a no-op");
});

test("the Adjunto does not say everything is fine about a league with no games", () => {
  const s = emptyLeagueState();
  normalizeLeagueState(s);
  const brief = adjuntoBrief(leagueToday(s, deriveLeague(s)));
  assert.match(brief.text, /Ainda não há jogos/);
  assert.deepEqual(brief.actions, []);
});
