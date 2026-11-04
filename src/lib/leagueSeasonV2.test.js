import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo, generateFixtures, addMatch } from "./leagueSetup.js";
import { importTeams, importRoster } from "./leagueImport.js";
import { recordResult } from "./leagueResults.js";
import { transition } from "./core/league.js";
import { closeSeason, newSeason, leagueTable } from "./leagueSeason.js";
import { proposeMovements, normalizeMovements } from "./leagueMovements.js";
import { athleteCareer } from "./leagueCareer.js";
import { supercupProposal, createSupercup } from "./leagueSupercup.js";
import { importHistory } from "./leagueHistory.js";
import { saveRegulation, regulationOf } from "./leagueRegulation.js";
import { adjuntoContext } from "./leagueAdjuntoActions.js";
import { approvePlayerRequest } from "./leaguePlayerRequests.js";
import { LIMITS } from "./leagueAdjuntoRequest.js";

/** Two divisions of four teams (one athlete each) and a cup. Every league game is a 1–0 home win. */
const build = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "Liga", city: "Porto" });
  s = addCompetition(s, { name: "1.ª Divisão", kind: "league", legs: 1, season: "2026/27" });
  s = addCompetition(s, { name: "2.ª Divisão", kind: "league", legs: 1, season: "2026/27" });
  s = addCompetition(s, { name: "Taça", kind: "cup", season: "2026/27" });
  const [d1, d2, taca] = s.data.competitions.map((c) => c.id);
  s = importTeams(s, { competitionId: d1, rows: [["Alfa"], ["Beta"], ["Gama"], ["Delta"]] }).state;
  s = importTeams(s, { competitionId: d2, rows: [["Epsilon"], ["Zeta"], ["Eta"], ["Teta"]] }).state;
  s = importRoster(s, { rows: [["Equipa", "Nome", "Número"], ...["Alfa", "Beta", "Gama", "Delta", "Epsilon", "Zeta", "Eta", "Teta"].map((n, i) => [n, `Atleta ${n}`, String(i + 1)])] }).state;
  s = generateFixtures(s, { competitionId: d1, startDate: "2026-11-07", times: ["15:00"] });
  s = generateFixtures(s, { competitionId: d2, startDate: "2026-11-07", times: ["17:00"] });
  return { s, d1, d2, taca };
};
const id = (s, name) => s.data.teams.find((t) => t.name === name).id;
const pid = (s, name) => s.data.players.find((p) => p.name === name).id;
const homologate = (s, mid) => ({ ...s, matches: s.matches.map((m) => (m.id === mid ? transition(m, "homologated", { role: "manager", by: "t", at: "2026-11-30T00:00:00Z" }) : m)) });
const playLeagues = (s0) => {
  let s = s0;
  for (const m of s.matches.filter((x) => x.state === "scheduled")) {
    const home = s.data.players.find((p) => p.teamId === m.homeId);
    s = homologate(recordResult(s, { matchId: m.id, score: { home: 1, away: 0 }, goals: [{ teamId: m.homeId, playerId: home.id }] }), m.id);
  }
  return s;
};
const withCup = (s0, taca, a, b) => {
  let s = addMatch(s0, { competitionId: taca, homeId: id(s0, a), awayId: id(s0, b), date: "2026-12-05", time: "15:00", round: 1, roundName: "Final" });
  const m = s.matches[s.matches.length - 1];
  return homologate(recordResult(s, { matchId: m.id, score: { home: 1, away: 0 } }), m.id);
};
const played = () => { const b = build(); return { ...b, s: withCup(playLeagues(b.s), b.taca, "Delta", "Alfa") }; };

test("promotion and relegation are proposed from the final tables, level in size", () => {
  const { s, d1, d2 } = played();
  assert.equal(proposeMovements(build().s).moves.length, 0, "no games, nothing proposed");
  const p = proposeMovements(s, { down: 1 });
  const t1 = leagueTable(s, s.data.competitions.find((c) => c.id === d1)); const t2 = leagueTable(s, s.data.competitions.find((c) => c.id === d2));
  const down = p.moves.find((m) => m.kind === "relegated"); const up = p.moves.find((m) => m.kind === "promoted");
  assert.equal(down.teamId, t1[t1.length - 1].id); assert.equal(down.to, d2);
  assert.equal(up.teamId, t2[0].id); assert.equal(up.to, d1);
  assert.equal(proposeMovements(s, { down: 2 }).moves.length, 4);
});

test("the Gestor's list is validated: a special case needs a reason, a team must be where it says", () => {
  const { s, d1, d2 } = played();
  const t = (n) => id(s, n);
  assert.throws(() => normalizeMovements(s, [{ teamId: t("Alfa"), from: d1, to: d2, decidedBy: "manual" }]), (e) => e.code === "note_required");
  assert.throws(() => normalizeMovements(s, [{ teamId: t("Epsilon"), from: d1, to: d2, decidedBy: "table" }]), (e) => e.code === "invalid");
  assert.throws(() => normalizeMovements(s, [{ teamId: t("Alfa"), from: d1, to: d2, decidedBy: "table" }, { teamId: t("Alfa"), from: d1, to: d2, decidedBy: "table" }]), (e) => e.code === "invalid");
  const ok = normalizeMovements(s, [{ teamId: t("Alfa"), from: d1, to: d2, decidedBy: "manual", note: "Desistência" }]);
  assert.deepEqual([ok[0].kind, ok[0].toName, ok[0].note], ["relegated", "2.ª Divisão", "Desistência"]);
});

test("closing keeps the confirmed movements and the new season puts each team in its new division", () => {
  const { s, d1, d2 } = played();
  const moves = proposeMovements(s, { down: 1 }).moves;
  const closed = closeSeason(s, { label: "2026/27", movements: moves });
  assert.equal(closed.data.seasons[0].movements.length, 2);
  const n = newSeason(closed, { label: "2027/28" });
  const [nd1, nd2] = n.data.competitions.filter((c) => c.kind !== "cup");
  const goesDown = moves.find((m) => m.kind === "relegated").teamId; const comesUp = moves.find((m) => m.kind === "promoted").teamId;
  assert.ok(!nd1.teamIds.includes(goesDown) && nd2.teamIds.includes(goesDown));
  assert.ok(nd1.teamIds.includes(comesUp) && !nd2.teamIds.includes(comesUp));
  assert.equal(nd1.teamIds.length, 4); assert.equal(nd2.teamIds.length, 4);
  assert.ok(d1 && d2);
});

test("a career adds up the closed seasons and the one in progress; the id survives the new season", () => {
  const { s } = played();
  const alfa = pid(s, "Atleta Alfa");
  const closed = closeSeason(s, { label: "2026/27" });
  const c1 = athleteCareer(closed, alfa);
  assert.equal(c1.rows.length, 1);
  assert.ok(c1.rows[0].goals >= 1 && c1.rows[0].games >= 0);
  assert.equal(c1.rows[0].teamName, "Alfa");
  const n = newSeason(closed, { label: "2027/28" });
  assert.equal(n.data.players.length, 0, "squads start empty");
  assert.equal(athleteCareer(n, alfa).totals.goals, c1.totals.goals, "the career lives in the archive");
  assert.equal(athleteCareer(n, "nobody").rows.length, 0);
});

test("the Supertaça pairs the league champion with the cup winner, or the runner-up if it is the same team", () => {
  const { s } = played();
  const closed = closeSeason(s, { label: "2026/27" });
  assert.equal(supercupProposal(closed), null, "needs the new season");
  const n = newSeason(closed, { label: "2027/28" });
  const p = supercupProposal(n);
  assert.ok(p && p.homeId !== p.awayId);
  const withIt = createSupercup(n, { date: "2027-08-14", time: "21:00" });
  const comp = withIt.data.competitions.find((c) => c.supercupOf);
  assert.equal(comp.kind, "cup");
  assert.equal(withIt.matches.filter((m) => m.competitionId === comp.id).length, 1);
  assert.equal(supercupProposal(withIt), null, "only once");
});

test("a spreadsheet of past seasons becomes archived seasons with the 1st place as champion", () => {
  const { s } = build();
  const rows = [["Época", "Competição", "Posição", "Equipa", "J", "V", "E", "D", "GM", "GS", "Pts"],
    ["2024/25", "1.ª Divisão", "2", "Beta", "6", "3", "1", "2", "7", "5", "10"],
    ["2024/25", "1.ª Divisão", "1", "Alfa", "6", "5", "0", "1", "12", "4", "15"],
    ["2024/25", "1.ª Divisão", "3", "Clube Extinto", "6", "1", "1", "4", "3", "9", "4"],
    ["2025/26", "1.ª Divisão", "1", "Gama", "6", "4", "2", "0", "9", "3", "14"]];
  const r = importHistory(s, { rows });
  assert.equal(r.added, 2);
  const first = r.state.data.seasons.find((x) => x.label === "2024/25");
  assert.equal(first.competitions[0].champion.name, "Alfa");
  assert.equal(first.competitions[0].table.length, 3);
  assert.ok(first.teams.some((t) => t.id.startsWith("hist-")), "a team of the past keeps its name");
  assert.equal(first.competitions[0].table[0].gd, 8);
  assert.equal(importHistory(r.state, { rows }).skipped.every((x) => x.reason === "season_exists"), true);
  assert.equal(importHistory(s, { rows: [["Foo"], ["a"]] }).skipped[0].reason, "history_columns");
});

test("the regulation is stored, reaches the Adjunto context and never breaks its size limit", () => {
  const { s } = played();
  assert.throws(() => saveRegulation(s, { text: "curto" }), (e) => e.code === "invalid");
  const text = "Artigo 12.º — Em caso de empate pontual, decide o confronto direto. ".repeat(200);
  const withReg = saveRegulation(s, { name: "Regulamento 2026", text });
  assert.equal(regulationOf(withReg).name, "Regulamento 2026");
  const ctx = adjuntoContext(withReg);
  assert.ok(ctx.regulation.text.includes("Artigo 12"));
  assert.ok(ctx.tables.items.length >= 1);
  assert.ok(JSON.stringify(ctx).length <= LIMITS.contextChars, "fits the request limit");
  assert.equal(regulationOf(saveRegulation(withReg, { text: "" })), null, "empty removes it");
});

test("a captain's request to bring a former athlete back is approved from the pool", () => {
  const { s } = played();
  const alfa = pid(s, "Atleta Alfa");
  const n = newSeason(closeSeason(s, { label: "2026/27" }), { label: "2027/28" });
  const rq = { id: "rq-1", teamId: id(s, "Alfa"), name: "Atleta Alfa", number: 1, position: null, reuseId: alfa, status: "pending", requestedAt: "2027-07-01T10:00:00Z" };
  const asked = { ...n, data: { ...n.data, playerRequests: [rq] } };
  const done = approvePlayerRequest(asked, "rq-1", { at: "2027-07-02T10:00:00Z" });
  assert.equal(done.data.players.length, 1);
  assert.equal(done.data.players[0].id, alfa, "same id: account and history stay linked");
  assert.equal(done.data.athletePool.some((p) => p.id === alfa), false);
  assert.equal(done.data.playerRequests[0].status, "approved");
});

test("the Adjunto can propose keeping a regulation from a document", async () => {
  const { prepareBatch } = await import("./leagueAdjuntoActions.js");
  const { s } = build();
  const text = "Artigo 5.º — O campeão é a equipa com mais pontos; em caso de empate decide o confronto direto. Artigo 6.º — Descem as duas últimas.";
  const r = prepareBatch(s, [{ kind: "save_regulation", args: { name: "Regulamento", text } }]);
  assert.equal(r.failed, 0, JSON.stringify(r.items));
  assert.ok(regulationOf(r.state).text.includes("Artigo 6"));
  assert.equal(prepareBatch(s, [{ kind: "save_regulation", args: { text: "curto" } }]).failed, 1);
});
