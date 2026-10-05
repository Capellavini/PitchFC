import { test } from "node:test";
import assert from "node:assert/strict";
import { proposeTeams, applyTeamsCommand, rosterDiff, adjustTeams, renderTeamsCard, lineup, validDraft } from "../src/adjunto/teams.js";
import { makeWorld, seeded } from "./adjunto-fakes.js";

const all = (teams) => teams.flatMap((t) => t.players).sort((a, b) => a - b);

test("fresh draw: every playing player exactly once, hashed ids", () => {
  const ctx = makeWorld().ctx();
  const { teams, fromApp } = proposeTeams({ players: ctx.playing, numTeams: 2, rng: seeded(1) });
  assert.equal(fromApp, false);
  assert.deepEqual(all(teams), ctx.playing.map((p) => p.id).sort((a, b) => a - b));
  assert.equal(typeof teams[0].players[0], "number");
});

test("an app draft that fits the roster is validated, not redrawn", () => {
  const ctx = makeWorld().ctx();
  const app = [{ id: "t1", name: "Coletes", color: "#C8FF00", players: ctx.playing.slice(0, 5).map((p) => p.id) },
    { id: "t2", name: "Sem coletes", color: "#4895FF", players: ctx.playing.slice(5).map((p) => p.id) }];
  assert.equal(validDraft(app, ctx.playing), true);
  const r = proposeTeams({ players: ctx.playing, appTeams: app, rng: seeded(1) });
  assert.equal(r.fromApp, true);
  assert.equal(r.teams, app);
  assert.equal(validDraft([{ players: [1] }, { players: [2] }], ctx.playing), false);
});

test("swap / separate / move / redraw; unknown and ambiguous refs", () => {
  const ctx = makeWorld().ctx();
  const { teams } = proposeTeams({ players: ctx.playing, rng: seeded(2) });
  const nick = (id) => ctx.playing.find((p) => p.id === id).nick;
  const a = nick(teams[0].players[0]), b = nick(teams[1].players[0]);
  const sw = applyTeamsCommand(teams, { type: "swap", a, b }, ctx.playing).teams;
  assert.equal(nick(sw[1].players[0]), a);
  const same = [nick(teams[0].players[0]), nick(teams[0].players[1])];
  const sep = applyTeamsCommand(teams, { type: "separate", a: same[0], b: same[1] }, ctx.playing).teams;
  assert.ok(!sep.some((t) => t.players.map(nick).includes(same[0]) && t.players.map(nick).includes(same[1])));
  const mv = applyTeamsCommand(teams, { type: "move", player: a, team: 2 }, ctx.playing).teams;
  assert.ok(mv[1].players.map(nick).includes(a));
  const rd = applyTeamsCommand(teams, { type: "redraw", numTeams: 3 }, ctx.playing, { rng: seeded(9) }).teams;
  assert.equal(rd.length, 3);
  assert.deepEqual(all(rd), all(teams));
  assert.equal(applyTeamsCommand(teams, { type: "swap", a: "ninguem", b }, ctx.playing).error, "unknown");
});

test("roster diff + adjust keeps everyone once", () => {
  const w = makeWorld({ confirmed: 10 });
  const before = w.ctx();
  const { teams } = proposeTeams({ players: before.playing, rng: seeded(4) });
  w.state.attendances[3].status = "declined";       // Tiago out
  w.state.attendances[10].status = "confirmed";     // Cris in
  const after = w.ctx();
  const diff = rosterDiff(before.playing.map((p) => p.uuid), after.playing.map((p) => p.uuid));
  assert.deepEqual(diff, { out: ["p3"], in: ["p10"] });
  const adj = adjustTeams(teams, diff, new Map(before.players.map((p) => [p.uuid, p])), after.playing);
  assert.deepEqual(all(adj), after.playing.map((p) => p.id).sort((a, b) => a - b));
});

test("validation card: OVR with '?' under 3 ratings, team OVR, insights; lineup has nicks only", () => {
  const ctx = makeWorld().ctx();
  const { teams } = proposeTeams({ players: ctx.playing, rng: seeded(5) });
  const card = renderTeamsCard({ teams, players: ctx.playing, summaries: [], lang: "pt", confirmed: 10, spots: 10 });
  assert.match(card, /Jogo fechado \(10\/10\)/);
  assert.match(card, /— OVR \d+/);
  assert.match(card, /João \(GR\) \d+\?/);
  assert.match(card, /Diferença de OVR entre equipas: /);
  assert.match(card, /troca X com Y/);
  ctx.playing[1].ratingsCount = 3;
  assert.doesNotMatch(renderTeamsCard({ teams, players: ctx.playing, lang: "pt", confirmed: 10, spots: 10 }), new RegExp(`${ctx.playing[1].nick} \\d+\\?`));
  const lu = lineup(teams, ctx.playing);
  assert.deepEqual(Object.keys(lu[0]), ["name", "nicks"]);
  assert.ok(lu[0].nicks.every((n) => typeof n === "string"));
});
