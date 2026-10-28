import test from "node:test";
import assert from "node:assert/strict";
import { isLeagueAccount, leagueAccountRedirect, leagueSignUpMeta, leagueProfileForm, LEAGUE_HOME_PATH } from "./leagueAccount.js";
import { homeContexts, resolveHomeContext } from "./homeContext.js";
import { parseLeaguePath, RESERVED_LEAGUE_SLUGS } from "./leagueCloud.js";

const league = { user_metadata: { pitch_product: "league" } };
const regular = { user_metadata: { name: "Rui" } };

test("only accounts created on the league entry are league accounts", () => {
  assert.equal(isLeagueAccount(league), true);
  assert.equal(isLeagueAccount(regular), false);
  assert.equal(isLeagueAccount(null), false);
});

test("a league account is kept inside the league product", () => {
  for (const p of ["/", "/?join=abc", "/rivals", "/pricing", "/admin", "/demo", "/desafios"]) {
    assert.equal(leagueAccountRedirect(league, p.split("?")[0]), LEAGUE_HOME_PATH, p);
  }
  for (const p of ["/league", "/league/minhas", "/league/liga-x/campeonato", "/league/entrar", "/league/demo", "/l/afpce", "/privacidade", "/termos", "/league/"]) {
    assert.equal(leagueAccountRedirect(league, p), null, p);
  }
});

test("everyone else is never redirected", () => {
  assert.equal(leagueAccountRedirect(regular, "/"), null);
  assert.equal(leagueAccountRedirect(null, "/"), null);
});

test("league sign-up metadata carries the marker and never a group or Rivals intent", () => {
  const m = leagueSignUpMeta({ name: "Ana", phone: "+351912345678", lang: "pt", join_token: "x", pending_intent: { kind: "tjoin" }, tjoin_token: "y" });
  assert.equal(m.pitch_product, "league");
  assert.equal(m.pitch_context_mode, "league_only");
  assert.equal(m.name, "Ana");
  assert.ok(!("join_token" in m) && !("pending_intent" in m) && !("tjoin_token" in m));
});

test("the minimal profile needs only a name", () => {
  const f = leagueProfileForm({ email: "ana.silva@x.pt", user_metadata: { name: "Ana Silva" } });
  assert.equal(f.name, "Ana Silva");
  assert.equal(f.nick, "Ana");
  assert.equal(leagueProfileForm({ email: "joao@x.pt", user_metadata: {} }).name, "joao");
});

test("a league account sees only the league context, even with no league membership yet", () => {
  assert.deepEqual(homeContexts({ product: "league" }), ["league"]);
  assert.deepEqual(homeContexts({ product: "league", teams: [{ id: "t" }] }), ["league"]);
  assert.equal(resolveHomeContext({ product: "league", preferred: "player" }), "league");
});

test("the entry path is reserved so it is never read as a league slug", () => {
  assert.ok(RESERVED_LEAGUE_SLUGS.includes("entrar"));
  assert.equal(parseLeaguePath("/league/entrar")?.kind === "league", false);
});
