// Pitch Manager of a REAL league: the server's board (current squad + lineups locked per round) → the SAME engine.
// Uses the invented example league for matches/events; the squads are the board's, not the demo seed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeagueFantasyLive, leagueRounds, leagueFantasyStanding, LEAGUE_FANTASY } from "./leagueFantasy.js";
import { loadExample, PLAYERS, TEAMS, POSITION_FULL, COMPETITION } from "./leagueDemo.js";
import { deriveLeague } from "./leagueDemo.js";
import { scoreLineupWithConnection } from "./core/fantasyRules.js";

const state = loadExample();
const derived = deriveLeague(state);
const common = { state, players: PLAYERS, teams: TEAMS, stats: derived.stats, competitionId: COMPETITION.id };
const positions = Object.fromEntries(PLAYERS.map((p) => [p.id, POSITION_FULL[p.position]]));
const r1 = leagueRounds({ matches: state.matches, logs: state.logs, players: PLAYERS, teams: TEAMS, competitionId: COMPETITION.id }).find((r) => r.round === 1);

const ME = "11111111-1111-1111-1111-111111111111";
const RIVAL = "22222222-2222-2222-2222-222222222222";
const squadA = { player_ids: ["t4p1", "t1p4", "t1p7", "t1p8", "t5p8", "t2p5"], reserve_ids: ["t2p5"], captain_id: "t1p7", vice_captain_id: "t1p8", prices_paid: {}, connection: { creator_id: "t1p7", finisher_id: "t1p8" } };
const squadB = { player_ids: ["t5p8", "t4p7", "t2p7", "t6p7", "t1p5", "t3p8"], reserve_ids: ["t3p8"], captain_id: "t5p8", vice_captain_id: null, prices_paid: {}, connection: null };
const board = (over = {}) => ({
  enabled: true, me: ME, name: "Os Gestores", mine: squadA,
  locks: [{ round: 1, kickoff_at: "2020-01-01T20:00:00Z", lineups: { [ME]: { name: "Os Gestores", squad: squadA }, [RIVAL]: { name: "Rivais FC", squad: squadB } } }],
  ownership: { t5p8: 1, t4p7: 1 }, managers: [{ uuid: ME, name: "Os Gestores" }, { uuid: RIVAL, name: "Rivais FC" }],
  ...over,
});

test("a locked round is scored from each manager's snapshot, Conexão included", () => {
  const built = buildLeagueFantasyLive({ board: board(), ...common });
  const mine = built.demo.fantasyScores.find((s) => s.participant_id === ME && s.matchday_id === "round-1");
  const lineup = { starters: squadA.player_ids.filter((id) => !squadA.reserve_ids.includes(id)), bench: squadA.reserve_ids, captain: "t1p7", vice: "t1p8", transferCost: 0, connection: { creator: "t1p7", finisher: "t1p8" } };
  const expected = scoreLineupWithConnection(lineup, r1.summary, positions, { mvp: null });
  assert.equal(mine.points, expected.total);
  assert.equal(mine.breakdown.connection.status, "activated");
  assert.equal(mine.breakdown.connection.points, 3);
  assert.deepEqual(mine.breakdown.connectionPair, { creator_id: "t1p7", finisher_id: "t1p8" });
  const rival = built.demo.fantasyScores.find((s) => s.participant_id === RIVAL && s.matchday_id === "round-1");
  assert.ok(rival, "the rival has a score from THEIR snapshot");
  assert.equal(rival.breakdown.connection.status, "none");
});

test("editing my squad after the lock never changes a scored round", () => {
  const edited = { ...squadA, player_ids: ["t2p1", "t2p2", "t2p3", "t2p4", "t2p5", "t2p6"], reserve_ids: ["t2p6"], captain_id: "t2p1", vice_captain_id: null, connection: null };
  const a = buildLeagueFantasyLive({ board: board(), ...common });
  const b = buildLeagueFantasyLive({ board: board({ mine: edited }), ...common });
  const pts = (x) => x.demo.fantasyScores.find((s) => s.participant_id === ME && s.matchday_id === "round-1").points;
  assert.equal(pts(a), pts(b));
  // …but the draft is the edited one, and the transfers are counted against the LOCKED squad
  assert.deepEqual(b.demo.fantasySquads[0].player_ids, edited.player_ids);
  assert.deepEqual(b.demo.fantasySquads[0].locked_player_ids, squadA.player_ids);
});

test("a manager who wasn't in a round has no score there (joined after the lock)", () => {
  const late = board({ locks: [{ round: 1, kickoff_at: "2020-01-01T20:00:00Z", lineups: { [RIVAL]: { name: "Rivais FC", squad: squadB } } }] });
  const built = buildLeagueFantasyLive({ board: late, ...common });
  assert.equal(built.demo.fantasyScores.some((s) => s.participant_id === ME), false);
  assert.equal(built.demo.fantasyScores.some((s) => s.participant_id === RIVAL), true);
  const st = leagueFantasyStanding(built);
  assert.deepEqual([st.points, st.rank, st.of], [0, 2, 2]);
});

test("a round that locked but isn't official yet is not scored", () => {
  const b = buildLeagueFantasyLive({ board: board({ locks: [{ round: 2, kickoff_at: "2020-01-08T20:00:00Z", lineups: { [ME]: { name: "x", squad: squadA } } }] }), ...common });
  assert.equal(b.demo.fantasyScores.length, 0);
});

test("rivals only show their latest LOCKED squad; the cap uses counts, not squads", () => {
  const built = buildLeagueFantasyLive({ board: board(), ...common });
  const rivalSquad = built.demo.fantasySquads.find((s) => s.participant_id === RIVAL);
  assert.deepEqual(rivalSquad.player_ids, squadB.player_ids);
  // six managers → cap max(2, ceil(6/2)) = 3 owners per athlete: an athlete already in 3 other squads is refused, one in 2 is not
  const crowd = (n) => board({ ownership: { t2p6: n }, managers: [{ uuid: ME, name: "Os Gestores" }, ...[1, 2, 3, 4, 5].map((i) => ({ uuid: `m${i}`, name: `M${i}` }))] });
  const swap = { player_ids: ["t4p1", "t1p4", "t1p7", "t1p8", "t5p8", "t2p6"], reserve_ids: ["t2p6"], captain_id: "t1p7", vice_captain_id: "t1p8" };
  assert.equal(buildLeagueFantasyLive({ board: crowd(3), ...common }).demo.validate(swap), "fantasy:ownership_cap");
  assert.notEqual(buildLeagueFantasyLive({ board: crowd(2), ...common }).demo.validate(swap), "fantasy:ownership_cap");
});

test("a brand-new league: no squad, no locks → an empty, working Pitch Manager with the Conexão on", () => {
  const built = buildLeagueFantasyLive({ board: { enabled: true, me: ME, name: null, mine: null, locks: [], ownership: {}, managers: [] }, ...common, label: "Gestor" });
  assert.equal(built.demo.fantasyScores.length, 0);
  assert.equal(built.demo.fantasyLeague.connection_rules.enabled, true);
  assert.equal(built.me.name, "Gestor");
  assert.equal(leagueFantasyStanding(built).picked, false);
  assert.equal(built.seed.squadSize, LEAGUE_FANTASY.squadSize);
});
