// In-memory fakes for the Treinador Adjunto tests: a store with the same
// function names as src/adjunto/store.js (recording every shared-table
// write), a group fixture, and an env like src/adjunto/index.js builds.
import { buildCtx } from "../src/adjunto/data.js";
import { Takeover } from "../src/adjunto/takeover.js";
import { DEFAULT_LIMITS } from "../src/adjunto/budget.js";

export const NOW = new Date("2026-10-09T18:00:00Z"); // Friday 19:00 Lisbon
export const GROUP_ID = "g-good";
export const GAME_ID = "game-1";
export const ORG = "p-org";      // organizer (João)
export const ASSIST = "p-assist";  // assistant

/** Seeded rng (mulberry32) so draws are reproducible. */
export function seeded(seed = 7) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const POS = ["Guarda-redes", "Defesa", "Defesa", "Médio", "Médio", "Médio", "Avançado", "Avançado", "Guarda-redes", "Avançado", "Defesa", "Médio"];
const NICKS = ["João", "Zé", "Rui", "Tiago", "Hugo", "Miguel", "André", "Vini", "Nuno", "Pedro", "Cris", "Bruno"];

export function makeWorld({ confirmed = 10, hoursToKickoff = 20, format = null, teams = null, spots = 10 } = {}) {
  const ids = NICKS.map((_, i) => (i === 0 ? ORG : i === 1 ? ASSIST : `p${i}`));
  const members = NICKS.map((nick, i) => ({
    player_id: ids[i], role: i === 0 ? "organizer" : i === 1 ? "assistant" : "member", player_type: "mensalista", banned: false,
    goals: i, assists: 1, mvps: 0, games_played: 5, wins: 2, clean_sheets: 0, epic_saves: 0,
    players: { id: ids[i], nick, name: nick, position: POS[i], attrs: { rit: 60 + i, rem: 60 + i, pas: 60 + i, dri: 60 + i, def: 60 + i, fis: 60 + i, div: 60 + i, man: 60 + i, kic: 60 + i, ref: 60 + i, spd: 60 + i, pos: 60 + i },
      phone: i === 0 ? "+351912345678" : `+3519100000${String(i).padStart(2, "0")}`, magic_token: `tok${i}`, injured: false },
  }));
  const ratings = []; // nobody has 3 ratings → every OVR shows "?"
  const state = {
    group: { id: GROUP_ID, name: "Goodweather F.C.", wa_bot_lang: "pt", adjunto_enabled: true, game_format: format, max_players: spots, invite_token: "inv", invite_token_avulso: "avu", venue: "Campo 1" },
    game: { id: GAME_ID, group_id: GROUP_ID, status: "open", scheduled_at: new Date(NOW.getTime() + hoursToKickoff * 36e5).toISOString(), created_at: new Date(NOW.getTime() - 5 * 864e5).toISOString(),
      cycle_opened_at: "2026-10-05T16:00:00Z", spots, venue: "Campo 1", teams, teams_confirmed: false, live_matchday: null, total_cost_cents: 4500 },
    members, ratings,
    attendances: ids.map((id, i) => ({ player_id: id, status: i < confirmed ? "confirmed" : "pending", paid: false, responded_at: new Date(NOW.getTime() - (20 - i) * 36e5).toISOString(), priority_locked: false })),
    matchdays: [],
  };
  const ctx = () => buildCtx({ group: state.group, game: state.game, members: state.members, ratings: state.ratings, attendances: state.attendances, matchdays: state.matchdays });
  return { state, ctx, ids };
}

const md5 = (v) => `md5:${JSON.stringify(v ?? null)}`;

export function makeStore(world, { orgRows = null } = {}) {
  const s = world.state;
  const db = { links: [], threads: new Map(), messages: [], proposals: [], usage: new Map(), dmReplies: [], codes: [], writes: [] };
  let pid = 0, lid = 0;
  const store = {
    db,
    async findLink({ jids = [], pn = null }) {
      return db.links.find((l) => jids.includes(l.wa_jid) || (l.wa_lid && jids.includes(l.wa_lid))) ?? (pn ? db.links.find((l) => l.wa_pn === pn) : null) ?? null;
    },
    async updateLink(id, fields) { const l = db.links.find((x) => x.id === id); Object.assign(l, fields); return l; },
    async upsertLink({ playerId, waJid, waLid, waPn, activeGroupId }) {
      db.links = db.links.filter((l) => !(l.wa_jid === waJid && l.player_id !== playerId));
      let l = db.links.find((x) => x.player_id === playerId);
      if (!l) { l = { id: `link${++lid}`, player_id: playerId, prefs: {}, lang: null, enabled: true }; db.links.push(l); }
      Object.assign(l, { wa_jid: waJid, wa_lid: waLid ?? null, wa_pn: waPn ?? null, active_group_id: activeGroupId ?? null, linked_at: NOW.toISOString() });
      return l;
    },
    async consumeCode(code, jid) {
      const c = db.codes.find((x) => x.code === code && !x.used_at && new Date(x.expires_at) > NOW);
      if (!c) return null;
      c.used_at = NOW.toISOString(); c.used_jid = jid; return c;
    },
    async countDmReplies(jid, kind) { return db.dmReplies.filter((r) => r.jid === jid && r.kind === kind).length; },
    async noteDmReply(jid, kind) { db.dmReplies.push({ jid, kind }); },
    async findOrganizerByPhone(digits) {
      if (orgRows) return orgRows(digits);
      return s.members.filter((m) => ["organizer", "assistant"].includes(m.role) && m.players.phone.replace(/\D/g, "") === digits)
        .map((m) => ({ player_id: m.player_id, group_id: GROUP_ID, group_name: s.group.name, role: m.role, nick: m.players.nick }));
    },
    async membership(playerId) { const m = s.members.find((x) => x.player_id === playerId); return m ? { role: m.role, banned: m.banned } : null; },
    async managedGroups(playerId) {
      const m = s.members.find((x) => x.player_id === playerId && ["organizer", "assistant"].includes(x.role));
      return m && s.group.adjunto_enabled ? [{ id: GROUP_ID, name: s.group.name, lang: s.group.wa_bot_lang, role: m.role }, ...(store.extraGroups ?? [])] : [];
    },
    async groupRow(id) { return id === GROUP_ID ? s.group : (store.extraGroups ?? []).find((g) => g.id === id) ?? null; },
    async playerRow(id) { const m = s.members.find((x) => x.player_id === id); return m ? { id, nick: m.players.nick, name: m.players.name, phone: m.players.phone } : null; },
    async activeLinks() { return db.links.filter((l) => l.enabled); },
    async getThread(linkId) { return db.threads.get(linkId) ?? { link_id: linkId, mode: "idle", step: null, draft: {}, version: -1 }; },
    async saveThread(th, { mode, step = null, draft = {} }) {
      const cur = db.threads.get(th.link_id);
      if ((cur?.version ?? -1) !== th.version) return false;
      db.threads.set(th.link_id, { link_id: th.link_id, mode, step, draft, version: th.version + 1 });
      return true;
    },
    async appendMessage(linkId, groupId, role, content) { db.messages.push({ link_id: linkId, role, content, created_at: NOW.toISOString() }); },
    async recentMessages(linkId, { limit = 12 } = {}) { return db.messages.filter((m) => m.link_id === linkId).slice(-limit); },
    async createProposal({ linkId, groupId, gameId = null, cycle = null, kind, payload, precondition = {}, expiresAt }) {
      db.proposals.filter((p) => p.link_id === linkId && p.kind === kind && p.status === "pending" && (p.game_id ?? null) === gameId).forEach((p) => { p.status = "superseded"; });
      const p = { id: ++pid, link_id: linkId, group_id: groupId, game_id: gameId, cycle, kind, payload: structuredClone(payload), precondition, status: "pending", expires_at: expiresAt, created_at: new Date(NOW.getTime() + pid).toISOString() };
      db.proposals.push(p); return p;
    },
    async pendingProposals(linkId) { return db.proposals.filter((p) => p.link_id === linkId && p.status === "pending").sort((a, b) => b.id - a.id); },
    async pendingForGame(gameId, kind) { return db.proposals.filter((p) => p.game_id === gameId && p.kind === kind && p.status === "pending"); },
    async updateProposal(id, fields) { const p = db.proposals.find((x) => x.id === id); Object.assign(p, structuredClone(fields)); return p; },
    async setProposalStatus(id, status, { decidedBy = null, error = null } = {}) {
      const p = db.proposals.find((x) => x.id === id);
      if (!p || p.status !== "pending") return null;
      Object.assign(p, { status, decided_by: decidedBy, error, decided_at: NOW.toISOString() }); return p;
    },
    async gameProposals(linkId, gameId) { return db.proposals.filter((p) => p.link_id === linkId && p.game_id === gameId).sort((a, b) => b.id - a.id); },
    async countProactiveSince() { return 0; },
    async getUsage(day, playerId) { return db.usage.get(`${day}|${playerId}`) ?? null; },
    async saveUsage(day, playerId, row) { db.usage.set(`${day}|${playerId}`, row); },
    async globalUsdMicros() { return store.globalMicros ?? 0; },
    async attendanceLog() { return []; },
    async teamsMd5() { return md5(s.game.teams); },
    async applyTeams({ gameId, teams, expectedMd5, actor, confirm }) {
      db.writes.push({ op: "rpc adjunto_apply_teams", p_game_id: gameId, p_teams: teams, p_expected_md5: expectedMd5, p_actor: actor, p_confirm: confirm });
      if (md5(s.game.teams) !== expectedMd5) return { ok: false, reason: "teams_changed", md5: md5(s.game.teams) };
      s.game.teams = structuredClone(teams); s.game.teams_confirmed = confirm; s.game.teams_confirmed_by = confirm ? actor : null;
      return { ok: true, md5: md5(teams) };
    },
    async setGameFormat(groupId, format) { db.writes.push({ op: "update groups.game_format", groupId, format }); s.group.game_format = format; },
    async setSpots(groupId, gameId, n) { db.writes.push({ op: "update groups.max_players + games.spots", groupId, gameId, n }); s.group.max_players = n; s.game.spots = n; },
    async setPaid(gameId, playerIds, paid) { db.writes.push({ op: "update attendances.paid/paid_at", gameId, playerIds, paid }); },
    async cancelGame(gameId) { db.writes.push({ op: "update games.status=cancelled", gameId }); s.game.status = "cancelled"; return true; },
    async rescheduleGame(args) { db.writes.push({ op: "rpc adjunto_reschedule_game", ...args }); s.game.scheduled_at = args.scheduledAt; return { ok: true }; },
  };
  return store;
}

export function makeEnv(world, store, { autosend = true, anthropic = null, lid = {}, cfg = {} } = {}) {
  const sent = [], posts = [], logs = [];
  const env = {
    store, loadGroupCtx: async () => world.ctx(),
    cfg: { adjuntoAutosend: autosend, adjuntoBurstMs: 0, appUrl: "https://pitch-fc.com", adjuntoLimits: DEFAULT_LIMITS, adjuntoWindowTurns: 12,
      adjuntoModel: "claude-sonnet-5-5", adjuntoEffort: "low", adjuntoMaxRounds: 6, adjuntoFallback: false, adjuntoDmDailyCap: 3, ...cfg },
    log: (...a) => logs.push(a.join(" ")), now: () => NOW, rng: seeded(3),
    sendDm: async (target, text) => { sent.push({ to: typeof target === "string" ? target : target.wa_jid, text }); },
    postGroup: async (group, gameId, ev, ctx) => { posts.push({ group: group.id, gameId, ev, ctx }); return "sent"; },
    claim: async () => "claim-id", markSent: async () => {}, unclaim: async () => {}, suppressAutoReminder: async () => { posts.push({ ev: { kind: "suppress_reminder" } }); },
    takeover: new Takeover({ now: () => NOW.getTime() }), anthropic,
    lidMapping: () => ({ getPNForLID: async (l) => lid[l] ?? null }), logMessage: async () => {},
  };
  return { env, sent, posts, logs };
}

/** A Baileys-like DM. */
export const dm = (text, { jid = "351912345678@s.whatsapp.net", alt, id = `m${Math.random()}`, fromMe = false } = {}) =>
  ({ key: { remoteJid: jid, ...(alt ? { remoteJidAlt: alt } : {}), id, fromMe }, message: { conversation: text } });
