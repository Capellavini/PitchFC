import test from "node:test";
import assert from "node:assert/strict";
import { marketFromCountry, detectMarket, cachedMarket } from "./market.js";
import geo from "../../api/geo.js";

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const okFetch = (body) => async () => ({ ok: true, json: async () => body });

test("Brazil → BR; any other country → EU; garbage → null", () => {
  assert.equal(marketFromCountry("BR"), "BR");
  assert.equal(marketFromCountry("br"), "BR");
  assert.equal(marketFromCountry("PT"), "EU");
  assert.equal(marketFromCountry("DE"), "EU");
  assert.equal(marketFromCountry("US"), "EU");
  assert.equal(marketFromCountry(null), null);
  assert.equal(marketFromCountry(""), null);
  assert.equal(marketFromCountry("BRA"), null);
  assert.equal(marketFromCountry(42), null);
});

test("detectMarket reads the edge answer and caches it for the session", async () => {
  const storage = memStore();
  assert.equal(await detectMarket({ fetchImpl: okFetch({ country: "BR" }), storage }), "BR");
  assert.equal(cachedMarket(storage), "BR");
  // second call must not hit the network
  assert.equal(await detectMarket({ fetchImpl: async () => { throw new Error("no network expected"); }, storage }), "BR");
});

test("detectMarket never throws: failures resolve to null (page falls back to the UI language)", async () => {
  assert.equal(await detectMarket({ fetchImpl: async () => { throw new Error("offline"); }, storage: memStore() }), null);
  assert.equal(await detectMarket({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }), storage: memStore() }), null);
  assert.equal(await detectMarket({ fetchImpl: okFetch({ country: null }), storage: memStore() }), null);
  assert.equal(await detectMarket({ fetchImpl: undefined, storage: memStore() }), null);
});

test("an aborted/slow lookup resolves to null instead of hanging", async () => {
  const slow = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  assert.equal(await detectMarket({ fetchImpl: slow, timeoutMs: 20, storage: memStore() }), null);
});

test("api/geo only echoes a 2-letter country code, uncached", async () => {
  const call = async (h) => geo({ headers: new Headers(h) });
  const br = await call({ "x-vercel-ip-country": "br" });
  assert.deepEqual(await br.json(), { country: "BR" });
  assert.equal(br.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await (await call({ "x-vercel-ip-country": "PT" })).json(), { country: "PT" });
  assert.deepEqual(await (await call({})).json(), { country: null });
  assert.deepEqual(await (await call({ "x-vercel-ip-country": "<script>" })).json(), { country: null });
});
