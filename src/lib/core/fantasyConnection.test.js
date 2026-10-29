// Conexão da Rodada v1 — rule tests. The cases mirror the acceptance table
// of the revamp brief (docs: CLAUDE-IMPLEMENTAR-FANTASY.md §10). The JS
// mirror is all there is for now: SQL authority + parity vectors come with
// the backend phase.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FANTASY_V2, FANTASY_CONNECTION, scoreLineup, scoreLineupWithConnection, connectionBonus, connectionDraftIssue,
} from "./fantasyRules.js";

const POS = { gk: "Guarda-redes", diego: "Médio", lucas: "Avançado", vini: "Avançado", rafa: "Defesa", x1: "Avançado", x2: "Médio", xgk: "Guarda-redes" };
const HOME = ["gk", "diego", "lucas", "vini", "rafa"];
const AWAY = ["xgk", "x1", "x2"];
const PAIR = { creator: "diego", finisher: "lucas" };
const STARTERS = ["gk", "diego", "lucas", "vini", "rafa"];

const goal = (id, by, ast, min, extra = {}) => ({ id, side: "h", type: "goal", by, ...(ast ? { ast } : {}), min, ...extra });
const night = (...games) => ({
  teamResults: [{ name: "Casa", wins: 1, players: HOME }, { name: "Fora", wins: 0, players: AWAY }],
  matches: games.map((events, i) => ({
    n: i + 1, homeName: "Casa", awayName: "Fora",
    homeGoals: events.filter((e) => e.side === "h" && e.type !== "save").length, awayGoals: events.filter((e) => e.side === "a" && e.type !== "save").length,
    homeGk: "gk", awayGk: "xgk", events,
  })),
  lines: [], candidates: [...HOME, ...AWAY].map((key) => ({ key })),
});
const bonus = (summary, pair = PAIR, starters = STARTERS) => connectionBonus(pair, starters, summary);

test("no Conexão: nothing changes", () => {
  const s = night([goal("e1", "lucas", "diego", 4)]);
  const lineup = { starters: STARTERS, bench: [], captain: "lucas", vice: null, transferCost: 0 };
  const base = scoreLineup(lineup, s, POS);
  const r = scoreLineupWithConnection(lineup, s, POS);
  assert.equal(r.total, base.total);
  assert.equal(r.connection.status, "none");
  assert.equal(r.connection.points, 0);
});

test("Diego → Lucas: one assisted goal is +3", () => {
  const r = bonus(night([goal("e1", "lucas", "diego", 12)]));
  assert.deepEqual([r.status, r.points, r.awarded, r.capped], ["activated", 3, 1, false]);
  assert.deepEqual(r.awardedEventIds, ["e1"]);
});

test("two distinct events are +6; three or more stay +6 and flag the cap", () => {
  const two = bonus(night([goal("e1", "lucas", "diego", 12)], [goal("e2", "lucas", "diego", 3)]));
  assert.equal(two.points, 6);
  assert.equal(two.capped, false);
  const three = bonus(night([goal("e3", "lucas", "diego", 9), goal("e1", "lucas", "diego", 2)], [goal("e2", "lucas", "diego", 1)]));
  assert.equal(three.points, FANTASY_CONNECTION.bonusPerEvent * FANTASY_CONNECTION.maxEvents);
  assert.equal(three.totalValid, 3);
  assert.equal(three.capped, true);
  // game order first, then minute: game 1 min 2 and min 9 are paid, game 2 is not
  assert.deepEqual(three.awardedEventIds, ["e1", "e3"]);
  assert.equal(three.events.find((e) => e.id === "e2").awarded, false);
});

test("the cap pick does not depend on the array order", () => {
  const a = night([goal("b", "lucas", "diego", 5), goal("a", "lucas", "diego", 5), goal("c", "lucas", "diego", 5)]);
  const b = night([goal("c", "lucas", "diego", 5), goal("a", "lucas", "diego", 5), goal("b", "lucas", "diego", 5)]);
  assert.deepEqual(bonus(a).awardedEventIds, ["a", "b"]);
  assert.deepEqual(bonus(b).awardedEventIds, ["a", "b"]);
});

test("the same event repeated in the input counts once", () => {
  const e = goal("e1", "lucas", "diego", 12);
  const r = bonus(night([e, { ...e }], [{ ...e }]));
  assert.equal(r.points, 3);
  assert.equal(r.totalValid, 1);
});

test("inverted assist, split goals and totals never infer a connection", () => {
  assert.equal(bonus(night([goal("e1", "diego", "lucas", 4)])).points, 0);
  const split = night([goal("e1", "lucas", null, 4), goal("e2", "vini", "diego", 6), goal("e3", "diego", "rafa", 8)]);
  split.lines = [{ key: "diego", goals: 1, assists: 1 }, { key: "lucas", goals: 1, assists: 0 }];
  const r = bonus(split);
  assert.deepEqual([r.status, r.points], ["no_match", 0]);
});

test("own goal, shootout, cancelled and wrong type never count", () => {
  const s = night([
    { id: "og", side: "a", type: "og", by: "lucas", ast: "diego", min: 1 },
    goal("so", "lucas", "diego", 2, { shootout: true }),
    goal("x", "lucas", "diego", 3, { cancelled: true }),
    { id: "sv", side: "h", type: "save", by: "lucas", ast: "diego", min: 4 },
  ]);
  assert.deepEqual([bonus(s).status, bonus(s).points], ["no_match", 0]);
});

test("a penalty counts only with an explicit assist", () => {
  assert.equal(bonus(night([goal("p1", "lucas", null, 5, { pen: true })])).points, 0);
  assert.equal(bonus(night([goal("p2", "lucas", "diego", 5, { pen: true })])).points, 3);
});

test("creator = finisher, bench players and strangers are rejected", () => {
  assert.equal(connectionDraftIssue({ creator: "lucas", finisher: "lucas" }, STARTERS), "same_player");
  assert.equal(connectionDraftIssue(PAIR, ["gk", "lucas"]), "creator_not_starter");
  assert.equal(connectionDraftIssue(PAIR, ["gk", "diego"]), "finisher_not_starter");
  assert.equal(connectionDraftIssue({ creator: "diego", finisher: "outsider" }, STARTERS), "finisher_not_starter");
  assert.equal(connectionDraftIssue({ creator: "diego" }, STARTERS), "incomplete_finisher");
  assert.equal(connectionDraftIssue({ finisher: "lucas" }, STARTERS), "incomplete_creator");
  assert.equal(connectionDraftIssue(null, STARTERS), null);
  assert.equal(bonus(night([goal("e1", "lucas", "diego", 1)]), PAIR, ["gk", "lucas"]).status, "invalid");
});

test("drawn teams: opposite sides are blocked, unknown teams are allowed", () => {
  assert.equal(connectionDraftIssue(PAIR, STARTERS, [["diego", "x1"], ["lucas", "vini"]]), "split_teams");
  assert.equal(connectionDraftIssue(PAIR, STARTERS, [["diego", "lucas"], ["vini"]]), null);
  assert.equal(connectionDraftIssue(PAIR, STARTERS, [["diego"], ["vini"]]), null);
  assert.equal(connectionDraftIssue(PAIR, STARTERS, null), null);
});

test("a goal where the pair played on different real teams does not count", () => {
  const s = night([{ id: "e1", side: "a", type: "goal", by: "lucas", ast: "diego", min: 3 }]);
  assert.deepEqual([bonus(s).status, bonus(s).points], ["no_match", 0]);
});

test("provisional events are reported apart from the official bonus", () => {
  const r = bonus(night([goal("e1", "lucas", "diego", 3, { provisional: true })]));
  assert.deepEqual([r.status, r.points, r.provisional, r.totalValid], ["provisional", 0, 1, 0]);
});

test("missing coverage is 'insufficient', not zero", () => {
  const noEvents = night([goal("e1", "lucas", "diego", 3)]);
  delete noEvents.matches[0].events;
  assert.equal(bonus(noEvents).status, "insufficient");
  assert.equal(bonus({ teamResults: [], matches: [] }).status, "insufficient");
  const noId = night([{ side: "h", type: "goal", by: "lucas", ast: "diego", min: 3 }]);
  assert.equal(bonus(noId).status, "insufficient");
  const partial = night([goal("e1", "vini", null, 3)], [goal("e2", "vini", null, 3)]);
  delete partial.matches[1].events;
  assert.equal(bonus(partial).status, "insufficient");
  // ambiguous team names → no roster → cannot confirm the same side
  const clash = night([goal("e1", "lucas", "diego", 3)]);
  clash.matches[0].awayName = "Casa";
  assert.equal(bonus(clash).status, "insufficient");
});

test("captain on the pair: the bonus stays +3, the captain only doubles his own points", () => {
  const s = night([goal("e1", "lucas", "diego", 3)]);
  const lineup = { starters: STARTERS, bench: [], captain: "lucas", vice: "diego", transferCost: 0 };
  const plain = scoreLineup(lineup, s, POS);
  const withC = scoreLineupWithConnection({ ...lineup, connection: PAIR }, s, POS);
  assert.equal(withC.base, plain.total);
  assert.equal(withC.total, plain.total + 3);
  assert.equal(withC.players.find((p) => p.id === "lucas").mult, FANTASY_V2.captain);
});

test("an auto-substitute never inherits the connection", () => {
  // diego didn't appear at all: a bench player came on for him, but the pair is still diego → lucas.
  const s = night([goal("e1", "lucas", "diego", 3)]);
  s.teamResults[0].players = HOME.filter((p) => p !== "diego").concat("sub");
  s.candidates = s.candidates.filter((c) => c.key !== "diego").concat({ key: "sub" });
  s.matches[0].events = [goal("e1", "lucas", "vini", 3)];
  const lineup = { starters: STARTERS, bench: ["sub"], captain: null, vice: null, transferCost: 0, connection: PAIR };
  const r = scoreLineupWithConnection(lineup, s, { ...POS, sub: "Médio" });
  assert.equal(r.players.find((p) => p.id === "sub").counted, true);
  assert.equal(r.connection.points, 0);
});

test("transfer cost 4, base already net 87, Conexão +3 → 90 (not 86, not 93)", () => {
  const s = night([goal("e1", "lucas", "diego", 3)]);
  const lineup = { starters: STARTERS, bench: [], captain: null, vice: null, transferCost: 4, connection: PAIR };
  const r = scoreLineupWithConnection(lineup, s, POS);
  assert.equal(r.transferCost, 4);
  assert.equal(r.total, r.base + 3);
  assert.equal(r.base, scoreLineup({ ...lineup, connection: undefined }, s, POS).total);
});

test("a correction that removes the assist removes the bonus; recomputing is idempotent", () => {
  const before = night([goal("e1", "lucas", "diego", 3)]);
  const after = night([goal("e1", "lucas", null, 3)]);
  assert.equal(bonus(before).points, 3);
  assert.equal(bonus(after).points, 0);
  assert.deepEqual(bonus(before), bonus(before));
  const lineup = { starters: STARTERS, bench: [], captain: null, vice: null, transferCost: 0, connection: PAIR };
  const first = scoreLineupWithConnection(lineup, before, POS);
  const again = scoreLineupWithConnection(lineup, before, POS);
  assert.equal(first.total, again.total);
});

test("the bonus never leaks into a player's own points (price by form)", () => {
  const s = night([goal("e1", "lucas", "diego", 3)]);
  const lineup = { starters: STARTERS, bench: [], captain: null, vice: null, transferCost: 0 };
  const a = scoreLineupWithConnection(lineup, s, POS);
  const b = scoreLineupWithConnection({ ...lineup, connection: PAIR }, s, POS);
  assert.deepEqual(b.players.map((p) => p.pts), a.players.map((p) => p.pts));
});
