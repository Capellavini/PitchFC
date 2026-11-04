import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeagueState } from "./leagueDemo.js";
import { addCompetition, setLeagueInfo } from "./leagueSetup.js";
import { importTeams, importRoster } from "./leagueImport.js";
import { pendingPlayerRequests, teamPlayerRequests, approvePlayerRequest, refusePlayerRequest } from "./leaguePlayerRequests.js";

const base = () => {
  let s = setLeagueInfo(emptyLeagueState(), { name: "Liga", city: "Porto" });
  s = addCompetition(s, { name: "1.ª", kind: "league", legs: 2, season: "2026/27" });
  s = importTeams(s, { competitionId: s.data.competitions[0].id, rows: [["Alfa"], ["Beta"]] }).state;
  s = importRoster(s, { rows: [["Equipa", "Nome", "Número"], ["Alfa", "Rui Silva", "1"]] }).state;
  return s;
};
const withRequest = (s, r = {}) => ({
  ...s, data: { ...s.data, playerRequests: [{ id: "rq-1", teamId: s.data.teams[0].id, name: "Novo Atleta", number: 7, position: "AVA", status: "pending", requestedAt: "2026-11-04T10:00:00Z", ...r }] },
});

test("pending requests are listed per team, oldest first", () => {
  const s = withRequest(base());
  assert.equal(pendingPlayerRequests(s).length, 1);
  assert.equal(pendingPlayerRequests(s, s.data.teams[1].id).length, 0);
  assert.equal(teamPlayerRequests(s, s.data.teams[0].id).length, 1);
});

test("approving joins the squad with the requested data and closes the request", () => {
  const s = approvePlayerRequest(withRequest(base()), "rq-1", { at: "2026-11-04T11:00:00Z" });
  const p = s.data.players.find((x) => x.name === "Novo Atleta");
  assert.ok(p); assert.equal(p.number, 7); assert.equal(p.position, "AVA"); assert.equal(p.captain, false);
  const r = s.data.playerRequests[0];
  assert.equal(r.status, "approved"); assert.equal(r.playerId, p.id); assert.equal(pendingPlayerRequests(s).length, 0);
});

test("refusing keeps the reason for the captain and adds nobody", () => {
  const before = withRequest(base());
  const s = refusePlayerRequest(before, "rq-1", { reason: "Fora do prazo de inscrições" });
  assert.equal(s.data.players.length, before.data.players.length);
  assert.equal(s.data.playerRequests[0].status, "refused");
  assert.equal(s.data.playerRequests[0].reason, "Fora do prazo de inscrições");
});

test("a shirt number already in the squad blocks the approval and changes nothing; a decided request cannot be decided twice", () => {
  const s = withRequest(base(), { number: 1 });
  assert.throws(() => approvePlayerRequest(s, "rq-1"), (e) => e.code === "duplicate_number");
  const done = refusePlayerRequest(s, "rq-1");
  assert.throws(() => approvePlayerRequest(done, "rq-1"), (e) => e.code === "request_not_found");
  assert.throws(() => refusePlayerRequest(done, "rq-1"), (e) => e.code === "request_not_found");
});

test("the archive of decided requests stays bounded", () => {
  let s = base();
  const many = Array.from({ length: 80 }, (_, i) => ({ id: `rq-${i}`, teamId: s.data.teams[0].id, name: `N${i}`, number: null, status: "refused", requestedAt: `2026-11-0${(i % 9) + 1}T10:00:00Z`, decidedAt: `2026-11-0${(i % 9) + 1}T12:00:00Z` }));
  s = { ...s, data: { ...s.data, playerRequests: [...many, { id: "rq-new", teamId: s.data.teams[0].id, name: "Pendente", number: 9, status: "pending", requestedAt: "2026-11-04T10:00:00Z" }] } };
  const out = refusePlayerRequest(s, "rq-new");
  assert.ok(out.data.playerRequests.length <= 60);
});
