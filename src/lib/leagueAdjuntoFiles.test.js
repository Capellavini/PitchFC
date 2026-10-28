import test from "node:test";
import assert from "node:assert/strict";
import { classifyFile, chatHistory } from "./leagueAdjuntoFiles.js";
import { validateAdjuntoRequest, modelMessages } from "./leagueAdjuntoRequest.js";

test("which files the Adjunto reads", () => {
  assert.deepEqual(classifyFile({ name: "calendario.PDF", type: "" }), { kind: "media", media_type: "application/pdf" });
  assert.deepEqual(classifyFile({ name: "foto.jpeg", type: "image/jpeg" }), { kind: "media", media_type: "image/jpeg" });
  assert.deepEqual(classifyFile({ name: "plantel.csv", type: "application/vnd.ms-excel" }), { kind: "text" });
  assert.deepEqual(classifyFile({ name: "notas.txt", type: "text/plain" }), { kind: "text" });
  assert.equal(classifyFile({ name: "equipas.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), null, "Excel must be exported to CSV or PDF first");
  assert.equal(classifyFile({ name: "virus.exe", type: "" }), null);
});

test("the history sent to the model starts with the user and keeps the latest turns", () => {
  const log = [{ role: "assistant", text: "Olá" }, { role: "user", text: "a" }, { role: "assistant", text: "b" }, { role: "assistant", text: "" }, { role: "user", text: "c" }];
  assert.deepEqual(chatHistory(log), [{ role: "user", text: "a" }, { role: "assistant", text: "b" }, { role: "user", text: "c" }]);
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `m${i}` }));
  const h = chatHistory(many);
  assert.equal(h[0].role, "user");
  assert.ok(h.length <= 8);
});

test("a leading assistant turn never reaches the model", () => {
  const r = validateAdjuntoRequest({ messages: [{ role: "assistant", text: "Olá" }, { role: "user", text: "Cria a equipa X" }], context: {} });
  assert.equal(modelMessages(r)[0].role, "user");
});
