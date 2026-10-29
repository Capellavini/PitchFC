import test from "node:test";
import assert from "node:assert/strict";
import { loadExample, deriveLeague, emptyLeagueState } from "./leagueDemo.js";
import { SetupError } from "./leagueSetup.js";
import {
  landingRouteFromPath, legacyLandingSlug, leaguePagePath, leagueAppPath, leaguePageUrl,
  pageSettings, setPageSettings, INTRO_MAX,
  notices, postNotice, editNotice, removeNotice, currentRoundOf, landingModel, signupsCsv,
} from "./leagueLanding.js";

const code = (fn) => { try { fn(); } catch (e) { return e instanceof SetupError ? e.code : `other:${e.message}`; } return "no error"; };

test("the page lives at /leagues/<slug>, the full app one level down", () => {
  assert.equal(leaguePagePath("afpce"), "/leagues/afpce");
  assert.equal(leagueAppPath("afpce"), "/leagues/afpce/app");
  assert.equal(leaguePageUrl("afpce", "https://pitch-fc.com"), "https://pitch-fc.com/leagues/afpce");
  assert.deepEqual(landingRouteFromPath("/leagues/liga-do-porto"), { slug: "liga-do-porto", view: "page" });
  assert.deepEqual(landingRouteFromPath("/leagues/liga-do-porto/"), { slug: "liga-do-porto", view: "page" });
  assert.deepEqual(landingRouteFromPath("/leagues/liga-do-porto/app"), { slug: "liga-do-porto", view: "app" });
  for (const bad of ["/leagues", "/leagues/", "/leagues/Liga", "/leagues/a/b", "/leagues/a/app/x", "/league/a", "/leagues/-x", "/leagues/a_b"]) assert.equal(landingRouteFromPath(bad), null, bad);
});

test("the first address (/l/<slug>) is recognised, the invite page is not", () => {
  assert.equal(legacyLandingSlug("/l/afpce"), "afpce");
  assert.equal(legacyLandingSlug("/l/afpce/"), "afpce");
  assert.equal(legacyLandingSlug("/l/convite"), null);
  assert.equal(legacyLandingSlug("/l/convite/" + "a".repeat(40)), null);
  assert.equal(legacyLandingSlug("/leagues/afpce"), null);
});

test("page settings: everything on by default, only what the Gestor changes changes", () => {
  assert.deepEqual(pageSettings({}), { intro: "", signup: true, scorers: true, teams: true });
  assert.deepEqual(pageSettings(undefined), { intro: "", signup: true, scorers: true, teams: true });
  assert.deepEqual(pageSettings({ page: "lixo" }), { intro: "", signup: true, scorers: true, teams: true });
  const s0 = emptyLeagueState();
  const s1 = setPageSettings(s0, { intro: "  Bem-vindos à nossa liga.  ", signup: false });
  assert.deepEqual(pageSettings(s1.data.league), { intro: "Bem-vindos à nossa liga.", signup: false, scorers: true, teams: true });
  const s2 = setPageSettings(s1, { teams: false });
  assert.deepEqual(pageSettings(s2.data.league), { intro: "Bem-vindos à nossa liga.", signup: false, scorers: true, teams: false });
  assert.equal(s0.data.league.page, undefined, "the previous state is untouched");
  assert.equal(setPageSettings(s0, { intro: "x".repeat(INTRO_MAX + 50) }).data.league.page.intro.length, INTRO_MAX);
  assert.equal(s2.data.league.name, s0.data.league.name, "the rest of the league is kept");
});

test("notices: pinned first, then newest first", () => {
  let s = emptyLeagueState();
  s = postNotice(s, { title: "Primeiro", body: "a", at: "2026-10-01T10:00:00Z" });
  s = postNotice(s, { title: "Fixado", body: "b", pinned: true, at: "2026-09-01T10:00:00Z" });
  s = postNotice(s, { title: "Último", body: "c", at: "2026-10-20T10:00:00Z" });
  assert.deepEqual(notices(s).map((n) => n.title), ["Fixado", "Último", "Primeiro"]);
  assert.equal(notices(s)[0].pinned, true);
  assert.equal(notices(s)[1].pinned, undefined);
});

test("notices: posting needs a title and a text", () => {
  const s = emptyLeagueState();
  assert.equal(code(() => postNotice(s, { title: "A", body: "x" })), "title_required");
  assert.equal(code(() => postNotice(s, { title: "Aviso", body: "   " })), "body_required");
  const ok = postNotice(s, { title: "  Jornada   adiada ", body: " O jogo passa para domingo. " });
  assert.equal(ok.announcements[0].title, "Jornada adiada");
  assert.equal(ok.announcements[0].body, "O jogo passa para domingo.");
});

test("notices: editing keeps when it was published; pin and unpin; delete", () => {
  let s = postNotice(emptyLeagueState(), { title: "Aviso", body: "texto", at: "2026-10-01T10:00:00Z" });
  const id = s.announcements[0].id;
  s = editNotice(s, id, { title: "Aviso novo", body: "texto novo", pinned: true });
  assert.deepEqual({ t: s.announcements[0].title, b: s.announcements[0].body, p: s.announcements[0].pinned, at: s.announcements[0].at },
    { t: "Aviso novo", b: "texto novo", p: true, at: "2026-10-01T10:00:00Z" });
  s = editNotice(s, id, { pinned: false });
  assert.equal("pinned" in s.announcements[0], false);
  assert.equal(s.announcements[0].title, "Aviso novo", "unchanged fields stay");
  assert.equal(code(() => editNotice(s, "nope", { title: "Algo" })), "not_found");
  assert.equal(code(() => editNotice(s, id, { title: "A" })), "title_required");
  assert.equal(code(() => editNotice(s, id, { body: "" })), "body_required");
  s = removeNotice(s, id);
  assert.equal(s.announcements.length, 0);
  assert.equal(code(() => removeNotice(s, id)), "not_found");
});

test("current round: the first with a game still to be made official; the last when all are", () => {
  const m = (round, state) => ({ round, state });
  assert.equal(currentRoundOf([]), 0);
  assert.equal(currentRoundOf([m(1, "homologated"), m(2, "scheduled"), m(3, "scheduled")]), 2);
  assert.equal(currentRoundOf([m(1, "homologated"), m(2, "cancelled"), m(3, "walkover")]), 3);
  assert.equal(currentRoundOf([m(1, "ended_provisional"), m(2, "scheduled")]), 1);
});

test("the page model: rounds, official table, scorers and teams from the league", () => {
  const state = loadExample();
  const derived = deriveLeague(state);
  const model = landingModel(state, derived);
  assert.ok(model.competitions.length >= 1);
  const comp = model.competitions.find((c) => c.kind === "league");
  assert.ok(comp.rounds.length >= 2);
  assert.deepEqual(comp.rounds.map((r) => r.n), [...comp.rounds.map((r) => r.n)].sort((a, b) => a - b), "rounds in order");
  assert.ok(comp.currentRound >= 1);
  assert.ok(comp.table.length > 0 && comp.table[0].pts >= comp.table[comp.table.length - 1].pts);
  assert.ok(comp.scorers.length > 0 && comp.scorers[0].value >= comp.scorers[comp.scorers.length - 1].value);
  const played = comp.rounds.flatMap((r) => r.matches).find((x) => x.state === "homologated");
  assert.ok(played && played.score && Number.isInteger(played.score.home) && played.official);
  assert.ok(played.home?.name && played.away?.name);
  const scheduled = comp.rounds.flatMap((r) => r.matches).find((x) => x.state === "scheduled");
  assert.equal(scheduled.score, null, "a game not played has no score");
  assert.equal(model.teams.length, state.data.teams.length);
  assert.ok(model.teams.every((t) => typeof t.playerCount === "number"));
  assert.equal(model.empty, false);
  const cup = model.competitions.find((c) => c.kind === "cup");
  if (cup) assert.deepEqual(cup.table, [], "a cup has no table");
});

test("the page model: a league with nothing in it is empty, not broken", () => {
  const state = emptyLeagueState();
  const model = landingModel(state, deriveLeague(state));
  assert.equal(model.empty, true);
  assert.deepEqual(model.competitions, []);
  assert.deepEqual(model.live, []);
  assert.deepEqual(model.notices, []);
});

test("the page model: only the league's own notices, pinned first", () => {
  const state = postNotice(loadExample(), { title: "Importante", body: "Leiam.", pinned: true });
  const model = landingModel(state, deriveLeague(state));
  assert.equal(model.notices[0].title, "Importante");
  assert.ok(model.notices.length >= 3);
});

test("the sign-ups CSV keeps accents, quotes cells and never starts a cell with a formula", () => {
  const csv = signupsCsv([
    { name: 'João "Zé" Silva', email: "joao@x.pt", team_id: "t1", created_at: "2026-10-29T10:11:12Z" },
    { name: '=HYPERLINK("http://x")', email: "+a@x.pt", team_id: null, created_at: "2026-10-30T10:00:00Z" },
  ], { t1: "Marés FC" });
  const BOM = String.fromCharCode(0xFEFF);
  const lines = csv.replace(BOM, "").trim().split("\r\n");
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.equal(lines[0], '"Nome","Email","Equipa","Data"');
  assert.equal(lines[1], '"João ""Zé"" Silva","joao@x.pt","Marés FC","2026-10-29"');
  assert.ok(lines[2].startsWith(`"'=HYPERLINK`), lines[2]);
  assert.ok(lines[2].includes(`"'+a@x.pt"`), lines[2]);
  assert.equal(signupsCsv([]), BOM + '"Nome","Email","Equipa","Data"\r\n');
});
