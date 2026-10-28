import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo } from "./leagueSetup.js";
import { importTeams, importCalendar, importRoster, parseDate, parseTime, parsePosition, findTeam } from "./leagueImport.js";

const base = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "AFPCE", city: "Espinho" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 1, season: "2026/27" });
  return { s, id: s.data.competitions[0].id };
};

test("parseDate / parseTime accept the formats leagues really use", () => {
  assert.equal(parseDate("2026-09-13"), "2026-09-13");
  assert.equal(parseDate("13/09/2026"), "2026-09-13");
  assert.equal(parseDate("3-9-26"), "2026-09-03");
  assert.equal(parseDate("13.09.2026 15:00"), "2026-09-13");
  assert.equal(parseDate("31/02/2026"), null);
  assert.equal(parseDate("amanhã"), null);
  assert.equal(parseTime("15:00"), "15:00");
  assert.equal(parseTime("15h"), "15:00");
  assert.equal(parseTime("9h30"), "09:30");
  assert.equal(parseTime("15:00:00"), "15:00");
  assert.equal(parseTime("25:00"), null);
});

test("parsePosition understands Portuguese labels", () => {
  assert.equal(parsePosition("Guarda-Redes"), "GR");
  assert.equal(parsePosition("Médio"), "MED");
  assert.equal(parsePosition("Avançado"), "AVA");
  assert.equal(parsePosition("Defesa"), "DEF");
  assert.equal(parsePosition("??"), null);
});

test("importTeams: one column or a table, existing teams are entered not duplicated", () => {
  const { s, id } = base();
  const r1 = importTeams(s, { competitionId: id, rows: [["Equipa", "Sigla", "Campo"], ["Anta FC", "ANT", "Campo da Anta"], ["Paramos", "", ""], ["", "", ""], ["A", "", ""]] });
  assert.deepEqual(r1.added, ["Anta FC", "Paramos"]);
  assert.deepEqual(r1.skipped, [{ line: 5, reason: "name_required" }]);
  assert.equal(r1.state.data.teams.find((t) => t.name === "Anta FC").venue, "Campo da Anta");
  assert.equal(r1.state.data.competitions[0].teamIds.length, 2);
  const r2 = importTeams(r1.state, { competitionId: id, rows: [["anta fc"], ["Silvalde"]] });
  assert.deepEqual(r2.added, ["Silvalde"]);
  assert.equal(r2.state.data.teams.length, 3);
});

test("a team can be in two competitions without being created twice", () => {
  let { s, id } = base();
  s = addCompetition(s, { name: "Taça", kind: "cup" });
  const cup = s.data.competitions[1].id;
  s = importTeams(s, { competitionId: id, rows: [["Anta FC"], ["Paramos"]] }).state;
  const r = importTeams(s, { competitionId: cup, rows: [["Anta FC"]] });
  assert.equal(r.state.data.teams.length, 2);
  assert.deepEqual(r.entered, ["Anta FC"]);
  assert.ok(r.state.data.competitions[0].teamIds.length === 2 && r.state.data.competitions[1].teamIds.length === 1);
});

test("importCalendar: header columns, Portuguese dates, missing teams created, rounds kept", () => {
  const { s, id } = base();
  const rows = [["Jornada", "Data", "Hora", "Casa", "Fora", "Local"],
    ["1", "13/09/2026", "15:00", "Anta FC", "Paramos", "Campo da Anta"],
    ["1", "13/09/2026", "17h", "Silvalde", "Anta FC", ""],
    ["2", "20/09/2026", "", "Paramos", "Silvalde", ""]];
  const r = importCalendar(s, { competitionId: id, rows });
  assert.equal(r.added, 3);
  assert.deepEqual(r.created.sort(), ["Anta FC", "Paramos", "Silvalde"]);
  assert.deepEqual(r.skipped, []);
  const m = r.state.matches;
  assert.equal(m.length, 3);
  assert.equal(m[0].venue, "Campo da Anta");
  assert.equal(m[2].round, 2);
  assert.match(m[1].kickoff, /T1[67]:00:00.000Z$/); // 17h Lisbon in September = 16:00Z
  assert.equal(r.state.data.competitions[0].rounds, 2);
  assert.equal(r.state.data.competitions[0].teamIds.length, 3);
});

test("importCalendar: no header, bad rows are reported with their line and the rest still import", () => {
  const { s, id } = base();
  const rows = [["2026-09-13", "15:00", "Alfa FC", "Beta FC"], ["não é data", "15:00", "Alfa FC", "Beta FC"], ["2026-09-20", "99:99", "Alfa FC", "Beta FC"], ["2026-09-20", "15:00", "Alfa FC", "Alfa FC"], ["2026-09-20", "15:00", "Beta FC", "Alfa FC"]];
  const r = importCalendar(s, { competitionId: id, rows });
  assert.equal(r.added, 2);
  assert.deepEqual(r.skipped, [{ line: 2, reason: "bad_date" }, { line: 3, reason: "bad_time" }, { line: 4, reason: "two_different_teams" }]);
});

test("importCalendar: the same file twice adds nothing the second time", () => {
  const { s, id } = base();
  const rows = [["Data", "Hora", "Casa", "Fora"], ["2026-09-13", "15:00", "Alfa FC", "Beta FC"]];
  const once = importCalendar(s, { competitionId: id, rows });
  const twice = importCalendar(once.state, { competitionId: id, rows });
  assert.equal(twice.added, 0);
  assert.deepEqual(twice.skipped, [{ line: 2, reason: "duplicate" }]);
  assert.equal(twice.state.matches.length, 1);
});

test("importCalendar: createMissing=false skips unknown teams and creates nothing", () => {
  let { s, id } = base();
  s = importTeams(s, { competitionId: id, rows: [["Alfa FC"], ["Beta FC"]] }).state;
  const r = importCalendar(s, { competitionId: id, createMissing: false, rows: [["Data", "Hora", "Casa", "Fora"], ["2026-09-13", "15:00", "Alfa FC", "Beta FC"], ["2026-09-13", "15:00", "Alfa FC", "Zeta FC"]] });
  assert.equal(r.added, 1);
  assert.deepEqual(r.skipped, [{ line: 3, reason: "unknown_team" }]);
  assert.equal(r.state.data.teams.length, 2);
});

test("importCalendar: date and time in one cell, and a missing column is explained", () => {
  const { s, id } = base();
  const joined = importCalendar(s, { competitionId: id, rows: [["Data", "Casa", "Fora"], ["13/09/2026 16:30", "Alfa FC", "Beta FC"]] });
  assert.equal(joined.added, 1);
  const bad = importCalendar(s, { competitionId: id, rows: [["Data", "Casa"], ["13/09/2026", "Alfa FC"]] });
  assert.deepEqual(bad.skipped, [{ line: 1, reason: "columns_missing" }]);
});

test("importRoster: by team name, with number and position; unknown team reported", () => {
  let { s, id } = base();
  s = importTeams(s, { competitionId: id, rows: [["Anta FC"], ["Paramos"]] }).state;
  const r = importRoster(s, { rows: [["Equipa", "Nome", "Número", "Posição"], ["Anta FC", "Rui Silva", "1", "Guarda-redes"], ["Anta FC", "Nuno Reis", "7", "Avançado"], ["Paramos", "Zé Costa", "", ""], ["Outra", "X Y", "", ""]] });
  assert.equal(r.added, 3);
  assert.deepEqual(r.skipped, [{ line: 5, reason: "unknown_team" }]);
  const anta = r.state.data.teams.find((t) => t.name === "Anta FC");
  const gk = r.state.data.players.find((p) => p.name === "Rui Silva");
  assert.equal(gk.teamId, anta.id); assert.equal(gk.position, "GR"); assert.equal(gk.number, 1);
});

test("importRoster: a duplicated shirt number rejects that team only", () => {
  let { s, id } = base();
  s = importTeams(s, { competitionId: id, rows: [["Alfa FC"], ["Beta FC"]] }).state;
  const r = importRoster(s, { rows: [["Equipa", "Nome", "Número"], ["Alfa FC", "Um Dois", "9"], ["Alfa FC", "Três Quatro", "9"], ["Beta FC", "Cinco Seis", "9"]] });
  assert.equal(r.added, 1);
  assert.equal(r.skipped[0].reason, "duplicate_number");
  assert.equal(r.skipped[0].team, "Alfa FC");
});

test("findTeam: exact ignoring accents, unique partial, never ambiguous", () => {
  let { s, id } = base();
  s = importTeams(s, { competitionId: id, rows: [["Atlético de Anta"], ["Atlético de Paramos"], ["Silvalde"]] }).state;
  assert.equal(findTeam(s, "atletico de anta").name, "Atlético de Anta");
  assert.equal(findTeam(s, "Silv").name, "Silvalde");
  assert.equal(findTeam(s, "Atlético"), null);
});
