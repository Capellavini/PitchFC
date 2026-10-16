import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLeaguePath, leagueErrorCode, validateRules, leagueDemoOp, emptyLeagueOrgState, normLeaguePage, normRegistrations,
  normFollowing, RESERVED_LEAGUE_SLUGS, slugify,
} from "./leagueCloud.js";

test("parseLeaguePath: landing, demo, hub, league, competition", () => {
  assert.deepEqual(parseLeaguePath("/league"), { kind: "landing" });
  assert.deepEqual(parseLeaguePath("/league/"), { kind: "landing" });
  assert.deepEqual(parseLeaguePath("/league/demo"), { kind: "demo" });
  assert.deepEqual(parseLeaguePath("/league/minhas"), { kind: "hub" });
  assert.deepEqual(parseLeaguePath("/league/liga-do-porto"), { kind: "league", slug: "liga-do-porto" });
  assert.deepEqual(parseLeaguePath("/league/liga-do-porto/sabado-2026"), { kind: "competition", slug: "liga-do-porto", competitionSlug: "sabado-2026" });
  assert.equal(parseLeaguePath("/rivals"), null);
  assert.equal(parseLeaguePath("/league/a/b/c"), null);
  assert.equal(parseLeaguePath("/league/demo/x"), null);
  assert.equal(parseLeaguePath("/league/Bad Slug!"), null);
});

test("reserved slugs mirror the SQL list and slugify never yields them silently", () => {
  for (const w of ["demo", "minhas", "convite", "inscricao"]) assert.ok(RESERVED_LEAGUE_SLUGS.includes(w));
  assert.equal(slugify("Liga Água Doce"), "liga-agua-doce");
});

test("leagueErrorCode", () => {
  assert.equal(leagueErrorCode({ message: "league:access_not_approved" }), "access_not_approved");
  assert.equal(leagueErrorCode("rivals:not_team_leader"), "not_team_leader");
  assert.equal(leagueErrorCode({ message: "permission denied for function x" }), "not_authenticated");
  assert.equal(leagueErrorCode({ message: "Could not find the function public.my_leagues" }), "not_deployed");
  assert.equal(leagueErrorCode({ message: "boom" }), "unknown");
});

test("validateRules mirrors the server allow-list", () => {
  assert.equal(validateRules({ bonus: 1 }).error, "unsupported_rule");
  assert.equal(validateRules({ tiebreakers: ["pts", "lots"] }).error, "unsupported_tiebreaker");
  assert.equal(validateRules({ tiebreakers: ["pts", "gd", "h2h"] }).error, "unsupported_tiebreaker");
  assert.equal(validateRules({ squad: { min: 10, max: 5 } }).error, "invalid_rule");
  const ok = validateRules({ squad: { min: 1, max: 10 } });
  assert.equal(ok.data.points.win, 3);
  assert.deepEqual(ok.data.tiebreakers, ["pts", "gd", "gf"]);
});

const olga = { id: "p-olga", name: "Olga", isAdmin: false };
const admin = { id: "p-admin", name: "Admin", isAdmin: true };
const ana = { id: "p-ana", name: "Ana", isAdmin: false };
const fan = { id: "p-fan", name: "Fábio", isAdmin: false };
const zed = { id: "p-ze", name: "Zé", isAdmin: false };
const run = (s, op, args, who) => {
  const r = leagueDemoOp(s, op, args, who);
  if (r.error) throw new Error(`${op}: ${r.error}`);
  return r;
};

test("demo mirror: pilot → league → competition → registration → squad → fan", () => {
  let s = emptyLeagueOrgState();
  assert.equal(leagueDemoOp(s, "create_league", { name: "Liga Teste" }, olga).error, "access_not_approved");
  let r = run(s, "request_league_access", { orgName: "Liga Teste" }, olga); s = r.state;
  assert.equal(run(s, "request_league_access", { orgName: "Outra" }, olga).data.created, false);
  assert.equal(leagueDemoOp(s, "review_league_access", { requestId: r.data.requestId, decision: "approve" }, olga).error, "admin_only");
  s = run(s, "review_league_access", { requestId: r.data.requestId, decision: "approve" }, admin).state;
  r = run(s, "create_league", { name: "Demo" }, olga); s = r.state;
  assert.notEqual(r.data.slug, "demo", "reserved word is never a slug");
  const leagueId = r.data.leagueId; const slug = r.data.slug;
  assert.equal(leagueDemoOp(s, "create_league", { name: "Segunda" }, olga).error, "access_not_approved", "one league per approval");
  assert.equal(run(s, "league_page", { slug }, null).data, null, "draft league hidden from anon");
  assert.ok(run(s, "league_page", { slug }, olga).data.viewKey, "owner sees view key");

  // collaborators
  assert.equal(leagueDemoOp(s, "create_league_invite", { leagueId, role: "owner" }, olga).error, "invalid_role");
  r = run(s, "create_league_invite", { leagueId, role: "scorer" }, olga); s = r.state;
  assert.equal(run(s, "league_invite_preview", { token: r.data.token }, null).data.status, "valid");
  s = run(s, "accept_league_invite", { token: r.data.token }, zed).state;
  assert.equal(leagueDemoOp(s, "accept_league_invite", { token: r.data.token }, fan).error, "invite_used");
  assert.deepEqual(run(s, "my_leagues", {}, zed).data.items[0].roles, ["scorer"]);
  assert.equal(leagueDemoOp(s, "create_league_invite", { leagueId, role: "referee" }, zed).error, "not_found");

  // competition + regulation
  assert.equal(leagueDemoOp(s, "create_competition", { leagueId, fields: { name: "X", structure: "knockout" } }, olga).error, "structure_not_available");
  r = run(s, "create_competition", { leagueId, fields: { name: "Liga de Sábado" }, rules: { squad: { min: 1, max: 10 } } }, olga); s = r.state;
  const competitionId = r.data.competitionId;
  assert.equal(leagueDemoOp(s, "set_competition_status", { competitionId, status: "registration_open" }, olga).error, "regulation_not_published");
  s = run(s, "publish_regulation", { competitionId, version: 1 }, olga).state;
  s = run(s, "set_competition_status", { competitionId, status: "registration_open" }, olga).state;
  s = run(s, "update_league", { leagueId, fields: { visibility: "public" } }, olga).state;
  assert.equal(run(s, "league_page", { slug }, null).data.competitions.length, 1, "public league lists its competition");

  // registration (captain Ana of team T)
  r = run(s, "create_registration_link", { competitionId }, olga); s = r.state;
  const tok = r.data.token;
  const teamT = { id: "t-1", name: "Leões", role: "captain", memberIds: ["p-ana", "p-abel"] };
  assert.equal(leagueDemoOp(s, "register_team", { token: tok, team: { ...teamT, role: "player" } }, ana).error, "not_team_leader");
  r = run(s, "register_team", { token: tok, team: teamT }, ana); s = r.state;
  const registrationId = r.data.registrationId;
  assert.equal(run(s, "register_team", { token: tok, team: teamT }, ana).data.registrationId, registrationId, "idempotent");
  assert.equal(leagueDemoOp(s, "submit_squad", { registrationId, team: teamT, players: [{ playerId: "p-stranger" }] }, ana).error, "not_team_member");
  s = run(s, "submit_squad", { registrationId, team: teamT, players: [{ playerId: "p-ana", name: "Ana", shirtNumber: 10 }, { playerId: "p-abel", name: "Abel" }] }, ana).state;
  assert.equal(leagueDemoOp(s, "decide_squad", { registrationId, version: 1, decision: "approve" }, ana).error, "not_found");
  const regs = normRegistrations(run(s, "competition_registrations", { competitionId }, olga).data);
  assert.equal(regs.isManager, true);
  assert.equal(regs.items[0].versions[0].players[0].name, "Ana");
  s = run(s, "decide_squad", { registrationId, version: 1, decision: "approve" }, olga).state;
  assert.equal(run(s, "competition_teams_page", { competitionId }, null).data.items.length, 1);

  // fan
  assert.equal(leagueDemoOp(s, "set_supported_team", { competitionId, teamId: "t-nope" }, fan).error, "team_not_registered");
  s = run(s, "set_supported_team", { competitionId, teamId: "t-1" }, fan).state;
  const f = normFollowing(run(s, "my_following", {}, fan).data);
  assert.equal(f.supporting[0].teamId, "t-1");
  assert.equal(f.follows.length, 2, "supporting auto-follows team + competition");
  s = run(s, "follow", { entityType: "league", entityId: leagueId }, fan).state;
  assert.equal(normFollowing(run(s, "my_following", {}, fan).data).follows.length, 3);
  assert.deepEqual(run(s, "my_leagues", {}, fan).data.items, [], "a fan holds no league role");
});

test("normLeaguePage keeps only the public projection", () => {
  const p = normLeaguePage({ id: "1", slug: "x", name: "X", visibility: "public", status: "active", my_roles: ["owner"],
    responsaveis: [{ name: "Olga", role: "owner" }], competitions: [{ id: "c", slug: "s", name: "S", status: "registration_open" }], view_key: "k" });
  assert.equal(p.competitions[0].slug, "s");
  assert.deepEqual(p.myRoles, ["owner"]);
  assert.equal(p.viewKey, "k");
  assert.equal(normLeaguePage(null), null);
});
