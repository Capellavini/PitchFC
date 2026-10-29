// PITCH Ligas — the league's own public page (LP) at /leagues/<slug>. Pure: the
// address, the Gestor's page settings, the notices (avisos) and the model the
// page draws (rounds, table, scorers, teams) from the league state. No I/O.
import { addAnnouncement, SetupError } from "./leagueSetup.js";
import { ranking } from "./core/league.js";

/** The page of a league and, one level down, the full follower app on the same data. */
export const LEAGUE_PAGE_BASE = "/leagues";
export const leaguePagePath = (slug) => `${LEAGUE_PAGE_BASE}/${slug}`;
export const leagueAppPath = (slug) => `${LEAGUE_PAGE_BASE}/${slug}/app`;
export const leaguePageUrl = (slug, origin = "") => `${origin}${leaguePagePath(slug)}`;

const SLUG = "[a-z0-9][a-z0-9-]{0,59}";
/** /leagues/<slug> → { slug, view: "page" }; /leagues/<slug>/app → { slug, view: "app" }; anything else → null. */
export function landingRouteFromPath(pathname) {
  const m = String(pathname || "").replace(/\/+$/, "").match(new RegExp(`^${LEAGUE_PAGE_BASE}/(${SLUG})(?:/(app))?$`));
  return m ? { slug: m[1], view: m[2] ? "app" : "page" } : null;
}
/** The first public address of a league was /l/<slug>: it still works and lands on the page. */
export function legacyLandingSlug(pathname) {
  const m = String(pathname || "").replace(/\/+$/, "").match(new RegExp(`^/l/(${SLUG})$`));
  return m && m[1] !== "convite" ? m[1] : null;
}

// ── What the Gestor controls on the page ────────────────────
export const INTRO_MAX = 280;
export const PAGE_DEFAULTS = Object.freeze({ intro: "", signup: true, scorers: true, teams: true });
/** The page settings of a league, defaults filled in (everything is shown until the Gestor hides it). */
export function pageSettings(league) {
  const p = league?.page && typeof league.page === "object" ? league.page : {};
  return {
    intro: typeof p.intro === "string" ? p.intro.slice(0, INTRO_MAX) : PAGE_DEFAULTS.intro,
    signup: p.signup !== false,
    scorers: p.scorers !== false,
    teams: p.teams !== false,
  };
}
/** Saves the page settings (only the keys passed change). */
export function setPageSettings(state, patch = {}) {
  const cur = pageSettings(state.data.league);
  const next = { ...cur };
  if (patch.intro !== undefined) next.intro = String(patch.intro ?? "").replace(/\r\n/g, "\n").trim().slice(0, INTRO_MAX);
  for (const k of ["signup", "scorers", "teams"]) if (patch[k] !== undefined) next[k] = Boolean(patch[k]);
  return { ...state, data: { ...state.data, league: { ...state.data.league, page: next } } };
}

// ── Notices (avisos) ────────────────────────────────────────
const byNewest = (a, b) => String(b.at || "").localeCompare(String(a.at || ""));
/** What fans read: pinned first, then newest first. */
export const notices = (state) => (state.announcements || []).slice().sort((a, b) => (Boolean(b.pinned) - Boolean(a.pinned)) || byNewest(a, b));

/** A new notice on the page; `pinned` keeps it on top. */
export function postNotice(state, { title, body, pinned = false, at }) {
  const next = addAnnouncement(state, { title, body, at });
  return pinned ? { ...next, announcements: next.announcements.map((a, i) => (i === 0 ? { ...a, pinned: true } : a)) } : next;
}
/** Edits a notice (title, text, pinned). The time it was first published stays. */
export function editNotice(state, id, { title, body, pinned }) {
  const found = (state.announcements || []).find((a) => a.id === id);
  if (!found) throw new SetupError("not_found", id);
  const t = String(title ?? found.title).replace(/\s+/g, " ").trim();
  const b = String(body ?? found.body).trim().slice(0, 1200);
  if (t.length < 2) throw new SetupError("title_required");
  if (!b) throw new SetupError("body_required");
  const keep = pinned === undefined ? Boolean(found.pinned) : Boolean(pinned);
  return { ...state, announcements: state.announcements.map((a) => {
    if (a.id !== id) return a;
    const { pinned: _drop, ...rest } = a;
    return { ...rest, title: t.slice(0, 120), body: b, ...(keep ? { pinned: true } : {}) };
  }) };
}
export function removeNotice(state, id) {
  if (!(state.announcements || []).some((a) => a.id === id)) throw new SetupError("not_found", id);
  return { ...state, announcements: state.announcements.filter((a) => a.id !== id) };
}

// ── The page itself ─────────────────────────────────────────
const SHOWS_SCORE = new Set(["live", "ended_provisional", "in_review", "homologated", "walkover"]);
const OFFICIAL = new Set(["homologated", "walkover", "cancelled"]);
const byKickoff = (a, b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")) || String(a.id).localeCompare(String(b.id));

/** Lowest round that still has a game to be made official; once everything is official, the last round. */
export function currentRoundOf(matches) {
  if (!matches.length) return 0;
  const open = matches.filter((m) => !OFFICIAL.has(m.state));
  return open.length ? Math.min(...open.map((m) => Number(m.round) || 0)) : Math.max(...matches.map((m) => Number(m.round) || 0));
}

/**
 * What the page draws, per competition: rounds with their games, the official table,
 * the top scorers and assisters; plus the games on right now and the teams.
 * `derived` is deriveLeague(state).
 */
export function landingModel(state, derived) {
  const d = state.data || {};
  const teams = d.teams || [];
  const players = d.players || [];
  const teamOf = Object.fromEntries(teams.map((t) => [t.id, t]));
  const primary = (d.competitions || []).find((c) => c.kind !== "cup");
  const view = (m) => ({
    id: m.id, round: Number(m.round) || 0, kickoff: m.kickoff || null, venue: m.venue || "", state: m.state,
    home: teamOf[m.homeId] || null, away: teamOf[m.awayId] || null,
    score: SHOWS_SCORE.has(m.state) && derived.scores?.[m.id] ? { home: derived.scores[m.id].home, away: derived.scores[m.id].away } : null,
    official: m.state === "homologated" || m.state === "walkover",
  });
  const competitions = (d.competitions || []).map((c) => {
    const own = state.matches.filter((m) => (m.competitionId || primary?.id) === c.id);
    const rounds = [];
    for (const m of own.slice().sort(byKickoff)) {
      const n = Number(m.round) || 0;
      let r = rounds.find((x) => x.n === n);
      if (!r) { r = { n, matches: [] }; rounds.push(r); }
      r.matches.push(view(m));
    }
    rounds.sort((a, b) => a.n - b.n);
    const ids = c.teamIds?.length ? c.teamIds : teams.map((t) => t.id);
    const inComp = new Set(ids);
    const roster = players.filter((p) => inComp.has(p.teamId));
    const stats = derived.stats || {};
    return {
      id: c.id, name: c.name, short: c.short || c.name, season: c.season || "", category: c.category || "", sponsor: c.sponsor || "",
      kind: c.kind === "cup" ? "cup" : "league",
      rounds, currentRound: currentRoundOf(own), played: own.filter((m) => SHOWS_SCORE.has(m.state)).length, total: own.length,
      table: c.kind === "cup" ? [] : (derived.tables?.[c.id] || []),
      scorers: ranking(stats, roster, "goals", 10), assisters: ranking(stats, roster, "assists", 10),
      teamCount: ids.length,
    };
  });
  return {
    competitions,
    live: state.matches.filter((m) => m.state === "live").sort(byKickoff).map(view),
    teams: teams.map((t) => ({ ...t, playerCount: players.filter((p) => p.teamId === t.id).length })),
    notices: notices(state),
    empty: !state.matches.length && !teams.length,
  };
}

// ── Fan sign-ups as a spreadsheet ───────────────────────────
// A cell that starts with = + - @ (or a tab / return) would run as a formula when opened in Excel: a leading
// quote keeps it text. Everything is quoted.
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
/** The sign-ups of the page as CSV (UTF-8 with BOM so Excel reads the accents): name, email, team, date. */
export function signupsCsv(items, teamName = {}) {
  const rows = [["Nome", "Email", "Equipa", "Data"], ...(items || []).map((i) => [i.name, i.email, teamName[i.team_id] || "", String(i.created_at || "").slice(0, 10)])];
  return `\uFEFF${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
