import test from "node:test";
import assert from "node:assert/strict";
import { parseAdjuntoText } from "./adjuntoText.js";

test("paragraphs and bullets become blocks; consecutive bullets share one list", () => {
  const b = parseAdjuntoText("Tens 2 coisas:\n- uma\n- duas\nFim.");
  assert.deepEqual(b.map((x) => x.type), ["p", "ul", "p"]);
  assert.equal(b[1].items.length, 2);
});

test("**bold** is split into parts, never HTML", () => {
  const [p] = parseAdjuntoText("Falta **homologar** o jogo");
  assert.deepEqual(p.parts, [{ text: "Falta " }, { text: "homologar", bold: true }, { text: " o jogo" }]);
});

test("markup the screen does not support is flattened to plain text", () => {
  const b = parseAdjuntoText("## Resumo\nVê [aqui](http://x.test) `código` <b>x</b>");
  assert.equal(b[0].parts[0].bold, true);
  assert.equal(b[0].parts[0].text, "Resumo");
  assert.equal(b[1].parts.map((p) => p.text).join(""), "Vê aqui código <b>x</b>"); // rendered as text by React, so the tag stays inert
});

test("empty or non-string input gives no blocks", () => {
  assert.deepEqual(parseAdjuntoText(""), []);
  assert.deepEqual(parseAdjuntoText(null), []);
});
