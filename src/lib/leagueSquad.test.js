import test from "node:test";
import assert from "node:assert/strict";
import { draftFromPlayers, squadProblems, squadPayload, isSquadDirty } from "./leagueSquad.js";

const players = [
  { id: "pl-1", teamId: "tm-a", name: "Ana", number: 1, position: "GR", captain: true },
  { id: "pl-2", teamId: "tm-a", name: "Bruno", number: null, position: "", captain: false },
];

test("rows keep the id and show an empty number as empty text", () => {
  const rows = draftFromPlayers(players);
  assert.deepEqual(rows.map((r) => [r.id, r.number, r.captain]), [["pl-1", "1", true], ["pl-2", "", false]]);
  assert.deepEqual(draftFromPlayers(), []);
});

test("problems are reported in PT-PT and an empty list means it can be saved", () => {
  assert.deepEqual(squadProblems(draftFromPlayers(players)), []);
  const bad = [{ name: " ", number: "" }, { name: "X", number: "7" }, { name: "Y", number: "7" }, { name: "Z", number: "100" }];
  assert.deepEqual(squadProblems(bad), ["Há atletas sem nome.", "O número tem de estar entre 0 e 99.", "Dois atletas têm o mesmo número."]);
  assert.ok(squadProblems(Array.from({ length: 41 }, (_, i) => ({ name: "P" + i, number: "" }))).includes("O plantel pode ter no máximo 40 atletas."));
});

test("the payload keeps ids for existing athletes, none for new ones, and numbers as numbers", () => {
  const rows = [...draftFromPlayers(players), { key: "new-1", id: null, name: " Carla ", number: "9", position: " AVA ", captain: false }];
  assert.deepEqual(squadPayload(rows), [
    { id: "pl-1", name: "Ana", number: 1, position: "GR", captain: true },
    { id: "pl-2", name: "Bruno", number: null, position: "", captain: false },
    { name: "Carla", number: 9, position: "AVA", captain: false },
  ]);
});

test("dirty only when something really changed", () => {
  const rows = draftFromPlayers(players);
  assert.equal(isSquadDirty(rows, players), false);
  assert.equal(isSquadDirty(rows.map((r) => (r.id === "pl-1" ? { ...r, name: "Ana " } : r)), players), false, "trailing space is not a change");
  assert.equal(isSquadDirty(rows.map((r) => (r.id === "pl-1" ? { ...r, number: "10" } : r)), players), true);
  assert.equal(isSquadDirty(rows.slice(1), players), true);
  assert.equal(isSquadDirty([...rows, { key: "n", id: null, name: "Nova", number: "", position: "", captain: false }], players), true);
});
