// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.
// PITCH Ligas (Fase 1 — local demo): third-party league domain.
//
// The ONE source of truth for a league match is its append-only event
// log. Score, súmula, player stats, standings, discipline and fantasy are
// all PROJECTIONS of (event log + match state); nothing here stores an
// editable total. A correction never edits an event: it appends a new one
// that `supersedes` the old id, with a mandatory `voidReason`.
//
// Event shape:
//   { id, matchId, type, teamId, playerId|null, assistId|null, minute|null,
//     recordedBy, recordedAt, supersedes|null, voidReason|null }
//   type: goal | own_goal | card_yellow | card_red | sub | shootout_goal | void
//   - goal / own_goal / shootout_goal: `teamId` is the team that BENEFITS
//     (an own goal by an away player has teamId = home). `playerId` may be
//     null (scorer unknown — never invent one).
//   - own_goal: `playerId` is the player who put it in his own net.
//   - card_* / sub: `teamId` is the player's own team.
//   - void: pure annulment of `supersedes` (no replacement).
//
// Match state machine (transitions guarded by role, see TRANSITIONS):
//   scheduled → live → ended_provisional → in_review → homologated
//   + postponed, cancelled, walkover.
import { computeTable } from "./standings.js";

// ── Centralized DEMO rules — EXAMPLES, not a regulation. A real league
// configures these in its versioned regulation (Fase 2+). ─────────────
export const DEMO_RULES = Object.freeze({
  label: "DEMO — regras de exemplo, não é regulamento",
  points: Object.freeze({ win: 3, draw: 1, loss: 0 }),
  tiebreakers: Object.freeze(["pts", "gd", "gf", "h2h"]),
  /** Walkover result awarded to the winner (W.O.). */
  walkoverGoals: 3,
  /** Every N accumulated yellows (official matches) = 1-match suspension. */
  yellowsForSuspension: 3,
  /** Matches suspended after a straight red (or 2 yellows in one match). */
  redSuspensionMatches: 1,
  /** Assists only count when explicitly recorded (never auto-granted). */
  assistPolicy: "recorded_only",
});

export const FANTASY_DEMO_RULES = Object.freeze({
  label: "Regras de exemplo — não é regulamento",
  budget: 30,
  squadSize: 5,
  maxPerTeam: 2,
  points: Object.freeze({
    appearance: 1,
    goal: Object.freeze({ GR: 6, DEF: 6, MED: 5, AVA: 4 }),
    assist: 3,
    cleanSheet: Object.freeze({ GR: 4, DEF: 4, MED: 1, AVA: 0 }),
    yellow: -1,
    red: -3,
    ownGoal: -2,
    officialMvp: 3,
  }),
  // Fans' vote ("Craque da torcida") never scores — by design.
});

export const EVENT_TYPES = ["goal", "own_goal", "card_yellow", "card_red", "sub", "shootout_goal", "void"];
export const MATCH_STATES = ["scheduled", "live", "ended_provisional", "in_review", "homologated", "postponed", "cancelled", "walkover"];
export const ROLES = ["fan", "athlete", "captain", "manager"];

/** States whose result is OFFICIAL (enters the table by default). */
export const OFFICIAL_STATES = new Set(["homologated", "walkover"]);
/** States with a provisional (non-official) result. */
export const PROVISIONAL_STATES = new Set(["live", "ended_provisional", "in_review"]);

export class LeagueError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// ── Event log ────────────────────────────────────────────────────────

const SCORING = new Set(["goal", "own_goal"]);

/** Append an event to a match log. Pure: returns a NEW array (or the same
 *  array when it's an idempotent resend of an id already in the log).
 *  Throws LeagueError on an invalid event or a conflicting correction
 *  (superseding something that was already superseded = someone else
 *  corrected it first — never overwrite silently). */
export function appendEvent(log, event) {
  const list = log || [];
  if (!event || !event.id) throw new LeagueError("missing_id");
  if (list.some((e) => e.id === event.id)) return list; // idempotent resend
  if (!EVENT_TYPES.includes(event.type)) throw new LeagueError("bad_type", event.type);
  if (!event.matchId) throw new LeagueError("missing_match");
  if (event.type !== "void" && !event.teamId) throw new LeagueError("missing_team");
  if ((event.type === "card_yellow" || event.type === "card_red") && !event.playerId) throw new LeagueError("card_needs_player");
  if (event.type === "void" && !event.supersedes) throw new LeagueError("void_needs_target");
  if (event.supersedes) {
    const target = list.find((e) => e.id === event.supersedes);
    if (!target) throw new LeagueError("unknown_target", event.supersedes);
    if (target.matchId !== event.matchId) throw new LeagueError("cross_match");
    if (!String(event.voidReason || "").trim()) throw new LeagueError("reason_required");
    if (list.some((e) => e.supersedes === event.supersedes)) throw new LeagueError("already_superseded", event.supersedes);
  }
  const clean = {
    id: event.id, matchId: event.matchId, type: event.type, teamId: event.teamId ?? null,
    playerId: event.playerId ?? null, assistId: event.assistId ?? null, minute: event.minute ?? null,
    recordedBy: event.recordedBy ?? null, recordedAt: event.recordedAt ?? null,
    supersedes: event.supersedes ?? null, voidReason: event.voidReason ? String(event.voidReason).trim() : null,
  };
  return [...list, clean];
}

/** Events currently in force: not superseded by a later correction, and
 *  not themselves a `void` marker. Order = minute, then log order. */
export function activeEvents(log) {
  const list = log || [];
  const superseded = new Set(list.filter((e) => e.supersedes).map((e) => e.supersedes));
  return list
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !superseded.has(e.id) && e.type !== "void")
    .sort((a, b) => ((a.e.minute ?? 999) - (b.e.minute ?? 999)) || (a.i - b.i))
    .map(({ e }) => e);
}

/** Correction history (who/when/why) — every event that superseded or
 *  voided another, paired with what it replaced. Newest last. */
export function corrections(log) {
  const list = log || [];
  return list.filter((e) => e.supersedes).map((e) => ({
    event: e, replaced: list.find((x) => x.id === e.supersedes) || null,
  }));
}

const logFor = (logs, matchId) => (Array.isArray(logs) ? logs.filter((e) => e.matchId === matchId) : (logs?.[matchId] || []));

/** { home, away, shootout: {home, away} | null } from the active log.
 *  Own goals count for the benefiting team. Shootout goals NEVER enter
 *  the score. A walkover uses DEMO_RULES.walkoverGoals for the winner. */
export function matchScore(log, match, rules = DEMO_RULES) {
  if (match.state === "walkover" && match.walkover?.winnerId) {
    const w = match.walkover.winnerId;
    return { home: w === match.homeId ? rules.walkoverGoals : 0, away: w === match.awayId ? rules.walkoverGoals : 0, shootout: null, walkover: true };
  }
  const evs = activeEvents(log).filter((e) => e.matchId === match.id);
  const count = (teamId, types) => evs.filter((e) => e.teamId === teamId && types.has(e.type)).length;
  const sh = new Set(["shootout_goal"]);
  const shHome = count(match.homeId, sh), shAway = count(match.awayId, sh);
  return {
    home: count(match.homeId, SCORING), away: count(match.awayId, SCORING),
    shootout: shHome + shAway > 0 ? { home: shHome, away: shAway } : null,
    walkover: false,
  };
}

// ── Match state machine ──────────────────────────────────────────────

/** from → { to: roles allowed }. A captain may only CONTEST (→ in_review,
 *  with reason); homologation and reopening belong to the manager. */
export const TRANSITIONS = Object.freeze({
  scheduled: { live: ["manager"], postponed: ["manager"], cancelled: ["manager"], walkover: ["manager"] },
  postponed: { scheduled: ["manager"], cancelled: ["manager"] },
  live: { ended_provisional: ["manager"] },
  ended_provisional: { in_review: ["manager", "captain"], homologated: ["manager"] },
  in_review: { homologated: ["manager"] },
  homologated: { in_review: ["manager"] },
  cancelled: {},
  walkover: {},
});

/** Transitions that require a written reason. */
const NEEDS_REASON = new Set(["in_review", "postponed", "cancelled", "walkover"]);

export function canTransition(from, to, role) {
  return Boolean(TRANSITIONS[from]?.[to]?.includes(role));
}

/** Returns a NEW match with `state` changed and a history entry appended.
 *  A captain can only contest a match his own team plays. */
export function transition(match, to, { role, by = null, at = null, reason = null, teamId = null, winnerId = null } = {}) {
  if (!canTransition(match.state, to, role)) throw new LeagueError("forbidden_transition", `${match.state}→${to} (${role})`);
  if (NEEDS_REASON.has(to) && !String(reason || "").trim()) throw new LeagueError("reason_required");
  if (role === "captain" && teamId !== match.homeId && teamId !== match.awayId) throw new LeagueError("not_your_match");
  if (to === "walkover" && winnerId !== match.homeId && winnerId !== match.awayId) throw new LeagueError("walkover_needs_winner");
  const entry = { from: match.state, to, role, by, at, reason: reason ? String(reason).trim() : null };
  const next = { ...match, state: to, history: [...(match.history || []), entry] };
  if (to === "walkover") next.walkover = { winnerId };
  if (to === "in_review" && role === "captain") next.contest = { teamId, by, at, reason: entry.reason };
  if (to === "homologated") next.homologatedBy = { by, at };
  return next;
}

/** Can `role` add live events to this match right now? */
export const canRecordLive = (match, role) => role === "manager" && match.state === "live";
/** Can `role` correct/void events (súmula) right now? Homologated
 *  matches must be reopened (→ in_review) first. */
export const canCorrect = (match, role) => role === "manager" && ["live", "ended_provisional", "in_review"].includes(match.state);

// ── Tactical board (formation per team per match) ────────────────────

const TACTICS_OPEN = new Set(["scheduled", "postponed", "live"]);

/** Captain: own team, before/while the match. Manager: any team, same
 *  window. Everyone else: read-only. */
export const canEditTactics = (match, role, teamId, myTeamId = null) =>
  TACTICS_OPEN.has(match.state) && (teamId === match.homeId || teamId === match.awayId)
  && (role === "manager" || (role === "captain" && myTeamId === teamId));

/** Publish a team's board for a match. `board` = { formation, slots:
 *  { slotKey: playerId } }. Rejects suspended players, players outside
 *  the call-up (when one is published) and a player in two slots. */
export function setTactics(match, teamId, board, { role, myTeamId = null, by = null, at = null, suspendedIds = [] } = {}) {
  if (!canEditTactics(match, role, teamId, myTeamId)) throw new LeagueError("forbidden_tactics");
  const placed = Object.values(board?.slots || {}).filter(Boolean);
  if (new Set(placed).size !== placed.length) throw new LeagueError("tactics_duplicate");
  const banned = new Set(suspendedIds);
  if (placed.some((id) => banned.has(id))) throw new LeagueError("tactics_suspended");
  const lineup = match.lineups?.[teamId];
  if (lineup?.length && placed.some((id) => !lineup.includes(id))) throw new LeagueError("tactics_not_called");
  const clean = { formation: board.formation, slots: { ...board.slots }, by, at };
  return { ...match, tactics: { ...(match.tactics || {}), [teamId]: clean } };
}

// ── Projections ─────────────────────────────────────────────────────

/** Which matches count: official only by default; `includeProvisional`
 *  adds live / ended_provisional / in_review (labelled "provisória"). */
export function countedMatches(matches, { includeProvisional = false } = {}) {
  return (matches || []).filter((m) => OFFICIAL_STATES.has(m.state) || (includeProvisional && PROVISIONAL_STATES.has(m.state)));
}

/** League table via core computeTable, with the competition's points and
 *  tiebreakers. Rows carry the team fields + { w, d, l, gf, ga, j, gd, pts }. */
export function standings(competition, matches, logs, { includeProvisional = false, teams } = {}) {
  const teamList = teams || competition.teams || [];
  const counted = countedMatches(matches.filter((m) => !competition.id || !m.competitionId || m.competitionId === competition.id), { includeProvisional });
  const shaped = counted.map((m) => {
    const s = matchScore(logFor(logs, m.id), m);
    const events = [
      ...Array.from({ length: s.home }, () => ({ teamId: m.homeId })),
      ...Array.from({ length: s.away }, () => ({ teamId: m.awayId })),
    ];
    return { homeId: m.homeId, awayId: m.awayId, events };
  });
  return computeTable(teamList, shaped, {
    points: competition.points || DEMO_RULES.points,
    tiebreakers: competition.tiebreakers || DEMO_RULES.tiebreakers,
    seed: competition.id,
  });
}

const blankStats = (playerId) => ({ playerId, games: 0, goals: 0, assists: 0, ownGoals: 0, yellows: 0, reds: 0, shootoutGoals: 0, mvps: 0 });

/** Per-player stats from counted matches. Goals exclude own goals and
 *  shootout goals; assists only when recorded; an unknown scorer adds to
 *  the team score but to nobody's tally. `games` = in a published lineup. */
export function playerStats(matches, logs, { includeProvisional = false } = {}) {
  const out = {};
  const get = (id) => (out[id] ||= blankStats(id));
  for (const m of countedMatches(matches, { includeProvisional })) {
    for (const ids of Object.values(m.lineups || {})) for (const id of ids || []) get(id).games++;
    if (m.officialMvp?.playerId) get(m.officialMvp.playerId).mvps++;
    if (m.state === "walkover") continue;
    for (const e of activeEvents(logFor(logs, m.id))) {
      if (e.type === "goal" && e.playerId) get(e.playerId).goals++;
      if (e.type === "goal" && e.assistId) get(e.assistId).assists++;
      if (e.type === "own_goal" && e.playerId) get(e.playerId).ownGoals++;
      if (e.type === "shootout_goal" && e.playerId) get(e.playerId).shootoutGoals++;
      if (e.type === "card_yellow") get(e.playerId).yellows++;
      if (e.type === "card_red") get(e.playerId).reds++;
    }
  }
  return out;
}

/** Ranking rows for one stat key, desc, ties by name order of `players`. */
export function ranking(statsById, players, key, limit = 10) {
  return players
    .map((p) => ({ player: p, value: statsById[p.id]?.[key] || 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

const matchOrder = (a, b) => (a.round - b.round) || String(a.kickoff || "").localeCompare(String(b.kickoff || "")) || String(a.id).localeCompare(String(b.id));

/** Discipline from OFFICIAL matches under DEMO_RULES: accumulated
 *  yellows, reds, suspensions triggered and served (a suspension is served
 *  by the player's team playing its next official match). Returns
 *  { [playerId]: { playerId, teamId, yellows, reds, triggered, served,
 *  pending, log: [{ matchId, kind, matches }] } }. Two yellows in the
 *  same match count as a sending-off (red rule), not toward accumulation. */
export function discipline(matches, logs, players, rules = DEMO_RULES) {
  const teamOf = Object.fromEntries((players || []).map((p) => [p.id, p.teamId]));
  const out = {};
  const get = (id) => (out[id] ||= { playerId: id, teamId: teamOf[id] ?? null, yellows: 0, accum: 0, reds: 0, triggered: 0, served: 0, pending: 0, log: [] });
  const ordered = countedMatches(matches).slice().sort(matchOrder);
  for (const m of ordered) {
    // serve first: anyone with a pending ban whose team plays this match
    for (const rec of Object.values(out)) {
      if (rec.pending > 0 && (rec.teamId === m.homeId || rec.teamId === m.awayId)) {
        rec.pending--; rec.served++;
        rec.log.push({ matchId: m.id, kind: "served", matches: 1 });
      }
    }
    if (m.state === "walkover") continue;
    const evs = activeEvents(logFor(logs, m.id));
    const yellowsHere = {};
    for (const e of evs) if (e.type === "card_yellow") yellowsHere[e.playerId] = (yellowsHere[e.playerId] || 0) + 1;
    for (const e of evs) {
      if (e.type === "card_red") {
        const r = get(e.playerId); r.reds++;
        r.triggered += rules.redSuspensionMatches; r.pending += rules.redSuspensionMatches;
        r.log.push({ matchId: m.id, kind: "red", matches: rules.redSuspensionMatches });
      }
    }
    for (const [pid, n] of Object.entries(yellowsHere)) {
      const r = get(pid); r.yellows += n;
      if (n >= 2) {
        r.triggered += rules.redSuspensionMatches; r.pending += rules.redSuspensionMatches;
        r.log.push({ matchId: m.id, kind: "second_yellow", matches: rules.redSuspensionMatches });
      } else {
        r.accum += n;
        while (r.accum >= rules.yellowsForSuspension) {
          r.accum -= rules.yellowsForSuspension;
          r.triggered++; r.pending++;
          r.log.push({ matchId: m.id, kind: "yellow_accumulation", matches: 1 });
        }
      }
    }
  }
  return out;
}

// ── Official MVP vs fans' vote — separate structures ─────────────────

/** Official MVP ("Craque oficial"): chosen by the manager, with author. */
export function setOfficialMvp(match, playerId, { role, by = null, at = null } = {}) {
  if (role !== "manager") throw new LeagueError("forbidden_mvp");
  if (!["ended_provisional", "in_review", "homologated"].includes(match.state)) throw new LeagueError("match_not_ended");
  return { ...match, officialMvp: { playerId, by, at } };
}

/** Fans' vote ("Craque da torcida") is open after the final whistle and
 *  until the manager closes it. */
export const fanVoteOpen = (match) => ["ended_provisional", "in_review", "homologated"].includes(match.state) && !match.fanVoteClosed;

/** One vote per account per match, changeable until close. `votes` =
 *  { [matchId]: { [accountId]: playerId } }. Returns new votes. */
export function castFanVote(votes, match, accountId, playerId) {
  if (!fanVoteOpen(match)) throw new LeagueError("vote_closed");
  if (!accountId) throw new LeagueError("needs_account");
  return { ...(votes || {}), [match.id]: { ...(votes?.[match.id] || {}), [accountId]: playerId } };
}

/** Tally for one match: [{ playerId, votes }] desc + total. */
export function tallyFanVotes(votes, matchId) {
  const byAccount = votes?.[matchId] || {};
  const counts = {};
  for (const pid of Object.values(byAccount)) counts[pid] = (counts[pid] || 0) + 1;
  const rows = Object.entries(counts).map(([playerId, n]) => ({ playerId, votes: n })).sort((a, b) => b.votes - a.votes || a.playerId.localeCompare(b.playerId));
  return { rows, total: Object.keys(byAccount).length };
}

// ── Fantasy preview (FANTASY_DEMO_RULES — examples) ──────────────────

/** Points for one player across counted matches (optionally one round),
 *  with a per-event breakdown. Fans' vote never scores. */
export function fantasyPlayerPoints(player, matches, logs, { round = null, includeProvisional = false, rules = FANTASY_DEMO_RULES } = {}) {
  const P = rules.points;
  const breakdown = [];
  const add = (matchId, kind, pts) => { if (pts) breakdown.push({ matchId, kind, pts }); };
  for (const m of countedMatches(matches, { includeProvisional })) {
    if (round !== null && m.round !== round) continue;
    if (m.homeId !== player.teamId && m.awayId !== player.teamId) continue;
    const lineup = m.lineups?.[player.teamId] || [];
    if (!lineup.includes(player.id)) continue;
    add(m.id, "appearance", P.appearance);
    if (m.state === "walkover") continue;
    const evs = activeEvents(logFor(logs, m.id));
    for (const e of evs) {
      if (e.type === "goal" && e.playerId === player.id) add(m.id, "goal", P.goal[player.position] ?? 0);
      if (e.type === "goal" && e.assistId === player.id) add(m.id, "assist", P.assist);
      if (e.type === "own_goal" && e.playerId === player.id) add(m.id, "ownGoal", P.ownGoal);
      if (e.type === "card_yellow" && e.playerId === player.id) add(m.id, "yellow", P.yellow);
      if (e.type === "card_red" && e.playerId === player.id) add(m.id, "red", P.red);
    }
    const s = matchScore(logFor(logs, m.id), m);
    const conceded = player.teamId === m.homeId ? s.away : s.home;
    if (conceded === 0) add(m.id, "cleanSheet", P.cleanSheet[player.position] ?? 0);
    if (m.officialMvp?.playerId === player.id) add(m.id, "officialMvp", P.officialMvp);
  }
  return { total: breakdown.reduce((n, b) => n + b.pts, 0), breakdown };
}

/** Validate a fantasy pick list → array of error codes (empty = valid). */
export function validateFantasyPicks(pickIds, players, rules = FANTASY_DEMO_RULES) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const picks = pickIds.map((id) => byId[id]).filter(Boolean);
  const errors = [];
  if (new Set(pickIds).size !== pickIds.length) errors.push("duplicate");
  if (picks.length !== rules.squadSize) errors.push("squad_size");
  if (picks.reduce((n, p) => n + (p.price || 0), 0) > rules.budget) errors.push("over_budget");
  const perTeam = {};
  for (const p of picks) perTeam[p.teamId] = (perTeam[p.teamId] || 0) + 1;
  if (Object.values(perTeam).some((n) => n > rules.maxPerTeam)) errors.push("max_per_team");
  return errors;
}

export function fantasyTeamPoints(pickIds, players, matches, logs, opts = {}) {
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const rows = pickIds.map((id) => byId[id]).filter(Boolean).map((p) => ({ player: p, ...fantasyPlayerPoints(p, matches, logs, opts) }));
  return { total: rows.reduce((n, r) => n + r.total, 0), rows };
}
