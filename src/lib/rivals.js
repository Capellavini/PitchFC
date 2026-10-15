// ─────────────────────────────────────────────────────────
// PITCH Rivals — pure logic (no React, no Supabase, no storage).
//
// Shared by useTeams (cloud + local demo) and the Rivals UI. The demo
// operations at the bottom MIRROR the SECURITY DEFINER RPCs of
// supabase/migrations/20260101007000_rivals_teams.sql (same rules, same
// `rivals:<code>` error codes) so the demo behaves like production.
// Kept out of src/lib/core/ on purpose — the WhatsApp bot doesn't need it.
// ─────────────────────────────────────────────────────────

export const TEAM_FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "11v11"];
export const DEFAULT_FORMAT = "7v7";
export const INVITE_TTL_DAYS = 14;
export const MAX_TEAM_MEMBERS = 40;
export const MAX_CAPTAINED_TEAMS = 5;

// Markets — Portugal and Brazil from day one (owner, 2026-10-08).
export const MARKETS = {
  PT: { country: "PT", currency: "EUR", timezone: "Europe/Lisbon" },
  BR: { country: "BR", currency: "BRL", timezone: "America/Sao_Paulo" },
};
/** Default market from the UI language (pt-BR → Brazil, else Portugal). */
export const marketForLang = (lang) => (String(lang || "").toLowerCase() === "pt-br" ? MARKETS.BR : MARKETS.PT);

// Challenges (PR4+) — constants decided now so every layer agrees.
/** Default response deadline: min(now + 24h, kickoff − 2h) (owner, 2026-10-08). */
export const CHALLENGE_RESPONSE_HOURS = 24;
export const CHALLENGE_DEADLINE_BEFORE_KICKOFF_HOURS = 2;
export function challengeDeadline(kickoffIso, now = Date.now()) {
  const byResponse = now + CHALLENGE_RESPONSE_HOURS * 3600e3;
  const k = Date.parse(kickoffIso);
  const byKickoff = Number.isFinite(k) ? k - CHALLENGE_DEADLINE_BEFORE_KICKOFF_HOURS * 3600e3 : Infinity;
  return new Date(Math.min(byResponse, byKickoff)).toISOString();
}
/** Disputes we can't settle in-app → "Fala connosco" (the bot's WhatsApp). */
export const SUPPORT_WHATSAPP = "+351913813845";
export const supportWhatsAppUrl = (text = "") => `https://wa.me/351913813845${text ? `?text=${encodeURIComponent(text)}` : ""}`;

// ── Slugs + links ───────────────────────────────────────
const ACCENTS = "ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ";
const PLAIN = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn";
/** Mirrors public.team_slugify (SQL): ascii words joined by '-', ≤40 chars. */
export function slugify(name) {
  const tr = [...String(name || "")].map((ch) => {
    const i = ACCENTS.indexOf(ch);
    return i >= 0 ? PLAIN[i] : ch;
  }).join("");
  const s = tr.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/^-+|-+$/g, "");
  return s || "equipa";
}
/** First free slug: base, base-2, base-3 … (mirror of rivals_unique_slug). */
export function uniqueSlug(name, taken) {
  const base = slugify(name);
  const has = (s) => (taken instanceof Set ? taken.has(s) : (taken || []).includes(s));
  if (!has(base)) return base;
  for (let n = 2; ; n += 1) {
    const cand = `${base.slice(0, 35).replace(/-+$/, "")}-${n}`;
    if (!has(cand)) return cand;
  }
}

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
/** A pasted invite (raw token or any URL with ?tjoin=) / team link (?team=). */
export function parseTeamLink(raw) {
  const text = String(raw || "").trim();
  if (!text) return {};
  const tj = text.match(/[?&]tjoin=([A-Za-z0-9_-]+)/);
  if (tj) return { token: tj[1] };
  const tm = text.match(/[?&]team=([A-Za-z0-9-]+)/);
  if (tm) return { slug: tm[1].toLowerCase() };
  if (/^[A-Za-z0-9_]{16,64}$/.test(text)) return { token: text };
  return {};
}
/** The Rivals deep-link params of a URL search string. */
export function readRivalsParams(search = "") {
  const q = new URLSearchParams(search);
  const tjoin = (q.get("tjoin") || "").trim();
  const team = (q.get("team") || "").trim().toLowerCase();
  return {
    tjoin: TOKEN_RE.test(tjoin) ? tjoin : null,
    team: SLUG_RE.test(team) ? team : null,
    optIn: q.get("rivals") === "1",
  };
}
export const teamShareUrl = (slug, origin = "https://pitch-fc.com") => `${origin}/?team=${encodeURIComponent(slug || "")}`;
export const teamInviteUrl = (token, origin = "https://pitch-fc.com") => `${origin}/?tjoin=${encodeURIComponent(token || "")}`;

/** "rivals:invite_expired" (or an Error/PostgREST error carrying it) → "invite_expired". */
export function rivalsErrorCode(err) {
  const msg = typeof err === "string" ? err : err?.message || "";
  const m = msg.match(/rivals:([a-z_]+)/);
  if (m) return m[1];
  if (/permission denied|JWT|not authenticated/i.test(msg)) return "not_authenticated";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "network";
  return "unknown";
}

// ── Shapes (cloud snake_case → app camelCase; demo already camel) ──
export function normTeam(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, slug: r.slug,
    city: r.city ?? null, region: r.region ?? null, country: r.country || "PT",
    color: r.color || null, secondaryColor: r.secondary_color ?? r.secondaryColor ?? null,
    logoUrl: r.logo_url ?? r.logoUrl ?? null,
    format: r.preferred_format ?? r.format ?? DEFAULT_FORMAT,
    homeVenue: r.home_venue ?? r.homeVenue ?? null,
    timezone: r.timezone || "Europe/Lisbon", currency: r.currency || "EUR",
    listed: r.listed !== false,
    captainId: r.captain_id ?? r.captainId ?? null,
    createdAt: r.created_at ?? r.createdAt ?? null,
    archived: Boolean(r.archived_at ?? r.archivedAt ?? r.archived),
  };
}
export function normMember(r) {
  const p = r.players || {};
  return {
    playerId: r.player_id ?? r.playerId,
    role: r.role, status: r.status || "active",
    joinedAt: r.joined_at ?? r.joinedAt ?? null,
    nick: p.nick ?? r.nick ?? null, name: p.name ?? r.name ?? null,
    photoUrl: p.photo_url ?? r.photoUrl ?? null, position: p.position ?? r.position ?? null,
  };
}
/** list_teams item → directory card shape. */
export function normDirectoryItem(r) {
  return {
    ...normTeam(r),
    memberCount: Number(r.member_count ?? r.memberCount ?? 0),
    captain: r.captain ? { id: r.captain.id, nick: r.captain.nick, photoUrl: r.captain.photo_url ?? r.captain.photoUrl ?? null } : null,
    vice: r.vice ? { id: r.vice.id, nick: r.vice.nick, photoUrl: r.vice.photo_url ?? r.vice.photoUrl ?? null } : null,
    myRole: r.my_role ?? r.myRole ?? null,
    sameCity: Boolean(r.same_city ?? r.sameCity), sameRegion: Boolean(r.same_region ?? r.sameRegion),
    // list_teams items carry the real record {played,wins,draws,losses} + form (top-level)
    record: r.record ? normRecord(r.record, r.form) : emptyRecord(),
  };
}

// ── Roles + permissions (UI mirror of the RPC checks) ───
export const ROLE_ORDER = { captain: 0, vice: 1, player: 2 };
export const isLeader = (role) => role === "captain" || role === "vice";
export function sortRoster(members) {
  return [...(members || [])].sort((a, b) =>
    (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9)
    || String(a.nick || a.name || "").localeCompare(String(b.nick || b.name || ""), "pt"));
}
/** What `role` may do on the team page. targetRole for member actions. */
export function can(role, action, targetRole) {
  switch (action) {
    case "view": return Boolean(role);
    case "edit": case "invite": return isLeader(role);
    case "rename": case "hide": case "setVice": case "transfer": case "archive": return role === "captain";
    case "remove":
      if (!isLeader(role) || targetRole === "captain") return false;
      return targetRole === "vice" ? role === "captain" : true;
    case "leave": return Boolean(role);
    case "challenge": return isLeader(role); // wired in PR5
    default: return false;
  }
}

// ── Record (W-D-L) — derived from CONFIRMED matches only ──
// (server: team_record(); demo: rivalsResults.teamRecord()). Provisional
// scores, cancellations and "not played" never count as losses.
export const emptyRecord = () => ({
  played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, form: [],
  streak: { type: null, n: 0 }, biggestWin: null, cleanSheets: 0, cancellations: 0, lateCancellations: 0, notPlayed: 0,
});
/** team_record / team_profile.record (snake_case, `gf`/`ga`) or an app-shaped record → record. */
export function normRecord(r, formOverride) {
  if (!r) return emptyRecord();
  const gf = Number(r.gf ?? r.goals_for ?? r.goalsFor ?? 0);
  const ga = Number(r.ga ?? r.goals_against ?? r.goalsAgainst ?? 0);
  const form = Array.isArray(formOverride) ? formOverride : Array.isArray(r.form) ? r.form : [];
  const st = r.streak || {};
  const bw = r.biggest_win ?? r.biggestWin ?? null;
  return {
    played: Number(r.played || 0), wins: Number(r.wins || 0), draws: Number(r.draws || 0), losses: Number(r.losses || 0),
    goalsFor: gf, goalsAgainst: ga, goalDiff: Number(r.gd ?? r.goalDiff ?? gf - ga), form,
    streak: { type: st.type ?? null, n: Number(st.n || 0) },
    biggestWin: bw ? { opponent: bw.opponent ?? null, score: bw.score ?? null } : null,
    cleanSheets: Number(r.clean_sheets ?? r.cleanSheets ?? 0),
    cancellations: Number(r.cancellations || 0), lateCancellations: Number(r.late_cancellations ?? r.lateCancellations ?? 0),
    notPlayed: Number(r.not_played ?? r.notPlayed ?? 0),
  };
}
export const hasPlayed = (record) => Number(record?.played || 0) > 0;

// ── Invites ─────────────────────────────────────────────
export function inviteStatus(inv, now = Date.now()) {
  if (!inv) return "not_found";
  if (inv.archived) return "archived";
  if (inv.revokedAt) return "revoked";
  if (Date.parse(inv.expiresAt) <= now) return "expired";
  if (inv.maxUses != null && inv.uses >= inv.maxUses) return "used_up";
  return "valid";
}
export function inviteDaysLeft(inv, now = Date.now()) {
  const ms = Date.parse(inv?.expiresAt) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 864e5)) : 0;
}

// ── Visibility / navigation rules (plan §4) ─────────────
/** Rivals is visible when the flag is on, OR the user already has a team,
 *  OR arrived with a Rivals intent (?tjoin), OR opted in with ?rivals=1. */
export const rivalsVisible = ({ flagOn, teamCount = 0, hasIntent = false, optIn = false }) =>
  Boolean(flagOn || teamCount > 0 || hasIntent || optIn);
/** A logged-in player without a group skips the JoinGroup wall when they
 *  opted to explore, have a team, or carry a pending team invite. */
export const isNoGroup = ({ needsGroup, optIn = false, teamCount = 0, hasIntent = false }) =>
  Boolean(needsGroup && (optIn || teamCount > 0 || hasIntent));
/** Contextual opening tab. Team-only users land on Competir; group users
 *  keep the existing order (live matchday → my RSVP → home).
 *  EXTENSION POINT (PR7): team match today / unanswered team RSVP ≤48h /
 *  leader action → "competir" before "home". */
export function openingTab({ noGroup, teamCount = 0, matchdayLive = false, awaitingMyAnswer = false, teamAction = false, teamMatchToday = false }) {
  // Team-only users get the team-mode nav (decision 2026-10-13 c):
  // Matchday on team match day, otherwise the Equipa tab.
  if (noGroup) return teamCount > 0 ? (teamMatchToday ? "matchday" : "equipa") : "home";
  if (matchdayLive) return "matchday";
  if (awaitingMyAnswer) return "jogar";
  if (teamAction) return "competir";
  return "home";
}

/** Team-mode nav (decision 2026-10-13 c): a player with a team and no
 *  group gets Home · Jogar · Matchday · Equipa · Perfil. */
export const isTeamMode = ({ noGroup, teamCount = 0 }) => Boolean(noGroup && teamCount > 0);

/** Map the requested tab to the nav in use: "competir" ⇄ "equipa". */
export function resolveTab(tab, teamMode) {
  if (teamMode) return tab === "competir" ? "equipa" : tab;
  return tab === "equipa" ? "competir" : tab;
}

const dayKey = (ms, timezone) => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)); } catch { return new Date(ms).toISOString().slice(0, 10); }
};

/**
 * The next agreed match of any of MY teams, normalised — or null.
 * Defensive on purpose: team_matches arrive with the challenges PR
 * (useTeams.matches, snake_case rows or camelCase objects); until then
 * `matches` is undefined and every caller shows its empty state.
 * A match stays "next" until 3h after kickoff. isToday uses the team's
 * timezone; daysLeft counts calendar days.
 */
export function nextTeamMatch(matches, myTeams, now = Date.now()) {
  if (!Array.isArray(matches) || !matches.length || !myTeams?.length) return null;
  const mine = new Map(myTeams.map((tm) => [tm.id, tm]));
  const pick = (...v) => v.find((x) => x !== undefined && x !== null);
  const rows = [];
  for (const m of matches) {
    if (!m) continue;
    const status = pick(m.matchStatus, m.match_status, m.status, "scheduled");
    if (status !== "scheduled" && status !== "agreed") continue;
    const kickoff = Date.parse(pick(m.kickoffAt, m.kickoff_at, ""));
    if (!Number.isFinite(kickoff) || kickoff < now - 3 * 36e5) continue;
    const homeId = pick(m.homeTeamId, m.home_team_id, m.homeTeam?.id, m.home_team?.id);
    const awayId = pick(m.awayTeamId, m.away_team_id, m.awayTeam?.id, m.away_team?.id);
    const teamId = mine.has(homeId) ? homeId : mine.has(awayId) ? awayId : pick(m.myTeamId, m.my_team_id);
    const team = mine.get(teamId);
    if (!team) continue;
    const home = teamId === homeId;
    const opp = pick(m.opponent, home ? pick(m.awayTeam, m.away_team) : pick(m.homeTeam, m.home_team), null);
    const timezone = pick(m.timezone, team.timezone, "Europe/Lisbon");
    const today = dayKey(now, timezone);
    const day = dayKey(kickoff, timezone);
    rows.push({
      id: m.id, teamId, team, kickoffAt: new Date(kickoff).toISOString(), timezone,
      opponent: opp ? { id: opp.id ?? null, name: opp.name ?? null, color: opp.color ?? null, logoUrl: opp.logoUrl ?? opp.logo_url ?? null, slug: opp.slug ?? null } : (m.opponentName ? { name: m.opponentName } : null),
      venue: pick(m.venueName, m.venue_name, m.venue, null), format: pick(m.format, null),
      myRsvp: pick(m.myAvailability, m.my_availability, null),
      // PR7: what the team-mode screens need to act on the match.
      challengeId: pick(m.challengeId, m.challenge_id, null), myRole: team.role ?? null, match: m,
      kickoffPassed: kickoff <= now,
      isToday: day === today,
      daysLeft: Math.max(0, Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5)),
    });
  }
  rows.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  return rows[0] ?? null;
}

/** Home items for my teams (no match items until PR7): a welcome line
 *  for a team I joined/created in the last 7 days, and — for leaders of
 *  a small squad — a nudge to invite players. Newest first, ≤1 per team. */
export function teamFeedItems(myTeams, now = Date.now(), minSquad = 5) {
  const out = [];
  for (const tm of myTeams || []) {
    if (!tm || tm.archived) continue;
    const since = Date.parse(tm.since);
    const recent = Number.isFinite(since) && now - since < 7 * 864e5;
    if (isLeader(tm.role) && (tm.memberCount ?? 0) < minSquad) {
      out.push({ id: `team-invite-${tm.id}`, kind: "team_invite", teamId: tm.id, team: tm, ts: Number.isFinite(since) ? since : 0 });
    } else if (recent) {
      out.push({ id: `team-joined-${tm.id}`, kind: tm.role === "captain" ? "team_created" : "team_joined", teamId: tm.id, team: tm, ts: since });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

/** Kickoff label in the team's own timezone (Intl). */
export function formatKickoff(iso, { timezone = "Europe/Lisbon", locale = "pt-PT" } = {}) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: timezone });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  return `${date} · ${time}`;
}
/** "desde out 2026" style month label. */
export function sinceLabel(iso, locale = "pt-PT") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
}

// ── Directory (demo mirror of list_teams) ───────────────
const low = (s) => String(s || "").trim().toLowerCase();
export function listTeamsLocal(state, { country = "PT", region, city, format, query, onlyNear = false, limit = 30, offset = 0 } = {}, meId) {
  const q = low(query), rg = low(region), ct = low(city);
  const rows = (state.teams || []).filter((t) => t.listed !== false && !t.archived && (t.country || "PT") === country
    && (!format || t.format === format)
    && (!q || low(t.name).includes(q) || low(t.city).includes(q) || low(t.region).includes(q))
    && (!onlyNear || (rg ? low(t.region) === rg : ct ? low(t.city) === ct : true)));
  const active = (tid) => (state.members || []).filter((m) => m.teamId === tid && m.status === "active");
  const person = (m) => (m ? { id: m.playerId, nick: m.nick || (m.name || "").split(" ")[0], photoUrl: m.photoUrl || null } : null);
  const items = rows.map((t) => {
    const ms = active(t.id);
    return {
      ...t, memberCount: ms.length,
      captain: person(ms.find((m) => m.role === "captain")), vice: person(ms.find((m) => m.role === "vice")),
      myRole: ms.find((m) => m.playerId === meId)?.role ?? null,
      sameCity: Boolean(ct) && low(t.city) === ct, sameRegion: Boolean(rg) && low(t.region) === rg,
      record: emptyRecord(),
    };
  }).sort((a, b) => (b.sameCity - a.sameCity) || (b.sameRegion - a.sameRegion)
    || String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return { items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit };
}

// ── Local demo (mirror of the 007000 RPCs) ──────────────
const iso = (ms) => new Date(ms).toISOString();
const daysAgo = (n, now) => iso(now - n * 864e5);

/** Opponent teams (PT + BR) so the directory, ?team= pages and ?tjoin=
 *  have something to click through. The user builds their own team.
 *  DEMO_INVITE_TOKEN joins "Matosinhos United" (try ?tjoin=<it>). */
export const DEMO_INVITE_TOKEN = "demo7e4a1c0b9f2d4e6a8c1b3d5f7a9e0c2b";
export function demoSeed(now = Date.now()) {
  const team = (id, name, city, region, country, color, secondaryColor, format, venue, ago) => ({
    id, name, slug: slugify(name), city, region, country, color, secondaryColor, logoUrl: null, format,
    homeVenue: venue, timezone: MARKETS[country].timezone, currency: MARKETS[country].currency, listed: true,
    captainId: `${id}-p0`, createdAt: daysAgo(ago, now), updatedAt: daysAgo(ago, now), archived: false,
  });
  const teams = [
    team("demo-t-mu", "Matosinhos United", "Matosinhos", "Porto", "PT", "#4895FF", "#FFFFFF", "7v7", "Complexo do Leixões", 40),
    team("demo-t-pc", "Porto Casual", "Porto", "Porto", "PT", "#FF3B5C", "#0A0F18", "5v5", "Campo da Constituição", 30),
    team("demo-t-lm", "Laranja Mecânica", "Maia", "Porto", "PT", "#FF9F0A", "#0A0F18", "7v7", "Maia Soccer", 20),
    team("demo-t-lx", "Alfama Futebol Clube", "Lisboa", "Lisboa", "PT", "#00D08A", "#FFFFFF", "7v7", "Campo do Alto da Ajuda", 12),
    team("demo-t-sp", "Vila Madalena FC", "São Paulo", "SP", "BR", "#E8C547", "#1B3A8C", "7v7", "Arena Pinheiros", 9),
  ];
  const squad = (teamId, names) => names.map((nick, i) => ({
    teamId, playerId: `${teamId}-p${i}`, nick, name: nick, photoUrl: null,
    position: ["Guarda-redes", "Defesa", "Médio", "Avançado"][i % 4],
    role: i === 0 ? "captain" : i === 1 ? "vice" : "player", status: "active", joinedAt: daysAgo(40 - i, now), leftAt: null,
  }));
  const members = [
    ...squad("demo-t-mu", ["Rui", "Tiago", "Nuno", "Hugo", "Pedro", "Zé"]),
    ...squad("demo-t-pc", ["André", "Bruno", "Carlos", "Diogo", "Fábio"]),
    ...squad("demo-t-lm", ["Gonçalo", "Ivo", "João", "Luís", "Marco", "Rafa"]),
    ...squad("demo-t-lx", ["Miguel", "Duarte", "Simão", "Tomás"]),
    ...squad("demo-t-sp", ["Caio", "Thiago", "Lucas", "Mateus", "Gabriel"]),
  ];
  const invites = [{ teamId: "demo-t-mu", token: DEMO_INVITE_TOKEN, createdAt: daysAgo(1, now), expiresAt: iso(now + 13 * 864e5), revokedAt: null, maxUses: null, uses: 0 }];
  return { v: 1, teams, members, invites };
}

const ERR = (code) => ({ error: code });
const roleIn = (state, teamId, meId) => (state.members || []).find((m) => m.teamId === teamId && m.playerId === meId && m.status === "active")?.role ?? null;
const activeCount = (state, teamId) => (state.members || []).filter((m) => m.teamId === teamId && m.status === "active").length;
const findTeam = (state, teamId) => (state.teams || []).find((t) => t.id === teamId);
const setMembers = (state, fn) => ({ ...state, members: state.members.map(fn) });
const newToken = (n) => `demo${Math.abs(n).toString(16)}${Math.random().toString(16).slice(2, 14)}`.padEnd(32, "0").slice(0, 32);
const ALLOWED = ["name", "city", "region", "country", "listed", "color", "secondaryColor", "homeVenue", "format", "logoUrl", "timezone", "currency"];
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Same checks as rivals_validate_team_fields (subset that matters in UI). */
export function validateTeamFields(f = {}) {
  for (const k of Object.keys(f)) if (!ALLOWED.includes(k)) return "invalid_field";
  if ("name" in f) { const n = String(f.name || "").trim(); if (n.length < 2 || n.length > 40) return "invalid_name"; }
  if ((f.color && !HEX.test(f.color)) || (f.secondaryColor && !HEX.test(f.secondaryColor))) return "invalid_color";
  if (f.format && !TEAM_FORMATS.includes(f.format)) return "invalid_format";
  if (f.country && !MARKETS[f.country]) return "invalid_country";
  if (f.currency && !["EUR", "BRL"].includes(f.currency)) return "invalid_currency";
  if (String(f.city || "").length > 60 || String(f.region || "").length > 60 || String(f.homeVenue || "").length > 80) return "field_too_long";
  return null;
}

/**
 * Apply one Rivals operation to the demo state, exactly like the RPC.
 * Returns { state, data } or { error: code } (state untouched on error).
 * `me` = { id, nick, name, photo, position }.
 */
export function demoOp(state, op, args = {}, me, now = Date.now()) {
  const meId = me?.id;
  if (!meId) return ERR("not_authenticated");
  const role = (tid) => roleIn(state, tid, meId);
  switch (op) {
    case "create_team": {
      const name = String(args.name || "").trim();
      const fields = { ...args.fields, name };
      const bad = validateTeamFields(fields);
      if (bad) return ERR(bad);
      const dup = state.teams.find((t) => !t.archived && t.createdBy === meId && t.name.toLowerCase() === name.toLowerCase());
      if (dup) return { state, data: { teamId: dup.id, slug: dup.slug, created: false } };
      if (state.teams.filter((t) => !t.archived && t.captainId === meId).length >= MAX_CAPTAINED_TEAMS) return ERR("too_many_teams");
      const market = MARKETS[fields.country] || MARKETS.PT;
      const id = `demo-t-${now.toString(36)}${state.teams.length}`;
      const team = {
        id, name, slug: uniqueSlug(name, new Set(state.teams.map((t) => t.slug))),
        city: fields.city?.trim() || null, region: fields.region?.trim() || null, country: market.country,
        color: fields.color || "#C8FF00", secondaryColor: fields.secondaryColor || null, logoUrl: fields.logoUrl || null,
        format: fields.format || DEFAULT_FORMAT, homeVenue: fields.homeVenue?.trim() || null,
        timezone: fields.timezone || market.timezone, currency: fields.currency || market.currency,
        listed: fields.listed !== false, captainId: meId, createdBy: meId,
        createdAt: iso(now), updatedAt: iso(now), archived: false,
      };
      const member = { teamId: id, playerId: meId, nick: me.nick || me.name, name: me.name || me.nick, photoUrl: me.photo || null, position: me.position || null, role: "captain", status: "active", joinedAt: iso(now), leftAt: null };
      return { state: { ...state, teams: [...state.teams, team], members: [...state.members, member] }, data: { teamId: id, slug: team.slug, created: true } };
    }
    case "update_team": {
      const t = findTeam(state, args.teamId);
      if (!t) return ERR("team_not_found");
      if (t.archived) return ERR("team_archived");
      const r = role(t.id);
      if (!isLeader(r)) return ERR("not_team_leader");
      const f = args.fields || {};
      if (("name" in f || "listed" in f) && r !== "captain") return ERR("captain_only");
      const bad = validateTeamFields(f);
      if (bad) return ERR(bad);
      const patch = { ...f };
      if ("name" in f) patch.name = String(f.name).trim();
      return { state: { ...state, teams: state.teams.map((x) => (x.id === t.id ? { ...x, ...patch, updatedAt: iso(now) } : x)) }, data: { teamId: t.id, slug: t.slug } };
    }
    case "archive_team": {
      const t = findTeam(state, args.teamId);
      if (!t) return ERR("team_not_found");
      if (role(t.id) !== "captain") return ERR("captain_only");
      return { state: { ...state, teams: state.teams.map((x) => (x.id === t.id ? { ...x, archived: true } : x)), invites: state.invites.map((i) => (i.teamId === t.id && !i.revokedAt ? { ...i, revokedAt: iso(now) } : i)) }, data: { teamId: t.id } };
    }
    case "create_team_invite": {
      const t = findTeam(state, args.teamId);
      if (!t) return ERR("team_not_found");
      if (t.archived) return ERR("team_archived");
      if (!isLeader(role(t.id))) return ERR("not_team_leader");
      const live = state.invites.find((i) => i.teamId === t.id && !i.revokedAt);
      if (live && !args.rotate && inviteStatus(live, now) === "valid") return { state, data: live };
      const inv = { teamId: t.id, token: newToken(now), createdAt: iso(now), expiresAt: iso(now + (args.ttlDays || INVITE_TTL_DAYS) * 864e5), revokedAt: null, maxUses: args.maxUses ?? null, uses: 0 };
      const invites = state.invites.map((i) => (i === live ? { ...i, revokedAt: iso(now) } : i));
      return { state: { ...state, invites: [...invites, inv] }, data: inv };
    }
    case "revoke_team_invite": {
      const t = findTeam(state, args.teamId);
      if (!t) return ERR("team_not_found");
      if (!isLeader(role(t.id))) return ERR("not_team_leader");
      let n = 0;
      const invites = state.invites.map((i) => (i.teamId === t.id && !i.revokedAt ? (n += 1, { ...i, revokedAt: iso(now) }) : i));
      return { state: { ...state, invites }, data: { revoked: n } };
    }
    case "accept_team_invite": {
      const inv = state.invites.find((i) => i.token === args.token);
      if (!inv) return ERR("invite_not_found");
      const t = findTeam(state, inv.teamId);
      const mem = state.members.find((m) => m.teamId === t.id && m.playerId === meId);
      const out = { teamId: t.id, slug: t.slug, name: t.name };
      if (mem?.status === "active") return { state, data: { ...out, alreadyMember: true } };
      const st = inviteStatus({ ...inv, archived: t.archived }, now);
      if (st !== "valid") return ERR({ archived: "team_archived", revoked: "invite_revoked", expired: "invite_expired", used_up: "invite_used_up" }[st]);
      if (mem?.status === "removed" && Date.parse(mem.leftAt) >= Date.parse(inv.createdAt)) return ERR("removed_from_team");
      if (activeCount(state, t.id) >= MAX_TEAM_MEMBERS) return ERR("team_full");
      const row = { teamId: t.id, playerId: meId, nick: me.nick || me.name, name: me.name || me.nick, photoUrl: me.photo || null, position: me.position || null, role: "player", status: "active", joinedAt: iso(now), leftAt: null };
      const members = mem ? state.members.map((m) => (m === mem ? row : m)) : [...state.members, row];
      const invites = state.invites.map((i) => (i === inv ? { ...i, uses: i.uses + 1 } : i));
      return { state: { ...state, members, invites }, data: { ...out, alreadyMember: false } };
    }
    case "set_member_role": {
      const { teamId, playerId, role: to } = args;
      const t = findTeam(state, teamId);
      if (!["vice", "player"].includes(to)) return ERR("invalid_role");
      if (!t) return ERR("team_not_found");
      if (t.archived) return ERR("team_archived");
      if (role(teamId) !== "captain") return ERR("captain_only");
      const target = state.members.find((m) => m.teamId === teamId && m.playerId === playerId && m.status === "active");
      if (!target) return ERR("not_a_member");
      if (target.role === "captain") return ERR("use_transfer");
      if (target.role === to) return { state, data: { teamId, playerId, role: to, demoted: null } };
      let demoted = null;
      const next = setMembers(state, (m) => {
        if (m.teamId !== teamId || m.status !== "active") return m;
        if (m.playerId === playerId) return { ...m, role: to };
        if (to === "vice" && m.role === "vice") { demoted = m.playerId; return { ...m, role: "player" }; }
        return m;
      });
      return { state: next, data: { teamId, playerId, role: to, demoted } };
    }
    case "transfer_captaincy": {
      const { teamId, playerId } = args;
      const t = findTeam(state, teamId);
      if (!t) return ERR("team_not_found");
      if (t.archived) return ERR("team_archived");
      if (role(teamId) !== "captain") return ERR("captain_only");
      const target = state.members.find((m) => m.teamId === teamId && m.playerId === playerId && m.status === "active");
      if (!target || playerId === meId) return ERR("invalid_target");
      const viceFree = target.role === "vice" || !state.members.some((m) => m.teamId === teamId && m.status === "active" && m.role === "vice");
      const prev = viceFree ? "vice" : "player";
      const next = setMembers(state, (m) => {
        if (m.teamId !== teamId || m.status !== "active") return m;
        if (m.playerId === playerId) return { ...m, role: "captain" };
        if (m.playerId === meId) return { ...m, role: prev };
        return m;
      });
      return { state: { ...next, teams: next.teams.map((x) => (x.id === teamId ? { ...x, captainId: playerId } : x)) }, data: { teamId, captainId: playerId, previousCaptainRole: prev } };
    }
    case "remove_team_member": {
      const { teamId, playerId } = args;
      const t = findTeam(state, teamId);
      if (!t) return ERR("team_not_found");
      if (t.archived) return ERR("team_archived");
      const r = role(teamId);
      if (!isLeader(r)) return ERR("not_team_leader");
      if (playerId === meId) return ERR("use_leave");
      const target = state.members.find((m) => m.teamId === teamId && m.playerId === playerId && m.status === "active");
      if (!target) return ERR("not_a_member");
      if (target.role === "captain") return ERR("cannot_remove_captain");
      if (target.role === "vice" && r !== "captain") return ERR("captain_only");
      return { state: setMembers(state, (m) => (m === target ? { ...m, status: "removed", leftAt: iso(now) } : m)), data: { teamId, playerId } };
    }
    case "leave_team": {
      const t = findTeam(state, args.teamId);
      if (!t) return ERR("team_not_found");
      const mine = state.members.find((m) => m.teamId === t.id && m.playerId === meId && m.status === "active");
      if (!mine) return ERR("not_a_member");
      const others = activeCount(state, t.id) - 1;
      if (mine.role === "captain" && others > 0) return ERR("captain_must_transfer");
      const archive = others === 0 && !t.archived;
      let next = setMembers(state, (m) => (m === mine ? { ...m, status: "left", leftAt: iso(now) } : m));
      if (archive) next = { ...next, teams: next.teams.map((x) => (x.id === t.id ? { ...x, archived: true } : x)), invites: next.invites.map((i) => (i.teamId === t.id && !i.revokedAt ? { ...i, revokedAt: iso(now) } : i)) };
      return { state: next, data: { teamId: t.id, archived: archive } };
    }
    default:
      return ERR("unknown");
  }
}

/** Demo preview (mirror of team_invite_preview). */
export function demoInvitePreview(state, token, meId, now = Date.now()) {
  const inv = (state.invites || []).find((i) => i.token === token);
  if (!inv) return { status: "not_found" };
  const t = findTeam(state, inv.teamId);
  const inviter = (state.members || []).find((m) => m.teamId === t.id && m.role === "captain" && m.status === "active");
  return {
    status: inviteStatus({ ...inv, archived: t.archived }, now), expiresAt: inv.expiresAt,
    team: { ...t, memberCount: activeCount(state, t.id) },
    invitedBy: inviter?.nick || null,
    alreadyMember: Boolean(meId) && roleIn(state, t.id, meId) != null,
  };
}

// ── Milestones (PR9) ────────────────────────────────────
// Pure, derived from CONFIRMED numbers only (team_record / my_team_career) — nothing
// is stored. Cumulative ladders (games, wins, clean sheets, thrashing) never go
// back down; "live" ones (win streak, unbeaten run) describe the CURRENT run, since
// the server only keeps the current streak and the last five results.
export const GAMES_LADDER = [1, 5, 10, 25, 50, 100];
export const WINS_LADDER = [1, 5, 10, 25, 50];
export const CLEAN_LADDER = [1, 5, 10, 25];
export const WIN_STREAK_LADDER = [3, 5, 10];
export const UNBEATEN_RUN = 5; // the form window is the last five results
export const BIG_WIN_MARGIN = 4;
export const PLAYER_APPEARANCES_LADDER = [1, 5, 10, 25, 50];
export const PLAYER_GOALS_LADDER = [1, 5, 10, 25, 50];
export const PLAYER_ASSISTS_LADDER = [1, 5, 10, 25];

/** The highest rung of `ladder` that `value` has reached, or null. */
export const topRung = (ladder, value) => ladder.reduce((best, n) => (Number(value) >= n ? n : best), null);
/** The first rung above `value`, or null when the ladder is done. */
export const nextRung = (ladder, value) => ladder.find((n) => n > Number(value || 0)) ?? null;
/** "4-1" → margin 3 (0 when it can't be read). */
export function scoreMargin(score) {
  const m = String(score || "").match(/^(\d+)\D+(\d+)$/);
  return m ? Number(m[1]) - Number(m[2]) : 0;
}
/** Consecutive results without a loss, newest first, out of the form window. */
export function unbeatenRun(form = []) {
  const i = form.indexOf("L");
  return i < 0 ? form.length : i;
}

/**
 * The team's milestones: [{ id, kind, n, live }], the highest rung of each
 * ladder. kind: games | wins | clean | bigwin | streak | unbeaten. `record` is a
 * normRecord(). An empty record has none.
 */
export function teamMilestones(record) {
  const r = record || emptyRecord();
  const out = [];
  const add = (kind, n, live = false) => { if (n != null) out.push({ id: `${kind}_${n}`, kind, n, live }); };
  add("wins", topRung(WINS_LADDER, r.wins));
  add("games", topRung(GAMES_LADDER, r.played));
  add("clean", topRung(CLEAN_LADDER, r.cleanSheets));
  const margin = scoreMargin(r.biggestWin?.score);
  if (margin >= BIG_WIN_MARGIN) add("bigwin", margin);
  if (r.streak?.type === "W") add("streak", topRung(WIN_STREAK_LADDER, r.streak.n), true);
  if (unbeatenRun(r.form) >= UNBEATEN_RUN) add("unbeaten", UNBEATEN_RUN, true);
  return out;
}

/**
 * The closest cumulative milestone still to reach → { kind, n, have, left } or
 * null. Ties go to games, then wins, then clean sheets. A team with no games
 * is told about the first one.
 */
export function nextMilestone(record) {
  const r = record || emptyRecord();
  const ladders = [["games", GAMES_LADDER, r.played], ["wins", WINS_LADDER, r.wins], ["clean", CLEAN_LADDER, r.cleanSheets]];
  let best = null;
  for (const [kind, ladder, have] of ladders) {
    const n = nextRung(ladder, have);
    if (n == null) continue;
    const left = n - Number(have || 0);
    if (!best || left < best.left) best = { kind, n, have: Number(have || 0), left };
  }
  return best;
}

/** A player's milestones in one team (a my_team_career item): the highest rung of each ladder. */
export function playerMilestones(career) {
  const c = career || {};
  const out = [];
  const add = (kind, ladder, value) => { const n = topRung(ladder, value); if (n != null) out.push({ id: `p_${kind}_${n}`, kind, n, live: false }); };
  add("appearances", PLAYER_APPEARANCES_LADDER, c.appearances);
  add("goals", PLAYER_GOALS_LADDER, c.goals);
  add("assists", PLAYER_ASSISTS_LADDER, c.assists);
  return out;
}

/** My active teams in the demo (same shape as the cloud myTeams). */
export function demoMyTeams(state, meId) {
  return (state.members || [])
    .filter((m) => m.playerId === meId && m.status === "active")
    .map((m) => {
      const t = findTeam(state, m.teamId);
      return t && !t.archived ? { ...t, role: m.role, since: m.joinedAt, memberCount: activeCount(state, t.id), record: emptyRecord() } : null;
    })
    .filter(Boolean);
}
