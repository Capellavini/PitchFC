import { test } from "node:test";
import assert from "node:assert/strict";
import { captainHelpText, captainHelpUrl, parseCaptainPhrase, phraseLangOf, PITCH_AI_NUMBER } from "./captainPhrase.js";

test("prefilled text per language", () => {
  assert.equal(captainHelpText("Coletes FC", "pt"), "Olá PITCH! Criei a equipa «Coletes FC» e quero ajuda para montar o plantel.");
  assert.equal(captainHelpText("Coletes FC", "pt-br"), "Olá PITCH! Criei o time «Coletes FC» e quero ajuda para montar o elenco.");
  assert.equal(captainHelpText("Coletes FC", "en"), "Hi PITCH! I created the team «Coletes FC» and I want help building the squad.");
  assert.equal(captainHelpText("«Bad» \"Name\"", "pt"), "Olá PITCH! Criei a equipa «Bad Name» e quero ajuda para montar o plantel.");
  assert.equal(phraseLangOf("ptbr"), "pt-br");
  assert.equal(phraseLangOf("xx"), "pt");
});

test("wa.me url targets the bot and encodes the text", () => {
  const url = captainHelpUrl("Coletes FC", "pt");
  assert.ok(url.startsWith(`https://wa.me/${PITCH_AI_NUMBER}?text=`));
  assert.equal(decodeURIComponent(url.split("?text=")[1]), captainHelpText("Coletes FC", "pt"));
});

test("the bot recognises exactly what the app sends (round trip, 3 languages)", () => {
  for (const [lang, want] of [["pt", "pt"], ["pt-br", "pt-br"], ["en", "en"]]) {
    for (const team of ["Coletes FC", "Os Leões da Maia", "FC 1990 & Amigos", "Á"]) {
      const r = parseCaptainPhrase(captainHelpText(team, lang));
      assert.ok(r, `${lang} ${team}`);
      assert.equal(r.lang, want);
      assert.equal(r.team, team);
    }
  }
});

test("hand-typed variations still match; team from the free slot", () => {
  assert.deepEqual(parseCaptainPhrase("criei a equipa coletes fc e quero ajuda para montar o plantel"), { lang: "pt", team: "coletes fc" });
  assert.deepEqual(parseCaptainPhrase("Oi! Criei o meu time e preciso de ajuda pra montar o elenco"), { lang: "pt-br", team: null });
  assert.deepEqual(parseCaptainPhrase("hello pitch, I just created my team and I need help building the squad please"), { lang: "en", team: null });
});

test("ordinary messages never match", () => {
  for (const s of ["", "olá", "a equipa do benfica é boa", "Quero o Treinador Adjunto", "quero ajuda para montar o plantel",
    "criei a equipa", "I created the team", "x".repeat(300)]) {
    assert.equal(parseCaptainPhrase(s), null, s);
  }
});
