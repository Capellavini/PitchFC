// ─────────────────────────────────────────────────────────
// PITCH Rivals — challenges: pure logic (no React, no Supabase, no storage).
//
// Shared by useTeams (cloud + local demo) and the challenge UI. The demo
// operations MIRROR the SECURITY DEFINER RPCs of
// supabase/migrations/20261013140000_rivals_challenges.sql (same rules,
// same `rivals:<code>` error codes). Split from rivals.js only for size.
// ─────────────────────────────────────────────────────────

import { CHALLENGE_RESPONSE_HOURS, CHALLENGE_DEADLINE_BEFORE_KICKOFF_HOURS, DEFAULT_FORMAT, TEAM_FORMATS, isLeader, normTeam } from "./rivals.js";
import { resultView } from "./rivalsResults.js";

export const MIN_KICKOFF_LEAD_HOURS = 3; // ⇒ the 24h/kickoff−2h window is ≥ 1h
export const MAX_KICKOFF_DAYS = 180;
export const MAX_PENDING_PER_TEAM = 10;
export const MAX_VERSIONS = 20;
export const DURATIONS = [40, 50, 60, 70, 80, 90, 120];
export const COST_SPLITS = ["split", "challenger", "challenged", "loser", "none"];
export const FIELD_STATUSES = ["unconfirmed", "confirmed", "unavailable"];
export const DEFAULT_DURATION = 60;

// Terms (camelCase in the app, snake_case on the wire).
const SNAKE = {
  kickoffAt: "kickoff_at", timezone: "timezone", format: "format", durationMin: "duration_min",
  venueName: "venue_name", venueAddress: "venue_address", venueUrl: "venue_url",
  fieldResponsible: "field_responsible", costCents: "cost_cents", currency: "currency",
  costSplit: "cost_split", note: "note",
};
export const TERM_KEYS = Object.keys(SNAKE);
const pick = (r, k) => (r?.[k] !== undefined ? r[k] : r?.[SNAKE[k]]);

/** Wire/demo row → terms object (every key present, nulls kept). */
export function normTerms(r) {
  const out = {};
  for (const k of TERM_KEYS) out[k] = pick(r, k) ?? null;
  if (out.durationMin != null) out.durationMin = Number(out.durationMin);
  if (out.costCents != null) out.costCents = Number(out.costCents);
  return out;
}
/** Terms (possibly partial) → the RPC's snake_case object. */
export function termsToRpc(terms = {}) {
  const out = {};
  for (const [k, v] of Object.entries(terms)) if (SNAKE[k] && v !== undefined) out[SNAKE[k]] = v === "" ? null : v;
  return out;
}

const same = (k, a, b) => {
  if (k === "kickoffAt") return Date.parse(a) === Date.parse(b) || (a == null && b == null);
  const x = typeof a === "string" ? a.trim() || null : a ?? null;
  const y = typeof b === "string" ? b.trim() || null : b ?? null;
  return x === y;
};
/** Keys that differ between two term objects (the "mudou" markers). */
export function diffTerms(prev, next) {
  if (!prev || !next) return [];
  return TERM_KEYS.filter((k) => !same(k, prev[k], next[k]));
}
export const sameTerms = (a, b) => diffTerms(a, b).length === 0;

// ── Shapes ───────────────────────────────────────────────
export function normChallengeTeam(r) {
  if (!r) return null;
  return { ...normTeam(r), captainNick: r.captain_nick ?? r.captainNick ?? null };
}
export function normVersion(r) {
  return {
    ...normTerms(r), version: Number(r.version), kind: r.kind,
    proposedByTeamId: r.proposed_by_team_id ?? r.proposedByTeamId,
    outcome: r.outcome ?? null, respondedAt: r.responded_at ?? r.respondedAt ?? null,
    createdAt: r.created_at ?? r.createdAt ?? null,
  };
}
export function normMatch(r) {
  if (!r) return null;
  return {
    ...normTerms(r), id: r.id,
    homeTeamId: r.home_team_id ?? r.homeTeamId, awayTeamId: r.away_team_id ?? r.awayTeamId,
    agreedVersion: Number(r.agreed_version ?? r.agreedVersion),
    matchStatus: r.match_status ?? r.matchStatus ?? "scheduled",
    fieldStatus: r.field_status ?? r.fieldStatus ?? "unconfirmed",
    fieldNote: r.field_note ?? r.fieldNote ?? null, fieldStatusAt: r.field_status_at ?? r.fieldStatusAt ?? null,
    resultStatus: r.result_status ?? r.resultStatus ?? "none",
    officialHomeScore: r.official_home_score ?? r.officialHomeScore ?? null,
    officialAwayScore: r.official_away_score ?? r.officialAwayScore ?? null,
    cancelledByTeamId: r.cancelled_by_team_id ?? r.cancelledByTeamId ?? null,
    cancelledAt: r.cancelled_at ?? r.cancelledAt ?? null, cancelReason: r.cancel_reason ?? r.cancelReason ?? null,
    // PR6/PR7 (20261014120000): result summary + my team's call-up numbers. All optional — an
    // older server just omits them.
    confirmedRevision: r.confirmed_revision ?? r.confirmedRevision ?? null,
    resultConfirmedAt: r.result_confirmed_at ?? r.resultConfirmedAt ?? null,
    notPlayedReason: r.not_played_reason ?? r.notPlayedReason ?? null,
    result: normResultSummary(r.result, r),
    myAvailability: r.my_availability ?? r.myAvailability ?? null,
    availabilityCounts: normCounts(r.availability_counts ?? r.availabilityCounts),
    lineupCount: Number(r.lineup_count ?? r.lineupCount ?? 0),
    statsRecorded: Boolean(r.stats_recorded ?? r.statsRecorded),
  };
}
const normCounts = (c) => ({ yes: Number(c?.yes || 0), no: Number(c?.no || 0), maybe: Number(c?.maybe || 0), pending: Number(c?.pending || 0) });
function normOpenRevision(o) {
  if (!o) return null;
  return {
    revision: Number(o.revision), kind: o.kind, status: o.status ?? "proposed",
    homeScore: Number(o.home_score ?? o.homeScore), awayScore: Number(o.away_score ?? o.awayScore),
    reportedByTeamId: o.reported_by_team_id ?? o.reportedByTeamId ?? null, reportedByPlayerId: o.reported_by_player_id ?? o.reportedByPlayerId ?? null,
    note: o.note ?? null, createdAt: o.created_at ?? o.createdAt ?? null, respondedAt: o.responded_at ?? o.respondedAt ?? null,
    respondedByPlayerId: o.responded_by_player_id ?? o.respondedByPlayerId ?? null,
  };
}
/** match.result { status, official_*, open_revision, revisions_count } — falls back to the match's own columns. */
function normResultSummary(s, r) {
  const status = s?.status ?? r.result_status ?? r.resultStatus ?? "none";
  const num = (v) => (v == null ? null : Number(v));
  return {
    status,
    officialHomeScore: num(s?.official_home_score ?? s?.officialHomeScore ?? r.official_home_score ?? r.officialHomeScore),
    officialAwayScore: num(s?.official_away_score ?? s?.officialAwayScore ?? r.official_away_score ?? r.officialAwayScore),
    openRevision: normOpenRevision(s?.open_revision ?? s?.openRevision),
    revisionsCount: Number(s?.revisions_count ?? s?.revisionsCount ?? 0),
  };
}
export { normOpenRevision };
/** my_challenges item (or a demo row already shaped) → app shape. */
export function normChallenge(r, now = Date.now()) {
  const ch = {
    id: r.id, mode: r.mode, status: r.status,
    currentVersion: Number(r.current_version ?? r.currentVersion),
    turnTeamId: r.turn_team_id ?? r.turnTeamId ?? null,
    expiresAt: r.expires_at ?? r.expiresAt,
    pendingChangeVersion: r.pending_change_version ?? r.pendingChangeVersion ?? null,
    token: r.invite_token ?? r.token ?? null,
    createdAt: r.created_at ?? r.createdAt, updatedAt: r.updated_at ?? r.updatedAt,
    decidedAt: r.decided_at ?? r.decidedAt ?? null, decidedByTeamId: r.decided_by_team_id ?? r.decidedByTeamId ?? null,
    reason: r.reason ?? null,
    challenger: normChallengeTeam(r.challenger), challenged: normChallengeTeam(r.challenged),
    myTeamId: r.my_team_id ?? r.myTeamId ?? null, myRole: r.my_role ?? r.myRole ?? null,
    versions: (r.versions || []).map(normVersion).sort((a, b) => a.version - b.version),
    match: normMatch(r.match),
  };
  ch.effectiveStatus = effectiveStatus(ch, now);
  return ch;
}

/** Status with lazy expiry applied (pending past its deadline → expired). */
export function effectiveStatus(ch, now = Date.now()) {
  if (ch.status === "pending" && Date.parse(ch.expiresAt) <= now) return "expired";
  return ch.status;
}
/** A pending post-agreement change, unless it already ran out. */
export function openChange(ch, now = Date.now()) {
  if (ch.status !== "agreed" || ch.pendingChangeVersion == null || Date.parse(ch.expiresAt) <= now) return null;
  return ch.versions.find((v) => v.version === ch.pendingChangeVersion) || null;
}
export const versionOf = (ch, n) => ch.versions.find((v) => v.version === n) || null;
/** The terms that currently stand: the match's (agreed) or the open version's. */
export const currentTerms = (ch) => (ch.match ? normTerms(ch.match) : versionOf(ch, ch.currentVersion));
/** The version before `n` that it should be compared with (changes compare
 *  with the agreed terms they would replace). */
export function previousTerms(ch, n) {
  const v = versionOf(ch, n);
  if (!v) return null;
  if (v.kind === "change") {
    const before = [...ch.versions].reverse().find((x) => x.version < n && x.outcome === "accepted");
    return before || null;
  }
  return versionOf(ch, n - 1);
}

/**
 * Everything the inbox / detail need to know from MY side.
 * → { side, myTeam, opponent, leader, myTurn, bucket, stage, nextAction, needsAction }
 * stage: respond | awaiting | open_link | change_review | change_waiting |
 *        agreed | kicked_off | match_cancelled | declined | cancelled | expired
 * nextAction: respond | review_change | confirm_field | share_link | wait | details
 *             | report_result | confirm_result   (after kickoff, PR7)
 * result: resultView() of the match once it has kicked off (else null).
 */
export function challengeView(ch, now = Date.now()) {
  const side = ch.myTeamId && ch.myTeamId === ch.challenger?.id ? "challenger" : "challenged";
  const myTeam = side === "challenger" ? ch.challenger : ch.challenged;
  const opponent = side === "challenger" ? ch.challenged : ch.challenger;
  const leader = isLeader(ch.myRole);
  const status = effectiveStatus(ch, now);
  const change = openChange(ch, now);
  const myTurn = Boolean(ch.turnTeamId && ch.turnTeamId === ch.myTeamId);
  const m = ch.match;
  const kicked = m && Date.parse(m.kickoffAt) <= now;

  let stage;
  if (status === "pending") stage = ch.mode === "claimable" && !ch.challenged ? "open_link" : myTurn ? "respond" : "awaiting";
  else if (status === "agreed") {
    if (m?.matchStatus === "cancelled") stage = "match_cancelled";
    else if (kicked) stage = "kicked_off";
    else if (change) stage = myTurn ? "change_review" : "change_waiting";
    else stage = "agreed";
  } else stage = status; // declined | cancelled | expired

  const responsible = m ? (m.fieldResponsible === side) : false;
  // After kickoff the shared result drives the stage (PR7): report it, or
  // confirm / contest the other team's — only the OTHER team can confirm.
  const result = stage === "kicked_off" ? resultView(m, { myTeamId: ch.myTeamId, leader, now }) : null;
  let nextAction = "details";
  if (stage === "respond") nextAction = leader ? "respond" : "wait";
  else if (stage === "change_review") nextAction = leader ? "review_change" : "wait";
  else if (stage === "open_link") nextAction = leader ? "share_link" : "wait";
  else if (stage === "awaiting" || stage === "change_waiting") nextAction = "wait";
  else if (stage === "agreed" && responsible && leader && m.fieldStatus !== "confirmed") nextAction = "confirm_field";
  else if (result?.canRespond) nextAction = "confirm_result";
  else if (result?.canReport) nextAction = "report_result";

  // A kicked-off match stays in Sent / Received while its result is open (a
  // match nobody reported for two weeks moves on to History).
  const unresolved = result && ["ready", "reported", "disputed", "correction"].includes(result.phase)
    && !(result.phase === "ready" && now - Date.parse(m.kickoffAt) > 14 * 864e5);
  const terminal = ["declined", "cancelled", "expired", "match_cancelled"].includes(stage) || (stage === "kicked_off" && !unresolved);
  const bucket = terminal ? "history" : side === "challenger" ? "sent" : "received";
  return {
    side, myTeam, opponent, leader, myTurn, stage, nextAction, bucket, status, result,
    needsAction: ["respond", "review_change", "confirm_field", "confirm_result", "report_result"].includes(nextAction),
  };
}

/** Inbox buckets, action-needed first, then soonest kickoff / newest. */
export function inboxBuckets(challenges, now = Date.now()) {
  const out = { received: [], sent: [], history: [] };
  for (const ch of challenges || []) {
    const view = challengeView(ch, now);
    out[view.bucket].push({ ch, view });
  }
  const kick = (x) => Date.parse(currentTerms(x.ch)?.kickoffAt) || 0;
  const open = (a, b) => (b.view.needsAction - a.view.needsAction) || (kick(a) - kick(b));
  out.received.sort(open);
  out.sent.sort(open);
  out.history.sort((a, b) => String(b.ch.updatedAt).localeCompare(String(a.ch.updatedAt)));
  return out;
}
/** How many challenges need ME (a leader) — the Desafios badge. */
export const pendingActionCount = (challenges, now = Date.now()) =>
  (challenges || []).filter((ch) => challengeView(ch, now).needsAction).length;

/** Rivals challenges are visible like teams (flag, own team, a ?desafio
 *  link, or the ?rivals=1 pilot) — and only where teams are. */
export const challengesVisible = ({ rivalsOn, flagOn, teamCount = 0, hasIntent = false, optIn = false }) =>
  Boolean(rivalsOn && (flagOn || teamCount > 0 || hasIntent || optIn));

// ── Links ────────────────────────────────────────────────
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const challengeInviteUrl = (token, origin = "https://pitch-fc.com") => `${origin}/?desafio=${encodeURIComponent(token || "")}`;
export function readChallengeToken(search = "") {
  const v = (new URLSearchParams(search).get("desafio") || "").trim();
  return TOKEN_RE.test(v) ? v : null;
}
/** A fresh idempotency key for one composer submit. */
export const newClientRef = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.padEnd(12, "0");

// ── Time zones (Intl, no deps) ───────────────────────────
const partsFmt = new Map();
function zoneFmt(tz) {
  if (!partsFmt.has(tz)) {
    partsFmt.set(tz, new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }));
  }
  return partsFmt.get(tz);
}
/** ISO instant → { date: "YYYY-MM-DD", time: "HH:MM" } in `tz`. */
export function zonedParts(iso, tz = "Europe/Lisbon") {
  const p = Object.fromEntries(zoneFmt(tz).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}
/** Wall-clock date + time in `tz` → ISO instant (DST-safe). */
export function zonedToIso(date, time, tz = "Europe/Lisbon") {
  const [y, mo, d] = String(date).split("-").map(Number);
  const [hh, mm] = String(time).split(":").map(Number);
  if (![y, mo, d, hh, mm].every(Number.isFinite)) return null;
  const want = Date.UTC(y, mo - 1, d, hh, mm);
  let guess = want;
  for (let i = 0; i < 3; i += 1) {
    const p = zonedParts(new Date(guess).toISOString(), tz);
    const [py, pmo, pd] = p.date.split("-").map(Number);
    const [ph, pm] = p.time.split(":").map(Number);
    const diff = want - Date.UTC(py, pmo - 1, pd, ph, pm);
    if (!diff) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}
/** "€60" / "R$ 150" (cost is informational only). */
export function formatCost(cents, currency = "EUR", locale = "pt-PT") {
  if (cents == null) return "";
  const v = Number(cents) / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
}
/** Euros/reais text typed by the user ("60", "60,5") → cents | null | NaN. */
export function parseCost(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

// ── Validation (mirror of rivals_norm_terms + rivals_check_kickoff) ──
export function validateTerms(t, now = Date.now()) {
  const k = Date.parse(t.kickoffAt);
  if (!Number.isFinite(k)) return "invalid_kickoff";
  if (k < now + MIN_KICKOFF_LEAD_HOURS * 3600e3) return "kickoff_too_soon";
  if (k > now + MAX_KICKOFF_DAYS * 864e5) return "kickoff_too_far";
  if (!t.timezone) return "invalid_timezone";
  if (!TEAM_FORMATS.includes(t.format)) return "invalid_format";
  if (!(Number.isInteger(t.durationMin) && t.durationMin >= 20 && t.durationMin <= 180)) return "invalid_duration";
  if (String(t.venueName || "").trim().length > 80 || String(t.venueAddress || "").trim().length > 120) return "invalid_venue";
  if (t.venueUrl && (!/^https:\/\//.test(t.venueUrl) || t.venueUrl.length > 500)) return "invalid_venue";
  if (!["challenger", "challenged"].includes(t.fieldResponsible)) return "invalid_field_responsible";
  if (t.costCents != null && !(Number.isInteger(t.costCents) && t.costCents >= 0 && t.costCents <= 1e7)) return "invalid_cost";
  if (!["EUR", "BRL"].includes(t.currency)) return "invalid_currency";
  if (!COST_SPLITS.includes(t.costSplit)) return "invalid_split";
  if (String(t.note || "").trim().length > 280) return "note_too_long";
  return null;
}
const tidy = (t) => {
  const out = normTerms(t);
  for (const k of ["venueName", "venueAddress", "venueUrl", "note"]) out[k] = String(out[k] ?? "").trim() || null;
  return out;
};
/** Default terms for a new challenge from `team` (mirror of create_challenge). */
export const defaultTerms = (team) => ({
  timezone: team?.timezone || "Europe/Lisbon", currency: team?.currency || "EUR",
  format: team?.format || DEFAULT_FORMAT, durationMin: DEFAULT_DURATION,
  fieldResponsible: "challenger", costSplit: "split", venueName: team?.homeVenue || null,
  venueAddress: null, venueUrl: null, costCents: null, note: null, kickoffAt: null,
});
/** Deadline mirror (owner rule): min(now + 24h, kickoff − 2h). */
export const responseDeadline = (kickoffIso, now = Date.now()) =>
  new Date(Math.min(now + CHALLENGE_RESPONSE_HOURS * 3600e3, Date.parse(kickoffIso) - CHALLENGE_DEADLINE_BEFORE_KICKOFF_HOURS * 3600e3)).toISOString();

// ── Local demo (mirror of the 20261013140000 RPCs) ───────────────
export const DEMO_CHALLENGE_TOKEN = "democ4a11e0e5f1b2d3c4e5f6a7b8c9d0";
const ERR = (code) => ({ error: code });
const iso = (ms) => new Date(ms).toISOString();
const roleIn = (state, teamId, meId) => (state.members || []).find((m) => m.teamId === teamId && m.playerId === meId && m.status === "active")?.role ?? null;
const teamById = (state, id) => (state.teams || []).find((t) => t.id === id) || null;
const leads = (state, teamId, meId) => isLeader(roleIn(state, teamId, meId));
const captainOf = (state, teamId) => (state.members || []).find((m) => m.teamId === teamId && m.role === "captain" && m.status === "active") || null;
let seq = 0;
const nextId = (p, now) => `${p}${now.toString(36)}${(seq += 1).toString(36)}`;
const demoToken = (now) => `democ${now.toString(16)}${Math.random().toString(16).slice(2)}`.replace(/[^a-z0-9]/g, "").padEnd(32, "0").slice(0, 32);

/** A wall-clock slot `days` ahead at `hour`:00 in `tz`. */
export function demoSlot(now, days, hour = 19, tz = "Europe/Lisbon") {
  const { date } = zonedParts(iso(now + days * 864e5), tz);
  return zonedToIso(date, `${String(hour).padStart(2, "0")}:00`, tz);
}

/** Adds the challenge collections (+ one open claimable link from Porto
 *  Casual: try ?desafio=DEMO_CHALLENGE_TOKEN) to a PR2 demo state. The
 *  seeded link is refreshed when it ran out unclaimed so the demo stays
 *  clickable. */
export function withChallengeSeed(state, now = Date.now()) {
  let s = { ...state, challenges: state.challenges || [], matches: state.matches || [] };
  const seeded = s.challenges.find((c) => c.token === DEMO_CHALLENGE_TOKEN);
  const fresh = seeded && (seeded.status !== "pending" || Date.parse(seeded.expiresAt) > now || seeded.challengedTeamId);
  if (fresh || !teamById(s, "demo-t-pc")) return s;
  s = { ...s, challenges: s.challenges.filter((c) => c.token !== DEMO_CHALLENGE_TOKEN) };
  const cap = captainOf(s, "demo-t-pc");
  const r = demoChallengeOp(s, "create_challenge", {
    fromTeamId: "demo-t-pc", toTeamId: null, token: DEMO_CHALLENGE_TOKEN,
    terms: { kickoffAt: demoSlot(now, 4, 20), venueName: "Campo da Constituição", format: "5v5", durationMin: 60, costCents: 5000, costSplit: "split", note: "Jogo limpo, nível médio." },
  }, { id: cap.playerId, nick: cap.nick }, now);
  return r.error ? s : r.state;
}

function demoCreate(state, a, me, now) {
  const from = teamById(state, a.fromTeamId);
  if (!from) return ERR("team_not_found");
  if (from.archived) return ERR("team_archived");
  if (!leads(state, from.id, me.id)) return ERR("not_team_leader");
  if (a.clientRef) {
    const dup = state.challenges.find((c) => c.createdBy === me.id && c.clientRef === a.clientRef);
    if (dup) return { state, data: { challengeId: dup.id, token: dup.token, status: dup.status, created: false, mode: dup.mode } };
  }
  const to = a.toTeamId ? teamById(state, a.toTeamId) : null;
  if (a.toTeamId && (!to || to.id === from.id || to.archived)) return to ? ERR("invalid_opponent") : ERR("team_not_found");
  const terms = tidy({ ...defaultTerms(from), ...a.terms });
  const bad = validateTerms(terms, now);
  if (bad) return ERR(bad);
  let s = demoExpire(state, now);
  if (s.challenges.filter((c) => c.challengerTeamId === from.id && c.status === "pending").length >= MAX_PENDING_PER_TEAM) return ERR("too_many_pending");
  if (to && s.challenges.some((c) => c.status === "pending" && [c.challengerTeamId, c.challengedTeamId].sort().join() === [from.id, to.id].sort().join())) return ERR("pair_open_challenge");
  const ch = {
    id: nextId("demo-c-", now), mode: to ? "directed" : "claimable", token: a.token || demoToken(now), status: "pending",
    challengerTeamId: from.id, challengedTeamId: to?.id ?? null, currentVersion: 1, turnTeamId: to?.id ?? null,
    expiresAt: responseDeadline(terms.kickoffAt, now), pendingChangeVersion: null, createdBy: me.id, clientRef: a.clientRef || null,
    decidedByTeamId: null, decidedAt: null, reason: null, createdAt: iso(now), updatedAt: iso(now),
    versions: [{ ...terms, version: 1, kind: "proposal", proposedByTeamId: from.id, outcome: null, respondedAt: null, createdAt: iso(now) }],
  };
  s = { ...s, challenges: [...s.challenges, ch] };
  return { state: s, data: { challengeId: ch.id, token: ch.token, status: "pending", created: true, mode: ch.mode } };
}

// Acting team (mirror of rivals_acting_team).
function acting(state, ch, asTeamId, meId) {
  if (asTeamId) {
    if (asTeamId !== ch.challengerTeamId && asTeamId !== ch.challengedTeamId) return ERR("not_a_party");
    return leads(state, asTeamId, meId) ? { team: asTeamId } : ERR("not_team_leader");
  }
  for (const id of [ch.turnTeamId, ch.challengerTeamId, ch.challengedTeamId]) if (id && leads(state, id, meId)) return { team: id };
  return ERR("not_team_leader");
}
const patchCh = (state, id, fn) => ({ ...state, challenges: state.challenges.map((c) => (c.id === id ? fn(c) : c)) });
const setOutcome = (c, version, outcome, now) => ({ ...c, versions: c.versions.map((v) => (v.version === version && !v.outcome ? { ...v, outcome, respondedAt: iso(now) } : v)) });

function claimIfNeeded(state, ch, a, meId) {
  if (!(ch.mode === "claimable" && !ch.challengedTeamId)) return { state, ch };
  if (!a.token || a.token !== ch.token) return ERR("invalid_token");
  if (!a.asTeamId) return ERR("choose_team");
  if (a.asTeamId === ch.challengerTeamId) return ERR("cannot_accept_own");
  if (!leads(state, a.asTeamId, meId)) return ERR("not_team_leader");
  const pair = [ch.challengerTeamId, a.asTeamId].sort().join();
  if (state.challenges.some((c) => c.id !== ch.id && c.status === "pending" && c.challengedTeamId && [c.challengerTeamId, c.challengedTeamId].sort().join() === pair)) return ERR("pair_open_challenge");
  const claimed = { ...ch, challengedTeamId: a.asTeamId, turnTeamId: a.asTeamId };
  return { state: patchCh(state, ch.id, () => claimed), ch: claimed, claimedBy: a.asTeamId };
}

function openGuard(ch, now) {
  if (ch.status === "pending" && Date.parse(ch.expiresAt) <= now) return "challenge_expired";
  if (ch.status !== "pending") return `challenge_${ch.status}`;
  return null;
}

function demoRespond(state, a, me, now) {
  let ch = state.challenges.find((c) => c.id === a.challengeId);
  if (!ch) return ERR("challenge_not_found");
  if (!["accept", "decline"].includes(a.action)) return ERR("invalid_action");
  if (ch.status === "agreed" && a.action === "accept") {
    const acc = ch.versions.find((v) => v.outcome === "accepted" && v.kind !== "change");
    const party = leads(state, ch.challengerTeamId, me.id) || leads(state, ch.challengedTeamId, me.id);
    if (party && acc && a.version === acc.version) {
      return { state, data: { challengeId: ch.id, status: "agreed", matchId: state.matches.find((m) => m.challengeId === ch.id)?.id, alreadyAgreed: true } };
    }
    return ERR(ch.mode === "claimable" && !party ? "challenge_claimed" : "stale_version");
  }
  const g = openGuard(ch, now);
  if (g) return ERR(g);
  if (a.version !== ch.currentVersion) return ERR("stale_version");
  let s = state;
  let team;
  if (ch.mode === "claimable" && !ch.challengedTeamId) {
    if (a.action === "decline") return ERR("not_your_turn");
    const c = claimIfNeeded(s, ch, a, me.id);
    if (c.error) return c;
    ({ state: s, ch } = c);
    team = a.asTeamId;
  } else {
    if (ch.mode === "claimable" && a.token && !(leads(s, ch.challengerTeamId, me.id) || leads(s, ch.challengedTeamId, me.id))) return ERR("challenge_claimed");
    const r = acting(s, ch, a.asTeamId, me.id);
    if (r.error) return r;
    team = r.team;
  }
  if (ch.turnTeamId !== team) return ERR("not_your_turn");
  const ver = ch.versions.find((v) => v.version === ch.currentVersion);
  if (ver.proposedByTeamId === team) return ERR("cannot_accept_own");
  if (a.action === "decline") {
    const reason = String(a.reason || "").trim() || null;
    if (reason && reason.length > 280) return ERR("reason_too_long");
    s = patchCh(s, ch.id, (c) => setOutcome({ ...c, status: "declined", turnTeamId: null, decidedByTeamId: team, decidedAt: iso(now), reason, updatedAt: iso(now) }, c.currentVersion, "declined", now));
    return { state: s, data: { challengeId: ch.id, status: "declined", matchId: null, alreadyAgreed: false } };
  }
  const match = {
    ...normTerms(ver), id: nextId("demo-m-", now), challengeId: ch.id, homeTeamId: ch.challengerTeamId, awayTeamId: team,
    agreedVersion: ver.version, matchStatus: "scheduled", fieldStatus: "unconfirmed", fieldNote: null, fieldStatusAt: null,
    resultStatus: "none", officialHomeScore: null, officialAwayScore: null, cancelledByTeamId: null, cancelledAt: null, cancelReason: null,
    createdAt: iso(now),
  };
  s = patchCh(s, ch.id, (c) => setOutcome({ ...c, status: "agreed", turnTeamId: null, decidedByTeamId: team, decidedAt: iso(now), updatedAt: iso(now) }, c.currentVersion, "accepted", now));
  s = { ...s, matches: [...s.matches, match] };
  return { state: s, data: { challengeId: ch.id, status: "agreed", matchId: match.id, alreadyAgreed: false } };
}

function demoCounter(state, a, me, now) {
  let ch = state.challenges.find((c) => c.id === a.challengeId);
  if (!ch) return ERR("challenge_not_found");
  const g = openGuard(ch, now);
  if (g) return ERR(g);
  if (a.baseVersion !== ch.currentVersion) return ERR("stale_version");
  if (ch.currentVersion >= MAX_VERSIONS) return ERR("too_many_versions");
  const base = normTerms(ch.versions.find((v) => v.version === ch.currentVersion));
  const terms = tidy({ ...base, ...a.terms });
  const bad = validateTerms(terms, now);
  if (bad) return ERR(bad);
  if (sameTerms(base, terms)) return ERR("no_changes");
  let s = state;
  let team;
  if (ch.mode === "claimable" && !ch.challengedTeamId) {
    const c = claimIfNeeded(s, ch, a, me.id);
    if (c.error) return c;
    ({ state: s, ch } = c);
    team = a.asTeamId;
  } else {
    const r = acting(s, ch, a.asTeamId, me.id);
    if (r.error) return r;
    team = r.team;
  }
  if (ch.turnTeamId !== team) return ERR("not_your_turn");
  const other = team === ch.challengerTeamId ? ch.challengedTeamId : ch.challengerTeamId;
  const v = ch.currentVersion + 1;
  s = patchCh(s, ch.id, (c) => {
    const done = setOutcome(c, c.currentVersion, "countered", now);
    return {
      ...done, currentVersion: v, turnTeamId: other, expiresAt: responseDeadline(terms.kickoffAt, now), updatedAt: iso(now),
      versions: [...done.versions, { ...terms, version: v, kind: "counter", proposedByTeamId: team, outcome: null, respondedAt: null, createdAt: iso(now) }],
    };
  });
  return { state: s, data: { challengeId: ch.id, version: v, status: "pending", turnTeamId: other } };
}

function demoCancel(state, a, me, now) {
  const ch = state.challenges.find((c) => c.id === a.challengeId);
  if (!ch) return ERR("challenge_not_found");
  const team = leads(state, ch.challengerTeamId, me.id) ? ch.challengerTeamId : ch.challengedTeamId && leads(state, ch.challengedTeamId, me.id) ? ch.challengedTeamId : null;
  if (!team) return ERR("not_team_leader");
  const reason = String(a.reason || "").trim() || null;
  if (reason && reason.length > 280) return ERR("reason_too_long");
  if (ch.status === "cancelled") return { state, data: { challengeId: ch.id, status: "cancelled", matchStatus: null } };
  if (ch.status === "pending") {
    if (Date.parse(ch.expiresAt) <= now) return ERR("challenge_expired");
    const s = patchCh(state, ch.id, (c) => setOutcome({ ...c, status: "cancelled", turnTeamId: null, decidedByTeamId: team, decidedAt: iso(now), reason, updatedAt: iso(now) }, c.currentVersion, "cancelled", now));
    return { state: s, data: { challengeId: ch.id, status: "cancelled", matchStatus: null } };
  }
  if (ch.status !== "agreed") return ERR(`challenge_${ch.status}`);
  const m = state.matches.find((x) => x.challengeId === ch.id);
  if (!m) return ERR("match_not_found");
  if (m.matchStatus === "cancelled") return { state, data: { challengeId: ch.id, status: ch.status, matchId: m.id, matchStatus: "cancelled" } };
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) <= now) return ERR("match_started");
  let s = { ...state, matches: state.matches.map((x) => (x === m ? { ...x, matchStatus: "cancelled", cancelledByTeamId: team, cancelledAt: iso(now), cancelReason: reason } : x)) };
  s = patchCh(s, ch.id, (c) => {
    const base = { ...c, updatedAt: iso(now) };
    return c.pendingChangeVersion != null ? { ...setOutcome(base, c.pendingChangeVersion, "cancelled", now), pendingChangeVersion: null, turnTeamId: null } : base;
  });
  return { state: s, data: { challengeId: ch.id, status: ch.status, matchId: m.id, matchStatus: "cancelled" } };
}

function demoProposeChange(state, a, me, now) {
  const m = state.matches.find((x) => x.id === a.matchId);
  if (!m) return ERR("match_not_found");
  let ch = state.challenges.find((c) => c.id === m.challengeId);
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) <= now) return ERR("match_started");
  let s = state;
  if (ch.pendingChangeVersion != null) {
    if (Date.parse(ch.expiresAt) > now) return ERR("change_pending");
    s = demoExpire(s, now);
    ch = s.challenges.find((c) => c.id === m.challengeId);
  }
  if (a.baseVersion !== ch.currentVersion) return ERR("stale_version");
  if (ch.currentVersion >= MAX_VERSIONS) return ERR("too_many_versions");
  const r = acting(s, ch, a.asTeamId, me.id);
  if (r.error) return r;
  const base = normTerms(m);
  const terms = tidy({ ...base, ...a.terms });
  const bad = validateTerms(terms, now);
  if (bad) return ERR(bad);
  if (sameTerms(base, terms)) return ERR("no_changes");
  const dead = Math.min(now + CHALLENGE_RESPONSE_HOURS * 3600e3, Math.min(Date.parse(m.kickoffAt), Date.parse(terms.kickoffAt)) - CHALLENGE_DEADLINE_BEFORE_KICKOFF_HOURS * 3600e3);
  if (dead <= now) return ERR("too_late_to_change");
  const other = r.team === ch.challengerTeamId ? ch.challengedTeamId : ch.challengerTeamId;
  const v = ch.currentVersion + 1;
  s = patchCh(s, ch.id, (c) => ({
    ...c, currentVersion: v, pendingChangeVersion: v, turnTeamId: other, expiresAt: iso(dead), updatedAt: iso(now),
    versions: [...c.versions, { ...terms, version: v, kind: "change", proposedByTeamId: r.team, outcome: null, respondedAt: null, createdAt: iso(now) }],
  }));
  return { state: s, data: { matchId: m.id, challengeId: ch.id, version: v } };
}

function demoRespondChange(state, a, me, now) {
  const m = state.matches.find((x) => x.id === a.matchId);
  if (!m) return ERR("match_not_found");
  if (!["accept", "decline"].includes(a.action)) return ERR("invalid_action");
  const ch = state.challenges.find((c) => c.id === m.challengeId);
  if (ch.pendingChangeVersion == null) {
    const v = ch.versions.find((x) => x.version === a.version);
    if (v && v.kind === "change" && v.outcome === "accepted" && a.action === "accept") return { state, data: { matchId: m.id, version: a.version, accepted: true, fieldStatus: m.fieldStatus } };
    return ERR("no_pending_change");
  }
  if (a.version !== ch.pendingChangeVersion) return ERR("stale_version");
  if (Date.parse(ch.expiresAt) <= now) return ERR("change_expired");
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  const r = acting(state, ch, a.asTeamId, me.id);
  if (r.error) return r;
  if (ch.turnTeamId !== r.team) return ERR("not_your_turn");
  const ver = ch.versions.find((x) => x.version === a.version);
  if (ver.proposedByTeamId === r.team) return ERR("cannot_accept_own");
  let field = m.fieldStatus;
  let s = state;
  if (a.action === "accept") {
    const reset = Date.parse(ver.kickoffAt) !== Date.parse(m.kickoffAt) || ver.venueName !== m.venueName || ver.venueAddress !== m.venueAddress;
    field = reset ? "unconfirmed" : m.fieldStatus;
    s = { ...s, matches: s.matches.map((x) => (x === m ? { ...x, ...normTerms(ver), agreedVersion: ver.version, fieldStatus: field, fieldNote: reset ? null : x.fieldNote, fieldStatusAt: reset ? null : x.fieldStatusAt } : x)) };
  }
  s = patchCh(s, ch.id, (c) => ({ ...setOutcome(c, a.version, a.action === "accept" ? "accepted" : "declined", now), pendingChangeVersion: null, turnTeamId: null, updatedAt: iso(now) }));
  return { state: s, data: { matchId: m.id, version: a.version, accepted: a.action === "accept", fieldStatus: field } };
}

function demoFieldStatus(state, a, me, now) {
  if (!FIELD_STATUSES.includes(a.status)) return ERR("invalid_field_status");
  const m = state.matches.find((x) => x.id === a.matchId);
  if (!m) return ERR("match_not_found");
  const resp = m.fieldResponsible === "challenger" ? m.homeTeamId : m.awayTeamId;
  if (!leads(state, resp, me.id)) return ERR("not_field_responsible");
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  const note = String(a.note || "").trim() || null;
  if (note && note.length > 280) return ERR("note_too_long");
  const s = { ...state, matches: state.matches.map((x) => (x === m ? { ...x, fieldStatus: a.status, fieldNote: note, fieldStatusAt: iso(now) } : x)) };
  return { state: patchCh(s, m.challengeId, (c) => ({ ...c, updatedAt: iso(now) })), data: { matchId: m.id, fieldStatus: a.status } };
}

/** Apply one challenge operation to the demo state, exactly like the RPC.
 *  → { state, data } or { error: code } (state untouched on error). */
export function demoChallengeOp(state, op, args = {}, me, now = Date.now()) {
  if (!me?.id) return ERR("not_authenticated");
  const s = { ...state, challenges: state.challenges || [], matches: state.matches || [] };
  switch (op) {
    case "create_challenge": return demoCreate(s, args, me, now);
    case "respond_challenge": return demoRespond(s, args, me, now);
    case "counter_challenge": return demoCounter(s, args, me, now);
    case "cancel_challenge": return demoCancel(s, args, me, now);
    case "propose_match_change": return demoProposeChange(s, args, me, now);
    case "respond_match_change": return demoRespondChange(s, args, me, now);
    case "set_field_status": return demoFieldStatus(s, args, me, now);
    default: return ERR("unknown");
  }
}

/** Persist overdue expiries (mirror of rivals_expire_due / expire_rivals). */
export function demoExpire(state, now = Date.now()) {
  let changed = false;
  const challenges = (state.challenges || []).map((c) => {
    if (c.status === "pending" && Date.parse(c.expiresAt) <= now) {
      changed = true;
      return setOutcome({ ...c, status: "expired", turnTeamId: null, updatedAt: iso(now) }, c.currentVersion, "expired", now);
    }
    if (c.status === "agreed" && c.pendingChangeVersion != null && Date.parse(c.expiresAt) <= now) {
      changed = true;
      return { ...setOutcome(c, c.pendingChangeVersion, "expired", now), pendingChangeVersion: null, turnTeamId: null, updatedAt: iso(now) };
    }
    return c;
  });
  return changed ? { ...state, challenges } : state;
}

const card = (state, id) => {
  const t = teamById(state, id);
  return t ? { ...t, captainNick: captainOf(state, id)?.nick ?? null } : null;
};
/** My challenges in the demo, same shape as normChallenge(my_challenges item). */
export function demoMyChallenges(state, meId, now = Date.now(), decorateMatch = null) {
  const mine = new Set((state.members || []).filter((m) => m.playerId === meId && m.status === "active").map((m) => m.teamId));
  return (state.challenges || [])
    .filter((c) => mine.has(c.challengerTeamId) || mine.has(c.challengedTeamId))
    .map((c) => {
      const myTeamId = mine.has(c.turnTeamId) ? c.turnTeamId : mine.has(c.challengerTeamId) ? c.challengerTeamId : c.challengedTeamId;
      return normChallenge({
        ...c, token: mine.has(c.challengerTeamId) ? c.token : null,
        challenger: card(state, c.challengerTeamId), challenged: c.challengedTeamId ? card(state, c.challengedTeamId) : null,
        myTeamId, myRole: roleIn(state, myTeamId, meId),
        match: (() => { const m = (state.matches || []).find((x) => x.challengeId === c.id) || null; return m && decorateMatch ? decorateMatch(m, myTeamId) : m; })(),
      }, now);
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

/** Demo mirror of get_challenge_invite (app shape). */
export function demoChallengeInvite(state, token, meId, now = Date.now()) {
  const c = (state.challenges || []).find((x) => x.token === token);
  if (!c) return { status: "not_found" };
  const ver = c.versions.find((v) => v.version === c.currentVersion);
  let side = null;
  let role = null;
  if (meId) {
    role = roleIn(state, c.challengerTeamId, meId);
    if (role) side = "challenger";
    else if (c.challengedTeamId) { role = roleIn(state, c.challengedTeamId, meId); if (role) side = "challenged"; }
  }
  const status = c.status === "pending" && Date.parse(c.expiresAt) <= now ? "expired"
    : c.mode === "claimable" && c.challengedTeamId && !side ? "claimed" : c.status;
  let eligible = [];
  if (meId && status === "pending") {
    if (c.mode === "claimable" && !c.challengedTeamId) {
      eligible = (state.members || []).filter((m) => m.playerId === meId && m.status === "active" && isLeader(m.role) && m.teamId !== c.challengerTeamId)
        .map((m) => ({ ...teamById(state, m.teamId), role: m.role })).filter((t) => t.id && !t.archived);
    } else if (side === "challenged" && isLeader(role)) eligible = [{ ...teamById(state, c.challengedTeamId), role }];
  }
  const creator = (state.members || []).find((m) => m.playerId === c.createdBy);
  return {
    status, mode: c.mode, claimed: Boolean(c.challengedTeamId), challengeId: c.id, currentVersion: c.currentVersion,
    expiresAt: c.expiresAt, turnTeamId: c.turnTeamId, kind: ver?.kind,
    challenger: card(state, c.challengerTeamId), challenged: c.challengedTeamId ? card(state, c.challengedTeamId) : null,
    terms: ver ? normTerms(ver) : null, invitedBy: creator?.nick || null,
    matchId: c.status === "agreed" && side ? (state.matches || []).find((m) => m.challengeId === c.id)?.id ?? null : null,
    viewer: {
      loggedIn: Boolean(meId), side, role,
      hasTeam: Boolean(meId) && (state.members || []).some((m) => m.playerId === meId && m.status === "active" && !teamById(state, m.teamId)?.archived),
      eligibleTeams: eligible,
    },
  };
}
/** get_challenge_invite (snake) → the same app shape as demoChallengeInvite. */
export function normChallengeInvite(d) {
  if (!d || d.status === "not_found") return { status: "not_found" };
  const v = d.viewer || {};
  return {
    status: d.status, mode: d.mode, claimed: Boolean(d.claimed), challengeId: d.challenge_id,
    currentVersion: Number(d.current_version), expiresAt: d.expires_at, turnTeamId: d.turn_team_id ?? null, kind: d.kind,
    challenger: normChallengeTeam(d.challenger), challenged: normChallengeTeam(d.challenged),
    terms: d.terms ? normTerms(d.terms) : null, invitedBy: d.invited_by ?? null, matchId: d.match_id ?? null,
    viewer: {
      loggedIn: Boolean(v.logged_in), side: v.side ?? null, role: v.role ?? null, hasTeam: Boolean(v.has_team),
      eligibleTeams: (v.eligible_teams || []).map((t) => ({ ...normTeam(t), role: t.role })),
    },
  };
}

/**
 * The simulated rival captain (demo only): when it's a demo team's turn,
 * its captain answers — first proposal → a counter one hour later with the
 * cost split down the middle; anything after → accept. A pending change →
 * accept. After agreement, a demo team responsible for the pitch confirms
 * it. Returns { state, action } or null when there's nothing to do.
 */
export function demoRivalMove(state, challengeId, userTeamIds, now = Date.now()) {
  const ch = (state.challenges || []).find((c) => c.id === challengeId);
  if (!ch) return null;
  const mine = new Set(userTeamIds || []);
  const rivalTurn = ch.turnTeamId && !mine.has(ch.turnTeamId);
  if (ch.status === "pending" && rivalTurn && Date.parse(ch.expiresAt) > now) {
    const cap = captainOf(state, ch.turnTeamId);
    if (!cap) return null;
    const me = { id: cap.playerId, nick: cap.nick };
    if (ch.currentVersion === 1) {
      const v = ch.versions[0];
      const later = new Date(Date.parse(v.kickoffAt) + 3600e3).toISOString();
      const r = demoChallengeOp(state, "counter_challenge", { challengeId, baseVersion: 1, terms: { kickoffAt: later, costSplit: "split" } }, me, now);
      if (!r.error) return { state: r.state, action: "countered" };
    }
    const r = demoChallengeOp(state, "respond_challenge", { challengeId, version: ch.currentVersion, action: "accept" }, me, now);
    return r.error ? null : { state: r.state, action: "accepted" };
  }
  if (ch.status === "agreed") {
    const m = (state.matches || []).find((x) => x.challengeId === ch.id);
    if (!m) return null;
    if (ch.pendingChangeVersion != null && rivalTurn) {
      const cap = captainOf(state, ch.turnTeamId);
      const r = demoChallengeOp(state, "respond_match_change", { matchId: m.id, version: ch.pendingChangeVersion, action: "accept" }, { id: cap?.playerId }, now);
      return r.error ? null : { state: r.state, action: "change_accepted" };
    }
    const resp = m.fieldResponsible === "challenger" ? m.homeTeamId : m.awayTeamId;
    if (!mine.has(resp) && m.fieldStatus === "unconfirmed" && m.matchStatus === "scheduled") {
      const cap = captainOf(state, resp);
      const r = demoChallengeOp(state, "set_field_status", { matchId: m.id, status: "confirmed" }, { id: cap?.playerId }, now);
      return r.error ? null : { state: r.state, action: "field_confirmed" };
    }
  }
  return null;
}

/** Demo: a rival (Laranja Mecânica) challenges a freshly created team so
 *  the inbox has something to answer. No-op when the team already has
 *  challenges or the rival team is missing. */
export function demoIncomingChallenge(state, teamId, now = Date.now()) {
  const s = { ...state, challenges: state.challenges || [], matches: state.matches || [] };
  if (s.challenges.some((c) => c.challengerTeamId === teamId || c.challengedTeamId === teamId)) return s;
  const rival = teamById(s, "demo-t-lm");
  const cap = captainOf(s, "demo-t-lm");
  if (!rival || !cap || !teamById(s, teamId)) return s;
  const r = demoChallengeOp(s, "create_challenge", {
    fromTeamId: rival.id, toTeamId: teamId,
    terms: { kickoffAt: demoSlot(now, 6, 21), venueName: rival.homeVenue, format: rival.format, durationMin: 60, costCents: 7000, costSplit: "split", fieldResponsible: "challenger", note: "Bora? Somos da Maia, jogo competitivo mas limpo." },
  }, { id: cap.playerId, nick: cap.nick }, now);
  return r.error ? s : r.state;
}

/** Shared match rows for Jogar/Matchday, including both team identities.
 * my_challenges may contain one item per membership: one fixture per ID. */
export function matchesFromChallenges(challenges = []) {
  const matches = new Map();
  for (const ch of challenges) {
    if (!ch?.match?.id || matches.has(ch.match.id)) continue;
    matches.set(ch.match.id, {
      ...ch.match,
      challengeId: ch.id,
      homeTeam: ch.challenger,
      awayTeam: ch.challenged,
      myTeamId: ch.myTeamId,
      myRole: ch.myRole,
    });
  }
  return [...matches.values()];
}
