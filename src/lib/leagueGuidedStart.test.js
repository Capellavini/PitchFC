import test from "node:test";
import assert from "node:assert/strict";
import { seasonLabel, parseCompetitionLines, parseTeamLines } from "./leagueGuidedStart.js";

test("seasonLabel: the new season starts in July", () => {
  assert.equal(seasonLabel(new Date(2026, 9, 28)), "2026/27");
  assert.equal(seasonLabel(new Date(2027, 2, 1)), "2026/27");
  assert.equal(seasonLabel(new Date(2026, 5, 30)), "2025/26");
  assert.equal(seasonLabel(new Date(2026, 6, 1)), "2026/27");
});

test("parseCompetitionLines: lines, commas, bullets; cups recognised; duplicates dropped", () => {
  assert.deepEqual(parseCompetitionLines("1.ª Divisão\n2.ª Divisão\nTaça da Associação\nSupertaça"), [
    { name: "1.ª Divisão", kind: "league" }, { name: "2.ª Divisão", kind: "league" }, { name: "Taça da Associação", kind: "cup" }, { name: "Supertaça", kind: "cup" },
  ]);
  assert.deepEqual(parseCompetitionLines("- Campeonato, Taça Cidade"), [{ name: "Campeonato", kind: "league" }, { name: "Taça Cidade", kind: "cup" }]);
  assert.deepEqual(parseCompetitionLines("Liga\nliga\n\n x "), [{ name: "Liga", kind: "league" }]);
});

test("parseTeamLines: numbering and bullets are stripped", () => {
  assert.deepEqual(parseTeamLines("1. Anta FC\n- Paramos\n\nSilvalde"), [["Anta FC"], ["Paramos"], ["Silvalde"]]);
});
