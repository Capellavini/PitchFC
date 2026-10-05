import { test } from "node:test";
import assert from "node:assert/strict";
import { isDmJid, bareJid, pnDigits, resolveDmIdentity, parseActivationCode, isActivationPhrase, phraseLang, normalize } from "../src/adjunto/identity.js";

test("isDmJid: 1:1 chats only", () => {
  assert.equal(isDmJid("351912345678@s.whatsapp.net"), true);
  assert.equal(isDmJid("123456789012345@lid"), true);
  for (const j of ["status@broadcast", "1234@broadcast", "1203@g.us", "12@newsletter", null, undefined, "garbage"]) assert.equal(isDmJid(j), false, String(j));
});

test("bareJid / pnDigits", () => {
  assert.equal(bareJid("351912345678:12@s.whatsapp.net"), "351912345678@s.whatsapp.net");
  assert.equal(bareJid("351912345678@c.us"), "351912345678@s.whatsapp.net");
  assert.equal(pnDigits("351912345678:3@s.whatsapp.net"), "351912345678");
  assert.equal(pnDigits("999@lid"), null);
});

test("resolveDmIdentity: @lid with remoteJidAlt", async () => {
  const id = await resolveDmIdentity({ remoteJid: "111222333@lid", remoteJidAlt: "351912345678@s.whatsapp.net" });
  assert.equal(id.chatJid, "111222333@lid");
  assert.equal(id.lid, "111222333@lid");
  assert.equal(id.pn, "351912345678");
  assert.deepEqual(id.jids.sort(), ["111222333@lid", "351912345678@s.whatsapp.net"].sort());
});

test("resolveDmIdentity: @lid resolved through lidMapping, or not at all", async () => {
  const mapped = await resolveDmIdentity({ remoteJid: "777@lid" }, { getPNForLID: async () => "351911111111:0@s.whatsapp.net" });
  assert.equal(mapped.pn, "351911111111");
  const none = await resolveDmIdentity({ remoteJid: "777@lid" }, { getPNForLID: async () => null });
  assert.equal(none.pn, null);
  const throws = await resolveDmIdentity({ remoteJid: "777@lid" }, { getPNForLID: async () => { throw new Error("x"); } });
  assert.equal(throws.pn, null);
});

test("resolveDmIdentity: plain phone jid + legacy senderPn", async () => {
  assert.equal((await resolveDmIdentity({ remoteJid: "351912345678@s.whatsapp.net" })).pn, "351912345678");
  assert.equal((await resolveDmIdentity({ remoteJid: "5@lid", senderPn: "5511987654321@s.whatsapp.net" })).pn, "5511987654321");
});

test("parseActivationCode", () => {
  assert.equal(parseActivationCode("Olá! Quero ativar o Treinador Adjunto do Goodweather 🧢 Código: ADJ-7K3QX9"), "ADJ-7K3QX9");
  assert.equal(parseActivationCode("code adj-7k3qx9"), "ADJ-7K3QX9");
  assert.equal(parseActivationCode("ADJ-7K3QX0"), null); // 0 not in the alphabet
  assert.equal(parseActivationCode("ADJ-ABC"), null);
});

test("activation phrase: positives in PT-PT, PT-BR and EN", () => {
  for (const s of [
    "Quero o Treinador Adjunto", "quero o treinador adjunto!", "Ativar adjunto", "Olá adjunto", "olá, adjunto 👋",
    "Quero o auxiliar técnico", "Oi! Quero ativar o Auxiliar Técnico", "assistant coach", "I want the assistant coach",
    "Hi assistant coach", "activate assistant coach please", "Quero ativar o Treinador Adjunto do Goodweather F.C.",
    "Treinador Adjunto", "preciso do adjunto", "Gostava de ativar o treinador adjunto para o Goodweather",
  ]) assert.equal(isActivationPhrase(s), true, s);
});

test("activation phrase: false positives stay silent", () => {
  for (const s of [
    "o adjunto do benfica é bom", "O adjunto do Benfica", "o treinador adjunto foi expulso", "adjunto é fixe",
    "preciso de falar com o adjunto do mister", "olá", "quero jogar sábado", "the assistant coach was sacked",
    "", "a".repeat(200),
  ]) assert.equal(isActivationPhrase(s), false, s);
});

test("phraseLang + normalize", () => {
  assert.equal(phraseLang("I want the assistant coach"), "en");
  assert.equal(phraseLang("Oi, quero o auxiliar técnico"), "ptbr");
  assert.equal(phraseLang("Quero o Treinador Adjunto"), "pt");
  assert.equal(normalize("  Olá,  ADJUNTO!! "), "ola adjunto");
});
