import { test } from "node:test";
import assert from "node:assert/strict";
import { numbersGrounded, numericTokens } from "../src/adjunto/guard.js";

const facts = JSON.stringify({ confirmed: 7, spots: 8, score: "3-1", price_each_cents: 450, when_label: "sábado, 21:00", win_pct: 75, forma: 1.6 });

test("grounded numbers pass (7/8, 3-1, 21h/21:00, €4,50, 75%, 1,6)", () => {
  for (const s of ["Já são 7/8.", "Ganharam 3-1.", "Jogo às 21:00.", "Cada um paga €4,50.", "Ganha 75% dos jogos.", "Forma 1,6× a média."]) {
    assert.equal(numbersGrounded(s, facts).ok, true, s);
  }
});

test("ungrounded numbers are flagged", () => {
  const r = numbersGrounded("O Zé marcou 12 golos e tem 63% de vitórias.", facts);
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, ["12", "63%"]);
  assert.equal(numbersGrounded("Faltam 9/10", facts).ok, false);
  assert.equal(numbersGrounded("Paga €5,50", facts).ok, false);
});

test("small counts and the organizer's own numbers are allowed", () => {
  assert.equal(numbersGrounded("Tenho 2 sugestões e 3 notas.", "{}").ok, true);
  assert.equal(numbersGrounded("Mudo para sexta às 22:30?", "{}", { userText: "muda para sexta 22:30" }).ok, true);
});

test("numericTokens splits composites", () => {
  assert.deepEqual(numericTokens("7/8 e 3-1").map((t) => t.atoms), [["7", "8"], ["3", "1"]]);
  assert.deepEqual(numericTokens("€4,50").map((t) => t.atoms), [["4.5"]]);
});
