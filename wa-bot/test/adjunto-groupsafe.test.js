import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUP_SAFE_KINDS, groupCtx } from "../src/adjunto/groupsafe.js";
import { render } from "../src/messages.js";

// A "dirty" context full of DM-only stuff that must never reach a group.
const dirty = {
  game: { scheduled_at: "2026-10-10T19:00:00Z", venue: "Campo 1", teams: "secret" },
  confirmed: 7, spots: 10, pending: ["Rui", "Zé"], inviteLink: "https://pitch-fc.com/?join=avu",
  teams: [{ name: "Coletes", nicks: ["Cris", "Zé"], ovr: 74, insights: "💡 juntos ganharam 7 de 8" }, { name: "Sem coletes", nicks: ["Rui"], ovr: 71 }],
  insights: ["🔥 O Rui está em fogo", "performance gap 23%"], llmText: "O Zé está a jogar mal (OVR 61?)", ovr: 74,
};

test("only the whitelisted kinds can be built", () => {
  assert.deepEqual([...GROUP_SAFE_KINDS], ["adj_reminder", "open_spots", "teams_confirmed", "rescheduled"]);
  assert.throws(() => groupCtx("anything_else", dirty));
});

for (const kind of GROUP_SAFE_KINDS) {
  for (const lang of ["pt", "ptbr", "en", "pt+en"]) {
    test(`group template ${kind}/${lang} carries no DM-only data`, () => {
      const full = render(kind, { ...groupCtx(kind, dirty), link: "https://pitch-fc.com/?join=inv" }, lang);
      const text = full.replace(/https:\/\/\S+/g, "<link>");
      assert.doesNotMatch(text,/OVR|%|🔥|💡|\d\?|em fogo|juntos|gap|jogar mal|secret|74|71/);
      assert.ok(text.length > 10);
    });
  }
}

test("teams_confirmed: lineup only (names + nicks)", () => {
  const text = render("teams_confirmed", groupCtx("teams_confirmed", dirty), "pt");
  assert.equal(text, "👕 *Equipas*\n*Coletes*: Cris, Zé\n*Sem coletes*: Rui");
});

test("a non-https invite link is dropped", () => {
  assert.equal(groupCtx("open_spots", { ...dirty, inviteLink: "javascript:alert(1)" }).inviteLink, null);
});
