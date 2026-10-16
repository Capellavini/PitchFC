// ─────────────────────────────────────────────────────────
// PITCH Ligas Fase 2 — pure helpers for the REAL league flows (L1–L3 +
// fans): routing of /league/<slug>, error codes, payload normalisers and a
// small local mirror of the RPC rules used when there is no Supabase
// client (local demo mode). The mirror follows the SQL in
// supabase/migrations/20261016155000…155500 (same error codes); it is NOT
// the /league/demo seed (src/lib/leagueDemo.js), which stays a separate,
// read-mostly showcase.
//
// No React, no Vite globals: imported by node --test (leagueCloud.test.js).
// ─────────────────────────────────────────────────────────

/** Path words that are app routes, never league slugs (mirrors league_unique_slug). */
export const RESERVED_LEAGUE_SLUGS = Object.freeze(["demo", "minhas", "me", "admin", "new", "nova", "convite", "inscricao", "pilot", "piloto"]);

/**
 * Parse a pathname under /league.
 *   /league                → { kind: "landing" }
 *   /league/demo           → { kind: "demo" }
 *   /league/minhas         → { kind: "hub" }
 *   /league/<slug>         → { kind: "league", slug }
 *   /league/<slug>/<comp>  → { kind: "competition", slug, competitionSlug }
 * Anything else (not under /league, or deeper paths) → null.
 */
export function parseLeaguePath(pathname) {
  const parts = String(pathname || "").replace(/\/+$/, "").split("/").filter(Boolean).map((p) => decodeURIComponent(p).toLowerCase());
  if (parts[0] !== "league") return null;
  if (parts.length === 1) return { kind: "landing" };
  if (parts.length === 2 && parts[1] === "demo") return { kind: "demo" };
  if (parts.length === 2 && (parts[1] === "minhas" || parts[1] === "me")) return { kind: "hub" };
  const slugOk = (s) => /^[a-z0-9][a-z0-9-]{0,59}$/.test(s);
  if (parts.length === 2 && slugOk(parts[1]) && !RESERVED_LEAGUE_SLUGS.includes(parts[1])) return { kind: "league", slug: parts[1] };
  if (parts.length === 3 && slugOk(parts[1]) && slugOk(parts[2]) && !RESERVED_LEAGUE_SLUGS.includes(parts[1])) {
    return { kind: "competition", slug: parts[1], competitionSlug: parts[2] };
  }
  return null;
}

export const leagueUrl = (slug, { competitionSlug = null, key = null, origin = "" } = {}) =>
  `${origin}/league/${slug}${competitionSlug ? `/${competitionSlug}` : ""}${key ? `?k=${key}` : ""}`;
export const leagueInviteUrl = (token, origin = "") => `${origin}/league/minhas?convite=${token}`;
export const registrationUrl = (token, origin = "") => `${origin}/league/minhas?inscricao=${token}`;

/** Supabase error → 'league:<code>' code (or rivals:/generic). */
export function leagueErrorCode(err) {
  const msg = typeof err === "string" ? err : err?.message || "";
  const m = msg.match(/league:([a-z_]+)/) || msg.match(/rivals:([a-z_]+)/);
  if (m) return m[1];
  if (/permission denied|JWT|not authenticated/i.test(msg)) return "not_authenticated";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "network";
  if (/does not exist|Could not find the function/i.test(msg)) return "not_deployed";
  return "unknown";
}

// ── Regulation defaults (mirror of league_validate_rules defaults) ──
export const DEFAULT_RULES = Object.freeze({
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["pts", "gd", "gf"],
  walkover: { home: 3, away: 0, loser_points: 0 },
  assists: "optional",
  homologation: { authority: ["owner", "manager"], team_leaders_can_score: false },
  dispute_window_hours: 48,
  squad: { min: 5, max: 25 },
  mvp: { official_by: ["referee", "manager"], fan_vote: false },
});
const ALLOWED_TIEBREAKERS = ["pts", "h2h", "gd", "gf", "wins", "ga_fewest"];
const RULE_KEYS = ["points", "tiebreakers", "walkover", "assists", "discipline", "homologation", "dispute_window_hours", "squad", "mvp"];

/** Client pre-validation of the subset the setup form edits. Server re-validates (league_validate_rules). */
export function validateRules(rules = {}) {
  for (const k of Object.keys(rules)) if (!RULE_KEYS.includes(k)) return { error: "unsupported_rule" };
  const tb = rules.tiebreakers ?? DEFAULT_RULES.tiebreakers;
  if (!Array.isArray(tb) || tb[0] !== "pts" || tb.some((x) => !ALLOWED_TIEBREAKERS.includes(x))
      || tb.indexOf("h2h") > 1 || new Set(tb).size !== tb.length) return { error: "unsupported_tiebreaker" };
  const sq = { ...DEFAULT_RULES.squad, ...(rules.squad || {}) };
  if (!(sq.min >= 1 && sq.max <= 60 && sq.min <= sq.max)) return { error: "invalid_rule" };
  const pts = { ...DEFAULT_RULES.points, ...(rules.points || {}) };
  if (!(pts.win >= 0 && pts.win <= 10 && pts.draw >= 0 && pts.draw <= 10 && pts.loss >= -5 && pts.loss <= 5)) return { error: "invalid_rule" };
  return { data: { ...DEFAULT_RULES, ...rules, squad: sq, points: pts, tiebreakers: tb } };
}

export const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "liga";

// ── Normalisers (cloud snake_case → camelCase) ──────────
export const normMyLeague = (r) => r && ({
  id: r.league_id ?? r.id, slug: r.slug, name: r.name, logoUrl: r.logo_url ?? null,
  status: r.status, visibility: r.visibility, roles: Array.isArray(r.roles) ? r.roles : [],
});
export const normRequest = (r) => r && ({
  id: r.id, orgName: r.org_name, city: r.city ?? null, country: r.country ?? "PT", expectedTeams: r.expected_teams ?? null,
  context: r.context ?? null, status: r.status, usedByLeagueId: r.used_by_league_id ?? null,
  requesterId: r.requester_player_id ?? null, requesterName: r.requester_name ?? null,
  requesterEmail: r.requester_email ?? null, requesterPhone: r.requester_phone ?? null, createdAt: r.created_at ?? null,
});
export function normLeaguePage(d) {
  if (!d) return null;
  return {
    id: d.id, slug: d.slug, name: d.name, shortName: d.short_name ?? null, description: d.description ?? null,
    logoUrl: d.logo_url ?? null, color: d.color ?? null, city: d.city ?? null, region: d.region ?? null, country: d.country ?? "PT",
    visibility: d.visibility, status: d.status,
    responsaveis: (d.responsaveis || []).map((x) => ({ name: x.name, role: x.role })),
    myRoles: Array.isArray(d.my_roles) ? d.my_roles : [],
    competitions: (d.competitions || []).map((c) => ({
      id: c.id, slug: c.slug, name: c.name, status: c.status, format: c.format ?? null, modality: c.modality ?? null,
      visibility: c.visibility ?? null, season: c.season ?? null, category: c.category ?? null,
    })),
    viewKey: d.view_key ?? null,
  };
}
export function normCompetitionPage(d) {
  if (!d) return null;
  return {
    id: d.id, slug: d.slug, name: d.name, status: d.status, structure: d.structure, modality: d.modality, format: d.format,
    matchDurationMin: d.match_duration_min ?? null, visibility: d.visibility,
    league: d.league ? { slug: d.league.slug, name: d.league.name, logoUrl: d.league.logo_url ?? null, color: d.league.color ?? null } : null,
    season: d.season?.name ?? null, category: d.category?.name ?? null, youth: Boolean(d.category?.youth),
    regulation: { version: d.regulation?.version ?? null, rules: d.regulation?.rules ?? null },
    isStaff: Boolean(d.is_staff), viewKey: d.view_key ?? null,
  };
}
export const normTeamsPage = (d) => ((d?.items) || []).map((x) => ({
  registrationId: x.registration_id,
  team: { id: x.team?.id, slug: x.team?.slug, name: x.team?.name, logoUrl: x.team?.logo_url ?? null, color: x.team?.color ?? null },
  squad: (x.squad || []).map((p) => ({ playerId: p.player_id, name: p.name, photoUrl: p.photo_url ?? null, position: p.position ?? null, shirtNumber: p.shirt_number ?? null })),
}));
export const normRegistrations = (d) => ({
  isManager: Boolean(d?.is_manager),
  items: (d?.items || []).map((r) => ({
    id: r.registration_id, teamId: r.team_id, teamName: r.team_name, status: r.status,
    homologatedVersion: r.homologated_squad_version ?? null, decisionNote: r.decision_note ?? null,
    versions: (r.versions || []).map((v) => ({
      version: v.version, status: v.status, decisionNote: v.decision_note ?? null,
      players: (v.players || []).map((p) => ({ playerId: p.player_id, name: p.name, shirtNumber: p.shirt_number ?? null })),
    })),
  })),
});
export const normFollowing = (d) => ({
  supporting: (d?.supporting || []).map((s) => ({ competitionId: s.competition_id, teamId: s.team_id })),
  follows: (d?.follows || []).map((f) => ({ entityType: f.entity_type, entityId: f.entity_id, notify: f.notify !== false })),
});
export const isLeagueManagerRole = (roles = []) => roles.includes("owner") || roles.includes("manager");

// ── Local mirror (no Supabase) ───────────────────────────
// State lives in localStorage (pitch.v2.leagueOrgDemo). Actor:
// { id, name, isAdmin }. Teams come from the Rivals demo (the hook passes
// { id, name, role, memberIds } for the actor's teams).
let seq = 0;
const uid = (p) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const token = () => Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

export function emptyLeagueOrgState() {
  return { v: 1, requests: [], leagues: [], members: [], invites: [], competitions: [], links: [], registrations: [], supporters: [], follows: [] };
}

const roleIn = (s, leagueId, pid, roles) => s.members.some((m) => m.leagueId === leagueId && m.playerId === pid && m.status === "active" && roles.includes(m.role));
const visibleLeague = (s, lg, actor) => lg && (actor?.isAdmin || roleIn(s, lg.id, actor?.id, ["owner", "manager", "scorer", "referee"])
  || (lg.status !== "draft" && lg.visibility !== "private"));
const visibleComp = (s, c, actor) => {
  const lg = s.leagues.find((l) => l.id === c?.leagueId);
  if (!c || !lg) return false;
  if (actor?.isAdmin || roleIn(s, lg.id, actor?.id, ["owner", "manager", "scorer", "referee"])) return true;
  return c.status !== "draft" && lg.status !== "draft" && (c.visibility || lg.visibility) === "public";
};

/** One mirrored RPC. Returns { state, data } | { error }. Never mutates `s`. */
export function leagueDemoOp(state, op, args = {}, actor = null, now = Date.now()) {
  const s = state && state.v === 1 ? state : emptyLeagueOrgState();
  const me = actor?.id;
  const need = () => (me ? null : { error: "not_authenticated" });
  const next = (patch, data) => ({ state: { ...s, ...patch }, data });
  switch (op) {
    case "request_league_access": {
      if (need()) return need();
      const open = s.requests.find((r) => r.requesterId === me && r.status === "pending");
      if (open) return { state: s, data: { requestId: open.id, status: "pending", created: false } };
      const orgName = String(args.orgName || "").trim();
      if (orgName.length < 2 || orgName.length > 80) return { error: "invalid_request" };
      const r = { id: uid("req"), requesterId: me, requesterName: actor.name || null, orgName, city: args.city || null, country: args.country || "PT",
        expectedTeams: args.expectedTeams ? Number(args.expectedTeams) : null, context: args.context || null, status: "pending", usedByLeagueId: null, createdAt: new Date(now).toISOString() };
      return next({ requests: [...s.requests, r] }, { requestId: r.id, status: "pending", created: true });
    }
    case "review_league_access": {
      if (!actor?.isAdmin) return { error: "admin_only" };
      const r = s.requests.find((x) => x.id === args.requestId);
      if (!r) return { error: "not_found" };
      if (r.status !== "pending") return { state: s, data: { requestId: r.id, status: r.status, alreadyReviewed: true } };
      const status = args.decision === "approve" ? "approved" : args.decision === "reject" ? "rejected" : null;
      if (!status) return { error: "invalid_decision" };
      return next({ requests: s.requests.map((x) => (x.id === r.id ? { ...x, status } : x)) }, { requestId: r.id, status });
    }
    case "create_league": {
      if (need()) return need();
      const name = String(args.name || "").trim();
      if (name.length < 2 || name.length > 80) return { error: "invalid_field" };
      const req = s.requests.find((x) => x.requesterId === me && x.status === "approved" && !x.usedByLeagueId);
      if (!req && !actor.isAdmin) return { error: "access_not_approved" };
      let slug = slugify(name); let n = 1; const base = slug;
      while (s.leagues.some((l) => l.slug === slug) || RESERVED_LEAGUE_SLUGS.includes(slug)) { n += 1; slug = `${base.slice(0, 35)}-${n}`; }
      const lg = { id: uid("lg"), slug, name, city: args.city || null, country: "PT", visibility: "private", status: "draft", viewKey: token(), color: "#C8FF00" };
      return next({
        leagues: [...s.leagues, lg],
        members: [...s.members, { id: uid("lm"), leagueId: lg.id, playerId: me, name: actor.name || null, role: "owner", status: "active", competitionId: null }],
        requests: req ? s.requests.map((x) => (x.id === req.id ? { ...x, usedByLeagueId: lg.id } : x)) : s.requests,
      }, { leagueId: lg.id, slug, created: true });
    }
    case "update_league": {
      const lg = s.leagues.find((l) => l.id === args.leagueId);
      if (!lg || !roleIn(s, lg.id, me, ["owner", "manager"])) return { error: "not_found" };
      const f = args.fields || {};
      if (("visibility" in f) && !roleIn(s, lg.id, me, ["owner"])) return { error: "owner_only" };
      if (f.visibility && !["public", "unlisted", "private"].includes(f.visibility)) return { error: "invalid_visibility" };
      return next({ leagues: s.leagues.map((l) => (l.id === lg.id ? { ...l, ...f } : l)) }, { leagueId: lg.id });
    }
    case "set_league_status": {
      const lg = s.leagues.find((l) => l.id === args.leagueId);
      if (!lg || !roleIn(s, lg.id, me, ["owner", "manager"])) return { error: "not_found" };
      if (!roleIn(s, lg.id, me, ["owner"])) return { error: "owner_only" };
      return next({ leagues: s.leagues.map((l) => (l.id === lg.id ? { ...l, status: args.status } : l)) }, { status: args.status });
    }
    case "create_league_invite": {
      const lg = s.leagues.find((l) => l.id === args.leagueId);
      if (!lg || !roleIn(s, lg.id, me, ["owner", "manager"])) return { error: "not_found" };
      if (!["manager", "scorer", "referee"].includes(args.role)) return { error: "invalid_role" };
      if (args.role === "manager" && !roleIn(s, lg.id, me, ["owner"])) return { error: "owner_only" };
      const inv = { token: token(), leagueId: lg.id, role: args.role, expiresAt: new Date(now + 7 * 864e5).toISOString(), acceptedBy: null };
      return next({ invites: [...s.invites, inv] }, { token: inv.token, role: inv.role, expiresAt: inv.expiresAt });
    }
    case "league_invite_preview": {
      const inv = s.invites.find((i) => i.token === args.token);
      if (!inv) return { state: s, data: { status: "not_found" } };
      const lg = s.leagues.find((l) => l.id === inv.leagueId);
      const status = inv.acceptedBy ? "used" : Date.parse(inv.expiresAt) <= now ? "expired" : "valid";
      return { state: s, data: { status, role: inv.role, league: { name: lg?.name, slug: lg?.slug } } };
    }
    case "accept_league_invite": {
      if (need()) return need();
      const inv = s.invites.find((i) => i.token === args.token);
      if (!inv) return { error: "invite_not_found" };
      if (inv.acceptedBy === me) return { state: s, data: { role: inv.role, alreadyMember: true, slug: s.leagues.find((l) => l.id === inv.leagueId)?.slug } };
      if (inv.acceptedBy) return { error: "invite_used" };
      if (Date.parse(inv.expiresAt) <= now) return { error: "invite_expired" };
      const lg = s.leagues.find((l) => l.id === inv.leagueId);
      return next({
        invites: s.invites.map((i) => (i.token === inv.token ? { ...i, acceptedBy: me } : i)),
        members: [...s.members, { id: uid("lm"), leagueId: inv.leagueId, playerId: me, name: actor.name || null, role: inv.role, status: "active", competitionId: null }],
      }, { role: inv.role, leagueId: inv.leagueId, slug: lg?.slug, alreadyMember: false });
    }
    case "my_leagues": {
      const items = s.leagues.filter((l) => roleIn(s, l.id, me, ["owner", "manager", "scorer", "referee"])).map((l) => ({
        id: l.id, slug: l.slug, name: l.name, logoUrl: null, status: l.status, visibility: l.visibility,
        roles: [...new Set(s.members.filter((m) => m.leagueId === l.id && m.playerId === me && m.status === "active").map((m) => m.role))],
      }));
      return { state: s, data: { items } };
    }
    case "league_page": {
      const lg = s.leagues.find((l) => l.slug === String(args.slug || "").toLowerCase());
      const staff = lg && (actor?.isAdmin || roleIn(s, lg.id, me, ["owner", "manager", "scorer", "referee"]));
      const keyed = lg && args.key && args.key === lg.viewKey;
      if (!lg || (!staff && (lg.status === "draft" || (lg.visibility === "private" && !keyed)))) return { state: s, data: null };
      const myRoles = [...new Set(s.members.filter((m) => m.leagueId === lg.id && m.playerId === me && m.status === "active").map((m) => m.role))];
      return { state: s, data: {
        id: lg.id, slug: lg.slug, name: lg.name, city: lg.city, country: lg.country, visibility: lg.visibility, status: lg.status, color: lg.color,
        responsaveis: s.members.filter((m) => m.leagueId === lg.id && m.status === "active" && ["owner", "manager"].includes(m.role)).map((m) => ({ name: m.name || "—", role: m.role })),
        myRoles,
        competitions: s.competitions.filter((c) => c.leagueId === lg.id && (staff || (c.status !== "draft" && ((c.visibility || lg.visibility) === "public" || keyed))))
          .map((c) => ({ id: c.id, slug: c.slug, name: c.name, status: c.status, format: c.format, modality: c.modality, visibility: c.visibility || lg.visibility, season: c.season, category: c.category })),
        viewKey: myRoles.some((r) => r === "owner" || r === "manager") ? lg.viewKey : null,
      } };
    }
    case "create_competition": {
      const lg = s.leagues.find((l) => l.id === args.leagueId);
      if (!lg || !roleIn(s, lg.id, me, ["owner", "manager"])) return { error: "not_found" };
      const f = args.fields || {};
      if ((f.structure || "league") !== "league") return { error: "structure_not_available" };
      const v = validateRules(args.rules || {});
      if (v.error) return v;
      const name = String(f.name || "").trim();
      if (name.length < 2) return { error: "invalid_field" };
      let slug = slugify(name); let n = 1; const base = slug;
      while (s.competitions.some((c) => c.leagueId === lg.id && c.slug === slug)) { n += 1; slug = `${base.slice(0, 35)}-${n}`; }
      const c = { id: uid("cp"), leagueId: lg.id, slug, name, status: "draft", format: f.format || "7v7", modality: f.modality || "futebol",
        season: f.season || null, category: f.category || null, visibility: null, youth: Boolean(f.youth),
        regulations: [{ version: 1, rules: v.data, status: "draft" }], currentVersion: null };
      return next({ competitions: [...s.competitions, c] }, { competitionId: c.id, slug, created: true, regulationVersion: 1 });
    }
    case "publish_regulation": {
      const c = s.competitions.find((x) => x.id === args.competitionId);
      if (!c || !roleIn(s, c.leagueId, me, ["owner", "manager"])) return { error: "not_found" };
      const reg = c.regulations.find((r) => r.version === args.version && r.status === "draft");
      if (!reg) return { error: "no_such_draft" };
      if (args.version > 1 && !String(args.reason || "").trim()) return { error: "reason_required" };
      const upd = { ...c, currentVersion: args.version, regulations: c.regulations.map((r) => (r.version === args.version ? { ...r, status: "published" } : r)) };
      return next({ competitions: s.competitions.map((x) => (x.id === c.id ? upd : x)) }, { version: args.version });
    }
    case "set_competition_status": {
      const c = s.competitions.find((x) => x.id === args.competitionId);
      if (!c || !roleIn(s, c.leagueId, me, ["owner", "manager"])) return { error: "not_found" };
      const ok = [["draft", "registration_open"], ["registration_open", "registration_closed"], ["registration_closed", "registration_open"],
        ["registration_closed", "in_progress"], ["in_progress", "finished"], ["finished", "archived"], ["draft", "archived"]]
        .some(([a, b]) => a === c.status && b === args.status);
      if (c.status === args.status) return { state: s, data: { status: c.status, unchanged: true } };
      if (!ok) return { error: "invalid_transition" };
      if (args.status === "registration_open" && !c.currentVersion) return { error: "regulation_not_published" };
      return next({
        competitions: s.competitions.map((x) => (x.id === c.id ? { ...x, status: args.status } : x)),
        leagues: args.status === "registration_open" ? s.leagues.map((l) => (l.id === c.leagueId && l.status === "draft" ? { ...l, status: "active" } : l)) : s.leagues,
      }, { status: args.status });
    }
    case "competition_page": {
      const lg = s.leagues.find((l) => l.slug === args.leagueSlug);
      const c = lg && s.competitions.find((x) => x.leagueId === lg.id && x.slug === args.competitionSlug);
      const keyed = lg && args.key && args.key === lg.viewKey;
      if (!c || !(visibleComp(s, c, actor) || (keyed && c.status !== "draft"))) return { state: s, data: null };
      const staff = actor?.isAdmin || roleIn(s, lg.id, me, ["owner", "manager", "scorer", "referee"]);
      const reg = c.regulations.find((r) => r.version === c.currentVersion);
      return { state: s, data: {
        id: c.id, slug: c.slug, name: c.name, status: c.status, structure: "league", modality: c.modality, format: c.format, visibility: c.visibility || lg.visibility,
        league: { slug: lg.slug, name: lg.name, color: lg.color }, season: c.season ? { name: c.season } : null, category: c.category ? { name: c.category, youth: c.youth } : null,
        regulation: { version: c.currentVersion, rules: reg?.rules ?? null }, is_staff: Boolean(staff),
        draft_version: c.regulations.find((r) => r.status === "draft")?.version ?? null,
      } };
    }
    case "create_registration_link": {
      const c = s.competitions.find((x) => x.id === args.competitionId);
      if (!c || !roleIn(s, c.leagueId, me, ["owner", "manager"])) return { error: "not_found" };
      const l = { token: token(), competitionId: c.id, teamId: args.teamId || null, expiresAt: new Date(now + 30 * 864e5).toISOString() };
      return next({ links: [...s.links, l] }, { token: l.token, expiresAt: l.expiresAt });
    }
    case "registration_link_preview": {
      const l = s.links.find((x) => x.token === args.token);
      if (!l) return { state: s, data: { status: "not_found" } };
      const c = s.competitions.find((x) => x.id === l.competitionId); const lg = s.leagues.find((x) => x.id === c?.leagueId);
      const status = Date.parse(l.expiresAt) <= now ? "expired" : c.status !== "registration_open" ? "closed" : "valid";
      return { state: s, data: { status, competition: { id: c.id, name: c.name, slug: c.slug, format: c.format }, league: { name: lg?.name, slug: lg?.slug } } };
    }
    case "register_team": {
      if (need()) return need();
      const l = s.links.find((x) => x.token === args.token);
      if (!l) return { error: "link_not_found" };
      const c = s.competitions.find((x) => x.id === l.competitionId);
      if (c.status !== "registration_open") return { error: "registration_closed" };
      const team = args.team;
      if (!team || !["captain", "vice"].includes(team.role)) return { error: "not_team_leader" };
      if (l.teamId && l.teamId !== team.id) return { error: "link_for_other_team" };
      const ex = s.registrations.find((r) => r.competitionId === c.id && r.teamId === team.id && r.status !== "withdrawn");
      if (ex) return { state: s, data: { registrationId: ex.id, status: ex.status, created: false } };
      const r = { id: uid("reg"), competitionId: c.id, teamId: team.id, teamName: team.name, status: "draft", versions: [], homologatedVersion: null };
      return next({ registrations: [...s.registrations, r] }, { registrationId: r.id, status: r.status, created: true });
    }
    case "submit_squad": {
      const r = s.registrations.find((x) => x.id === args.registrationId);
      if (!r) return { error: "not_found" };
      const team = args.team;
      if (!team || team.id !== r.teamId || !["captain", "vice"].includes(team.role)) return { error: "not_found" };
      const players = args.players || [];
      const c = s.competitions.find((x) => x.id === r.competitionId);
      const rules = c.regulations.find((g) => g.version === c.currentVersion)?.rules || DEFAULT_RULES;
      if (players.some((p) => !(team.memberIds || []).includes(p.playerId))) return { error: "not_team_member" };
      if (players.length < rules.squad.min || players.length > rules.squad.max) return { error: "squad_size" };
      const version = r.versions.length + 1;
      const upd = { ...r, status: r.homologatedVersion ? r.status : "submitted",
        versions: [...r.versions.map((v) => (v.status === "submitted" ? { ...v, status: "superseded" } : v)), { version, status: "submitted", players: players.map((p) => ({ ...p })) }] };
      return next({ registrations: s.registrations.map((x) => (x.id === r.id ? upd : x)) }, { version, status: "submitted" });
    }
    case "decide_squad": {
      const r = s.registrations.find((x) => x.id === args.registrationId);
      const c = r && s.competitions.find((x) => x.id === r.competitionId);
      if (!c || !roleIn(s, c.leagueId, me, ["owner", "manager"])) return { error: "not_found" };
      const v = r.versions.find((x) => x.version === args.version && x.status === "submitted");
      if (!["approve", "reject"].includes(args.decision)) return { error: "invalid_decision" };
      if (!v) return { error: "stale_version" };
      const approve = args.decision === "approve";
      if (approve) {
        const taken = new Set(s.registrations.filter((x) => x.competitionId === r.competitionId && x.id !== r.id && x.homologatedVersion)
          .flatMap((x) => x.versions.find((y) => y.version === x.homologatedVersion)?.players.map((p) => p.playerId) || []));
        if (v.players.some((p) => taken.has(p.playerId))) return { error: "player_in_other_squad" };
      }
      const upd = { ...r, status: approve ? "homologated" : (r.homologatedVersion ? r.status : "rejected"), homologatedVersion: approve ? v.version : r.homologatedVersion,
        versions: r.versions.map((x) => (x.version === v.version ? { ...x, status: approve ? "homologated" : "rejected" }
          : (approve && x.status === "homologated" ? { ...x, status: "superseded" } : x))) };
      return next({ registrations: s.registrations.map((x) => (x.id === r.id ? upd : x)) }, { status: upd.status, version: v.version });
    }
    case "competition_registrations": {
      const c = s.competitions.find((x) => x.id === args.competitionId);
      const mine = new Set(args.myTeamIds || []);
      if (!c) return { error: "not_found" };
      const staff = roleIn(s, c.leagueId, me, ["owner", "manager"]);
      const items = s.registrations.filter((r) => r.competitionId === c.id && (staff || mine.has(r.teamId))).map((r) => ({
        registration_id: r.id, team_id: r.teamId, team_name: r.teamName, status: r.status, homologated_squad_version: r.homologatedVersion,
        versions: [...r.versions].reverse().map((v) => ({ version: v.version, status: v.status,
          players: v.players.map((p) => ({ player_id: p.playerId, name: p.name, shirt_number: p.shirtNumber ?? null })) })),
      }));
      return { state: s, data: { is_manager: staff, items } };
    }
    case "competition_teams_page": {
      const c = s.competitions.find((x) => x.id === args.competitionId);
      if (!c || !visibleComp(s, c, actor)) return { state: s, data: null };
      return { state: s, data: { items: s.registrations.filter((r) => r.competitionId === c.id && r.homologatedVersion).map((r) => ({
        registration_id: r.id, team: { id: r.teamId, name: r.teamName },
        squad: (r.versions.find((v) => v.version === r.homologatedVersion)?.players || []).map((p) => ({ player_id: p.playerId, name: c.youth ? `${String(p.name || "?")[0]}.` : p.name, shirt_number: p.shirtNumber ?? null })),
      })) } };
    }
    case "set_supported_team": {
      if (need()) return need();
      const c = s.competitions.find((x) => x.id === args.competitionId);
      if (!c || !visibleComp(s, c, actor)) return { error: "not_found" };
      const without = s.supporters.filter((x) => !(x.competitionId === c.id && x.playerId === me));
      if (!args.teamId) return next({ supporters: without }, { teamId: null });
      if (!s.registrations.some((r) => r.competitionId === c.id && r.teamId === args.teamId && r.status === "homologated")) return { error: "team_not_registered" };
      const add = (list, type, id) => (list.some((f) => f.playerId === me && f.entityType === type && f.entityId === id) ? list : [...list, { playerId: me, entityType: type, entityId: id, notify: true }]);
      return next({ supporters: [...without, { competitionId: c.id, playerId: me, teamId: args.teamId }],
        follows: add(add(s.follows, "team", args.teamId), "competition", c.id) }, { teamId: args.teamId });
    }
    case "follow": {
      if (need()) return need();
      const rest = s.follows.filter((f) => !(f.playerId === me && f.entityType === args.entityType && f.entityId === args.entityId));
      if (args.on === false) return next({ follows: rest }, { following: false });
      const ok = args.entityType === "league" ? visibleLeague(s, s.leagues.find((l) => l.id === args.entityId), actor)
        : args.entityType === "competition" ? visibleComp(s, s.competitions.find((c) => c.id === args.entityId), actor)
          : args.entityType === "team" || (args.entityType === "player" && args.entityId !== me);
      if (!ok) return { error: "not_found" };
      return next({ follows: [...rest, { playerId: me, entityType: args.entityType, entityId: args.entityId, notify: args.notify !== false }] }, { following: true });
    }
    case "my_following": {
      return { state: s, data: {
        supporting: s.supporters.filter((x) => x.playerId === me).map((x) => ({ competition_id: x.competitionId, team_id: x.teamId })),
        follows: s.follows.filter((f) => f.playerId === me).map((f) => ({ entity_type: f.entityType, entity_id: f.entityId, notify: f.notify })),
      } };
    }
    default:
      return { error: "unknown" };
  }
}

/** Names for "Acompanhando" rows in the mirror (cloud resolves through RLS-readable tables). */
export function demoEntityName(state, type, id) {
  const s = state && state.v === 1 ? state : emptyLeagueOrgState();
  if (type === "league") { const l = s.leagues.find((x) => x.id === id); return l ? { name: l.name, slug: l.slug } : null; }
  if (type === "competition") {
    const c = s.competitions.find((x) => x.id === id); const l = c && s.leagues.find((x) => x.id === c.leagueId);
    return c ? { name: c.name, slug: l?.slug, competitionSlug: c.slug } : null;
  }
  if (type === "team") { const r = s.registrations.find((x) => x.teamId === id); return r ? { name: r.teamName } : null; }
  return null;
}
