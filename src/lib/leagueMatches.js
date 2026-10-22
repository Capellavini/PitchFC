// ─────────────────────────────────────────────────────────
// PITCH Ligas Fase 2 — L4–L8 (fixtures, live súmula, homologation,
// standings, discipline, awards): pure helpers between the SECURITY
// DEFINER RPCs and the league UI.
//
//   • norm*      cloud payload (snake_case) → camelCase
//   • to*Demo    cloud shapes → the shapes the Fase 1 demo components
//                already render (LeagueMatchRow, LeagueTimeline,
//                LeagueEventSheet, LeagueStandingsTable, LeagueRankingList,
//                LeagueDiscipline…), so cloud screens REUSE that UI.
//   • eventToCloud  demo-shaped event from LeagueEventSheet → p_event.
//   • provisionalStandings  official rows + not-yet-homologated scores.
//   • roundRobinRounds  complete round robin WITH round numbers (the
//                server validates it in create_fixtures).
//   • matchPermissions  what the caller may do on one match (plan §5.1);
//                the server re-checks every RPC — this only hides buttons.
//
// RPC names/args follow supabase/migrations/20261016155300 + 155400 (L4,
// L5 events, deployed) and docs/ligas-draft-sql/05b, 06, 07, 08.
// No React, no Vite globals: imported by node --test (leagueMatches.test.js).
// ─────────────────────────────────────────────────────────

// ── Match state: server (match_status × result_status) → UI state ──
/** The demo UI vocabulary + two cloud-only states (unscheduled, abandoned). */
export function uiMatchState(matchStatus, resultStatus) {
  switch (matchStatus) {
    case "unscheduled": return "unscheduled";
    case "scheduled": return "scheduled";
    case "postponed": return "postponed";
    case "cancelled": return "cancelled";
    case "live": return "live";
    case "abandoned": return resultStatus === "homologated" ? "homologated" : "abandoned";
    case "finished":
      if (resultStatus === "homologated") return "homologated";
      if (resultStatus === "submitted") return "in_review";
      return "ended_provisional";
    default: return "scheduled";
  }
}
/** States whose (provisional) score is worth showing. */
export const SCORE_STATES = new Set(["live", "ended_provisional", "in_review", "homologated", "walkover", "abandoned"]);
/** Not homologated yet but already has a score (provisional table input). */
export const PENDING_STATES = new Set(["live", "ended_provisional", "in_review"]);

const initialsOf = (name) => String(name || "?").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "?";

// ── Directory: teams + homologated squads (competition_teams_page) ──
/**
 * { teamById, playerById, players, teams } from normTeamsPage() items —
 * the lookup the demo components read (teamById[x].name/short/color,
 * playerById[x].name/teamId/number). `palette`: colours for teams without
 * one (theme tokens, passed by the caller — no hex here).
 */
export function buildDirectory(teamsPage = [], palette = []) {
  const teams = []; const players = [];
  teamsPage.forEach((x, i) => {
    const tm = x.team || {};
    if (!tm.id) return;
    teams.push({ id: tm.id, slug: tm.slug ?? null, name: tm.name || "—", short: initialsOf(tm.name), color: tm.color || palette[i % (palette.length || 1)] || null,
      logoUrl: tm.logoUrl ?? null });
    (x.squad || []).forEach((p) => players.push({ id: p.playerId, name: p.name || "—", nick: p.name || "—", teamId: tm.id,
      number: p.shirtNumber ?? null, position: p.position ?? null, photo: p.photoUrl ?? null }));
  });
  return {
    teams, players,
    teamById: Object.fromEntries(teams.map((t) => [t.id, t])),
    playerById: Object.fromEntries(players.map((p) => [p.id, p])),
  };
}

/** Adds teams seen only in a match payload (e.g. a team that withdrew). */
export function ensureTeams(dir, refs = []) {
  const missing = refs.filter((r) => r?.id && !dir.teamById[r.id]);
  if (!missing.length) return dir;
  const extra = missing.map((r) => ({ id: r.id, slug: r.slug ?? null, name: r.name || "—", short: initialsOf(r.name), color: r.color ?? null, logoUrl: r.logoUrl ?? null }));
  return { ...dir, teams: [...dir.teams, ...extra], teamById: { ...dir.teamById, ...Object.fromEntries(extra.map((t) => [t.id, t])) } };
}

// ── competition_matches ──────────────────────────────────
export function normMatches(d) {
  return ((d?.items) || []).map((m) => ({
    id: m.id, round: m.round ?? null, roundName: m.round_name ?? null,
    home: { id: m.home?.id, name: m.home?.name, slug: m.home?.slug ?? null, logoUrl: m.home?.logo_url ?? null },
    away: { id: m.away?.id, name: m.away?.name, slug: m.away?.slug ?? null, logoUrl: m.away?.logo_url ?? null },
    homeId: m.home?.id, awayId: m.away?.id,
    kickoff: m.kickoff_at ?? null, timezone: m.timezone ?? null, venue: m.venue_name ?? null,
    matchStatus: m.match_status, resultStatus: m.result_status ?? "none",
    state: uiMatchState(m.match_status, m.result_status),
    homeScore: m.home_score ?? null, awayScore: m.away_score ?? null,
    // staff console only (competition_matches_staff)
    seq: m.seq ?? null, statusReason: m.status_reason ?? null, replayOf: m.replay_of_match_id ?? null,
    officials: (m.officials || []).map((o) => ({ playerId: o.player_id, name: o.name, role: o.role })),
  }));
}

// ── match_live ───────────────────────────────────────────
const CLOUD_TO_UI_EVENT = { goal: "goal", own_goal: "own_goal", yellow: "card_yellow", second_yellow: "card_second_yellow", red: "card_red", sub: "sub" };
const UI_TO_CLOUD_EVENT = { goal: "goal", own_goal: "own_goal", card_yellow: "yellow", card_second_yellow: "second_yellow", card_red: "red", sub: "sub" };
/** Event types a cloud league accepts from the sheet (no shoot-outs in Fase 2). */
export const CLOUD_EVENT_TYPES = ["goal", "own_goal", "card_yellow", "card_second_yellow", "card_red"];

/** One effective timeline row → the demo event shape. `null` for period markers. */
export function timelineEventToDemo(e, matchId) {
  const type = CLOUD_TO_UI_EVENT[e?.type];
  if (!type) return null;
  return {
    id: e.id, matchId, type, teamId: e.team_id ?? null, playerId: e.player_id ?? null, assistId: e.assist_player_id ?? null,
    minute: e.minute ?? null, period: e.period ?? null, playerName: e.player ?? null, assistName: e.assist ?? null,
    corrected: Boolean(e.corrected), supersedes: null, voidReason: null,
  };
}

export function normMatchLive(d) {
  if (!d?.match) return null;
  const m = d.match;
  const match = {
    id: m.id, competitionId: m.competition_id ?? null, roundId: m.round_id ?? null,
    homeId: m.home_team_id, awayId: m.away_team_id, kickoff: m.kickoff_at ?? null, timezone: m.timezone ?? null,
    venue: m.venue_name ?? null, matchStatus: m.match_status, resultStatus: m.result_status ?? "none",
    state: uiMatchState(m.match_status, m.result_status), seq: m.seq ?? 0, startedAt: m.started_at ?? null, endedAt: m.ended_at ?? null,
    statusReason: m.status_reason ?? null,
  };
  return {
    match,
    score: { home: d.score?.home ?? 0, away: d.score?.away ?? 0, state: d.score?.state || "none",
      pendingRehomologation: Boolean(d.score?.pending_rehomologation), shootout: null },
    log: (d.timeline || []).map((e) => timelineEventToDemo(e, m.id)).filter(Boolean),
    officials: (d.officials || []).map((o) => ({ role: o.role, name: o.name, playerId: o.player_id ?? null })),
    myRole: d.my_role ?? null,
    canHomologate: Boolean(d.can_homologate),
  };
}

/**
 * match_page (match_live ∪ competition, round, teams, homologation,
 * official_mvp, fan_vote, formations, dispute, me). Also accepts a bare
 * match_live payload (extras null) while match_page isn't deployed.
 */
export function normMatchPage(d) {
  const live = normMatchLive(d);
  if (!live) return null;
  const c = d.competition || null;
  const team = (x) => (x ? { id: x.id, name: x.name, slug: x.slug ?? null, logoUrl: x.logo_url ?? null } : null);
  const me = d.me || null;
  return {
    ...live,
    competition: c ? { id: c.id, name: c.name, slug: c.slug, leagueId: c.league_id, leagueSlug: c.league_slug, leagueName: c.league_name,
      modality: c.modality, format: c.format, matchDurationMin: c.match_duration_min ?? null, youth: Boolean(c.youth) } : null,
    round: d.round ? { number: d.round.number, name: d.round.name ?? null } : null,
    teams: d.teams ? { home: team(d.teams.home), away: team(d.teams.away) } : null,
    homologation: d.homologation ? { revision: d.homologation.revision, kind: d.homologation.kind, home: d.homologation.home_score,
      away: d.homologation.away_score, role: d.homologation.decided_role, at: d.homologation.created_at, regulationVersion: d.homologation.regulation_version,
      reason: d.homologation.reason ?? null } : null,
    officialMvp: d.official_mvp ? { playerId: d.official_mvp.player_id, name: d.official_mvp.name, teamId: d.official_mvp.team_id,
      revision: d.official_mvp.revision, role: d.official_mvp.decided_role } : null,
    fanVote: d.fan_vote ? normFanVote(d.fan_vote) : null,
    formations: { home: normFormation(d.formations?.home), away: normFormation(d.formations?.away) },
    dispute: { windowClosesAt: d.dispute?.window_closes_at ?? null, openCount: d.dispute?.open_count ?? null },
    me: me ? { isStaff: Boolean(me.is_staff), isManager: Boolean(me.is_manager), operatorRole: me.operator_role ?? null,
      canHomologate: Boolean(me.can_homologate), leaderOfTeamId: me.leader_of_team_id ?? null, memberOfTeamId: me.member_of_team_id ?? null } : null,
  };
}

export const normEventHistory = (d) => ((d?.items) || []).map((e) => ({
  id: e.id, seq: e.seq, action: e.action, supersedes: e.supersedes ?? null, type: CLOUD_TO_UI_EVENT[e.type] || e.type,
  teamId: e.team_id ?? null, playerId: e.player_id ?? null, assistId: e.assist_player_id ?? null, minute: e.minute ?? null,
  reason: e.reason ?? null, source: e.source ?? null, recordedBy: e.recorded_by ?? null, recordedRole: e.recorded_role ?? null,
  recordedAt: e.recorded_at ?? null, effective: e.effective !== false,
}));

/**
 * LeagueEventSheet output → record_match_event p_event.
 *   new     : { id, type, teamId, playerId, assistId, minute }
 *   correct : + { supersedes, voidReason }   → action 'correct'
 *   void    : { id, type:'void', supersedes, voidReason } → action 'void'
 * `post` = the match is already submitted/homologated (authority
 * correction: source 'correction', reason mandatory).
 */
export function eventToCloud(ev, { post = false } = {}) {
  if (!ev?.id) return { error: "event_id_required" };
  const reason = ev.voidReason ? String(ev.voidReason).trim() : null;
  if (ev.type === "void") {
    if (!ev.supersedes) return { error: "event_not_found" };
    if (!reason) return { error: "reason_required" };
    return { data: { id: ev.id, action: "void", supersedes: ev.supersedes, reason, ...(post ? { source: "correction" } : {}) } };
  }
  const type = UI_TO_CLOUD_EVENT[ev.type];
  if (!type) return { error: "invalid_event" };
  if (ev.supersedes && !reason) return { error: "reason_required" };
  if (post && !reason) return { error: "reason_required" };
  const minute = ev.minute == null || ev.minute === "" ? null : Number(ev.minute);
  return { data: {
    id: ev.id, action: ev.supersedes ? "correct" : "add", ...(ev.supersedes ? { supersedes: ev.supersedes } : {}),
    type, team_id: ev.teamId, player_id: ev.playerId || null,
    assist_player_id: type === "goal" && ev.assistId ? ev.assistId : null,
    minute: Number.isFinite(minute) ? minute : null,
    ...(reason ? { reason } : {}), ...(post ? { source: "correction" } : {}),
    client_recorded_at: ev.recordedAt || null,
  } };
}

/** RFC 4122 v4 id for an event (server column is uuid). */
export function newCloudEventId(rand = Math.random) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && rand === Math.random) return crypto.randomUUID();
  const h = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16));
  h[12] = "4"; h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

// ── Standings ────────────────────────────────────────────
export function normStandings(d, dir = null) {
  if (!d) return null;
  const rows = (d.rows || []).map((r) => ({
    id: r.team_id, name: r.name || dir?.teamById?.[r.team_id]?.name || "—",
    short: dir?.teamById?.[r.team_id]?.short || initialsOf(r.name), color: dir?.teamById?.[r.team_id]?.color ?? null,
    j: r.j ?? 0, w: r.w ?? 0, d: r.d ?? 0, l: r.l ?? 0, gf: r.gf ?? 0, ga: r.ga ?? 0, gd: r.gd ?? 0, pts: r.pts ?? 0,
    adjustments: r.adjustments ?? 0, rank: r.rank ?? null, tieUnresolved: Boolean(r.tie_unresolved),
  }));
  return {
    rows, regulationVersion: d.regulation_version ?? null, tiebreakers: d.tiebreakers || ["pts", "gd", "gf"],
    points: d.points || { win: 3, draw: 1, loss: 0 }, pending: d.pending ?? 0,
    adjustments: (d.adjustments || []).map((a) => ({ id: a.id ?? null, teamId: a.team_id, points: a.points, reason: a.reason, createdAt: a.created_at ?? null })),
  };
}

const SORTERS = { pts: (r) => r.pts, gd: (r) => r.gd, gf: (r) => r.gf, wins: (r) => r.w, ga_fewest: (r) => -r.ga };
/**
 * Official rows + results of matches that are NOT homologated yet
 * ([{ homeId, awayId, home, away }]) → a provisional table, re-sorted by
 * the regulation tiebreakers (h2h is skipped in the preview — it is
 * computed only by the server for the official table). Pure; adjustments
 * and W.O. deductions already inside the official `pts` are kept.
 */
export function provisionalStandings(rows, pending = [], { points = { win: 3, draw: 1, loss: 0 }, tiebreakers = ["pts", "gd", "gf"] } = {}) {
  const by = Object.fromEntries((rows || []).map((r) => [r.id, { ...r }]));
  for (const m of pending || []) {
    const H = by[m.homeId], A = by[m.awayId];
    if (!H || !A || m.home == null || m.away == null) continue;
    H.j += 1; A.j += 1; H.gf += m.home; H.ga += m.away; A.gf += m.away; A.ga += m.home;
    if (m.home > m.away) { H.w += 1; A.l += 1; H.pts += points.win; A.pts += points.loss; }
    else if (m.away > m.home) { A.w += 1; H.l += 1; A.pts += points.win; H.pts += points.loss; }
    else { H.d += 1; A.d += 1; H.pts += points.draw; A.pts += points.draw; }
    H.gd = H.gf - H.ga; A.gd = A.gf - A.ga;
  }
  const keys = (tiebreakers || []).filter((k) => SORTERS[k]);
  const cmp = (a, b) => { for (const k of keys) { const d = SORTERS[k](b) - SORTERS[k](a); if (d) return d; } return 0; };
  const sorted = Object.values(by).sort((a, b) => cmp(a, b) || String(a.name).localeCompare(String(b.name)));
  return sorted.map((r, i) => {
    const first = sorted.findIndex((x) => cmp(x, r) === 0);
    return { ...r, rank: first + 1, tieUnresolved: sorted.filter((x) => cmp(x, r) === 0).length > 1, _i: i };
  }).map(({ _i, ...r }) => r);
}

/** Zero rows for every homologated team (empty competition / mirror). */
export const zeroRows = (teams = []) => teams.map((t) => ({ id: t.id, name: t.name, short: t.short ?? initialsOf(t.name), color: t.color ?? null,
  j: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, adjustments: 0, rank: 1, tieUnresolved: false }));

// ── Player stats / rankings ──────────────────────────────
export const normPlayerStats = (d) => ((d?.items) || []).map((s) => ({
  playerId: s.player_id, name: s.name || "—", photo: s.photo_url ?? null, teamId: s.team_id,
  apps: s.apps ?? 0, goals: s.goals ?? 0, assists: s.assists ?? 0, ownGoals: s.own_goals ?? 0, yellows: s.yellows ?? 0, reds: s.reds ?? 0,
}));

/** LeagueRankingList rows for goals | assists | apps (value > 0, top `limit`). */
export function rankingRows(stats, key = "goals", limit = 10) {
  return (stats || []).filter((s) => (s[key] || 0) > 0)
    .sort((a, b) => (b[key] - a[key]) || (a.apps - b.apps) || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map((s) => ({ player: { id: s.playerId, name: s.name, photo: s.photo, teamId: s.teamId }, value: s[key] }));
}
export function cardRows(stats) {
  return (stats || []).filter((s) => s.yellows + s.reds > 0)
    .sort((a, b) => (b.reds - a.reds) || (b.yellows - a.yellows))
    .map((s) => ({ player: { id: s.playerId, name: s.name, photo: s.photo, teamId: s.teamId }, y: s.yellows, r: s.reds, value: s.reds * 10 + s.yellows }));
}

// ── Discipline ───────────────────────────────────────────
export const normDiscipline = (d) => ({
  suspended: ((d?.suspended) || []).map((s) => ({ playerId: s.player_id, teamId: s.team_id, matches: s.matches ?? 0, served: s.served ?? 0, name: s.name || "—" })),
  pendingCases: d?.pending_cases ?? null,
});
export const normDisciplineCase = (c) => ({
  id: c.case_id ?? c.id, name: c.name ?? null, teamName: c.team_name ?? null, round: c.round ?? null, served: c.served ?? null, active: Boolean(c.active), playerId: c.player_id, teamId: c.team_id, sourceMatchId: c.source_match_id ?? null, trigger: c.trigger,
  accumulationN: c.accumulation_n ?? null, suggested: c.suggested_matches ?? 0, decided: c.decided_matches ?? null,
  status: c.status, reason: c.reason ?? null, createdAt: c.created_at ?? null,
});
/**
 * LeagueDiscipline rows ({ playerId, teamId, yellows, reds, served, pending })
 * = official card counts ∪ active suspensions. `pending` = matches still
 * to serve (confirmed suspensions only — pending cases never block).
 */
export function disciplineRows(stats = [], discipline = { suspended: [] }) {
  const out = {};
  for (const s of stats) {
    if (s.yellows + s.reds > 0) out[s.playerId] = { playerId: s.playerId, teamId: s.teamId, name: s.name, yellows: s.yellows, reds: s.reds, served: 0, pending: 0 };
  }
  for (const x of discipline.suspended || []) {
    const r = out[x.playerId] || { playerId: x.playerId, teamId: x.teamId, name: x.name, yellows: 0, reds: 0, served: 0, pending: 0 };
    r.served += x.served; r.pending += Math.max(0, x.matches - x.served);
    out[x.playerId] = r;
  }
  return out;
}

// ── Awards / fan vote / formation / disputes ─────────────
export const normFanVote = (d) => ({
  state: d?.state || "none", opensAt: d?.opens_at ?? null, closesAt: d?.closes_at ?? null, myVote: d?.my_vote ?? null, totalVotes: d?.total_votes ?? null,
  items: (d?.items || []).map((x) => ({ playerId: x.player_id, name: x.name, votes: x.votes ?? 0 })),
});
export const normAward = (a) => (a ? { playerId: a.player_id, teamId: a.team_id ?? null, revision: a.revision ?? 1, role: a.decided_role ?? null,
  reason: a.reason ?? null, at: a.created_at ?? a.decided_at ?? null } : null);
export function normFormation(d) {
  if (!d) return null;
  return {
    formation: d.formation, version: d.version ?? 1, visibility: d.visibility || "team", by: d.published_by ?? null, at: d.published_at ?? null,
    slots: Object.fromEntries(Object.entries(d.slots || {}).map(([k, v]) => [k, typeof v === "string" ? v : v?.player_id]).filter(([, v]) => v)),
  };
}
export const normDispute = (x) => ({
  id: x.id, matchId: x.match_id, round: x.round ?? null, homeId: x.home_team_id ?? null, awayId: x.away_team_id ?? null,
  openedBy: x.opened_by ?? null, canDecide: Boolean(x.can_decide), evidence: Array.isArray(x.evidence) ? x.evidence : [], teamId: x.opened_by_team_id, reason: x.reason, status: x.status, deadlineAt: x.deadline_at ?? null,
  decisionNote: x.decision_note ?? null, createdAt: x.created_at ?? null,
});

// ── Fixtures ─────────────────────────────────────────────
/**
 * Complete round robin with round numbers (circle method), the payload
 * create_fixtures validates: [{ round, home_team_id, away_team_id }].
 * Odd team counts get a bye per round. Double-legged = second half with
 * home/away swapped, rounds continuing the numbering.
 */
export function roundRobinRounds(teamIds, doubleLegged = false) {
  const ids = [...new Set(teamIds || [])];
  if (ids.length < 2) return [];
  if (ids.length % 2) ids.push(null);
  const n = ids.length; const rot = [...ids]; const out = [];
  for (let r = 0; r < n - 1; r += 1) {
    for (let i = 0; i < n / 2; i += 1) {
      let h = rot[i], a = rot[n - 1 - i];
      if (h === null || a === null) continue;
      if (i === 0 && r % 2 === 1) [h, a] = [a, h]; // alternate the fixed team's venue
      out.push({ round: r + 1, home_team_id: h, away_team_id: a });
    }
    rot.splice(1, 0, rot.pop());
  }
  if (!doubleLegged) return out;
  const half = n - 1;
  return [...out, ...out.map((f) => ({ round: f.round + half, home_team_id: f.away_team_id, away_team_id: f.home_team_id }))];
}

// ── Permissions (plan §5.1) — UI only, the server re-checks ──
const OPERATOR_ROLES = new Set(["referee", "scorer", "owner", "manager", "team_leader"]);
/**
 * live: normMatchLive() result. ctx: { isManager, leaderTeamIds, memberTeamIds,
 * signedIn, rules, fanVote }.
 */
export function matchPermissions(live, { isManager = false, leaderTeamIds = [], memberTeamIds = [], signedIn = false, rules = null, fanVote = live?.fanVote ?? null } = {}) {
  const m = live?.match;
  if (!m) return {};
  const ms = m.matchStatus, rs = m.resultStatus;
  const me = live.me || null;
  if (me) { isManager = isManager || me.isManager; if (me.leaderOfTeamId) leaderTeamIds = [...leaderTeamIds, me.leaderOfTeamId]; if (me.memberOfTeamId) memberTeamIds = [...memberTeamIds, me.memberOfTeamId]; }
  const op = OPERATOR_ROLES.has(me?.operatorRole ?? live.myRole);
  const auth = Boolean(me ? me.canHomologate : live.canHomologate);
  const myRole = me?.operatorRole ?? live.myRole;
  const pre = ["unscheduled", "scheduled", "postponed"].includes(ms);
  const post = rs === "submitted" || rs === "homologated";
  const leaderTeamId = [m.homeId, m.awayId].find((id) => leaderTeamIds.includes(id)) || null;
  const memberTeamId = [m.homeId, m.awayId].find((id) => memberTeamIds.includes(id) || leaderTeamIds.includes(id)) || null;
  const ended = ms === "finished" || ms === "abandoned";
  const mvpBy = rules?.mvp?.official_by || ["referee", "manager"];
  return {
    isOperator: op, isAuthority: auth, leaderTeamId, memberTeamId,
    start: op && ms === "scheduled",
    addEvent: op && (ms === "live" || ms === "finished") && !post,
    end: op && ms === "live",
    submit: ["referee", "owner", "manager"].includes(myRole) && ms === "finished" && rs === "provisional",
    homologate: auth && ended && (rs === "provisional" || rs === "submitted"),
    rehomologate: auth && rs === "homologated" && Boolean(live.score?.pendingRehomologation),
    correct: (op && (ms === "live" || ms === "finished") && !post) || (auth && post),
    correctNeedsReason: post,
    walkover: auth && pre,
    abandon: (op || auth) && ms === "live",
    decideAbandoned: auth && ms === "abandoned" && rs !== "homologated",
    schedule: isManager && pre,
    postpone: isManager && pre && ms !== "postponed",
    cancel: isManager && pre,
    assignOfficials: isManager && ms !== "cancelled",
    dispute: Boolean(leaderTeamId) && ["provisional", "submitted", "homologated"].includes(rs),
    decideDispute: auth,
    formation: (teamId) => (leaderTeamIds.includes(teamId) || isManager) && pre,
    teamSheet: (op && ["scheduled", "live", "finished", "abandoned"].includes(ms) && !post) || (auth && post),
    officialMvp: ended && ((mvpBy.includes("manager") && isManager) || (mvpBy.includes("owner") && isManager) || (mvpBy.includes("referee") && myRole === "referee")),
    openFanVote: isManager && Boolean(rules?.mvp?.fan_vote) && ended && (!fanVote || fanVote.state === "none"),
    vote: signedIn && fanVote?.state === "open",
  };
}

/** Manager "à espera" list from the calendar: fichas to validate, live now. */
export function pendingWork(matches = []) {
  return {
    toHomologate: matches.filter((m) => m.state === "ended_provisional" || m.state === "in_review" || m.state === "abandoned"),
    live: matches.filter((m) => m.state === "live"),
    toSchedule: matches.filter((m) => m.state === "unscheduled" || m.state === "postponed"),
  };
}
