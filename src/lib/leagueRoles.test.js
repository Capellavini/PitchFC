import test from "node:test";
import assert from "node:assert/strict";
import { inviteTokenFromPath, inviteUrl, inviteMessage, whatsappShareUrl, roleErrorText, ROLE_ERROR, accessByTeam, inviteUsage } from "./leagueRoles.js";

const TOKEN = "a".repeat(40);

test("only a 40-char hex token is an invite path", () => {
  assert.equal(inviteTokenFromPath(`/l/convite/${TOKEN}`), TOKEN);
  assert.equal(inviteTokenFromPath(`/l/convite/${TOKEN}/`), TOKEN);
  assert.equal(inviteTokenFromPath("/l/convite/curto"), null);
  assert.equal(inviteTokenFromPath("/l/convite"), null);
  assert.equal(inviteTokenFromPath(`/l/${TOKEN}`), null);
  assert.equal(inviteTokenFromPath(null), null);
});

test("invite url and share text", () => {
  const url = inviteUrl(TOKEN, "https://pitch-fc.com/");
  assert.equal(url, `https://pitch-fc.com/l/convite/${TOKEN}`);
  const cap = inviteMessage({ league: "AFPCE", role: "captain", team: "Porto FC", url });
  assert.match(cap, /capitão da equipa Porto FC da AFPCE/);
  assert.ok(cap.endsWith(url));
  const ath = inviteMessage({ league: "", role: "athlete", team: "Porto FC", url });
  assert.match(ath, /Convidámos-te para a equipa Porto FC\./);
  assert.ok(whatsappShareUrl(ath).startsWith("https://wa.me/?text=") && !whatsappShareUrl(ath).includes(" "));
});

test("every server error code has PT-PT copy and unknown ones fall back", () => {
  for (const code of ["invalid_invite", "invite_used", "player_taken", "forbidden", "player_has_history", "duplicate_number"]) assert.ok(ROLE_ERROR[code], code);
  assert.match(roleErrorText("nonsense"), /Tenta outra vez/);
  assert.doesNotMatch(Object.values(ROLE_ERROR).join(" "), /\btimes?\b/i);
});

test("access is grouped per team with only open invites", () => {
  const teams = [{ id: "tm-a", name: "A" }, { id: "tm-b", name: "B" }];
  const invites = [
    { id: "1", role: "captain", team_id: "tm-a", status: "open" },
    { id: "2", role: "captain", team_id: "tm-a", status: "used" },
    { id: "3", role: "athlete", team_id: "tm-a", player_id: null, status: "open" },
    { id: "4", role: "athlete", team_id: "tm-a", player_id: "pl-1", status: "open" },
    { id: "5", role: "athlete", team_id: "tm-b", player_id: null, status: "revoked" },
  ];
  const members = [{ id: "m1", role: "captain", team_id: "tm-a" }, { id: "m2", role: "athlete", team_id: "tm-b" }];
  const [a, b] = accessByTeam({ teams, invites, members });
  assert.deepEqual(a.captainInvites.map((i) => i.id), ["1"]);
  assert.equal(a.teamInvite.id, "3");
  assert.deepEqual(a.playerInvites.map((i) => i.id), ["4"]);
  assert.deepEqual(a.captains.map((m) => m.id), ["m1"]);
  assert.equal(b.teamInvite, null);
  assert.deepEqual(b.athletes.map((m) => m.id), ["m2"]);
  assert.deepEqual(accessByTeam({}), []);
});

test("invite usage line", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  assert.equal(inviteUsage({ uses: 1, max_uses: 60, expires_at: "2026-11-10T12:00:00Z" }, now), "1 de 60 usado · expira em 12 dias");
  assert.equal(inviteUsage({ uses: 0, max_uses: 1, expires_at: "2026-10-30T11:00:00Z" }, now), "0 de 1 usados · expira em 1 dia");
});

test("the sign-in page only ever returns to an invite page", async () => {
  const { inviteNextFromSearch, memberPath, memberWorkspaceFromPath, homeEntries, MEMBER_HOME_PATH } = await import("./leagueRoles.js");
  assert.equal(inviteNextFromSearch(`?next=/l/convite/${TOKEN}`), `/l/convite/${TOKEN}`);
  assert.equal(inviteNextFromSearch(`?next=%2Fl%2Fconvite%2F${TOKEN}%2F`), `/l/convite/${TOKEN}`);
  assert.equal(inviteNextFromSearch("?next=https://evil.example/"), null);
  assert.equal(inviteNextFromSearch("?next=//evil.example/l/convite/" + TOKEN), null);
  assert.equal(inviteNextFromSearch("?next=/l/convite/x"), null);
  assert.equal(inviteNextFromSearch(""), null);
  const ws = "11111111-2222-3333-4444-555555555555";
  assert.equal(memberPath(ws), `${MEMBER_HOME_PATH}/${ws}`);
  assert.equal(memberWorkspaceFromPath(memberPath(ws)), ws);
  assert.equal(memberWorkspaceFromPath(`${MEMBER_HOME_PATH}/nope`), null);
  assert.equal(memberWorkspaceFromPath(MEMBER_HOME_PATH), null);
});

test("the member home lists the own league first, then each membership", async () => {
  const { homeEntries } = await import("./leagueRoles.js");
  const ms = [{ workspace_id: "w1", role: "captain", league_name: "AFPCE", team_id: "tm-a", team_name: "Porto FC" }, { workspace_id: "w2", role: "athlete", league_name: "", team_id: "tm-b", team_name: "" }];
  const list = homeEntries({ owner: true, memberships: ms });
  assert.deepEqual(list.map((e) => e.kind), ["owner", "captain", "athlete"]);
  assert.equal(list[0].href, "/league/minhas/painel");
  assert.equal(list[1].detail, "Capitão · Porto FC");
  assert.equal(list[2].title, "Liga");
  assert.equal(list[2].detail, "Atleta");
  assert.deepEqual(homeEntries({}), []);
});
