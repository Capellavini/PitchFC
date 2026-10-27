import test from "node:test";
import assert from "node:assert/strict";
import { buildLeagueDemoSeed, deriveLeague, CUP } from "./leagueDemo.js";
import { leagueToday } from "./leagueToday.js";
import { adjuntoBrief, adjuntoReply } from "./leagueAdjuntoGuide.js";

const today = () => { const s = buildLeagueDemoSeed(); return leagueToday(s, deriveLeague(s)); };

test("the brief counts what is waiting, across competitions", () => {
  const b = adjuntoBrief(today());
  assert.match(b.text, /contestaç/);
  assert.match(b.text, /resultados por homologar/); // m4 (league) + c1 (cup)
  assert.equal(b.counts.homologate, 2);
});

test("asking about the recap before anything is closed points at what is missing", () => {
  const r = adjuntoReply("Preparar o resumo da jornada", today());
  assert.match(r.text, /Ainda nenhuma jornada está fechada/);
  assert.equal(r.actions[0].id, "homologate");
});

test("the recap is offered once a competition's round is closed", () => {
  const t = today();
  const closed = { ...t, sections: t.sections.map((s) => (s.competition.id === CUP.id ? { ...s, done: true } : s)) };
  const r = adjuntoReply("resumo", closed, { names: { [CUP.id]: "Taça" } });
  assert.match(r.text, /Taça/);
  assert.equal(r.actions[0].id, "recap");
});

test("it never invents numbers: every figure in the reply is in the queue", () => {
  const t = today();
  const r = adjuntoReply("o que falta fechar hoje?", t);
  const nums = (r.text.match(/\d+/g) || []).map(Number);
  const known = new Set([1, 2, 3, 4, 5, 6, ...t.items.map(() => t.items.length)]);
  assert.ok(nums.every((n) => known.has(n)));
});

test("an empty queue says so", () => {
  const b = adjuntoBrief({ items: [], sections: [], done: false });
  assert.match(b.text, /tudo em dia/i);
});
