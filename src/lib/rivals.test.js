import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugify, uniqueSlug, parseTeamLink, readRivalsParams, teamInviteUrl, teamShareUrl, rivalsErrorCode,
  normTeam, normMember, normDirectoryItem, sortRoster, can, inviteStatus, inviteDaysLeft,
  rivalsVisible, isNoGroup, openingTab, teamFeedItems, challengeDeadline, marketForLang, MARKETS,
  supportWhatsAppUrl, listTeamsLocal, demoSeed, demoOp, demoInvitePreview, demoMyTeams, DEMO_INVITE_TOKEN,
  validateTeamFields, hasPlayed, emptyRecord, isTeamMode, resolveTab, nextTeamMatch,
} from "./rivals.js";

test("team mode: only with a team and no group; competir ⇄ equipa", () => {
  assert.equal(isTeamMode({ noGroup: true, teamCount: 1 }), true);
  assert.equal(isTeamMode({ noGroup: true, teamCount: 0 }), false);
  assert.equal(isTeamMode({ noGroup: false, teamCount: 3 }), false);
  assert.equal(resolveTab("competir", true), "equipa");
  assert.equal(resolveTab("equipa", false), "competir");
  assert.equal(resolveTab("jogar", true), "jogar");
});

test("next team match: defensive, mine only, soonest, today in the team's timezone", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  const mine = [{ id: "a", name: "Coletes", timezone: "Europe/Lisbon" }];
  assert.equal(nextTeamMatch(undefined, mine, now), null);
  assert.equal(nextTeamMatch([], mine, now), null);
  const later = { id: "m2", home_team_id: "a", away_team_id: "x", away_team: { id: "x", name: "Rivais FC" }, kickoff_at: "2026-10-16T19:00:00Z", match_status: "scheduled" };
  const today = { id: "m1", homeTeamId: "y", awayTeamId: "a", homeTeam: { id: "y", name: "Hoje FC" }, kickoffAt: "2026-10-13T20:00:00Z" };
  const other = { id: "m0", home_team_id: "q", away_team_id: "r", kickoff_at: "2026-10-13T13:00:00Z" };
  const cancelled = { id: "mc", home_team_id: "a", away_team_id: "x", kickoff_at: "2026-10-13T13:00:00Z", match_status: "cancelled" };
  const old = { id: "mo", home_team_id: "a", away_team_id: "x", kickoff_at: "2026-10-12T12:00:00Z" };
  const n = nextTeamMatch([later, today, other, cancelled, old], mine, now);
  assert.equal(n.id, "m1");
  assert.equal(n.opponent.name, "Hoje FC");
  assert.equal(n.isToday, true);
  assert.equal(n.daysLeft, 0);
  const l = nextTeamMatch([later], mine, now);
  assert.equal(l.opponent.name, "Rivais FC");
  assert.equal(l.isToday, false);
  assert.equal(l.daysLeft, 3);
});

const NOW = Date.parse("2026-10-13T12:00:00Z");
const ana = { id: "ana", nick: "Ana", name: "Ana Silva" };
const vasco = { id: "vasco", nick: "Vasco" };
const paulo = { id: "paulo", nick: "Paulo" };
const ze = { id: "ze", nick: "Zé" };

// Run ops in sequence, failing loudly on unexpected errors.
const run = (state, op, args, me, now = NOW) => {
  const r = demoOp(state, op, args, me, now);
  assert.ok(!r.error, `${op} failed: ${r.error}`);
  return r;
};

test("slugify mirrors team_slugify", () => {
  assert.equal(slugify("Os Leões de Matosinhos!"), "os-leoes-de-matosinhos");
  assert.equal(slugify("  Ação & Reação  "), "acao-reacao");
  assert.equal(slugify("!!!"), "equipa");
  assert.equal(slugify("a".repeat(60)).length, 40);
  assert.equal(uniqueSlug("Porto Casual", ["porto-casual"]), "porto-casual-2");
  assert.equal(uniqueSlug("Porto Casual", new Set(["porto-casual", "porto-casual-2"])), "porto-casual-3");
});

test("links: parse + build + read params", () => {
  assert.deepEqual(parseTeamLink("https://pitch-fc.com/?tjoin=abcd1234abcd1234"), { token: "abcd1234abcd1234" });
  assert.deepEqual(parseTeamLink("veja https://pitch-fc.com/?team=porto-casual"), { slug: "porto-casual" });
  assert.deepEqual(parseTeamLink("0123456789abcdef0123456789abcdef"), { token: "0123456789abcdef0123456789abcdef" });
  assert.deepEqual(parseTeamLink("olá"), {});
  assert.equal(teamInviteUrl("tok", "https://x.pt"), "https://x.pt/?tjoin=tok");
  assert.equal(teamShareUrl("porto-casual"), "https://pitch-fc.com/?team=porto-casual");
  assert.deepEqual(readRivalsParams("?tjoin=abcd1234abcd&team=Porto-Casual&rivals=1"), { tjoin: "abcd1234abcd", team: "porto-casual", optIn: true });
  assert.deepEqual(readRivalsParams("?tjoin=<script>"), { tjoin: null, team: null, optIn: false });
});

test("error codes come out of rivals:<code> messages", () => {
  assert.equal(rivalsErrorCode({ message: "rivals:invite_expired" }), "invite_expired");
  assert.equal(rivalsErrorCode("permission denied for function accept_team_invite"), "not_authenticated");
  assert.equal(rivalsErrorCode(new Error("TypeError: Failed to fetch")), "network");
  assert.equal(rivalsErrorCode({}), "unknown");
});

test("normalizers", () => {
  const t = normTeam({ id: "1", name: "X", slug: "x", secondary_color: "#000000", preferred_format: "5v5", archived_at: "2026-01-01", listed: false, country: "BR" });
  assert.equal(t.secondaryColor, "#000000");
  assert.equal(t.format, "5v5");
  assert.equal(t.archived, true);
  assert.equal(t.listed, false);
  assert.equal(t.country, "BR");
  const m = normMember({ player_id: "p", role: "vice", status: "active", players: { nick: "Zé", photo_url: "u" } });
  assert.deepEqual([m.playerId, m.role, m.nick, m.photoUrl], ["p", "vice", "Zé", "u"]);
  const d = normDirectoryItem({ id: "1", name: "X", slug: "x", member_count: 7, captain: { id: "c", nick: "Rui", photo_url: null }, vice: null, my_role: "player", same_city: true });
  assert.equal(d.memberCount, 7);
  assert.equal(d.captain.nick, "Rui");
  assert.equal(d.vice, null);
  assert.equal(d.sameCity, true);
  assert.equal(hasPlayed(d.record), false);
});

test("roster order + permissions matrix", () => {
  const order = sortRoster([{ role: "player", nick: "B" }, { role: "vice", nick: "Z" }, { role: "captain", nick: "Y" }, { role: "player", nick: "A" }]);
  assert.deepEqual(order.map((x) => x.nick), ["Y", "Z", "A", "B"]);
  assert.equal(can("player", "invite"), false);
  assert.equal(can("vice", "invite"), true);
  assert.equal(can("vice", "rename"), false);
  assert.equal(can("captain", "rename"), true);
  assert.equal(can("vice", "remove", "player"), true);
  assert.equal(can("vice", "remove", "vice"), false);
  assert.equal(can("captain", "remove", "vice"), true);
  assert.equal(can("captain", "remove", "captain"), false);
  assert.equal(can("vice", "transfer"), false);
  assert.equal(can(null, "leave"), false);
});

test("invite status + days left", () => {
  const base = { expiresAt: new Date(NOW + 3 * 864e5).toISOString(), revokedAt: null, maxUses: null, uses: 0 };
  assert.equal(inviteStatus(base, NOW), "valid");
  assert.equal(inviteDaysLeft(base, NOW), 3);
  assert.equal(inviteStatus({ ...base, revokedAt: "x" }, NOW), "revoked");
  assert.equal(inviteStatus({ ...base, expiresAt: new Date(NOW - 1).toISOString() }, NOW), "expired");
  assert.equal(inviteStatus({ ...base, maxUses: 1, uses: 1 }, NOW), "used_up");
  assert.equal(inviteStatus(null), "not_found");
});

test("visibility, no-group and opening-tab rules", () => {
  assert.equal(rivalsVisible({ flagOn: false }), false);
  assert.equal(rivalsVisible({ flagOn: false, teamCount: 1 }), true);
  assert.equal(rivalsVisible({ flagOn: false, hasIntent: true }), true);
  assert.equal(rivalsVisible({ flagOn: false, optIn: true }), true);
  assert.equal(isNoGroup({ needsGroup: false, optIn: true }), false);
  assert.equal(isNoGroup({ needsGroup: true }), false);
  assert.equal(isNoGroup({ needsGroup: true, teamCount: 1 }), true);
  assert.equal(isNoGroup({ needsGroup: true, hasIntent: true }), true);
  assert.equal(openingTab({ noGroup: true, teamCount: 1 }), "equipa");
  assert.equal(openingTab({ noGroup: true, teamCount: 1, teamMatchToday: true }), "matchday");
  assert.equal(openingTab({ noGroup: true, teamCount: 0 }), "home");
  assert.equal(openingTab({ noGroup: false, matchdayLive: true, teamAction: true }), "matchday");
  assert.equal(openingTab({ noGroup: false, awaitingMyAnswer: true }), "jogar");
  assert.equal(openingTab({ noGroup: false, teamAction: true }), "competir");
  assert.equal(openingTab({ noGroup: false }), "home");
});

test("home team items: invite nudge for small squads, welcome for recent joins", () => {
  const items = teamFeedItems([
    { id: "a", role: "captain", memberCount: 2, since: new Date(NOW - 864e5).toISOString() },
    { id: "b", role: "player", memberCount: 9, since: new Date(NOW - 2 * 864e5).toISOString() },
    { id: "c", role: "player", memberCount: 9, since: new Date(NOW - 30 * 864e5).toISOString() },
    { id: "d", role: "vice", memberCount: 3, archived: true },
  ], NOW);
  assert.deepEqual(items.map((i) => [i.teamId, i.kind]), [["a", "team_invite"], ["b", "team_joined"]]);
});

test("markets, 24h deadline, support link", () => {
  assert.deepEqual(marketForLang("pt-br"), MARKETS.BR);
  assert.deepEqual(marketForLang("pt"), MARKETS.PT);
  assert.equal(MARKETS.BR.currency, "BRL");
  const far = new Date(NOW + 10 * 864e5).toISOString();
  assert.equal(challengeDeadline(far, NOW), new Date(NOW + 24 * 3600e3).toISOString());
  const soon = new Date(NOW + 5 * 3600e3).toISOString();
  assert.equal(challengeDeadline(soon, NOW), new Date(NOW + 3 * 3600e3).toISOString());
  assert.equal(supportWhatsAppUrl(), "https://wa.me/351913813845");
});

test("field validation mirrors the RPC", () => {
  assert.equal(validateTeamFields({ name: "X" }), "invalid_name");
  assert.equal(validateTeamFields({ color: "red" }), "invalid_color");
  assert.equal(validateTeamFields({ slug: "x" }), "invalid_field");
  assert.equal(validateTeamFields({ country: "ES" }), "invalid_country");
  assert.equal(validateTeamFields({ name: "Leões", format: "7v7", country: "BR" }), null);
});

test("demo: create is idempotent, captain role, market defaults", () => {
  let s = demoSeed(NOW);
  const r1 = run(s, "create_team", { name: "Rivais FC", fields: { country: "BR", city: "Rio" } }, ana);
  s = r1.state;
  assert.equal(r1.data.created, true);
  const r2 = run(s, "create_team", { name: "rivais fc", fields: {} }, ana);
  assert.equal(r2.data.created, false);
  assert.equal(r2.data.teamId, r1.data.teamId);
  const mine = demoMyTeams(s, "ana");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].role, "captain");
  assert.equal(mine[0].currency, "BRL");
  assert.equal(mine[0].timezone, "America/Sao_Paulo");
});

test("demo: invite → player only, idempotent, expired/revoked/used-up/removed", () => {
  let s = demoSeed(NOW);
  s = run(s, "create_team", { name: "Rivais FC", fields: {} }, ana).state;
  const tid = demoMyTeams(s, "ana")[0].id;
  let r = run(s, "create_team_invite", { teamId: tid }, ana);
  s = r.state;
  const tok = r.data.token;
  assert.equal(demoOp(s, "create_team_invite", { teamId: tid }, ana, NOW).data.token, tok, "same live link");
  assert.equal(demoOp(s, "create_team_invite", { teamId: tid }, paulo, NOW).error, "not_team_leader");

  r = run(s, "accept_team_invite", { token: tok }, paulo); s = r.state;
  assert.equal(r.data.alreadyMember, false);
  assert.equal(demoMyTeams(s, "paulo")[0].role, "player");
  r = run(s, "accept_team_invite", { token: tok }, paulo);
  assert.equal(r.data.alreadyMember, true);
  assert.equal(s.invites.find((i) => i.token === tok).uses, 1);

  s = run(s, "accept_team_invite", { token: tok }, ze).state;
  s = run(s, "remove_team_member", { teamId: tid, playerId: "ze" }, ana, NOW + 1000).state;
  assert.equal(demoOp(s, "accept_team_invite", { token: tok }, ze, NOW + 2000).error, "removed_from_team");

  assert.equal(demoOp(s, "accept_team_invite", { token: tok }, vasco, NOW + 15 * 864e5).error, "invite_expired");
  s = run(s, "revoke_team_invite", { teamId: tid }, ana).state;
  assert.equal(demoOp(s, "accept_team_invite", { token: tok }, vasco).error, "invite_revoked");
  assert.equal(demoInvitePreview(s, tok, "vasco", NOW).status, "revoked");

  r = run(s, "create_team_invite", { teamId: tid, rotate: true, maxUses: 1 }, ana, NOW + 5000); s = r.state;
  s = run(s, "accept_team_invite", { token: r.data.token }, ze, NOW + 6000).state; // newer link brings Zé back
  assert.equal(demoMyTeams(s, "ze")[0].role, "player");
  assert.equal(demoOp(s, "accept_team_invite", { token: r.data.token }, vasco, NOW + 7000).error, "invite_used_up");
});

test("demo: ≤1 vice, captain-only actions, transfer + leave invariants", () => {
  let s = demoSeed(NOW);
  s = run(s, "create_team", { name: "Rivais FC", fields: {} }, ana).state;
  const tid = demoMyTeams(s, "ana")[0].id;
  const inv = run(s, "create_team_invite", { teamId: tid }, ana);
  s = inv.state;
  const tok = inv.data.token;
  for (const p of [vasco, paulo, ze]) s = run(s, "accept_team_invite", { token: tok }, p).state;

  s = run(s, "set_member_role", { teamId: tid, playerId: "vasco", role: "vice" }, ana).state;
  const r = run(s, "set_member_role", { teamId: tid, playerId: "paulo", role: "vice" }, ana);
  s = r.state;
  assert.equal(r.data.demoted, "vasco");
  assert.equal(s.members.filter((m) => m.teamId === tid && m.role === "vice" && m.status === "active").length, 1);
  assert.equal(demoOp(s, "set_member_role", { teamId: tid, playerId: "ana", role: "player" }, ana).error, "use_transfer");
  assert.equal(demoOp(s, "update_team", { teamId: tid, fields: { name: "Golpe" } }, paulo).error, "captain_only");
  assert.equal(demoOp(s, "update_team", { teamId: tid, fields: { listed: false } }, paulo).error, "captain_only");
  assert.ok(!demoOp(s, "update_team", { teamId: tid, fields: { city: "Maia" } }, paulo).error);
  assert.equal(demoOp(s, "remove_team_member", { teamId: tid, playerId: "ana" }, paulo).error, "cannot_remove_captain");
  assert.equal(demoOp(s, "leave_team", { teamId: tid }, ana).error, "captain_must_transfer");

  s = run(s, "transfer_captaincy", { teamId: tid, playerId: "paulo" }, ana).state;
  const team = s.teams.find((t) => t.id === tid);
  assert.equal(team.captainId, "paulo");
  assert.equal(demoMyTeams(s, "ana")[0].role, "vice");
  assert.equal(s.members.filter((m) => m.teamId === tid && m.role === "captain" && m.status === "active").length, 1);

  // last member leaving archives
  let solo = run(demoSeed(NOW), "create_team", { name: "Solo", fields: {} }, ana).state;
  const sid = demoMyTeams(solo, "ana")[0].id;
  const left = run(solo, "leave_team", { teamId: sid }, ana);
  assert.equal(left.data.archived, true);
  solo = left.state;
  assert.equal(demoMyTeams(solo, "ana").length, 0);
});

test("demo directory: country, same city first, captain + vice, hidden/archived excluded", () => {
  let s = demoSeed(NOW);
  const pt = listTeamsLocal(s, { country: "PT", city: "Maia" }, "ana");
  assert.equal(pt.items[0].name, "Laranja Mecânica");
  assert.ok(pt.items.every((t) => t.country === "PT"));
  assert.equal(pt.items[0].captain.nick, "Gonçalo");
  assert.equal(pt.items[0].vice.nick, "Ivo");
  const br = listTeamsLocal(s, { country: "BR" }, "ana");
  assert.deepEqual(br.items.map((t) => t.name), ["Vila Madalena FC"]);
  const near = listTeamsLocal(s, { country: "PT", region: "Lisboa", onlyNear: true }, "ana");
  assert.deepEqual(near.items.map((t) => t.name), ["Alfama Futebol Clube"]);
  s = { ...s, teams: s.teams.map((t) => (t.id === "demo-t-pc" ? { ...t, listed: false } : t.id === "demo-t-lm" ? { ...t, archived: true } : t)) };
  const names = listTeamsLocal(s, { country: "PT" }, "ana").items.map((t) => t.name);
  assert.ok(!names.includes("Porto Casual") && !names.includes("Laranja Mecânica"));
  assert.equal(listTeamsLocal(s, { country: "PT", query: "alfama" }, "ana").items.length, 1);
});

test("demo seed invite token works", () => {
  const s = demoSeed(NOW);
  const p = demoInvitePreview(s, DEMO_INVITE_TOKEN, "ana", NOW);
  assert.equal(p.status, "valid");
  assert.equal(p.team.name, "Matosinhos United");
  assert.equal(p.invitedBy, "Rui");
  assert.deepEqual(emptyRecord().form, []);
});
