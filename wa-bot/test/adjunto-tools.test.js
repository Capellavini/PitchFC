// Write tools only create proposals; actions.decide executes with the exact
// table/column/RPC payloads the app uses (fake store records them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runTool, TOOL_DEFS, WRITE_TOOLS } from "../src/adjunto/tools.js";
import { decide, gameStillValid } from "../src/adjunto/actions.js";
import { makeWorld, makeStore, makeEnv, ORG, GROUP_ID, GAME_ID, NOW } from "./adjunto-fakes.js";
import { defaultFormat } from "../src/core/format.js";

async function setup(worldOpts) {
  const world = makeWorld(worldOpts);
  const store = makeStore(world);
  const { env, posts } = makeEnv(world, store);
  const link = await store.upsertLink({ playerId: ORG, waJid: "351912345678@s.whatsapp.net", activeGroupId: GROUP_ID });
  const ctx = world.ctx();
  const me = ctx.players.find((p) => p.uuid === ORG);
  const tc = { env, link, me, lang: "pt", groupId: GROUP_ID, ctx: async () => world.ctx(), created: [] };
  const call = async (name, input) => { const r = await runTool(name, input, tc); return { ...r, json: JSON.parse(r.content) }; };
  const yes = async (id) => decide(env, { link, proposal: store.db.proposals.find((p) => p.id === id), decision: "yes", lang: "pt", ctx: world.ctx(), me });
  return { world, store, env, posts, link, call, yes, tc };
}

test("every tool schema is strict with all properties required", () => {
  for (const t of TOOL_DEFS) {
    const walk = (s) => {
      if (s?.type === "object") {
        assert.equal(s.additionalProperties, false, t.name);
        assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort(), t.name);
        Object.values(s.properties).forEach(walk);
      }
      if (s?.items) walk(s.items);
    };
    walk(t.input_schema);
    assert.equal(t.strict, true);
  }
});

test("write tools create a pending proposal and never write shared tables", async () => {
  const s = await setup();
  const inputs = {
    set_format: { ...defaultFormat("custom") },
    propose_teams: { num_teams: null }, send_group_reminder: { with_names: true, mention: true }, publish_open_spots: { extra_spots: 2 },
    set_spots: { spots: 12 }, change_game_time: { date: null, weekday: null, time: "21:30", this_week_only: true },
    change_venue: { venue: "Campo 2", this_week_only: true }, mark_paid: { players: ["Zé", "rui"], paid: true }, cancel_game: { reason: "chuva" },
  };
  delete inputs.set_format.v;
  for (const [name, input] of Object.entries(inputs)) {
    const r = await s.call(name, input);
    assert.equal(r.is_error, false, `${name}: ${r.content}`);
    assert.equal(r.json.status, "pending_confirmation", name);
  }
  assert.ok([...Object.keys(inputs)].every((n) => WRITE_TOOLS.has(n)));
  const shared = s.store.db.writes.filter((w) => !(w.op === "rpc adjunto_apply_teams" && w.p_confirm === false)); // a draft mirror of the card only
  assert.deepEqual(shared, []);
  assert.equal(s.world.state.game.teams_confirmed, false);
  assert.ok(s.store.db.proposals.every((p) => p.status === "pending" || p.status === "superseded"));
});

test("set_format → groups.game_format", async () => {
  const s = await setup();
  const f = defaultFormat("campeonato"); delete f.v;
  const { json } = await s.call("set_format", f);
  await s.yes(json.proposal_id);
  assert.equal(s.store.db.writes.at(-1).op, "update groups.game_format");
  assert.equal(s.store.db.writes.at(-1).format.type, "campeonato");
});

test("mark_paid → attendances.paid for the resolved player uuids", async () => {
  const s = await setup();
  const { json } = await s.call("mark_paid", { players: ["Zé", "rui"], paid: true });
  await s.yes(json.proposal_id);
  assert.deepEqual(s.store.db.writes.at(-1), { op: "update attendances.paid/paid_at", gameId: GAME_ID, playerIds: ["p-assist", "p2"], paid: true });
});

test("change_game_time → rpc adjunto_reschedule_game with CAS on scheduled_at + urgent 'rescheduled' group post", async () => {
  const s = await setup();
  const before = s.world.state.game.scheduled_at;
  const { json } = await s.call("change_game_time", { date: "2026-10-10", weekday: null, time: "21:30", this_week_only: false });
  const res = await s.yes(json.proposal_id);
  const w = s.store.db.writes.at(-1);
  assert.equal(w.op, "rpc adjunto_reschedule_game");
  assert.equal(w.scheduledAt, "2026-10-10T20:30:00.000Z"); // 21:30 Lisbon (UTC+1)
  assert.equal(w.thisWeekOnly, false);
  assert.equal(w.expectedScheduledAt, before);
  assert.equal(w.actor, ORG);
  assert.equal(s.posts.at(-1).ev.kind, "rescheduled");
  assert.equal(s.posts.at(-1).ev.urgent, true);
  assert.match(res.text, /Feito/);
});

test("cancel_game → games.status=cancelled; no group post (events.js announces it)", async () => {
  const s = await setup();
  const { json } = await s.call("cancel_game", { reason: null });
  await s.yes(json.proposal_id);
  assert.deepEqual(s.store.db.writes.at(-1), { op: "update games.status=cancelled", gameId: GAME_ID });
  assert.equal(s.posts.length, 0);
});

test("group reminder → adj_reminder post with pending nicks + the auto 24h reminder is suppressed", async () => {
  const s = await setup({ confirmed: 8 });
  const { json } = await s.call("send_group_reminder", { with_names: true, mention: true });
  await s.yes(json.proposal_id);
  const post = s.posts.find((p) => p.ev.kind === "adj_reminder");
  assert.deepEqual(post.ctx.pending, ["Nuno", "Pedro", "Cris", "Bruno"]);
  assert.equal(post.ev.key, `adj_reminder:${GAME_ID}:2026-10-05T16:00:00Z`);
  assert.ok(s.posts.some((p) => p.ev.kind === "suppress_reminder"));
});

test("open spots +2 → setSpots(12) + open_spots post with the avulso invite link", async () => {
  const s = await setup({ confirmed: 8 });
  const { json } = await s.call("publish_open_spots", { extra_spots: 2 });
  await s.yes(json.proposal_id);
  assert.deepEqual(s.store.db.writes.at(-1), { op: "update groups.max_players + games.spots", groupId: GROUP_ID, gameId: GAME_ID, n: 12 });
  assert.equal(s.posts.at(-1).ctx.inviteLink, "https://pitch-fc.com/?join=avu");
});

test("precondition failure: new weekly cycle or game no longer open → failed, nothing written", async () => {
  const s = await setup();
  const { json } = await s.call("set_spots", { spots: 12 });
  s.world.state.game.cycle_opened_at = "2026-10-12T16:00:00Z";
  const r = await s.yes(json.proposal_id);
  assert.match(r.text, /As coisas mudaram/);
  assert.equal(s.store.db.proposals.find((p) => p.id === json.proposal_id).status, "failed");
  assert.equal(s.store.db.writes.length, 0);
  assert.equal(gameStillValid({ game_id: GAME_ID, precondition: {} }, { ...s.world.state.game, status: "cancelled" }), false);
});

test("tool errors are returned as is_error (unknown player, bad input), never thrown", async () => {
  const s = await setup();
  assert.equal((await s.call("mark_paid", { players: ["Ninguém"], paid: true })).is_error, true);
  assert.equal((await s.call("set_spots", { spots: 99 })).is_error, true);
  assert.equal((await s.call("change_game_time", { date: null, weekday: null, time: "9pm", this_week_only: true })).is_error, true);
  assert.equal((await s.call("nope", {})).is_error, true);
});

test("read tools compute numbers in code", async () => {
  const s = await setup({ confirmed: 9 });
  const st = (await s.call("get_attendance_status", {})).json;
  assert.equal(st.confirmed, 9);
  assert.equal(st.spots, 10);
  assert.deepEqual(st.pending, ["Pedro", "Cris", "Bruno"]);
  const pay = (await s.call("get_payments", {})).json;
  assert.equal(pay.price_each_cents, 450);
  assert.equal(pay.price_each_eur, "4,50");
  const roster = (await s.call("get_roster", {})).json;
  assert.equal(roster.length, 12);
  assert.equal(roster[0].ovr_rated, false);
  const late = (await s.call("get_late_confirmers", { cycles: 6 })).json;
  assert.equal(late.insufficient_data, true);
  const fmt = (await s.call("get_format", {})).json;
  assert.equal(fmt.set, false);
  assert.ok(NOW);
});
