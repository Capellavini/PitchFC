import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo, generateFixtures } from "./leagueSetup.js";
import { importTeams, importRoster } from "./leagueImport.js";
import { recordResult } from "./leagueResults.js";
import { matchScore, discipline, playerStats } from "./core/league.js";
import { prepareBatch, cleanProposal, PROPOSALS } from "./leagueAdjuntoActions.js";

const league = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "Liga do Porto", city: "Porto" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 2, season: "2026/27" });
  const id = s.data.competitions[0].id;
  s = importTeams(s, { competitionId: id, rows: [["Porto FC"], ["Corinthians de Porto"], ["Vai.CO"]] }).state;
  s = importRoster(s, { rows: [["Equipa", "Nome", "Número"],
    ["Porto FC", "Vinicius Capella", "9"], ["Porto FC", "Rui Silva", "1"], ["Porto FC", "Bruno Barto", "4"],
    ["Corinthians de Porto", "Nuno Reis", "7"], ["Corinthians de Porto", "Zé Costa", "10"], ["Corinthians de Porto", "Bruno Barbosa", "5"],
    ["Vai.CO", "Outro Jogador", "3"]] }).state;
  s = generateFixtures(s, { competitionId: id, startDate: "2026-10-31", times: ["15:00"], everyDays: 7 });
  return s;
};
const batch = (s, args) => prepareBatch(s, [{ kind: "record_result", args }]);
const cleaned = (args) => cleanProposal("record_result", args);
const find = (s, a, b) => s.matches.find((m) => [m.homeId, m.awayId].sort().join() === [a, b].sort().join() && m.state === "scheduled");
const teamId = (s, name) => s.data.teams.find((t) => t.name === name).id;
const day = (iso) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date(iso));
/** Lisbon day of the i-th game between two teams (the calendar spreads them over several weeks). */
const legDay = (s, a, b, i = 0) => day(s.matches.filter((m) => [m.homeId, m.awayId].sort().join() === [teamId(s, a), teamId(s, b)].sort().join())[i].kickoff);

test("the sentence from the brief: names resolved, goals, a yellow card, provisional only", () => {
  const s = league();
  const r = batch(s, cleaned({ home: "Porto fc", away: "Corinthians", home_goals: 2, away_goals: 0, date: legDay(s, "Porto FC", "Corinthians de Porto"), scorers: [{ player: "Vini", goals: 2 }], cards: [{ player: "Barto", type: "yellow" }] }).args);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  assert.match(r.items[0].line, /Porto FC 2–0 Corinthians de Porto · golos: Vini \(2\) · cartões: Barto \(amarelo\) — fica por homologar/);
  const p = teamId(r.state, "Porto FC"); const c = teamId(r.state, "Corinthians de Porto");
  const m = r.state.matches.find((x) => x.state === "ended_provisional");
  assert.ok(m && [m.homeId, m.awayId].includes(p) && [m.homeId, m.awayId].includes(c));
  assert.deepEqual([matchScore(r.state.logs[m.id], m).home, matchScore(r.state.logs[m.id], m).away].sort(), [0, 2]);
  const vini = r.state.data.players.find((x) => x.name === "Vinicius Capella").id;
  assert.equal(playerStats(r.state.matches, r.state.logs, { includeProvisional: true })[vini].goals, 2);
  assert.equal(playerStats(r.state.matches, r.state.logs)[vini]?.goals ?? 0, 0, "provisional goals are not official");
  assert.equal(r.state.matches.filter((x) => x.state === "homologated").length, 0);
});

test("teams said in the opposite order of the fixture get the right goals", () => {
  const s = league();
  const p = teamId(s, "Porto FC"); const c = teamId(s, "Corinthians de Porto");
  const fixture = s.matches.filter((m) => [m.homeId, m.awayId].includes(p) && [m.homeId, m.awayId].includes(c))[0];
  const saidFirst = fixture.homeId === p ? "Corinthians de Porto" : "Porto FC"; // deliberately the away side first
  const saidSecond = saidFirst === "Porto FC" ? "Corinthians de Porto" : "Porto FC";
  const r = batch(s, cleaned({ home: saidFirst, away: saidSecond, home_goals: 3, away_goals: 1, date: legDay(s, "Porto FC", "Corinthians de Porto") }).args);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  const m = r.state.matches.find((x) => x.id === fixture.id);
  const sc = matchScore(r.state.logs[m.id], m);
  const firstIsHome = m.homeId === teamId(r.state, saidFirst);
  assert.equal(firstIsHome ? sc.home : sc.away, 3);
  assert.equal(firstIsHome ? sc.away : sc.home, 1);
});

test("no scorers: the goals are still recorded (without an author) and the line says so", () => {
  const s = league();
  const r = batch(s, cleaned({ home: "Porto FC", away: "Vai.CO", home_goals: 1, away_goals: 1, date: legDay(s, "Porto FC", "Vai.CO") }).args);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  assert.match(r.items[0].line, /sem marcadores/);
  const m = r.state.matches.find((x) => x.state === "ended_provisional");
  assert.equal(r.state.logs[m.id].filter((e) => e.type === "goal" && e.playerId === null).length, 2);
});

test("an own goal counts for the other side; a second yellow becomes yellow + red", () => {
  const s = league();
  const r = batch(s, cleaned({ home: "Porto FC", away: "Corinthians de Porto", home_goals: 1, away_goals: 0, date: legDay(s, "Porto FC", "Corinthians de Porto"), scorers: [{ player: "Nuno", own_goal: true }], cards: [{ player: "Zé", type: "second_yellow" }] }).args);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  const m = r.state.matches.find((x) => x.state === "ended_provisional");
  const own = r.state.logs[m.id].find((e) => e.type === "own_goal");
  assert.equal(own.teamId, teamId(r.state, "Porto FC"));
  assert.deepEqual(r.state.logs[m.id].filter((e) => e.type.startsWith("card")).map((e) => e.type), ["card_yellow", "card_red"]);
  assert.equal(discipline(r.state.matches, r.state.logs, r.state.data.players, undefined).constructor, Object);
});

test("things that must be refused, each with a readable reason", () => {
  const s = league();
  const base = { home: "Porto FC", away: "Corinthians de Porto", home_goals: 1, away_goals: 0, date: legDay(s, "Porto FC", "Corinthians de Porto") };
  assert.match(batch(s, cleaned({ ...base, scorers: [{ player: "Vini", goals: 2 }] }).args).items[0].error, /mais golos atribuídos/);
  assert.match(batch(s, cleaned({ ...base, scorers: [{ player: "Fulano Inexistente" }] }).args).items[0].error, /Não encontrei esse atleta/);
  assert.match(batch(s, cleaned({ ...base, away: "Vai.CO", date: legDay(s, "Porto FC", "Vai.CO"), cards: [{ player: "Nuno", type: "red" }] }).args).items[0].error, /Não encontrei esse atleta/);
  assert.match(batch(s, cleaned({ ...base, home_goals: undefined }).args).items[0].error, /Falta o resultado/);
  assert.match(batch(s, cleaned({ ...base, away: "Porto FC" }).args).items[0].error, /duas equipas diferentes/);
  assert.match(batch(s, cleaned({ ...base, away: "Equipa que não existe" }).args).items[0].error, /equipa/);
  // "Bruno" exists in both squads (Barto, Barbosa) and no team was said: never a guess.
  assert.match(batch(s, cleaned({ ...base, scorers: [{ player: "Bruno" }] }).args).items[0].error, /mais de um atleta/);
  // ...but with the team said it is resolved.
  assert.equal(batch(s, cleaned({ ...base, scorers: [{ player: "Bruno", team: "Porto FC" }] }).args).failed, 0);
});

test("a played game cannot get a second result; two games to play need the date", () => {
  const s = league();
  const args = cleaned({ home: "Porto FC", away: "Corinthians de Porto", home_goals: 2, away_goals: 2, date: legDay(s, "Porto FC", "Corinthians de Porto") }).args;
  const once = batch(s, args);
  assert.equal(once.failed, 0, JSON.stringify(once.items));
  const twice = batch(once.state, args);
  assert.equal(twice.failed, 0, "the second leg is still to play, so the same names can resolve to it");
  const thrice = batch(twice.state, args);
  assert.match(thrice.items[0].error, /já tem resultado/);
});

test("with two legs still to play and no date, it is ambiguous rather than guessed", () => {
  const s = league();
  const p = teamId(s, "Porto FC"); const c = teamId(s, "Corinthians de Porto");
  const legs = s.matches.filter((m) => [m.homeId, m.awayId].includes(p) && [m.homeId, m.awayId].includes(c));
  assert.equal(legs.length, 2);
  const r = batch(s, cleaned({ home: "Porto FC", away: "Corinthians de Porto", home_goals: 1, away_goals: 0 }).args);
  assert.match(r.items[0].error || "", /mais de um jogo/);
});

test("recordResult directly: score only, then it refuses a second time and never homologates", () => {
  const s = league();
  const m = s.matches[0];
  const done = recordResult(s, { matchId: m.id, score: { home: 4, away: 2 }, by: "Gestor" });
  const out = done.matches.find((x) => x.id === m.id);
  assert.equal(out.state, "ended_provisional");
  assert.deepEqual(matchScore(done.logs[m.id], out), { home: 4, away: 2, shootout: null, walkover: false });
  assert.throws(() => recordResult(done, { matchId: m.id, score: { home: 1, away: 0 } }), /result_exists/);
  assert.throws(() => recordResult(s, { matchId: m.id }), /score_required/);
});

test("the appeared list fills the call-up; names that aren't in the squad are reported, not invented", () => {
  const s = league();
  const r = batch(s, cleaned({ home: "Porto FC", away: "Vai.CO", home_goals: 0, away_goals: 0, date: legDay(s, "Porto FC", "Vai.CO"), appeared: [{ team: "Porto FC", players: ["Vinicius Capella", "Rui Silva", "Alguém Desconhecido"] }] }).args);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  assert.match(r.items[0].line, /fora do plantel: Alguém Desconhecido/);
  const m = r.state.matches.find((x) => x.state === "ended_provisional");
  assert.equal(m.lineups[teamId(r.state, "Porto FC")].length, 2);
});

test("the model's arguments are cleaned and the tool schema exists", () => {
  assert.ok(PROPOSALS.record_result.schema.required.includes("home_goals"));
  const c = cleaned({ home: " Porto ", away: "X", home_goals: "2", away_goals: 99, scorers: [{ player: "" }, { player: "Vini", goals: 500 }], cards: [{ player: "B", type: "blue" }] }).args;
  assert.equal(c.home_goals, null);
  assert.equal(c.away_goals, 99);
  assert.deepEqual(c.scorers, [{ player: "Vini", team: "", goals: 20, own_goal: false }]);
  assert.equal(c.cards[0].type, "yellow");
});

test("the Painel flags a game whose time has passed, then asks to homologate once it has a result", async () => {
  const { normalizeLeagueState, deriveLeague } = await import("./leagueDemo.js");
  const { leagueToday } = await import("./leagueToday.js");
  const s0 = normalizeLeagueState(league());
  const m = s0.matches[0];
  const later = Date.parse(m.kickoff) + 3 * 3600e3;
  const before = leagueToday(s0, deriveLeague(s0), { now: later });
  assert.ok(before.items.some((i) => i.kind === "result" && i.matchId === m.id));
  assert.ok(!leagueToday(s0, deriveLeague(s0), { now: Date.parse(m.kickoff) + 3600e3 }).items.some((i) => i.kind === "result"), "not yet: the game may still be on");
  const s1 = normalizeLeagueState(recordResult(s0, { matchId: m.id, score: { home: 1, away: 0 } }));
  const after = leagueToday(s1, deriveLeague(s1), { now: later });
  assert.ok(!after.items.some((i) => i.kind === "result" && i.matchId === m.id));
  assert.ok(after.items.some((i) => i.kind === "homologate" && i.matchId === m.id));
});
