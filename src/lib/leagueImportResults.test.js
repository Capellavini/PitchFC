import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo, generateFixtures } from "./leagueSetup.js";
import { importTeams } from "./leagueImport.js";
import { importResults } from "./leagueImportResults.js";
import { matchScore } from "./core/league.js";

const league = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "Liga do Porto", city: "Porto" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 2, season: "2026/27" });
  const id = s.data.competitions[0].id;
  s = importTeams(s, { competitionId: id, rows: [["Porto FC"], ["Corinthians de Porto"], ["Vai.CO"]] }).state;
  s = generateFixtures(s, { competitionId: id, startDate: "2026-10-31", times: ["15:00"], everyDays: 7 });
  return { s, id };
};
const H = ["Jornada", "Casa", "Fora", "Golos casa", "Golos fora"];

test("results from a file enter as provisional with the right score", () => {
  const { s, id } = league();
  const m1 = s.matches.find((m) => m.round === 1);
  const home = s.data.teams.find((t) => t.id === m1.homeId).name; const away = s.data.teams.find((t) => t.id === m1.awayId).name;
  const r = importResults(s, { competitionId: id, rows: [H, ["1", home, away, "3", "1"]] });
  assert.equal(r.added, 1, JSON.stringify(r.skipped));
  const done = r.state.matches.find((m) => m.id === m1.id);
  assert.equal(done.state, "ended_provisional");
  assert.deepEqual([matchScore(r.state.logs[m1.id], done).home, matchScore(r.state.logs[m1.id], done).away], [3, 1]);
});

test("a single «2-1» column works, and a pair listed the other way round is turned the right way", () => {
  const { s, id } = league();
  const m1 = s.matches.find((m) => m.round === 1);
  const home = s.data.teams.find((t) => t.id === m1.homeId).name; const away = s.data.teams.find((t) => t.id === m1.awayId).name;
  const r = importResults(s, { competitionId: id, rows: [["Casa", "Fora", "Resultado", "Jornada"], [away, home, "0–2", "1"]] });
  assert.equal(r.added, 1, JSON.stringify(r.skipped));
  const sc = matchScore(r.state.logs[m1.id], r.state.matches.find((m) => m.id === m1.id));
  assert.deepEqual([sc.home, sc.away], [2, 0], "the file said away 0 – home 2");
});

test("bad rows are skipped with their line, not thrown", () => {
  const { s, id } = league();
  const m1 = s.matches.find((m) => m.round === 1);
  const home = s.data.teams.find((t) => t.id === m1.homeId).name; const away = s.data.teams.find((t) => t.id === m1.awayId).name;
  const r = importResults(s, { competitionId: id, rows: [H, ["1", "Equipa Fantasma", away, "1", "0"], ["1", home, away, "x", "0"], ["1", home, away, "2", "2"], ["1", home, away, "1", "0"]] });
  assert.deepEqual(r.skipped.map((x) => [x.line, x.reason]), [[2, "unknown_team"], [3, "bad_score"], [5, "match_played"]]);
  assert.equal(r.added, 1);
  assert.equal(importResults(s, { competitionId: id, rows: [["Foo", "Bar"], ["a", "b"]] }).skipped[0].reason, "results_columns");
});

test("two games between the same teams need the round or the date; penalties only on a level score", () => {
  const { s, id } = league();
  const m1 = s.matches.find((m) => m.round === 1);
  const home = s.data.teams.find((t) => t.id === m1.homeId).name; const away = s.data.teams.find((t) => t.id === m1.awayId).name;
  const noRound = importResults(s, { competitionId: id, rows: [["Casa", "Fora", "Resultado"], [home, away, "1-0"]] });
  assert.equal(noRound.skipped[0].reason, "match_ambiguous", "home and away legs of the same pair");
  const bad = importResults(s, { competitionId: id, rows: [["Jornada", "Casa", "Fora", "Resultado", "Penáltis"], ["1", home, away, "1-0", "4-3"]] });
  assert.equal(bad.skipped[0].reason, "bad_shootout");
  const ok = importResults(s, { competitionId: id, rows: [["Jornada", "Casa", "Fora", "Resultado", "Penáltis"], ["1", home, away, "1-1", "4-3"]] });
  assert.equal(ok.added, 1, JSON.stringify(ok.skipped));
  assert.deepEqual(matchScore(ok.state.logs[m1.id], ok.state.matches.find((m) => m.id === m1.id)).shootout, { home: 4, away: 3 });
});
