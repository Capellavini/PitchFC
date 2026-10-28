// POST /api/league-adjunto — the Adjunto's chat for a league: free sentences and
// documents in, proposals out. The model never writes anything: it returns
// proposals the Gestor confirms in the app (see src/lib/leagueAdjuntoActions.js).
// Auth is the caller's Supabase session; the daily cap is a database function.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { validateAdjuntoRequest, ADJUNTO_SYSTEM, adjuntoTools, modelMessages, parseAdjuntoReply } from '../src/lib/leagueAdjuntoRequest.js';

const deps = {
  env: process.env,
  createSupabase: (url, key, token) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }),
  createAnthropic: (key) => new Anthropic({ apiKey: key, timeout: 55000, maxRetries: 0 }),
};
const todayLisbon = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date());

export function createHandler(overrides = {}) {
  const d = { ...deps, ...overrides };
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const fail = (status, message, code) => res.status(status).json({ error: true, code, message });
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(405, 'Método não permitido.', 'method'); }
    const token = /^Bearer (\S+)$/.exec(req.headers?.authorization || '')?.[1];
    if (!token) return fail(401, 'Inicia sessão para falar com o Adjunto.', 'auth');
    if (d.env.LEAGUE_COPILOT_ENABLED !== 'true' || !d.env.ANTHROPIC_API_KEY) return fail(503, 'O Adjunto com IA ainda não está ativado. Continua pelas ferramentas.', 'disabled');
    const url = d.env.SUPABASE_URL || d.env.VITE_SUPABASE_URL;
    const key = d.env.SUPABASE_ANON_KEY || d.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return fail(503, 'A IA não está configurada.', 'disabled');
    let input;
    try { input = validateAdjuntoRequest(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); }
    catch { return fail(400, 'Pedido inválido. Confirma o tamanho da mensagem e dos documentos (JPG, PNG, WebP, PDF até 2,4 MB, ou texto).', 'invalid'); }
    try {
      // The client carries the caller's JWT throughout; there is no service-role bypass.
      const db = d.createSupabase(url, key, token);
      const auth = await db.auth.getUser(token);
      if (auth.error || !auth.data?.user) return fail(401, 'A sessão terminou. Inicia sessão novamente.', 'auth');
      const slot = await db.rpc('league_adjunto_take_slot');
      if (slot.error) return fail(503, 'A cota da IA não está disponível. Continua pelas ferramentas.', 'quota');
      if (slot.data !== true) return fail(429, 'Atingiste o limite diário do Adjunto. Amanhã há mais; hoje continua pelas ferramentas.', 'limit');
      const result = await d.createAnthropic(d.env.ANTHROPIC_API_KEY).messages.create({
        model: d.env.LEAGUE_ADJUNTO_MODEL || d.env.LEAGUE_COPILOT_MODEL || 'claude-sonnet-5-5',
        max_tokens: 8000,
        system: ADJUNTO_SYSTEM,
        tools: adjuntoTools(),
        tool_choice: { type: 'auto' },
        messages: modelMessages({ ...input, context: { ...input.context, today: todayLisbon() } }),
      });
      if (result.stop_reason === 'refusal') return fail(422, 'Não consigo ajudar com este pedido.', 'refusal');
      const reply = parseAdjuntoReply(result.content);
      if (!reply.text && !reply.proposals.length && !reply.open.length) return fail(422, 'Não percebi o pedido. Tenta dizê-lo de outra forma.', 'empty');
      return res.status(200).json({
        ...reply,
        truncated: result.stop_reason === 'max_tokens',
        masked: input.masked,
        reviewRequired: reply.proposals.length > 0,
      });
    } catch {
      return fail(503, 'A IA não respondeu. Nada foi alterado na liga. Podes continuar pelas ferramentas.', 'model');
    }
  };
}
export default createHandler();
