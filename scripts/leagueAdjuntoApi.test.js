import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../api/league-adjunto.js';
import { validateAdjuntoRequest, adjuntoTools, modelMessages, parseAdjuntoReply } from '../src/lib/leagueAdjuntoRequest.js';

const env = { LEAGUE_COPILOT_ENABLED: 'true', ANTHROPIC_API_KEY: 'test', SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'anon' };
const ctx = { league: { name: 'Liga' }, competitions: [], teams: [] };
const body = (over = {}) => ({ messages: [{ role: 'user', text: 'Cria a equipa Alfa FC' }], context: ctx, ...over });
const request = (b = body()) => ({ method: 'POST', headers: { authorization: 'Bearer token' }, body: b });
const response = () => ({ setHeader() {}, status(n) { this.code = n; return this; }, json(x) { this.body = x; return this; } });
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]).toString('base64');
const PDF = Buffer.from('%PDF-1.4 test').toString('base64');

function fixture({ user = true, quota = true, quotaError = false, reply } = {}) {
  const calls = []; let params;
  const handler = createHandler({
    env,
    createSupabase: () => ({
      auth: { getUser: async () => ({ data: { user: user ? { id: 'u' } : null } }) },
      rpc: async (name) => { calls.push(name); if (name !== 'league_adjunto_take_slot') throw Error(name); return { data: quota, error: quotaError ? 'x' : null }; },
    }),
    createAnthropic: () => ({ messages: { create: async (p) => { calls.push('model'); params = p; return reply || { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Feito.' }, { type: 'tool_use', name: 'propose_add_team', input: { name: 'Alfa FC', venue: 'Campo A', competitions: [] } }] }; } } }),
  });
  return { handler, calls, params: () => params };
}

test('anonymous, wrong-method and disabled requests never reach the database or the model', async () => {
  const f = fixture();
  for (const req of [{ ...request(), method: 'GET' }, { ...request(), headers: {} }]) { const res = response(); await f.handler(req, res); assert.ok([401, 405].includes(res.code)); }
  const off = createHandler({ env: { ...env, LEAGUE_COPILOT_ENABLED: 'false' }, createSupabase() { throw Error('db'); } });
  const res = response(); await off(request(), res); assert.equal(res.code, 503); assert.equal(res.body.code, 'disabled');
  assert.deepEqual(f.calls, []);
});

test('invalid bodies are refused before any session or paid call', async () => {
  const f = fixture();
  for (const b of [{}, body({ messages: [] }), body({ messages: [{ role: 'assistant', text: 'x' }] }), body({ context: null }), body({ attachments: [{ kind: 'media', media_type: 'image/png', data: 'AAAA' }] }), body({ attachments: [{ kind: 'media', media_type: 'application/x-msdownload', data: PNG }] }), body({ attachments: Array(4).fill({ kind: 'text', name: 'a', text: 'x' }) })]) {
    const res = response(); await f.handler(request(b), res); assert.equal(res.code, 400, JSON.stringify(b).slice(0, 80));
  }
  assert.deepEqual(f.calls, []);
});

test('the daily cap and a database failure stop the paid call', async () => {
  for (const o of [{ quota: false }, { quotaError: true }]) { const f = fixture(o); const res = response(); await f.handler(request(), res); assert.ok([429, 503].includes(res.code)); assert.ok(!f.calls.includes('model')); }
  const f = fixture({ user: false }); const res = response(); await f.handler(request(), res); assert.equal(res.code, 401); assert.deepEqual(f.calls, []);
});

test('a proposal comes back cleaned and flagged for review; nothing is applied server-side', async () => {
  const f = fixture(); const res = response(); await f.handler(request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.reviewRequired, true);
  assert.deepEqual(res.body.proposals, [{ kind: 'add_team', args: { name: 'Alfa FC', venue: 'Campo A', competitions: [] } }]);
  assert.equal(res.body.text, 'Feito.');
  assert.deepEqual(f.calls, ['league_adjunto_take_slot', 'model']);
  assert.match(JSON.stringify(f.params().messages), /\\"today\\":\\"\d{4}-\d{2}-\d{2}\\"/);
});

test('private data in messages and documents is masked before the model sees it', async () => {
  const f = fixture(); const res = response();
  await f.handler(request(body({ messages: [{ role: 'user', text: 'O Rui (rui@x.pt, +351 912 345 678) é capitão' }], attachments: [{ kind: 'text', name: 'plantel.csv', text: '10;Rui Silva;GR;licença nº 99887766\n7;Tiago;AVA;123456789' }] })), res);
  assert.equal(res.code, 200);
  const sent = JSON.stringify(f.params().messages);
  assert.ok(!/rui@x|912 345|99887766|123456789/.test(sent), sent);
  assert.match(sent, /Rui Silva/);
  assert.ok(res.body.masked >= 4);
});

test('PDFs and images go to the model as document and image blocks, text as delimited data', () => {
  const r = validateAdjuntoRequest(body({ attachments: [{ kind: 'media', name: 'calendário.pdf', media_type: 'application/pdf', data: PDF }, { kind: 'media', name: 'foto.png', media_type: 'image/png', data: PNG }, { kind: 'text', name: 'a.csv', text: 'x;y' }] }));
  const content = modelMessages(r).at(-1).content;
  assert.deepEqual(content.map((b) => b.type), ['text', 'document', 'image', 'text', 'text']);
  assert.match(content[3].text, /^<documento nome="a.csv">/);
});

test('model output is untrusted: unknown tools and malformed inputs are dropped, kinds are capped', () => {
  const out = parseAdjuntoReply([
    { type: 'text', text: 'ok' },
    { type: 'tool_use', name: 'propose_drop_database', input: {} },
    { type: 'tool_use', name: 'delete_everything', input: {} },
    { type: 'tool_use', name: 'propose_set_module', input: { module: 'fairplay', on: 'true' } },
    { type: 'tool_use', name: 'open_screen', input: { screens: ['calendar', 'rm -rf', 'calendar'] } },
  ]);
  assert.deepEqual(out.proposals, [{ kind: 'set_module', args: { module: 'fairplay', on: false } }]);
  assert.deepEqual(out.open, ['calendar']);
  assert.ok(adjuntoTools().length <= 20);
  assert.ok(adjuntoTools().every((t) => /^[a-z_]+$/.test(t.name) && t.input_schema.type === 'object'));
});
