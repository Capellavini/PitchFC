import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo, generateFixtures, addMatch } from "./leagueSetup.js";
import { importTeams, importRoster } from "./leagueImport.js";
import { recordResult } from "./leagueResults.js";
import { transition } from "./core/league.js";
import { closeSeason, newSeason, seasonChecklist, proposedChampions, tieWinner, annotateSeason, nextSeasonLabel } from "./leagueSeason.js";

const setup = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "Liga", city: "Porto" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 1, season: "2026/27" });
  s = addCompetition(s, { name: "Taça", kind: "cup", season: "2026/27" });
  const [liga, taca] = s.data.competitions.map((c) => c.id);
  s = importTeams(s, { competitionId: liga, rows: [["Alfa"], ["Beta"], ["Gama"]] }).state;
  s = importRoster(s, { rows: [["Equipa", "Nome", "Número"], ["Alfa", "Rui Silva", "1"], ["Alfa", "Tiago Pinto", "9"], ["Beta", "Nuno Reis", "7"], ["Gama", "Zé Costa", "10"]] }).state;
  s = generateFixtures(s, { competitionId: liga, startDate: "2026-11-07", times: ["15:00"] });
  return { s, liga, taca };
};
const teamId = (s, name) => s.data.teams.find((t) => t.name === name).id;
const playerId = (s, name) => s.data.players.find((p) => p.name === name).id;
const homologate = (s, id) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? transition(m, "homologated", { role: "manager", by: "t", at: "2026-11-30T00:00:00Z" }) : m)) });
/** Alfa wins every game 1–0 (Rui Silva scores); Beta v Gama is 1–0 for the home side. */
const playLeague = (s0, liga) => {
  let s = s0;
  const alfa = teamId(s, "Alfa"), rui = playerId(s, "Rui Silva");
  for (const m of s.matches.filter((x) => x.competitionId === liga && x.state === "scheduled")) {
    const withAlfa = m.homeId === alfa || m.awayId === alfa;
    const score = withAlfa ? (m.homeId === alfa ? { home: 1, away: 0 } : { home: 0, away: 1 }) : { home: 1, away: 0 };
    const goals = withAlfa ? [{ teamId: alfa, playerId: rui }] : [{ teamId: m.homeId, playerId: null }];
    s = homologate(recordResult(s, { matchId: m.id, score, goals }), m.id);
  }
  return s;
};
const playCup = (s0, taca) => {
  const [a, b] = ["Alfa", "Beta"].map((n) => teamId(s0, n));
  let s = addMatch(s0, { competitionId: taca, homeId: a, awayId: b, date: "2026-12-05", time: "15:00", round: 1, roundName: "Final" });
  const m = s.matches.find((x) => x.competitionId === taca);
  s = recordResult(s, { matchId: m.id, score: { home: 1, away: 1 }, shootout: { kicks: [{ teamId: a, scored: true }, { teamId: b, scored: true }, { teamId: a, scored: false }, { teamId: b, scored: true }] } });
  return homologate(s, m.id);
};

test("a tie is decided by goals, then by the shoot-out; undecided and unofficial ones have no winner", () => {
  const m = { id: "x", homeId: "H", awayId: "A", state: "homologated" };
  assert.equal(tieWinner(m, { home: 2, away: 1, shootout: null }), "H");
  assert.equal(tieWinner(m, { home: 1, away: 1, shootout: { home: 3, away: 4 } }), "A");
  assert.equal(tieWinner(m, { home: 1, away: 1, shootout: null }), null);
  assert.equal(tieWinner({ ...m, state: "ended_provisional" }, { home: 2, away: 0, shootout: null }), null);
  assert.equal(tieWinner({ ...m, state: "walkover", walkover: { winnerId: "A" } }, null), "A");
});

test("the checklist blocks closing while games lack an official result", () => {
  const { s } = setup();
  const c = seasonChecklist(s);
  assert.equal(c.canClose, false);
  assert.equal(c.blockers[0].kind, "open");
  assert.throws(() => closeSeason(s, { label: "2026/27" }), (e) => e.code === "season_not_ready");
});

test("a finished season closes into an immutable archive with champions, table, scorers and the shoot-out", () => {
  const { s: s0, liga, taca } = setup();
  const s1 = playCup(playLeague(s0, liga), taca);
  assert.equal(seasonChecklist(s1).canClose, true);
  const prop = proposedChampions(s1);
  assert.equal(prop[liga].teamId, teamId(s1, "Alfa"));
  assert.equal(prop[taca].teamId, teamId(s1, "Beta"), "Beta wins the final 2–1 on kicks");
  const out = closeSeason(s1, { label: "2026/27", at: "2026-12-06T00:00:00Z" });
  const season = out.data.seasons[0];
  const L = season.competitions.find((c) => c.id === liga), T = season.competitions.find((c) => c.id === taca);
  assert.equal(L.champion.name, "Alfa"); assert.equal(L.champion.decidedBy, "table");
  assert.equal(L.table[0].teamId, teamId(s1, "Alfa")); assert.equal(L.table[0].pts, 6);
  assert.equal(L.scorers[0].name, "Rui Silva"); assert.equal(L.scorers[0].goals, 2);
  assert.equal(T.champion.name, "Beta");
  assert.equal(T.bracket[0].ties[0].shootout.home, 1); assert.equal(T.bracket[0].ties[0].shootout.away, 2);
  assert.ok(out.data.competitions.every((c) => c.closedSeasonId === season.id));
  assert.throws(() => closeSeason(out, { label: "2026/27" }), (e) => e.code === "season_not_ready" || e.code === "season_exists");
  assert.ok(JSON.stringify(season).length < 20_000, "compact: results and scorers, never the event logs");
});

test("the Gestor can name another champion, and must say why", () => {
  const { s: s0, liga, taca } = setup();
  const s1 = playCup(playLeague(s0, liga), taca);
  assert.throws(() => closeSeason(s1, { label: "2026/27", overrides: { [liga]: { teamId: teamId(s1, "Beta") } } }), (e) => e.code === "note_required");
  const out = closeSeason(s1, { label: "2026/27", overrides: { [liga]: { teamId: teamId(s1, "Beta"), note: "Alfa desclassificada pelo Conselho de Disciplina" } } });
  const L = out.data.seasons[0].competitions.find((c) => c.id === liga);
  assert.equal(L.champion.name, "Beta"); assert.equal(L.champion.decidedBy, "manual"); assert.match(L.champion.note, /desclassificada/);
  assert.equal(L.table[0].teamId, teamId(s1, "Alfa"), "the table itself is never rewritten");
});

test("a new season keeps teams and squads, starts the same competitions empty and drops last season's games", () => {
  const { s: s0, liga, taca } = setup();
  const closed = closeSeason(playCup(playLeague(s0, liga), taca), { label: "2026/27" });
  assert.throws(() => newSeason(s0, { label: "2027/28" }), (e) => e.code === "season_not_closed");
  const n = newSeason(closed, { label: "2027/28" });
  assert.equal(n.matches.length, 0); assert.deepEqual(n.logs, {});
  assert.equal(n.data.competitions.length, 2);
  assert.ok(n.data.competitions.every((c) => c.season === "2027/28" && !c.closedSeasonId && c.id !== liga && c.id !== taca));
  assert.equal(n.data.competitions.find((c) => c.kind === "cup").name, "Taça");
  assert.equal(n.data.competitions.find((c) => c.kind === "league").teamIds.length, 3);
  assert.equal(n.data.players.length, closed.data.players.length);
  assert.equal(n.data.seasons.length, 1, "the archive survives");
});

test("notes can be added to a closed season; the next label follows the pattern", () => {
  const { s: s0, liga, taca } = setup();
  const closed = closeSeason(playCup(playLeague(s0, liga), taca), { label: "2026/27" });
  const noted = annotateSeason(closed, closed.data.seasons[0].id, "Correção da direção: jogo 12 ficou 2–1", { at: "2026-12-10T00:00:00Z" });
  assert.equal(noted.data.seasons[0].notes.length, 1);
  assert.equal(nextSeasonLabel("2026/27"), "2027/28"); assert.equal(nextSeasonLabel("2026"), "2027"); assert.equal(nextSeasonLabel("Outono"), "");
});
