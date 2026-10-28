import test from "node:test";
import assert from "node:assert/strict";
import { prepareBatch, cleanProposal, adjuntoContext, PROPOSALS, PROPOSAL_KINDS } from "./leagueAdjuntoActions.js";
import { redactPrivate } from "./leagueAdjuntoPrivacy.js";
import { emptyLeagueState, deriveLeague, normalizeLeagueState } from "./leagueDemo.js";
import { moduleOn } from "./leagueModules.js";

const batch = (items, state = emptyLeagueState()) => prepareBatch(state, items);

const BUILD = [
  { kind: "set_league_info", args: { name: "Liga Teste", city: "Espinho" } },
  { kind: "add_competition", args: { name: "1.ª Divisão", kind: "league", legs: 2 } },
  { kind: "add_team", args: { name: "Alfa FC", venue: "Campo A" } },
  { kind: "add_team", args: { name: "Beta Unidos", venue: "Campo B" } },
  { kind: "add_team", args: { name: "Gama Clube", venue: "Campo G" } },
  { kind: "add_players", args: { team: "alfa", players: [{ name: "Rui Silva", number: 1, position: "guarda-redes" }, { name: "Tiago Pinto", number: 9, position: "avançado" }, { name: "Nuno Lopes" }] } },
  { kind: "set_captain", args: { team: "Alfa FC", player: "tiago" } },
  { kind: "generate_fixtures", args: { competition: "1.ª Divisão", start_date: "2026-11-07", times: ["15:00", "18:00"] } },
];

test("a whole league can be built from one batch, in order", () => {
  const r = batch(BUILD);
  assert.equal(r.failed, 0, JSON.stringify(r.items.filter((i) => !i.ok)));
  assert.equal(r.applied, 8);
  assert.equal(r.state.data.teams.length, 3);
  assert.equal(r.state.data.competitions[0].teamIds.length, 3, "a single competition is the default for new teams");
  assert.equal(r.state.matches.length, 6);
  const alfa = r.state.data.players.filter((p) => p.teamId === r.state.data.teams[0].id);
  assert.equal(alfa.find((p) => p.captain).name, "Tiago Pinto");
  assert.equal(alfa.find((p) => p.name === "Rui Silva").position, "GR", "position words map to codes");
});

test("an item that cannot apply is reported and the rest still go", () => {
  const r = batch([{ kind: "add_team", args: { name: "Alfa FC" } }, { kind: "add_team", args: { name: "alfa fc" } }, { kind: "add_team", args: { name: "Beta" } }]);
  assert.deepEqual(r.items.map((i) => i.ok), [true, false, true]);
  assert.match(r.items[1].error, /Já existe/);
  assert.equal(r.state.data.teams.length, 2);
});

test("names are resolved in code: unknown and ambiguous references never guess", () => {
  const base = batch(BUILD.slice(0, 5)).state;
  const unknown = batch([{ kind: "add_players", args: { team: "Delta", players: [{ name: "X Y" }] } }], base);
  assert.match(unknown.items[0].error, /Não encontrei essa equipa/);
  const withTwo = batch([{ kind: "add_team", args: { name: "Alfa Norte" } }, { kind: "add_players", args: { team: "Alfa", players: [{ name: "X Y" }] } }], base);
  assert.match(withTwo.items[1].error, /mais de uma equipa/, "«Alfa» fits Alfa FC and Alfa Norte: ask, never guess");
});

test("rescheduling finds the right match, asks for the round when teams meet twice, refuses started games", () => {
  const s = batch(BUILD).state;
  const name = (id) => s.data.teams.find((t) => t.id === id).name;
  const m = s.matches[0];
  const ask = { home: name(m.homeId), away: name(m.awayId) };
  const twice = batch([{ kind: "reschedule_match", args: { ...ask, date: "2026-11-08", time: "16:30" } }], s);
  assert.match(twice.items[0].error, /mais de um jogo/, "two legs between the same teams ask for the round");
  const ok = batch([{ kind: "reschedule_match", args: { ...ask, round: m.round, date: "2026-11-08", time: "16:30", venue: "Campo Novo" } }], s);
  assert.equal(ok.failed, 0, JSON.stringify(ok.items));
  const moved = ok.state.matches.find((x) => x.id === m.id);
  assert.equal(moved.kickoff, "2026-11-08T16:30:00.000Z");
  assert.equal(moved.venue, "Campo Novo");
  const live = { ...s, matches: s.matches.map((x) => (x.id === m.id ? { ...x, state: "live" } : x)) };
  const started = batch([{ kind: "reschedule_match", args: { ...ask, round: m.round, date: "2026-12-01", time: "10:00" } }], live);
  assert.match(started.items[0].error, /ainda não começou/);
});

test("announcements and modules", () => {
  const r = batch([
    { kind: "post_announcement", args: { title: "Jornada adiada", body: "O jogo de sábado passa para domingo." } },
    { kind: "set_module", args: { module: "fairplay", on: true } },
    { kind: "set_module", args: { module: "nope", on: true } },
  ]);
  assert.equal(r.state.announcements[0].title, "Jornada adiada");
  assert.equal(moduleOn(r.state, "fairplay"), true);
  assert.equal(r.items[2].ok, false);
});

test("the batch is capped and unknown kinds are refused, not run", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ kind: "add_team", args: { name: `Equipa ${i + 100}` } }));
  assert.equal(batch(many).items.length, 60);
  assert.equal(batch([{ kind: "format_disk", args: {} }]).items[0].ok, false);
  assert.equal(cleanProposal("format_disk", {}), null);
  assert.deepEqual(cleanProposal("set_module", { module: "fairplay", on: "yes" }).args, { module: "fairplay", on: false });
});

test("every proposal is a valid tool for the model (≤ 20, object schemas, unique names)", () => {
  assert.ok(PROPOSAL_KINDS.length <= 12);
  for (const k of PROPOSAL_KINDS) { assert.equal(PROPOSALS[k].schema.type, "object"); assert.ok(PROPOSALS[k].description.length > 20); }
});

test("the context carries structure and counts, never athlete names", () => {
  const r = batch(BUILD);
  normalizeLeagueState(r.state); deriveLeague(r.state);
  const ctx = adjuntoContext(r.state, { now: Date.parse("2026-11-01") });
  const json = JSON.stringify(ctx);
  assert.ok(!/Rui Silva|Tiago Pinto/.test(json));
  assert.equal(ctx.teams.find((t) => t.name === "Alfa FC").athletes, 3);
  assert.equal(ctx.upcoming.length, 6);
  assert.ok(ctx.modulesOn.includes("adjunto"));
});

test("private data is masked before anything leaves the browser", () => {
  const raw = "10 Rui Silva rui@x.pt +351 912 345 678 licença nº AB12345 NIF 123456789 jogo 2026-11-07 às 15:00";
  const { text, removed } = redactPrivate(raw);
  assert.ok(!/rui@x|912|AB12345|123456789/.test(text), text);
  assert.match(text, /10 Rui Silva/);
  assert.match(text, /2026-11-07/);
  assert.match(text, /15:00/);
  assert.ok(removed >= 4);
  assert.equal(redactPrivate("camisola 7").removed, 0);
});
