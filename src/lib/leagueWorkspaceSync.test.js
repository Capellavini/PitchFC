import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceSync, SYNC_STATUS } from "./leagueWorkspaceSync.js";

const manual = () => {
  const queue = [];
  return { schedule: (fn, ms) => { const h = { fn, ms }; queue.push(h); return h; }, cancel: (h) => { const i = queue.indexOf(h); if (i >= 0) queue.splice(i, 1); }, queue };
};
const fakeApi = (script = []) => {
  const saved = [];
  return {
    saved,
    get: async () => ({ data: null }),
    save: async (state, v) => { saved.push({ state, v }); const step = script.shift(); return step || { data: { version: v + 1 } }; },
  };
};

test("a new account loads empty at version 0", async () => {
  const s = createWorkspaceSync({ api: fakeApi() });
  assert.deepEqual(await s.load(), { state: null, version: 0, slug: null, published: false });
});

test("load returns the server copy and its version", async () => {
  const api = { get: async () => ({ data: { version: 7, state: { a: 1 }, slug: "x", published: true } }), save: async () => ({ data: { version: 8 } }) };
  const s = createWorkspaceSync({ api });
  assert.deepEqual(await s.load(), { state: { a: 1 }, version: 7, slug: "x", published: true });
  assert.equal(s.version(), 7);
});

test("changes are debounced into one save, sent with the expected version", async () => {
  const m = manual(); const api = fakeApi(); const seen = [];
  const s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel, onStatus: (x) => seen.push(x) });
  s.change({ n: 1 }); s.change({ n: 2 }); s.change({ n: 3 });
  assert.equal(m.queue.length, 1);
  await m.queue[0].fn();
  assert.deepEqual(api.saved, [{ state: { n: 3 }, v: 0 }]);
  assert.equal(s.version(), 1);
  assert.equal(s.hasPending(), false);
  assert.deepEqual(seen, [SYNC_STATUS.SAVING, SYNC_STATUS.SAVED]);
});

test("a change made during a save is sent right after it", async () => {
  const m = manual(); let release; const gate = new Promise((r) => { release = r; });
  const saved = [];
  const api = { get: async () => ({ data: null }), save: async (state, v) => { saved.push({ state, v }); if (saved.length === 1) await gate; return { data: { version: v + 1 } }; } };
  const s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel });
  s.change({ n: 1 });
  const first = m.queue[0].fn();
  s.change({ n: 2 }); // arrives while the first save is in flight
  release(); await first;
  assert.equal(s.hasPending(), true);
  await m.queue[m.queue.length - 1].fn();
  assert.deepEqual(saved.map((x) => [x.state.n, x.v]), [[1, 0], [2, 1]]);
  assert.equal(s.hasPending(), false);
});

test("a version conflict stops saving and keeps the local copy", async () => {
  const m = manual(); const api = fakeApi([{ error: "version_conflict" }]);
  const s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel });
  s.change({ n: 1 });
  await m.queue[0].fn();
  assert.equal(s.status(), SYNC_STATUS.CONFLICT);
  assert.equal(s.hasPending(), true);
  s.change({ n: 2 });
  assert.equal(m.queue.length, 0, "no further automatic attempt after a conflict");
});

test("other errors retry with a growing delay and succeed later", async () => {
  const m = manual(); const api = fakeApi([{ error: "network" }, { error: "network" }]);
  const s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel });
  s.change({ n: 1 });
  await m.queue.shift().fn();
  assert.equal(s.status(), SYNC_STATUS.ERROR);
  assert.equal(m.queue[0].ms, 2000);
  await m.queue.shift().fn();
  assert.equal(m.queue[0].ms, 5000);
  await m.queue.shift().fn();
  assert.equal(s.status(), SYNC_STATUS.SAVED);
  assert.equal(s.hasPending(), false);
  assert.equal(api.saved.length, 3);
});

test("stop() ignores later changes", async () => {
  const m = manual(); const api = fakeApi();
  const s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel });
  s.stop(); s.change({ n: 1 });
  assert.equal(m.queue.length, 0);
  assert.equal(api.saved.length, 0);
});

test("refresh adopts a newer server copy only when nothing is waiting to be saved", async () => {
  let server = { version: 3, state: { n: "server" }, slug: "liga", published: true };
  const api = { get: async () => ({ data: server }), save: async (s, v) => ({ data: { version: v + 1 } }), version: async () => ({ data: server.version }) };
  const s = createWorkspaceSync({ api });
  await s.load();
  assert.equal(await s.refresh(), null, "same version: nothing to adopt");
  server = { version: 4, state: { n: "captain saved" }, slug: "liga", published: true };
  assert.deepEqual(await s.refresh(), { state: { n: "captain saved" }, version: 4, slug: "liga", published: true });
  assert.equal(s.version(), 4);
  server = { version: 5, state: { n: "again" }, slug: "liga", published: true };
  s.change({ n: "mine" });
  assert.equal(await s.refresh(), null, "unsaved local change is never replaced");
  assert.equal(s.version(), 4);
});

test("refresh gives up when the user edits while it is fetching, and without a version check", async () => {
  const m = manual();
  let s;
  const api = { get: async () => { s.change({ n: "typed meanwhile" }); return { data: { version: 9, state: { n: "x" } } }; }, save: async () => ({ data: { version: 10 } }), version: async () => ({ data: 9 }) };
  s = createWorkspaceSync({ api, schedule: m.schedule, cancel: m.cancel });
  assert.equal(await s.refresh(), null);
  assert.equal(s.version(), 0);
  const noApi = createWorkspaceSync({ api: { get: async () => ({ data: null }), save: async () => ({ data: { version: 1 } }) } });
  assert.equal(await noApi.refresh(), null);
});
