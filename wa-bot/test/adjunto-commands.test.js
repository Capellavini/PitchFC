import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYesNo, parseTeamsCommand, parseQuickCommand, resolveNick, parseChoice, proposalRef } from "../src/adjunto/commands.js";

test("yes/no in PT/PTBR/EN; 'não sei' is not a decision", () => {
  for (const y of ["sim", "Sim!", "ok", "OK 👍", "confirmo", "aprovo", "bora", "manda", "👍", "yes", "sure", "pode ser", "sim por favor"]) assert.equal(parseYesNo(y), "yes", y);
  for (const n of ["não", "nao", "Não.", "cancela", "esquece", "no", "nope", "❌"]) assert.equal(parseYesNo(n), "no", n);
  for (const x of ["não sei", "sim, mas troca o Zé", "talvez", "", "1"]) assert.equal(parseYesNo(x), null, x);
  assert.equal(parseYesNo("1", { digits: true }), "yes");
  assert.equal(parseYesNo("2", { digits: true }), "no");
});

test("team commands", () => {
  assert.deepEqual(parseTeamsCommand("ok"), { type: "approve" });
  assert.deepEqual(parseTeamsCommand("troca o Zé com o André"), { type: "swap", a: "ze", b: "andre" });
  assert.deepEqual(parseTeamsCommand("troca Cris Miguel"), { type: "swap", a: "cris", b: "miguel" });
  assert.deepEqual(parseTeamsCommand("swap Rui with Hugo"), { type: "swap", a: "rui", b: "hugo" });
  assert.deepEqual(parseTeamsCommand("separa o Cris e o Zé"), { type: "separate", a: "cris", b: "ze" });
  assert.deepEqual(parseTeamsCommand("sorteia de novo"), { type: "redraw", numTeams: null });
  assert.deepEqual(parseTeamsCommand("sortear de novo com 3 equipas"), { type: "redraw", numTeams: 3 });
  assert.deepEqual(parseTeamsCommand("mete o Rui na equipa 2"), { type: "move", player: "rui", team: 2 });
  assert.deepEqual(parseTeamsCommand("propõe"), { type: "propose_now" });
  assert.deepEqual(parseTeamsCommand("espera"), { type: "wait" });
  assert.equal(parseTeamsCommand("quem é o melhor guarda-redes?"), null);
});

test("quick commands", () => {
  assert.deepEqual(parseQuickCommand("Estado"), { type: "status" });
  assert.deepEqual(parseQuickCommand("tabela"), { type: "table" });
  assert.deepEqual(parseQuickCommand("grupo Pitch Quarta"), { type: "group", name: "pitch quarta" });
  assert.deepEqual(parseQuickCommand("fala inglês"), { type: "lang", lang: "en" });
  assert.deepEqual(parseQuickCommand("formato"), { type: "format" });
  assert.equal(parseQuickCommand("qual é o estado do Zé?"), null);
});

test("resolveNick: accents, exact, unique prefix, ambiguity", () => {
  const ps = [{ nick: "Zé", name: "José Silva" }, { nick: "Zeca", name: "Zeca" }, { nick: "André", name: "André" }];
  assert.equal(resolveNick("ze", ps).player.nick, "Zé");
  assert.equal(resolveNick("andre", ps).player.nick, "André");
  assert.deepEqual(resolveNick("z", ps).ambiguous.sort(), ["Zeca", "Zé"].sort());
  assert.equal(resolveNick("silva", ps).player.nick, "Zé");
  assert.equal(resolveNick("xx", ps).none, true);
});

test("parseChoice / proposalRef", () => {
  assert.equal(parseChoice("2", 3), 2);
  assert.equal(parseChoice("opção 1", 3), 1);
  assert.equal(parseChoice("4", 3), null);
  assert.equal(proposalRef("sim #14"), 14);
  assert.equal(proposalRef("sim"), null);
});
