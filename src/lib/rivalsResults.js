// ─────────────────────────────────────────────────────────
// PITCH Rivals — team-match results, call-up, lineup, player stats and
// the metrics derived from them (PR7). Pure: no React, no Supabase.
//
// The demo operations at the bottom MIRROR the SECURITY DEFINER RPCs of
// supabase/migrations/20261014120000_rivals_results.sql as written in
// docs/RIVALS-RESULTS-CONTRACT.md (same rules, same `rivals:<code>`
// codes): report → the OTHER team confirms; contest → a counter revision;
// a correction keeps the official score until the other team confirms it;
// nothing ever auto-confirms; only CONFIRMED results feed the record,
// form, streak, head-to-head and per-player numbers.
//
// The view helpers (resultView, matchFeedItems…) derive the state from the
// official score + the open revision — never from result_status alone — so
// they work whichever status the server keeps during a pending correction.
// ─────────────────────────────────────────────────────────

import { computeOverall } from "./core/overall.js";
import { isLeader, normRecord, normTeam, emptyRecord } from "./rivals.js";

export const MAX_SCORE = 99;
export const MAX_STAT = 30;
export const MAX_LINEUP = 22;
/** Contesting is blocked once a match already has this many revisions → "Fala connosco". */
export const MAX_REVISIONS = 4;
export const MAX_TOTAL_REVISIONS = 30;
export const HELP_AFTER_DAYS = 7;
export const AVAILABILITY_STATUSES = ["yes", "no", "maybe"];
const DAY = 864e5;

// ── Shapes (cloud snake_case → app camelCase; demo already camel) ──
const num = (v, d = 0) => (v == null || v === "" ? d : Number(v));
const pickKey = (r, camel, snake) => (r?.[camel] !== undefined ? r[camel] : r?.[snake]);

/** One result revision (the contract's `result` object / get_match_results item). */
export function normResult(r) {
  if (!r) return null;
  return {
    matchId: pickKey(r, "matchId", "match_id") ?? null, revision: num(r.revision), kind: r.kind, status: r.status,
    homeScore: num(pickKey(r, "homeScore", "home_score")), awayScore: num(pickKey(r, "awayScore", "away_score")),
    reportedByTeamId: pickKey(r, "reportedByTeamId", "reported_by_team_id") ?? null,
    reportedByPlayerId: pickKey(r, "reportedByPlayerId", "reported_by_player_id") ?? null,
    respondedByPlayerId: pickKey(r, "respondedByPlayerId", "responded_by_player_id") ?? null,
    note: r.note ?? null, createdAt: pickKey(r, "createdAt", "created_at") ?? null, respondedAt: pickKey(r, "respondedAt", "responded_at") ?? null,
    // additive keys of the mutations (contract deviation 6)
    match: r.match ? {
      id: r.match.id, matchStatus: pickKey(r.match, "matchStatus", "match_status"), resultStatus: pickKey(r.match, "resultStatus", "result_status"),
      officialHomeScore: pickKey(r.match, "officialHomeScore", "official_home_score") ?? null, officialAwayScore: pickKey(r.match, "officialAwayScore", "official_away_score") ?? null,
      confirmedRevision: pickKey(r.match, "confirmedRevision", "confirmed_revision") ?? null, resultConfirmedAt: pickKey(r.match, "resultConfirmedAt", "result_confirmed_at") ?? null,
    } : null,
    alreadyConfirmed: Boolean(pickKey(r, "alreadyConfirmed", "already_confirmed")), alreadyWithdrawn: Boolean(pickKey(r, "alreadyWithdrawn", "already_withdrawn")),
  };
}
const person = (r) => ({
  playerId: pickKey(r, "playerId", "player_id"), nick: r.nick ?? null, name: r.name ?? null,
  photoUrl: pickKey(r, "photoUrl", "photo_url") ?? null, position: r.position ?? null,
});
export const normCounts = (c, items = null) => {
  if (c) return { yes: num(c.yes), no: num(c.no), maybe: num(c.maybe), pending: num(c.pending) };
  const out = { yes: 0, no: 0, maybe: 0, pending: 0 };
  for (const it of items || []) out[it.status || "pending"] += 1;
  return out;
};
/** get_match_availability → { items, counts }. */
export function normAvailability(d) {
  const items = (d?.items || []).map((r) => ({ ...person(r), role: r.role ?? "player", status: r.status ?? null, updatedAt: pickKey(r, "updatedAt", "updated_at") ?? null }));
  return { items, counts: normCounts(d?.counts, items) };
}
export const normLineup = (d) => ({ items: (d?.items || []).map((r) => ({ ...person(r), teamId: pickKey(r, "teamId", "team_id") })) });
export const normResultList = (d) => ({
  items: (d?.items || []).map(normResult).sort((a, b) => a.revision - b.revision),
  official: d?.official ? {
    homeScore: num(pickKey(d.official, "homeScore", "home_score")), awayScore: num(pickKey(d.official, "awayScore", "away_score")),
    revision: d.official.revision != null ? num(d.official.revision) : null,
  } : null,
});
export const normPlayerStats = (d) => ({
  items: (d?.items || []).map((r) => ({
    teamId: pickKey(r, "teamId", "team_id"), playerId: pickKey(r, "playerId", "player_id"), nick: r.nick ?? null,
    goals: num(r.goals), assists: num(r.assists),
  })),
});
const normLast = (l) => (l ? {
  kickoffAt: pickKey(l, "kickoffAt", "kickoff_at") ?? null,
  score: typeof l.score === "string" ? l.score : l.score && typeof l.score === "object" ? `${num(l.score.for ?? l.score.home)}-${num(l.score.against ?? l.score.away)}` : null,
  outcome: l.outcome ?? l.result ?? null,
} : null);
export const emptyH2H = () => ({ played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, last: null, confrontoN: 1 });
export function normH2H(d) {
  if (!d) return emptyH2H();
  const played = num(d.played);
  return {
    played, wins: num(d.wins), draws: num(d.draws), losses: num(d.losses),
    goalsFor: num(d.gf ?? d.goalsFor), goalsAgainst: num(d.ga ?? d.goalsAgainst), last: normLast(d.last),
    confrontoN: num(pickKey(d, "confrontoN", "confronto_n"), played + 1),
  };
}
/** Full-name display: nick first, then name. */
export const personLabel = (p) => p?.nick || p?.name || "—";
const withOvr = (r) => ({
  // OVR is computed here from the attrs (never stored); an unrated player has none.
  ...person(r), attrs: r.attrs ?? null, ovr: r.attrs ? computeOverall(r.position, r.attrs) : null,
  appearances: num(r.appearances), goals: num(r.goals), assists: num(r.assists),
  memberSince: pickKey(r, "memberSince", "member_since") ?? null,
});
/** team_player_stats → { items }. */
export const normSeasonStats = (d) => ({ items: (d?.items || []).map(withOvr) });
/** scout_opponent → { team, record, h2h, items } (OVR computed client-side). */
export const normScout = (d) => ({
  team: d?.team ? normTeam(d.team) : null, record: normRecord(d?.record), h2h: normH2H(d?.h2h),
  items: (d?.items || []).map(withOvr),
});
/** my_team_career → { items }. */
export const normCareer = (d) => ({
  items: (d?.items || []).map((r) => ({
    teamId: pickKey(r, "teamId", "team_id"), name: r.name, slug: r.slug,
    appearances: num(r.appearances), goals: num(r.goals), assists: num(r.assists), wins: num(r.wins), draws: num(r.draws), losses: num(r.losses),
  })),
});
/** team_profile top_scorers / top_assisters → [{ nick, n }]. */
export const normTop = (list) => (Array.isArray(list) ? list.map((x) => ({ nick: x.nick ?? x.name ?? "—", n: num(x.n ?? x.goals ?? x.assists) })) : []);
/** Top 3 by `key` ("goals" | "assists") out of team_player_stats items (zeros never make the list). */
export const topFrom = (items, key) => (items || []).filter((p) => p[key] > 0)
  .sort((a, b) => (b[key] - a[key]) || (b.appearances - a.appearances)).slice(0, 3).map((p) => ({ nick: p.nick || p.name || "—", n: p[key] }));

// ── Outcome + view helpers ──────────────────────────────
export const resultOutcome = (mine, theirs) => (mine > theirs ? "W" : mine < theirs ? "L" : "D");
const sideScores = (m, myTeamId, h, a) => (m.homeTeamId === myTeamId ? { mine: h, theirs: a } : { mine: a, theirs: h });
/** Home/away scores for "mine vs theirs" typed by the user. */
export const toHomeAway = (m, myTeamId, mine, theirs) => (m.homeTeamId === myTeamId ? { homeScore: mine, awayScore: theirs } : { homeScore: theirs, awayScore: mine });
export const validScore = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_SCORE;

/**
 * Where the result of ONE match stands, from my team's side.
 * match = normMatch() (needs match.result), opts.myTeamId, opts.leader.
 * phase: before | ready | reported | disputed | confirmed | correction | not_played | cancelled
 *  - ready      kickoff passed, nothing reported
 *  - reported   first report waiting for the OTHER team (never official)
 *  - disputed   a counter-proposal is waiting
 *  - confirmed  official score (both teams agreed)
 *  - correction an official score stands while a correction waits
 * Also: official/open {mine, theirs, …}, flags for the leader's actions.
 */
export function resultView(match, { myTeamId, leader = false, now = Date.now() } = {}) {
  const res = match?.result || {};
  const hasOfficial = res.officialHomeScore != null && res.officialAwayScore != null;
  const open = res.openRevision || null;
  const kicked = Date.parse(match?.kickoffAt) <= now;
  const revisionsCount = res.revisionsCount || 0;
  // Before any confirmation every revision belongs to the chain, so a 4th can never be proposed (3 are
  // already "stuck"). After a confirmation the chain is shorter than revisionsCount and only the server
  // knows: it answers needs_help and the UI shows the help card then.
  const stuck = Boolean(open) && !hasOfficial && revisionsCount >= MAX_REVISIONS - 1;
  const party = Boolean(myTeamId) && (match?.homeTeamId === myTeamId || match?.awayTeamId === myTeamId);

  let phase;
  if (match?.matchStatus === "cancelled") phase = "cancelled";
  else if (match?.matchStatus === "not_played") phase = "not_played";
  else if (hasOfficial) phase = open ? "correction" : "confirmed";
  else if (open) phase = open.kind === "counter" || res.status === "disputed" ? "disputed" : "reported";
  else phase = kicked ? "ready" : "before";

  const official = hasOfficial ? { ...sideScores(match, myTeamId, res.officialHomeScore, res.officialAwayScore), homeScore: res.officialHomeScore, awayScore: res.officialAwayScore } : null;
  if (official) official.outcome = resultOutcome(official.mine, official.theirs);
  const byMe = Boolean(open) && open.reportedByTeamId === myTeamId;
  const openInfo = open ? { ...open, ...sideScores(match, myTeamId, open.homeScore, open.awayScore), byMe } : null;
  const age = open?.createdAt ? now - Date.parse(open.createdAt) : 0;
  const lead = leader && party;
  return {
    phase, kicked, party, official, open: openInfo, revisionsCount, byMe,
    canReport: lead && phase === "ready",
    canMarkNotPlayed: lead && phase === "ready",
    canRespond: lead && Boolean(open) && !byMe,
    canContest: lead && Boolean(open) && !byMe && !stuck,
    canWithdraw: lead && Boolean(open) && byMe,
    canCorrect: lead && phase === "confirmed",
    // stale: a proposal nobody answered for a week; stuck: four revisions and still no agreement
    needsHelp: Boolean(open) && (stuck || age > HELP_AFTER_DAYS * DAY),
    stuck,
    /** Anyone on the team (not only leaders) can see the call-up, lineup and stats. */
    waitingOnOther: Boolean(open) && byMe,
  };
}

/** Stage of the call-up for a scheduled, not-yet-started match. */
export const rsvpOpen = (match, now = Date.now()) => match?.matchStatus === "scheduled" && Date.parse(match.kickoffAt) > now;

/** Matches that kicked off and are still waiting for a result (or a confirmation), newest first. */
export function matchesAwaitingResult(matches, myTeams, now = Date.now()) {
  const mine = new Set((myTeams || []).map((tm) => tm.id));
  const out = [];
  for (const m of matches || []) {
    if (!m || m.matchStatus !== "scheduled" && m.matchStatus !== "played") continue;
    if (!mine.has(m.myTeamId)) continue;
    const v = resultView(m, { myTeamId: m.myTeamId, leader: isLeader(m.myRole), now });
    if (["ready", "reported", "disputed", "correction"].includes(v.phase) && (v.phase !== "correction" || v.canRespond)) out.push({ match: m, view: v });
  }
  return out.sort((a, b) => Date.parse(b.match.kickoffAt) - Date.parse(a.match.kickoffAt));
}

/**
 * Home feed items about MATCHES of my teams (PR7). Kinds:
 *  - result_confirm   the other team reported a result → I (a leader) must confirm/contest (action);
 *  - result_report    kickoff passed, nothing reported → leader registers the result (action);
 *  - result_confirmed official result of the last 5 days.
 * `matches` = useTeams().matches (rows with myTeamId / myRole / homeTeam / awayTeam).
 */
export function matchFeedItems(matches, now = Date.now()) {
  const out = [];
  for (const m of matches || []) {
    if (!m?.id) continue;
    const leader = isLeader(m.myRole);
    const v = resultView(m, { myTeamId: m.myTeamId, leader, now });
    const mineTeam = m.myTeamId === m.homeTeamId ? m.homeTeam : m.awayTeam;
    const opp = m.myTeamId === m.homeTeamId ? m.awayTeam : m.homeTeam;
    const base = { matchId: m.id, challengeId: m.challengeId, teamId: m.myTeamId, team: mineTeam, opponent: opp, view: v };
    if (v.canRespond && (v.phase === "reported" || v.phase === "disputed" || v.phase === "correction")) {
      out.push({ ...base, id: `match-confirm-${m.id}`, kind: "result_confirm", needsAction: true, ts: Date.parse(v.open.createdAt) || now });
    } else if (v.canReport && now - Date.parse(m.kickoffAt) < 7 * DAY) {
      out.push({ ...base, id: `match-report-${m.id}`, kind: "result_report", needsAction: true, ts: Date.parse(m.kickoffAt) });
    } else if (v.phase === "confirmed" && m.resultConfirmedAt && now - Date.parse(m.resultConfirmedAt) < 5 * DAY) {
      out.push({ ...base, id: `match-done-${m.id}`, kind: "result_confirmed", needsAction: false, ts: Date.parse(m.resultConfirmedAt) });
    }
  }
  return out.sort((a, b) => (b.needsAction - a.needsAction) || (b.ts - a.ts));
}

// ─────────────────────────────────────────────────────────
// Derived metrics over a demo state (mirror of team_record & friends)
// ─────────────────────────────────────────────────────────
const ERR = (code) => ({ error: code });
const iso = (ms) => new Date(ms).toISOString();
const roleIn = (state, teamId, meId) => (state.members || []).find((m) => m.teamId === teamId && m.playerId === meId && m.status === "active")?.role ?? null;
const teamName = (state, id) => (state.teams || []).find((x) => x.id === id)?.name ?? null;
const matchOf = (state, id) => (state.matches || []).find((m) => m.id === id) || null;
const resultsOf = (state, matchId) => (state.results || []).filter((r) => r.matchId === matchId).sort((a, b) => a.revision - b.revision);
const openOf = (state, matchId) => resultsOf(state, matchId).find((r) => r.status === "proposed") || null;
const hasOfficialRow = (m) => m.officialHomeScore != null && m.officialAwayScore != null && m.confirmedRevision != null;
const activeMembers = (state, teamId) => (state.members || []).filter((m) => m.teamId === teamId && m.status === "active");

/** Matches of `teamId` with an official (CONFIRMED) score, newest first. */
function officialMatches(state, teamId) {
  return (state.matches || [])
    .filter((m) => (m.homeTeamId === teamId || m.awayTeamId === teamId) && hasOfficialRow(m))
    .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt));
}
const forAgainst = (m, teamId) => (m.homeTeamId === teamId ? [m.officialHomeScore, m.officialAwayScore] : [m.officialAwayScore, m.officialHomeScore]);

/** team_record: confirmed matches only; cancel / not played are never a loss. */
export function teamRecord(state, teamId) {
  const rec = emptyRecord();
  const ms = officialMatches(state, teamId);
  let best = null;
  for (const m of ms) {
    const [gf, ga] = forAgainst(m, teamId);
    const o = resultOutcome(gf, ga);
    rec.played += 1; rec.goalsFor += gf; rec.goalsAgainst += ga;
    if (o === "W") rec.wins += 1; else if (o === "D") rec.draws += 1; else rec.losses += 1;
    if (ga === 0) rec.cleanSheets += 1;
    if (o === "W" && (!best || gf - ga > best.margin)) {
      const oppId = m.homeTeamId === teamId ? m.awayTeamId : m.homeTeamId;
      best = { margin: gf - ga, opponent: teamName(state, oppId), score: `${gf}-${ga}` };
    }
  }
  rec.goalDiff = rec.goalsFor - rec.goalsAgainst;
  rec.form = ms.slice(0, 5).map((m) => resultOutcome(...forAgainst(m, teamId)));
  if (rec.form.length) {
    let n = 0;
    for (const m of ms) { if (resultOutcome(...forAgainst(m, teamId)) === rec.form[0]) n += 1; else break; }
    rec.streak = { type: rec.form[0], n };
  }
  rec.biggestWin = best ? { opponent: best.opponent, score: best.score } : null;
  for (const m of state.matches || []) {
    if (m.homeTeamId !== teamId && m.awayTeamId !== teamId) continue;
    if (m.matchStatus === "cancelled" && m.cancelledByTeamId === teamId) {
      rec.cancellations += 1;
      if (m.cancelledAt && Date.parse(m.kickoffAt) - Date.parse(m.cancelledAt) < DAY) rec.lateCancellations += 1;
    }
    if (m.matchStatus === "not_played") rec.notPlayed += 1;
  }
  return rec;
}

/** team_head_to_head: confirmed meetings only; confronto_n = meetings + 1. */
export function headToHead(state, teamId, oppId) {
  const ms = officialMatches(state, teamId).filter((m) => m.homeTeamId === oppId || m.awayTeamId === oppId);
  const h = emptyH2H();
  for (const m of ms) {
    const [gf, ga] = forAgainst(m, teamId);
    const o = resultOutcome(gf, ga);
    h.played += 1; h.goalsFor += gf; h.goalsAgainst += ga;
    if (o === "W") h.wins += 1; else if (o === "D") h.draws += 1; else h.losses += 1;
  }
  if (ms[0]) { const [gf, ga] = forAgainst(ms[0], teamId); h.last = { kickoffAt: ms[0].kickoffAt, score: `${gf}-${ga}`, outcome: resultOutcome(gf, ga) }; }
  h.confrontoN = h.played + 1;
  return h;
}

/** Deterministic fake attributes for demo players (the real ones come from players.attrs). */
export function demoAttrs(playerId, position) {
  const h = [...String(playerId)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const base = 55 + (h % 25);
  const keys = position === "Guarda-redes" ? ["ref", "div", "pos", "man", "kic", "spd"] : ["def", "fis", "rit", "pas", "dri", "rem"];
  return Object.fromEntries(keys.map((k, i) => [k, Math.min(95, base + ((h >> (i * 3)) % 17) - 6)]));
}

/** team_player_stats: appearances (lineup) + goals/assists, CONFIRMED matches only. */
export function teamPlayerStats(state, teamId) {
  const confirmed = new Set(officialMatches(state, teamId).map((m) => m.id));
  return activeMembers(state, teamId).map((mem) => {
    const appearances = (state.lineups || []).filter((l) => l.teamId === teamId && l.playerId === mem.playerId && confirmed.has(l.matchId)).length;
    const rows = (state.playerStats || []).filter((s) => s.teamId === teamId && s.playerId === mem.playerId && confirmed.has(s.matchId));
    return {
      playerId: mem.playerId, nick: mem.nick, name: mem.name, photoUrl: mem.photoUrl, position: mem.position,
      attrs: mem.attrs ?? demoAttrs(mem.playerId, mem.position), appearances,
      goals: rows.reduce((n, r) => n + r.goals, 0), assists: rows.reduce((n, r) => n + r.assists, 0), memberSince: mem.joinedAt,
    };
  }).sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || (b.appearances - a.appearances) || String(a.nick).localeCompare(String(b.nick), "pt"));
}

/** my_team_career: my numbers per team (appearances need a lineup spot in a confirmed match). */
export function myCareer(state, meId) {
  const teams = (state.members || []).filter((m) => m.playerId === meId && m.status === "active");
  return teams.map((mem) => {
    const team = (state.teams || []).find((x) => x.id === mem.teamId);
    if (!team || team.archived) return null;
    const played = officialMatches(state, team.id).filter((m) => (state.lineups || []).some((l) => l.matchId === m.id && l.playerId === meId && l.teamId === team.id));
    let wins = 0, draws = 0, losses = 0;
    for (const m of played) { const o = resultOutcome(...forAgainst(m, team.id)); if (o === "W") wins += 1; else if (o === "D") draws += 1; else losses += 1; }
    const ids = new Set(played.map((m) => m.id));
    const rows = (state.playerStats || []).filter((s) => s.playerId === meId && s.teamId === team.id && officialMatches(state, team.id).some((m) => m.id === s.matchId));
    return {
      teamId: team.id, name: team.name, slug: team.slug, appearances: ids.size,
      goals: rows.reduce((n, r) => n + r.goals, 0), assists: rows.reduce((n, r) => n + r.assists, 0), wins, draws, losses,
    };
  }).filter(Boolean);
}

/** Decorate a demo match like the `match` object of my_challenges (result summary + call-up numbers). */
export function decorateDemoMatch(state, m, myTeamId, meId) {
  const rs = resultsOf(state, m.id);
  const open = rs.find((r) => r.status === "proposed") || null;
  const rows = (state.availability || []).filter((a) => a.matchId === m.id && a.teamId === myTeamId);
  const mine = (state.availability || []).find((a) => a.matchId === m.id && a.playerId === meId);
  const counts = { yes: 0, no: 0, maybe: 0, pending: 0 };
  for (const r of rows) counts[r.status] += 1;
  counts.pending = Math.max(0, activeMembers(state, myTeamId).length - rows.length);
  return {
    ...m,
    result: {
      status: m.resultStatus || "none", officialHomeScore: m.officialHomeScore ?? null, officialAwayScore: m.officialAwayScore ?? null,
      openRevision: open, revisionsCount: rs.length,
    },
    myAvailability: mine?.status ?? null, availabilityCounts: counts,
    lineupCount: (state.lineups || []).filter((l) => l.matchId === m.id && l.teamId === myTeamId).length,
    statsRecorded: (state.playerStats || []).some((s) => s.matchId === m.id && s.teamId === myTeamId),
  };
}

// ─────────────────────────────────────────────────────────
// Demo mutations (mirror of the 20261014120000 RPCs)
// ─────────────────────────────────────────────────────────
const patchMatch = (state, id, patch) => ({ ...state, matches: state.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
const touch = (state, challengeId, now) => ({ ...state, challenges: (state.challenges || []).map((c) => (c.id === challengeId ? { ...c, updatedAt: iso(now) } : c)) });
/** The result object every mutation answers with, plus the match summary (contract deviation 6). */
function resultOut(state, row, extra = {}) {
  const m = matchOf(state, row.matchId);
  return {
    ...row,
    match: m && {
      id: m.id, matchStatus: m.matchStatus, resultStatus: m.resultStatus || "none", officialHomeScore: m.officialHomeScore ?? null,
      officialAwayScore: m.officialAwayScore ?? null, confirmedRevision: m.confirmedRevision ?? null, resultConfirmedAt: m.resultConfirmedAt ?? null,
    },
    ...extra,
  };
}
/** Revisions after the last confirmed one (withdrawn included) — the chain needs_help is counted on. */
const chainOf = (m, rs) => rs.filter((r) => r.revision > (m.confirmedRevision ?? 0));

/** Who am I in this match: member teams, leader teams. */
function standing(state, m, meId) {
  const mine = [m.homeTeamId, m.awayTeamId].map((id) => ({ id, role: roleIn(state, id, meId) })).filter((x) => x.role);
  return { memberTeams: mine.map((x) => x.id), leaderTeams: mine.filter((x) => isLeader(x.role)).map((x) => x.id) };
}
/** Leader gate shared by the leader-only ops → { team } | { error }. */
function needLeader(state, m, meId) {
  const s = standing(state, m, meId);
  if (!s.memberTeams.length) return ERR("not_team_member");
  if (!s.leaderTeams.length) return ERR("not_team_leader");
  return { team: s.leaderTeams[0], leaderTeams: s.leaderTeams };
}
const noteTooLong = (note) => String(note ?? "").trim().length > 280;
const tidyNote = (note) => String(note ?? "").trim() || null;
const withFilledRows = (rows, drop, add) => [...rows.filter((r) => !drop(r)), ...add];

function demoAvailability(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  if (!AVAILABILITY_STATUSES.includes(a.status)) return ERR("invalid_status");
  const s = standing(state, m, me.id);
  if (!s.memberTeams.length) return ERR("not_team_member");
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) <= now) return ERR("too_late");
  const teamId = s.memberTeams[0];
  const row = { matchId: m.id, playerId: me.id, teamId, status: a.status, updatedAt: iso(now) };
  return { state: { ...state, availability: withFilledRows(state.availability || [], (r) => r.matchId === m.id && r.playerId === me.id, [row]) }, data: { matchId: m.id, teamId, status: a.status } };
}

function demoLineup(state, a, me) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const g = needLeader(state, m, me.id);
  if (g.error) return g;
  if (!["scheduled", "played"].includes(m.matchStatus)) return ERR("match_not_scheduled");
  const ids = Array.isArray(a.playerIds) ? a.playerIds : null;
  if (!ids || ids.length > MAX_LINEUP || new Set(ids).size !== ids.length) return ERR("invalid_lineup");
  const roster = new Set(activeMembers(state, g.team).map((x) => x.playerId));
  if (!ids.every((id) => roster.has(id))) return ERR("invalid_lineup");
  const rows = ids.map((playerId) => ({ matchId: m.id, playerId, teamId: g.team, setByPlayerId: me.id }));
  // Players dropped from the list lose their goals/assists rows (the server deletes them too).
  const dropped = (state.playerStats || []).filter((r) => r.matchId === m.id && r.teamId === g.team && !ids.includes(r.playerId));
  const playerStats = (state.playerStats || []).filter((r) => !dropped.includes(r));
  return { state: { ...state, playerStats, lineups: withFilledRows(state.lineups || [], (r) => r.matchId === m.id && r.teamId === g.team, rows) }, data: { matchId: m.id, teamId: g.team, count: ids.length, statsRemoved: dropped.length } };
}

function demoPlayerStats(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const g = needLeader(state, m, me.id);
  if (g.error) return g;
  if (!["scheduled", "played"].includes(m.matchStatus)) return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) > now) return ERR("too_early");
  const list = Array.isArray(a.stats) ? a.stats : null;
  if (!list) return ERR("invalid_stats");
  const lineup = (state.lineups || []).filter((l) => l.matchId === m.id && l.teamId === g.team).map((l) => l.playerId);
  const allowed = new Set(lineup.length ? lineup : activeMembers(state, g.team).map((x) => x.playerId));
  const seen = new Set();
  const rows = [];
  for (const it of list) {
    const goals = Number(it?.goals ?? 0), assists = Number(it?.assists ?? 0);
    if (!allowed.has(it?.playerId) || seen.has(it.playerId)) return ERR("invalid_stats");
    if (![goals, assists].every((v) => Number.isInteger(v) && v >= 0 && v <= MAX_STAT)) return ERR("invalid_stats");
    seen.add(it.playerId);
    rows.push({ matchId: m.id, playerId: it.playerId, teamId: g.team, goals, assists, setByPlayerId: me.id });
  }
  return { state: { ...state, playerStats: withFilledRows(state.playerStats || [], (r) => r.matchId === m.id && r.teamId === g.team, rows) }, data: { matchId: m.id, teamId: g.team, count: rows.length } };
}

function demoReport(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const g = needLeader(state, m, me.id);
  if (g.error) return g;
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) > now) return ERR("too_early");
  if ((m.resultStatus || "none") !== "none") return ERR("result_exists");
  if (!validScore(a.homeScore) || !validScore(a.awayScore)) return ERR("invalid_score");
  if (noteTooLong(a.note)) return ERR("note_too_long");
  const rs = resultsOf(state, m.id);
  const row = {
    matchId: m.id, revision: (rs[rs.length - 1]?.revision ?? 0) + 1, kind: "report", status: "proposed",
    homeScore: a.homeScore, awayScore: a.awayScore, reportedByTeamId: g.team, reportedByPlayerId: me.id,
    respondedByPlayerId: null, respondedAt: null, note: tidyNote(a.note), createdAt: iso(now),
  };
  const next = touch(patchMatch({ ...state, results: [...(state.results || []), row] }, m.id, { resultStatus: "reported" }), m.challengeId, now);
  return { state: next, data: resultOut(next, row) };
}

/** Shared gate of confirm / contest: the latest open revision, answered by the OTHER team's leader. */
function respondGate(state, a, me) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const s = standing(state, m, me.id);
  if (!s.memberTeams.length) return ERR("not_team_member");
  if (!s.leaderTeams.length) return ERR("not_team_leader");
  const open = openOf(state, m.id);
  if (!open) return ERR("no_open_proposal");
  if (a.revision !== open.revision) return ERR("stale_revision");
  const team = s.leaderTeams.find((id) => id !== open.reportedByTeamId);
  // A player who leads both teams may propose, but never confirms / contests his own proposal.
  if (!team || open.reportedByPlayerId === me.id) return ERR("own_proposal");
  return { m, open, team };
}

function demoConfirm(state, a, me, now) {
  // Repeated confirm of an already confirmed revision → success flag (idempotent), nothing changes.
  const done = resultsOf(state, a.matchId).find((r) => r.revision === a.revision && r.status === "confirmed");
  if (done && !openOf(state, a.matchId)) {
    const m0 = matchOf(state, a.matchId);
    if (m0 && standing(state, m0, me.id).leaderTeams.some((id) => id !== done.reportedByTeamId) && done.reportedByPlayerId !== me.id) {
      return { state, data: resultOut(state, done, { alreadyConfirmed: true }) };
    }
  }
  const g = respondGate(state, a, me);
  if (g.error) return g;
  const { m, open } = g;
  const results = (state.results || []).map((r) => {
    if (r.matchId !== m.id) return r;
    if (r === open) return { ...r, status: "confirmed", respondedByPlayerId: me.id, respondedAt: iso(now) };
    if (r.status === "confirmed") return { ...r, status: "superseded" };
    return r;
  });
  const next = touch(patchMatch({ ...state, results }, m.id, {
    officialHomeScore: open.homeScore, officialAwayScore: open.awayScore, resultStatus: "confirmed",
    confirmedRevision: open.revision, resultConfirmedAt: iso(now), matchStatus: "played",
  }), m.challengeId, now);
  return { state: next, data: resultOut(next, results.find((r) => r.matchId === m.id && r.revision === open.revision)) };
}

function demoContest(state, a, me, now) {
  const g = respondGate(state, a, me);
  if (g.error) return g;
  const { m, open, team } = g;
  if (!validScore(a.homeScore) || !validScore(a.awayScore)) return ERR("invalid_score");
  if (noteTooLong(a.note)) return ERR("note_too_long");
  if (a.homeScore === open.homeScore && a.awayScore === open.awayScore) return ERR("same_score");
  const rs = resultsOf(state, m.id);
  // needs_help: the new revision would be the 4th of the current chain (revisions after the last
  // confirmed one, withdrawn included) — or beyond #30 for the match.
  if (chainOf(m, rs).length >= MAX_REVISIONS - 1 || rs.length >= MAX_TOTAL_REVISIONS) return ERR("needs_help");
  const row = {
    matchId: m.id, revision: rs[rs.length - 1].revision + 1, kind: "counter", status: "proposed",
    homeScore: a.homeScore, awayScore: a.awayScore, reportedByTeamId: team, reportedByPlayerId: me.id,
    respondedByPlayerId: null, respondedAt: null, note: tidyNote(a.note), createdAt: iso(now),
  };
  const results = (state.results || []).map((r) => (r === open ? { ...r, status: "disputed", respondedByPlayerId: me.id, respondedAt: iso(now) } : r));
  // result_status is 'disputed' only for the FIRST report; while a correction chain is open it stays 'confirmed'.
  const next = touch(patchMatch({ ...state, results: [...results, row] }, m.id, hasOfficialRow(m) ? {} : { resultStatus: "disputed" }), m.challengeId, now);
  return { state: next, data: resultOut(next, row) };
}

function demoCorrection(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const g = needLeader(state, m, me.id);
  if (g.error) return g;
  if (!hasOfficialRow(m)) return ERR("result_not_confirmed");
  if (openOf(state, m.id)) return ERR("proposal_open");
  if (!validScore(a.homeScore) || !validScore(a.awayScore)) return ERR("invalid_score");
  if (noteTooLong(a.note)) return ERR("note_too_long");
  if (a.homeScore === m.officialHomeScore && a.awayScore === m.officialAwayScore) return ERR("same_score");
  const rs = resultsOf(state, m.id);
  const row = {
    matchId: m.id, revision: rs[rs.length - 1].revision + 1, kind: "correction", status: "proposed",
    homeScore: a.homeScore, awayScore: a.awayScore, reportedByTeamId: g.team, reportedByPlayerId: me.id,
    respondedByPlayerId: null, respondedAt: null, note: tidyNote(a.note), createdAt: iso(now),
  };
  // The official score (and result_status 'confirmed', and so every metric) stays exactly as it was
  // until the other team confirms; the UI reads the open revision (kind 'correction').
  const next = touch({ ...state, results: [...(state.results || []), row] }, m.challengeId, now);
  return { state: next, data: resultOut(next, row) };
}

function demoWithdraw(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const s = standing(state, m, me.id);
  if (!s.memberTeams.length) return ERR("not_team_member");
  if (!s.leaderTeams.length) return ERR("not_team_leader");
  const open = openOf(state, m.id);
  const gone = resultsOf(state, m.id).find((r) => r.revision === a.revision && r.status === "withdrawn");
  if (!open && gone && s.leaderTeams.includes(gone.reportedByTeamId)) return { state, data: resultOut(state, gone, { alreadyWithdrawn: true }) };
  if (!open) return ERR("no_open_proposal");
  if (a.revision !== open.revision) return ERR("stale_revision");
  if (!s.leaderTeams.includes(open.reportedByTeamId)) return ERR("not_proposer");
  // Withdrawing a counter re-opens the revision it contested (a dispute never dead-ends).
  const reopen = open.kind === "counter" ? resultsOf(state, m.id).find((r) => r.revision === open.revision - 1 && r.status === "disputed") : null;
  const results = (state.results || []).map((r) => {
    if (r === open) return { ...r, status: "withdrawn", respondedByPlayerId: me.id, respondedAt: iso(now) };
    if (reopen && r === reopen) return { ...r, status: "proposed", respondedByPlayerId: null, respondedAt: null };
    return r;
  });
  // First report → none; a correction → no change; a counter → back to the contested report (or still confirmed).
  const patch = hasOfficialRow(m) ? {} : { resultStatus: reopen ? "reported" : "none" };
  const next = touch(patchMatch({ ...state, results }, m.id, patch), m.challengeId, now);
  return { state: next, data: resultOut(next, results.find((r) => r.matchId === m.id && r.revision === open.revision)) };
}

function demoNotPlayed(state, a, me, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const g = needLeader(state, m, me.id);
  if (g.error) return g;
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  if (Date.parse(m.kickoffAt) > now) return ERR("too_early");
  if ((m.resultStatus || "none") !== "none") return ERR("not_played_blocked");
  if (noteTooLong(a.reason)) return ERR("reason_too_long");
  return { state: touch(patchMatch(state, m.id, { matchStatus: "not_played", notPlayedReason: tidyNote(a.reason), notPlayedByTeamId: g.team }), m.challengeId, now), data: { matchId: m.id, matchStatus: "not_played" } };
}

// ── Demo-only helpers: let a lone tester walk the whole loop ──
/** Makes the match "already played" (kickoff 90 min ago). Demo only — real kickoffs are agreed, not edited. */
function demoAdvance(state, a, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  if (m.matchStatus !== "scheduled") return ERR("match_not_scheduled");
  return { state: patchMatch(state, m.id, { kickoffAt: iso(now - 90 * 60e3) }), data: { matchId: m.id } };
}
const hashOf = (s) => [...String(s)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 11);
/** The rival's captain, i.e. the leader of the team that isn't one of `userTeamIds`. */
function rivalCaptain(state, m, userTeamIds) {
  const rivalTeam = [m.homeTeamId, m.awayTeamId].find((id) => !userTeamIds.includes(id));
  const cap = (state.members || []).find((x) => x.teamId === rivalTeam && x.role === "captain" && x.status === "active");
  return cap ? { teamId: rivalTeam, me: { id: cap.playerId, nick: cap.nick } } : null;
}
/** The rival team's squad sheet for the demo: a lineup and a goals/assists spread that matches `goals`. */
function demoFillSide(state, m, teamId, goals, me, now) {
  if ((state.lineups || []).some((l) => l.matchId === m.id && l.teamId === teamId)) return state;
  const squad = activeMembers(state, teamId).slice(0, 8);
  if (!squad.length) return state;
  const lineup = demoLineup(state, { matchId: m.id, playerIds: squad.map((x) => x.playerId) }, me);
  if (lineup.error) return state;
  const scorers = squad.filter((x) => x.position !== "Guarda-redes");
  const tally = new Map();
  for (let i = 0; i < goals; i += 1) {
    const sc = scorers[(hashOf(`${m.id}${teamId}`) + i * 2) % scorers.length];
    const asst = scorers[(hashOf(`${m.id}${teamId}`) + i * 2 + 1) % scorers.length];
    const cur = tally.get(sc.playerId) || { goals: 0, assists: 0 };
    tally.set(sc.playerId, { ...cur, goals: cur.goals + 1 });
    if (asst.playerId !== sc.playerId && i % 2 === 0) {
      const ac = tally.get(asst.playerId) || { goals: 0, assists: 0 };
      tally.set(asst.playerId, { ...ac, assists: ac.assists + 1 });
    }
  }
  const stats = demoPlayerStats(lineup.state, { matchId: m.id, stats: [...tally].map(([playerId, v]) => ({ playerId, ...v })) }, me, now);
  return stats.error ? lineup.state : stats.state;
}
function demoRivalReports(state, a, userTeamIds, now) {
  const m = matchOf(state, a.matchId);
  if (!m) return ERR("match_not_found");
  const cap = rivalCaptain(state, m, userTeamIds);
  if (!cap) return ERR("not_team_leader");
  const rival = hashOf(m.id) % 3 + 2;   // 2..4
  const mine = hashOf(`${m.id}x`) % 3 + 1; // 1..3
  const rivalIsHome = cap.teamId === m.homeTeamId;
  return demoReport(state, { matchId: m.id, homeScore: rivalIsHome ? rival : mine, awayScore: rivalIsHome ? mine : rival, note: null }, cap.me, now);
}

/**
 * The simulated rival captain for results (demo only): whatever *my* team
 * proposed (report, counter, correction), the rival's captain confirms it
 * — after filling in its own lineup and goals/assists so scouting and the
 * per-player numbers have something real to show. A proposal made by the
 * rival waits for ME. Returns { state, action } or null.
 */
export function demoRivalResultMove(state, matchId, userTeamIds, now = Date.now()) {
  const m = matchOf(state, matchId);
  if (!m) return null;
  const open = openOf(state, matchId);
  if (!open || !userTeamIds.includes(open.reportedByTeamId)) return null;
  const cap = rivalCaptain(state, m, userTeamIds);
  if (!cap) return null;
  const rivalGoals = cap.teamId === m.homeTeamId ? open.homeScore : open.awayScore;
  const filled = demoFillSide(state, m, cap.teamId, rivalGoals, cap.me, now);
  const r = demoConfirm(filled, { matchId, revision: open.revision }, cap.me, now);
  return r.error ? null : { state: r.state, action: "confirmed" };
}

/** Apply one results operation to the demo state, exactly like the RPC.
 *  → { state, data } or { error: code } (state untouched on error). */
export function demoResultOp(state, op, args = {}, me, now = Date.now(), ctx = {}) {
  if (!me?.id) return ERR("not_authenticated");
  const s = { ...state, results: state.results || [], availability: state.availability || [], lineups: state.lineups || [], playerStats: state.playerStats || [], matches: state.matches || [] };
  switch (op) {
    case "set_match_availability": return demoAvailability(s, args, me, now);
    case "set_match_lineup": return demoLineup(s, args, me);
    case "set_match_player_stats": return demoPlayerStats(s, args, me, now);
    case "report_match_result": return demoReport(s, args, me, now);
    case "confirm_match_result": return demoConfirm(s, args, me, now);
    case "contest_match_result": return demoContest(s, args, me, now);
    case "propose_result_correction": return demoCorrection(s, args, me, now);
    case "withdraw_result_proposal": return demoWithdraw(s, args, me, now);
    case "mark_match_not_played": return demoNotPlayed(s, args, me, now);
    case "demo_advance_match": return demoAdvance(s, args, now);
    case "demo_rival_reports": return demoRivalReports(s, args, ctx.userTeamIds || [], now);
    default: return ERR("unknown");
  }
}

// ── Demo reads (same shapes as the normalised RPC reads) ──
const personOf = (mem) => ({ playerId: mem.playerId, nick: mem.nick ?? null, name: mem.name ?? null, photoUrl: mem.photoUrl ?? null, position: mem.position ?? null });

export function demoReadResults(state, op, args, me) {
  const meId = me?.id;
  if (!meId) return ERR("not_authenticated");
  if (op === "team_record") return { data: teamRecord(state, args.teamId) };
  if (op === "team_head_to_head") return { data: headToHead(state, args.teamId, args.opponentId) };
  if (op === "my_team_career") return { data: { items: myCareer(state, meId) } };
  if (op === "team_player_stats") {
    if (!roleIn(state, args.teamId, meId)) return ERR("not_team_member");
    return { data: { items: teamPlayerStats(state, args.teamId).map((p) => ({ ...p, ovr: computeOverall(p.position, p.attrs) })) } };
  }
  const m = matchOf(state, args.matchId);
  if (!m) return ERR("match_not_found");
  const s = standing(state, m, meId);
  if (!s.memberTeams.length) return ERR("not_team_member");
  switch (op) {
    case "get_match_availability": {
      const teamId = s.memberTeams[0];
      const items = activeMembers(state, teamId).map((mem) => {
        const row = (state.availability || []).find((a) => a.matchId === m.id && a.playerId === mem.playerId);
        return { ...personOf(mem), role: mem.role, status: row?.status ?? null, updatedAt: row?.updatedAt ?? null };
      });
      return { data: { items, counts: normCounts(null, items) } };
    }
    case "get_match_lineup": {
      const teams = m.matchStatus === "played" ? [m.homeTeamId, m.awayTeamId] : s.memberTeams;
      const items = (state.lineups || []).filter((l) => l.matchId === m.id && teams.includes(l.teamId)).map((l) => {
        const mem = (state.members || []).find((x) => x.teamId === l.teamId && x.playerId === l.playerId);
        const p = personOf(mem || { playerId: l.playerId });
        // Opponent players: first name only (same privacy line as scout_opponent).
        return { teamId: l.teamId, ...p, name: s.memberTeams.includes(l.teamId) || !p.name ? p.name : String(p.name).split(" ")[0] };
      });
      return { data: { items } };
    }
    case "get_match_results": {
      const items = resultsOf(state, m.id);
      return { data: { items, official: hasOfficialRow(m) ? { homeScore: m.officialHomeScore, awayScore: m.officialAwayScore, revision: m.confirmedRevision } : null } };
    }
    case "get_match_player_stats": {
      const items = (state.playerStats || []).filter((r) => r.matchId === m.id).map((r) => {
        const mem = (state.members || []).find((x) => x.teamId === r.teamId && x.playerId === r.playerId);
        return { teamId: r.teamId, playerId: r.playerId, nick: mem?.nick ?? null, goals: r.goals, assists: r.assists };
      });
      return { data: { items } };
    }
    case "scout_opponent": {
      if (!["scheduled", "played"].includes(m.matchStatus)) return ERR("scout_unavailable");
      const mineId = s.memberTeams[0];
      const oppId = m.homeTeamId === mineId ? m.awayTeamId : m.homeTeamId;
      const opp = (state.teams || []).find((x) => x.id === oppId);
      return { data: {
        team: opp, record: teamRecord(state, oppId), h2h: headToHead(state, mineId, oppId),
        items: teamPlayerStats(state, oppId).map((p) => ({ ...p, ovr: computeOverall(p.position, p.attrs) })),
      } };
    }
    default: return ERR("unknown");
  }
}
