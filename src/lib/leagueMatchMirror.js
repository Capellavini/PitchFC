// ─────────────────────────────────────────────────────────
// PITCH Ligas Fase 2 — local mirror of the L4–L8 match RPCs, used ONLY
// when there is no Supabase client (local demo mode), so the real league
// screens are walkable end to end on one machine. It answers in the SAME
// snake_case payloads as the SQL (so the cloud normalisers in
// leagueMatches.js are the only read path) and raises the same
// `league:<code>` errors for the rules it mirrors. It is deliberately
// smaller than the SQL: one local account plays every staff role it
// holds in the league; team leadership comes from the caller's Rivals
// demo teams (args.myTeams = [{ id, role }]).
//
// Called from leagueCloud.leagueDemoOp for any op it doesn't handle.
// No React, no Vite globals.
// ─────────────────────────────────────────────────────────
import { provisionalStandings, zeroRows } from "./leagueMatches.js";

export const emptyMatchState = () => ({
  phases: [], rounds: [], matches: [], events: [], homs: [], disputes: [], adjustments: [], cases: [],
  awards: [], windows: [], votes: [], formations: [], officials: [], lineups: [],
});

const fail = (code) => ({ error: code });

/**
 * One mirrored op. h = { roleIn, visibleComp, uid } from leagueCloud.
 * Returns { state, data } | { error } | null (unknown op).
 */
export function leagueMatchDemoOp(s, op, args = {}, actor = null, now = Date.now(), h) {
  const lm = s.lm || emptyMatchState();
  const me = actor?.id;
  const iso = new Date(now).toISOString();
  const put = (patch, data) => ({ state: { ...s, lm: { ...lm, ...patch } }, data });
  const comp = (id) => s.competitions.find((c) => c.id === id);
  const leagueOf = (cid) => comp(cid)?.leagueId;
  const isMgr = (cid) => Boolean(actor?.isAdmin) || h.roleIn(s, leagueOf(cid), me, ["owner", "manager"]);
  const rulesOf = (cid) => { const c = comp(cid); return c?.regulations.find((r) => r.version === c.currentVersion)?.rules || null; };
  const match = (id) => lm.matches.find((m) => m.id === id);
  const leaderOf = (teamId) => (args.myTeams || []).some((t) => t.id === teamId && ["captain", "vice"].includes(t.role));
  const isOfficial = (m, roles) => lm.officials.some((o) => o.matchId === m.id && o.playerId === me && roles.includes(o.role));
  const operatorRole = (m) => (isOfficial(m, ["referee"]) ? "referee" : isOfficial(m, ["scorer"]) ? "scorer"
    : h.roleIn(s, leagueOf(m.competitionId), me, ["owner"]) ? "owner" : isMgr(m.competitionId) ? "manager"
      : (rulesOf(m.competitionId)?.homologation?.team_leaders_can_score && (leaderOf(m.homeId) || leaderOf(m.awayId))) ? "team_leader" : null);
  const canHom = (m) => {
    const auth = rulesOf(m.competitionId)?.homologation?.authority || ["owner", "manager"];
    if ((auth.includes("owner") || auth.includes("manager")) && isMgr(m.competitionId)) return "manager";
    if (auth.includes("referee") && isOfficial(m, ["referee"])) return "referee";
    return null;
  };
  const squad = (cid, teamId) => {
    const r = s.registrations.find((x) => x.competitionId === cid && x.teamId === teamId && x.homologatedVersion);
    return r?.versions.find((v) => v.version === r.homologatedVersion)?.players || [];
  };
  const nameOf = (pid) => s.registrations.flatMap((r) => r.versions.flatMap((v) => v.players)).find((p) => p.playerId === pid)?.name || "—";
  const inSquad = (m, teamId, pid) => squad(m.competitionId, teamId).some((p) => p.playerId === pid);
  const effective = (mid) => {
    const evs = lm.events.filter((e) => e.matchId === mid);
    const sup = new Set(evs.filter((e) => e.supersedes).map((e) => e.supersedes));
    return evs.filter((e) => e.action !== "void" && !sup.has(e.id));
  };
  const scoreOf = (m) => {
    const evs = effective(m.id).filter((e) => e.type === "goal" || e.type === "own_goal");
    return { home: evs.filter((e) => e.teamId === m.homeId).length, away: evs.filter((e) => e.teamId === m.awayId).length };
  };
  const setMatch = (m, patch) => lm.matches.map((x) => (x.id === m.id ? { ...x, ...patch, seq: (x.seq || 0) + 1 } : x));
  const visibleMatch = (m) => m && h.visibleComp(s, comp(m.competitionId), actor);
  const teamName = (cid, tid) => s.registrations.find((r) => r.competitionId === cid && r.teamId === tid)?.teamName || "—";
  const currentHom = (mid) => lm.homs.find((x) => x.matchId === mid && x.status === "current");
  const writeHom = (m, kind, home, away, loser, role, reason) => {
    const rev = lm.homs.filter((x) => x.matchId === m.id).length + 1;
    const stats = [];
    if (kind === "played") {
      const add = (pid, teamId, k) => {
        if (!pid) return;
        let r = stats.find((x) => x.playerId === pid);
        if (!r) { r = { playerId: pid, teamId, appeared: true, goals: 0, own_goals: 0, assists: 0, yellows: 0, second_yellows: 0, reds: 0 }; stats.push(r); }
        if (k) r[k] += 1;
      };
      for (const e of effective(m.id)) {
        const other = e.teamId === m.homeId ? m.awayId : m.homeId;
        add(e.playerId, e.type === "own_goal" ? other : e.teamId, { goal: "goals", own_goal: "own_goals", yellow: "yellows", second_yellow: "second_yellows", red: "reds" }[e.type]);
        add(e.assistId, e.teamId, "assists");
      }
      for (const l of lm.lineups.filter((x) => x.matchId === m.id)) add(l.playerId, l.teamId, null);
    }
    const hom = { id: h.uid("hom"), matchId: m.id, revision: rev, kind, home, away, loserTeamId: loser, eventSeq: m.seq, status: "current", role, reason: reason || null, at: iso, stats };
    return { homs: [...lm.homs.map((x) => (x.matchId === m.id && x.status === "current" ? { ...x, status: "superseded" } : x)), hom], hom };
  };
  const suggestCases = (m, hom, cases) => {
    const rules = rulesOf(m.competitionId) || {};
    const out = [...cases];
    for (const st of hom.stats) {
      const trig = st.reds ? "red" : st.second_yellows ? "second_yellow" : null;
      if (trig && !out.some((c) => c.sourceMatchId === m.id && c.playerId === st.playerId && c.trigger === trig)) {
        out.push({ id: h.uid("case"), competitionId: m.competitionId, playerId: st.playerId, teamId: st.teamId, sourceMatchId: m.id, trigger: trig,
          suggested: Number(rules.discipline?.[trig === "red" ? "red_suspension" : "second_yellow_suspension"] ?? 1), decided: null, status: "pending", reason: null, createdAt: iso });
      }
    }
    return out;
  };
  const suspensions = (cid) => out(lm.cases.filter((c) => c.competitionId === cid && c.status === "confirmed")).filter(Boolean);
  function out(list) {
    return list.map((c) => {
      const src = c.sourceMatchId ? match(c.sourceMatchId) : null;
      const served = lm.matches.filter((x) => x.competitionId === c.competitionId && (x.homeId === c.teamId || x.awayId === c.teamId)
        && x.resultStatus === "homologated" && currentHom(x.id)?.kind !== "annulled" && (!src || (x.homologatedAt || "") > (src.homologatedAt || ""))).length;
      return { player_id: c.playerId, team_id: c.teamId, matches: c.decided || 0, served: Math.min(served, c.decided || 0), name: nameOf(c.playerId), active: served < (c.decided || 0) };
    });
  }

  switch (op) {
    // ── L4 ──
    case "create_phase": {
      if (!isMgr(args.competitionId)) return fail("not_found");
      const ex = lm.phases.find((p) => p.competitionId === args.competitionId);
      if (ex) return { state: s, data: { phase_id: ex.id, ordinal: 1, created: false } };
      const p = { id: h.uid("ph"), competitionId: args.competitionId, name: args.name || "Fase regular", doubleLegged: Boolean(args.doubleLegged) };
      return put({ phases: [...lm.phases, p] }, { phase_id: p.id, ordinal: 1, created: true });
    }
    case "create_fixtures": {
      const p = lm.phases.find((x) => x.id === args.phaseId);
      if (!p || !isMgr(p.competitionId)) return fail("not_found");
      if (lm.matches.some((m) => m.phaseId === p.id)) return fail("fixtures_exist");
      const teams = s.registrations.filter((r) => r.competitionId === p.competitionId && r.status === "homologated").map((r) => r.teamId);
      if (teams.length < 2) return fail("not_enough_teams");
      const fx = args.fixtures || [];
      const expected = (teams.length * (teams.length - 1) / 2) * (p.doubleLegged ? 2 : 1);
      if (fx.length !== expected || fx.some((f) => !teams.includes(f.home_team_id) || !teams.includes(f.away_team_id) || f.home_team_id === f.away_team_id)) return fail("invalid_fixtures");
      const c = comp(p.competitionId);
      const matches = fx.map((f) => ({ id: h.uid("m"), competitionId: p.competitionId, phaseId: p.id, round: f.round, homeId: f.home_team_id, awayId: f.away_team_id,
        kickoff: null, venue: null, matchStatus: "unscheduled", resultStatus: "none", seq: 0, format: c.format }));
      return put({ matches: [...lm.matches, ...matches] }, { created: true, matches: matches.length });
    }
    case "competition_matches": {
      const c = comp(args.competitionId);
      if (!c || !h.visibleComp(s, c, actor)) return { state: s, data: null };
      const items = lm.matches.filter((m) => m.competitionId === c.id && (args.round == null || m.round === args.round))
        .sort((a, b) => (a.round - b.round) || String(a.kickoff || "~").localeCompare(String(b.kickoff || "~")))
        .map((m) => ({ id: m.id, round: m.round, round_name: null,
          home: { id: m.homeId, name: teamName(c.id, m.homeId) }, away: { id: m.awayId, name: teamName(c.id, m.awayId) },
          kickoff_at: m.kickoff, timezone: "Europe/Lisbon", venue_name: m.venue, match_status: m.matchStatus, result_status: m.resultStatus,
          home_score: m.resultStatus === "homologated" ? m.officialHome : null, away_score: m.resultStatus === "homologated" ? m.officialAway : null }));
      return { state: s, data: { items } };
    }
    case "competition_matches_staff": {
      const c = comp(args.competitionId);
      if (!c || !(isMgr(c.id) || h.roleIn(s, c.leagueId, me, ["scorer", "referee"]))) return fail("not_found");
      const base = leagueMatchDemoOp(s, "competition_matches", args, actor, now, h).data;
      return { state: s, data: { is_manager: isMgr(c.id), items: base.items.map((x) => {
        const m = match(x.id);
        return { ...x, seq: m.seq, status_reason: m.statusReason || null, replay_of_match_id: m.replayOf || null,
          officials: lm.officials.filter((o) => o.matchId === m.id).map((o) => ({ player_id: o.playerId, role: o.role, name: s.members.find((y) => y.playerId === o.playerId)?.name || "—" })) };
      }) } };
    }
    case "league_collaborators": {
      if (!(actor?.isAdmin || h.roleIn(s, args.leagueId, me, ["owner", "manager"]))) return fail("not_found");
      return { state: s, data: { items: s.members.filter((x) => x.leagueId === args.leagueId && x.status === "active")
        .map((x) => ({ member_id: x.id, player_id: x.playerId, name: x.name || "—", role: x.role, competition_id: x.competitionId || null })) } };
    }
    case "schedule_match": {
      const m = match(args.matchId);
      if (!m || !isMgr(m.competitionId)) return fail("match_not_found");
      if (args.expectedSeq != null && args.expectedSeq !== m.seq) return fail("stale_seq");
      if (!["unscheduled", "scheduled", "postponed"].includes(m.matchStatus)) return fail("invalid_transition");
      if (!args.kickoffAt) return fail("kickoff_required");
      const nm = setMatch(m, { kickoff: args.kickoffAt, venue: args.venue?.name ?? m.venue, matchStatus: "scheduled" });
      return put({ matches: nm }, { match_id: m.id, match_status: "scheduled", seq: m.seq + 1 });
    }
    case "set_match_off": {
      const m = match(args.matchId);
      if (!["postponed", "cancelled"].includes(args.status)) return fail("invalid_transition");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      if (!m || !isMgr(m.competitionId)) return fail("match_not_found");
      if (!["unscheduled", "scheduled", "postponed"].includes(m.matchStatus)) return fail("invalid_transition");
      const nm = setMatch(m, { matchStatus: args.status, statusReason: args.reason, kickoff: args.status === "postponed" ? null : m.kickoff });
      return put({ matches: nm }, { match_id: m.id, match_status: args.status, seq: m.seq + 1 });
    }
    case "assign_official": {
      const m = match(args.matchId);
      if (!["scorer", "referee"].includes(args.role)) return fail("invalid_role");
      if (!m || !isMgr(m.competitionId)) return fail("match_not_found");
      const rest = lm.officials.filter((o) => !(o.matchId === m.id && o.playerId === args.playerId && o.role === args.role));
      if (args.assign === false) return put({ officials: rest }, { assigned: false });
      if (!s.members.some((x) => x.leagueId === leagueOf(m.competitionId) && x.playerId === args.playerId && x.status === "active")) return fail("not_a_collaborator");
      return put({ officials: [...rest, { matchId: m.id, playerId: args.playerId, role: args.role }] }, { assigned: true });
    }
    // ── L5 ──
    case "match_live": {
      const m = match(args.matchId);
      if (!visibleMatch(m)) return { state: s, data: null };
      const sc = scoreOf(m);
      const hom = m.resultStatus === "homologated";
      return { state: s, data: {
        match: { id: m.id, competition_id: m.competitionId, round_id: m.round, home_team_id: m.homeId, away_team_id: m.awayId, kickoff_at: m.kickoff,
          timezone: "Europe/Lisbon", venue_name: m.venue, match_status: m.matchStatus, result_status: m.resultStatus, seq: m.seq, status_reason: m.statusReason || null },
        score: { home: hom ? m.officialHome : sc.home, away: hom ? m.officialAway : sc.away,
          state: hom ? "homologated" : m.resultStatus === "submitted" ? "in_review" : m.resultStatus === "provisional" ? "provisional" : m.matchStatus === "live" ? "live" : "none",
          pending_rehomologation: hom && (sc.home !== m.officialHome || sc.away !== m.officialAway) && currentHom(m.id)?.kind === "played" },
        timeline: effective(m.id).sort((a, b) => ((a.minute ?? 999) - (b.minute ?? 999)) || (a.seq - b.seq)).map((e) => ({
          id: e.id, type: e.type, team_id: e.teamId, minute: e.minute, period: null, corrected: e.action === "correct",
          player_id: e.playerId, player: e.playerId ? nameOf(e.playerId) : null, assist_player_id: e.assistId, assist: e.assistId ? nameOf(e.assistId) : null })),
        officials: lm.officials.filter((o) => o.matchId === m.id).map((o) => ({ role: o.role, name: nameOf(o.playerId) !== "—" ? nameOf(o.playerId) : (s.members.find((x) => x.playerId === o.playerId)?.name || "—"), player_id: o.playerId })),
        my_role: me ? operatorRole(m) : null, can_homologate: Boolean(me && canHom(m)),
      } };
    }
    case "record_match_event": {
      const m = match(args.matchId);
      const e = args.event || {};
      if (!e.id) return fail("event_id_required");
      if (!m) return fail("match_not_found");
      const old = lm.events.find((x) => x.id === e.id);
      if (old) return old.matchId === m.id && old.action === (e.action || "add") ? { state: s, data: { event_id: old.id, seq: old.seq, duplicate: true } } : fail("event_id_conflict");
      const post = ["submitted", "homologated"].includes(m.resultStatus);
      let role;
      if (post) {
        role = canHom(m);
        if (!role) return fail("not_authority");
        if ((e.action || "add") === "add" && e.source !== "correction") return fail("sumula_closed");
        if (!String(e.reason || "").trim()) return fail("reason_required");
      } else {
        role = operatorRole(m);
        if (!role) return fail("not_operator");
        if (!["live", "finished"].includes(m.matchStatus)) return fail("match_not_live");
      }
      const action = e.action || "add";
      let tgt = null;
      if (action === "correct" || action === "void") {
        tgt = lm.events.find((x) => x.id === e.supersedes && x.matchId === m.id);
        if (!tgt) return fail("event_not_found");
        if (tgt.action === "void" || lm.events.some((x) => x.supersedes === tgt.id)) return fail("stale_event");
        if (!String(e.reason || "").trim()) return fail("reason_required");
      }
      const type = action === "void" ? tgt.type : e.type;
      const teamId = action === "void" ? tgt.teamId : e.team_id;
      const playerId = action === "void" ? tgt.playerId : e.player_id || null;
      if (action !== "void") {
        if (!["goal", "own_goal", "yellow", "second_yellow", "red", "sub"].includes(type)) return fail("invalid_event");
        if (![m.homeId, m.awayId].includes(teamId)) return fail("invalid_event");
        const other = teamId === m.homeId ? m.awayId : m.homeId;
        if (playerId && !inSquad(m, type === "own_goal" ? other : teamId, playerId)) return fail("player_not_in_squad");
        if (["yellow", "second_yellow", "red", "sub"].includes(type) && !playerId) return fail("player_required");
        if (e.assist_player_id) {
          if (rulesOf(m.competitionId)?.assists === "none") return fail("assists_disabled");
          if (!inSquad(m, teamId, e.assist_player_id)) return fail("player_not_in_squad");
        }
      }
      const seq = m.seq + 1;
      const ev = { id: e.id, matchId: m.id, seq, action, supersedes: e.supersedes || null, type, teamId, playerId,
        assistId: action === "void" ? null : e.assist_player_id || null, minute: e.minute ?? tgt?.minute ?? null, reason: e.reason || null,
        source: post ? "correction" : e.source || "live", recordedBy: actor?.name || null, recordedRole: role, recordedAt: iso };
      return put({ events: [...lm.events, ev], matches: setMatch(m, {}) }, { event_id: ev.id, seq, duplicate: false, possible_duplicate: false });
    }
    case "set_match_phase": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const role = operatorRole(m);
      if (!role) return fail("not_operator");
      if (args.expectedSeq !== m.seq) return fail("stale_seq");
      if (args.phase === "live") {
        if (m.matchStatus !== "scheduled") return fail("invalid_transition");
        if (m.kickoff && Date.parse(m.kickoff) > now + 2 * 3600e3) return fail("too_early");
        return put({ matches: setMatch(m, { matchStatus: "live" }) }, { match_id: m.id, match_status: "live", result_status: m.resultStatus, seq: m.seq + 1 });
      }
      if (args.phase === "finished") {
        if (m.matchStatus !== "live") return fail("invalid_transition");
        return put({ matches: setMatch(m, { matchStatus: "finished", resultStatus: "provisional" }) }, { match_id: m.id, match_status: "finished", result_status: "provisional", seq: m.seq + 1 });
      }
      if (args.phase === "submitted") {
        if (!["referee", "owner", "manager"].includes(role)) return fail("not_allowed");
        if (m.matchStatus !== "finished" || m.resultStatus !== "provisional") return fail("invalid_transition");
        return put({ matches: setMatch(m, { resultStatus: "submitted", statusReason: args.note || null }) }, { match_id: m.id, match_status: m.matchStatus, result_status: "submitted", seq: m.seq + 1 });
      }
      return fail("invalid_transition");
    }
    case "match_event_history": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const sup = new Set(lm.events.filter((e) => e.supersedes).map((e) => e.supersedes));
      return { state: s, data: { items: lm.events.filter((e) => e.matchId === m.id).map((e) => ({
        id: e.id, seq: e.seq, action: e.action, supersedes: e.supersedes, type: e.type, team_id: e.teamId, player_id: e.playerId,
        assist_player_id: e.assistId, minute: e.minute, reason: e.reason, source: e.source, recorded_by: e.recordedBy, recorded_role: e.recordedRole,
        recorded_at: e.recordedAt, effective: e.action !== "void" && !sup.has(e.id) })) } };
    }
    // ── 05b formations + Rivals call-up ──
    case "save_match_formation": {
      const m = match(args.matchId);
      if (!m || ![m.homeId, m.awayId].includes(args.teamId)) return fail("match_not_found");
      if (!(leaderOf(args.teamId) || isMgr(m.competitionId))) return fail("not_team_leader");
      if (!["unscheduled", "scheduled", "postponed"].includes(m.matchStatus)) return fail("formation_locked");
      const cur = lm.formations.find((f) => f.matchId === m.id && f.teamId === args.teamId && f.status === "current");
      if ((args.baseVersion ?? null) !== (cur?.version ?? null)) return fail("stale_formation");
      const susp = new Set(suspensions(m.competitionId).filter((x) => x.active).map((x) => x.player_id));
      for (const pid of Object.values(args.slots || {})) if (!inSquad(m, args.teamId, pid) || susp.has(pid)) return fail("player_not_eligible");
      const f = { matchId: m.id, teamId: args.teamId, version: (cur?.version || 0) + 1, formation: args.formation, slots: { ...(args.slots || {}) },
        visibility: args.visibility || "team", status: "current", by: actor?.name || null, at: iso };
      return put({ formations: [...lm.formations.map((x) => (x === cur ? { ...x, status: "superseded" } : x)), f] }, { version: f.version, visibility: f.visibility });
    }
    case "match_formation": {
      const f = lm.formations.find((x) => x.matchId === args.matchId && x.teamId === args.teamId && x.status === "current");
      if (!f) return { state: s, data: null };
      return { state: s, data: { formation: f.formation, version: f.version, visibility: f.visibility, published_by: f.by, published_at: f.at,
        slots: Object.fromEntries(Object.entries(f.slots).map(([k, pid]) => [k, { player_id: pid, name: nameOf(pid) }])) } };
    }
    case "set_league_lineup": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const teamId = args.teamId;
      if (![m.homeId, m.awayId].includes(teamId)) return fail("invalid_team");
      const post = ["submitted", "homologated"].includes(m.resultStatus);
      if (post ? !canHom(m) : !operatorRole(m)) return fail(post ? "not_authority" : "not_operator");
      if (!["scheduled", "live", "finished", "abandoned"].includes(m.matchStatus)) return fail("invalid_transition");
      const ids = args.playerIds || [];
      if (ids.length > 30 || new Set(ids).size !== ids.length) return fail("invalid_lineup");
      if (ids.some((p) => !inSquad(m, teamId, p))) return fail("player_not_in_squad");
      const susp = new Set(suspensions(m.competitionId).filter((x) => x.active).map((x) => x.player_id));
      if (ids.some((p) => susp.has(p))) return fail("player_suspended");
      return put({ lineups: [...lm.lineups.filter((l) => !(l.matchId === m.id && l.teamId === teamId)), ...ids.map((p) => ({ matchId: m.id, teamId, playerId: p }))],
        matches: setMatch(m, {}) }, { match_id: m.id, team_id: teamId, count: ids.length, seq: m.seq + 1 });
    }
    case "match_lineup": {
      return { state: s, data: lm.lineups.filter((l) => l.matchId === args.matchId).map((l) => ({ player_id: l.playerId, team_id: l.teamId })) };
    }
    // ── L6 ──
    case "homologate_match": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const role = canHom(m);
      if (!role) return fail("not_authority");
      if (args.expectedSeq !== m.seq) return fail("stale_seq");
      if (!["finished", "abandoned"].includes(m.matchStatus) || !["provisional", "submitted", "homologated"].includes(m.resultStatus)) return fail("invalid_transition");
      if (m.resultStatus === "homologated") {
        if (!String(args.reason || "").trim()) return fail("reason_required");
        if (!lm.events.some((e) => e.matchId === m.id && e.seq > (currentHom(m.id)?.eventSeq ?? 0))) return fail("nothing_to_rehomologate");
      }
      const sc = scoreOf(m);
      const w = writeHom(m, "played", sc.home, sc.away, null, role, args.reason);
      const cases = suggestCases(m, w.hom, lm.cases);
      return put({ homs: w.homs, cases, matches: setMatch(m, { resultStatus: "homologated", officialHome: sc.home, officialAway: sc.away, homologatedAt: iso }) },
        { revision: w.hom.revision, kind: "played", home_score: sc.home, away_score: sc.away });
    }
    case "record_walkover": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const role = canHom(m);
      if (!role) return fail("not_authority");
      if (args.expectedSeq !== m.seq) return fail("stale_seq");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      if (![m.homeId, m.awayId].includes(args.absentTeamId)) return fail("invalid_team");
      if (!["unscheduled", "scheduled", "postponed", "abandoned"].includes(m.matchStatus)) return fail("invalid_transition");
      const r = rulesOf(m.competitionId)?.walkover || {};
      const win = Number(r.winner_score ?? r.home ?? 3), lose = Number(r.loser_score ?? r.away ?? 0);
      const home = args.absentTeamId === m.homeId ? lose : win, away = args.absentTeamId === m.homeId ? win : lose;
      const w = writeHom(m, "walkover", home, away, args.absentTeamId, role, args.reason);
      return put({ homs: w.homs, matches: setMatch(m, { matchStatus: m.matchStatus === "abandoned" ? "abandoned" : "finished", resultStatus: "homologated",
        officialHome: home, officialAway: away, homologatedAt: iso, statusReason: args.reason, kickoff: m.kickoff || iso }) }, { revision: w.hom.revision, home_score: home, away_score: away });
    }
    case "abandon_match": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      if (!operatorRole(m) && !canHom(m)) return fail("not_operator");
      if (args.expectedSeq !== m.seq) return fail("stale_seq");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      if (m.matchStatus !== "live") return fail("invalid_transition");
      return put({ matches: setMatch(m, { matchStatus: "abandoned", resultStatus: "provisional", statusReason: args.reason }) }, { match_status: "abandoned" });
    }
    case "decide_abandoned_match": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const role = canHom(m);
      if (!role) return fail("not_authority");
      if (m.matchStatus !== "abandoned" || m.resultStatus === "homologated") return fail("invalid_transition");
      if (args.expectedSeq !== m.seq) return fail("stale_seq");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      if (args.decision === "keep_score") return leagueMatchDemoOp(s, "homologate_match", { matchId: m.id, expectedSeq: m.seq, reason: args.reason }, actor, now, h);
      let home = null, away = null, kind = "annulled", extra = [];
      if (args.decision === "award") {
        home = Number(args.payload?.home_score); away = Number(args.payload?.away_score);
        if (!Number.isFinite(home) || !Number.isFinite(away)) return fail("invalid_score");
        kind = "awarded";
      } else if (args.decision === "replay") {
        extra = [{ ...m, id: h.uid("m"), kickoff: null, matchStatus: "unscheduled", resultStatus: "none", seq: 0, replayOf: m.id, officialHome: null, officialAway: null }];
      } else if (args.decision !== "annul") return fail("invalid_decision");
      const w = writeHom(m, kind, home, away, null, role, args.reason);
      return put({ homs: w.homs, matches: [...setMatch(m, { resultStatus: "homologated", officialHome: home, officialAway: away, homologatedAt: iso }), ...extra] },
        { decision: args.decision, revision: w.hom.revision, replay_match_id: extra[0]?.id ?? null });
    }
    case "open_dispute": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const team = [m.homeId, m.awayId].find((t) => leaderOf(t));
      if (!team) return fail("not_team_leader");
      if (!["provisional", "submitted", "homologated"].includes(m.resultStatus)) return fail("nothing_to_dispute");
      const reason = String(args.reason || "").trim();
      if (reason.length < 5) return fail("invalid_dispute");
      const hom = currentHom(m.id);
      const hours = Number(rulesOf(m.competitionId)?.dispute_window_hours ?? 48);
      const deadline = hom ? new Date(Date.parse(hom.at) + hours * 3600e3).toISOString() : null;
      if (deadline && Date.parse(deadline) < now) return fail("dispute_window_closed");
      if (lm.disputes.some((d) => d.matchId === m.id && d.teamId === team && d.status === "open")) return fail("dispute_already_open");
      const d = { id: h.uid("dsp"), matchId: m.id, teamId: team, reason, status: "open", deadlineAt: deadline, createdAt: iso };
      return put({ disputes: [...lm.disputes, d] }, { dispute_id: d.id, deadline_at: deadline });
    }
    case "decide_dispute": {
      const d = lm.disputes.find((x) => x.id === args.disputeId);
      if (!d) return fail("dispute_not_found");
      if (d.status !== "open") return { state: s, data: { status: d.status, unchanged: true } };
      const m = match(d.matchId);
      if (args.decision === "withdrawn") { if (!leaderOf(d.teamId)) return fail("not_allowed"); }
      else if (["upheld", "rejected"].includes(args.decision)) {
        if (!canHom(m)) return fail("not_authority");
        if (!String(args.note || "").trim()) return fail("reason_required");
      } else return fail("invalid_decision");
      return put({ disputes: lm.disputes.map((x) => (x.id === d.id ? { ...x, status: args.decision, decisionNote: args.note || null } : x)) }, { status: args.decision });
    }
    case "competition_disputes": {
      const staff = isMgr(args.competitionId) || h.roleIn(s, leagueOf(args.competitionId), me, ["scorer", "referee"]);
      const items = lm.disputes.filter((d) => { const m = match(d.matchId); return m?.competitionId === args.competitionId && (!args.status || d.status === args.status)
        && (staff || leaderOf(m.homeId) || leaderOf(m.awayId)); })
        .map((d) => { const m = match(d.matchId); return { id: d.id, match_id: d.matchId, round: m.round, home_team_id: m.homeId, away_team_id: m.awayId,
          opened_by_team_id: d.teamId, reason: d.reason, status: d.status, deadline_at: d.deadlineAt, decision_note: d.decisionNote || null,
          created_at: d.createdAt, can_decide: d.status === "open" && Boolean(canHom(m)), evidence: [] }; });
      return { state: s, data: { is_staff: staff, items } };
    }
    case "adjust_points": {
      if (!isMgr(args.competitionId)) return fail("not_found");
      if (!s.registrations.some((r) => r.competitionId === args.competitionId && r.teamId === args.teamId && r.status === "homologated")) return fail("team_not_registered");
      const pts = Number(args.points);
      if (!Number.isInteger(pts) || pts === 0 || Math.abs(pts) > 50 || String(args.reason || "").trim().length < 5) return fail("invalid_adjustment");
      const a = { id: h.uid("adj"), competitionId: args.competitionId, teamId: args.teamId, points: pts, reason: String(args.reason).trim(), createdAt: iso, revokedAt: null };
      return put({ adjustments: [...lm.adjustments, a] }, { adjustment_id: a.id });
    }
    case "revoke_point_adjustment": {
      const a = lm.adjustments.find((x) => x.id === args.adjustmentId);
      if (!a || !isMgr(a.competitionId)) return fail("not_found");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      return put({ adjustments: lm.adjustments.map((x) => (x.id === a.id ? { ...x, revokedAt: iso } : x)) }, { revoked: true });
    }
    case "competition_standings": {
      const c = comp(args.competitionId);
      if (!c || !h.visibleComp(s, c, actor)) return { state: s, data: null };
      const rules = rulesOf(c.id);
      if (!rules) return { state: s, data: { rows: [], regulation_version: null } };
      const teams = s.registrations.filter((r) => r.competitionId === c.id && r.status === "homologated").map((r) => ({ id: r.teamId, name: r.teamName }));
      const done = lm.matches.filter((m) => m.competitionId === c.id && m.resultStatus === "homologated" && currentHom(m.id)?.kind !== "annulled")
        .map((m) => ({ homeId: m.homeId, awayId: m.awayId, home: m.officialHome, away: m.officialAway, loser: currentHom(m.id)?.loserTeamId }));
      const adj = lm.adjustments.filter((a) => a.competitionId === c.id && !a.revokedAt);
      const loserPts = Number(rules.walkover?.loser_points ?? 0);
      const base = zeroRows(teams).map((r) => {
        const a = adj.filter((x) => x.teamId === r.id).reduce((n, x) => n + x.points, 0)
          + done.filter((x) => x.loser === r.id).length * loserPts;
        return { ...r, pts: a, adjustments: a };
      });
      const rows = provisionalStandings(base, done, { points: rules.points, tiebreakers: rules.tiebreakers });
      return { state: s, data: {
        rows: rows.map((r) => ({ team_id: r.id, name: r.name, j: r.j, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts, adjustments: r.adjustments, rank: r.rank, tie_unresolved: r.tieUnresolved })),
        regulation_version: c.currentVersion, tiebreakers: rules.tiebreakers, points: rules.points,
        pending: lm.matches.filter((m) => m.competitionId === c.id && ["provisional", "submitted"].includes(m.resultStatus)).length,
        adjustments: adj.map((a) => ({ id: a.id, team_id: a.teamId, points: a.points, reason: a.reason, created_at: a.createdAt })),
      } };
    }
    case "competition_player_stats": {
      const c = comp(args.competitionId);
      if (!c || !h.visibleComp(s, c, actor)) return { state: s, data: null };
      const agg = {};
      for (const hom of lm.homs.filter((x) => x.status === "current" && match(x.matchId)?.competitionId === c.id)) {
        for (const st of hom.stats) {
          const r = agg[st.playerId] || (agg[st.playerId] = { player_id: st.playerId, team_id: st.teamId, apps: 0, goals: 0, assists: 0, own_goals: 0, yellows: 0, reds: 0 });
          r.apps += st.appeared ? 1 : 0; r.goals += st.goals; r.assists += st.assists; r.own_goals += st.own_goals;
          r.yellows += st.yellows + st.second_yellows; r.reds += st.reds;
        }
      }
      return { state: s, data: { items: Object.values(agg).map((r) => ({ ...r, name: c.youth ? `${String(nameOf(r.player_id))[0]}.` : nameOf(r.player_id), photo_url: null })) } };
    }
    // ── L7 ──
    case "competition_discipline": {
      const c = comp(args.competitionId);
      if (!c || !h.visibleComp(s, c, actor)) return { state: s, data: null };
      return { state: s, data: { suspended: suspensions(c.id).filter((x) => x.active), pending_cases: isMgr(c.id) ? lm.cases.filter((x) => x.competitionId === c.id && x.status === "pending").length : null } };
    }
    case "list_discipline_cases": {
      if (!isMgr(args.competitionId)) return fail("not_found");
      const sus = suspensions(args.competitionId);
      return { state: s, data: { is_manager: true, items: lm.cases.filter((x) => x.competitionId === args.competitionId && (!args.status || x.status === args.status))
        .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
        .map((x) => ({ case_id: x.id, player_id: x.playerId, name: nameOf(x.playerId), team_id: x.teamId, team_name: teamName(x.competitionId, x.teamId),
          source_match_id: x.sourceMatchId, round: x.sourceMatchId ? match(x.sourceMatchId)?.round ?? null : null, trigger: x.trigger,
          suggested_matches: x.suggested, decided_matches: x.decided, status: x.status, reason: x.reason, created_at: x.createdAt,
          served: sus.find((y) => y.player_id === x.playerId)?.served ?? 0, active: Boolean(sus.find((y) => y.player_id === x.playerId)?.active) })) } };
    }
    case "decide_discipline_case": {
      const x = lm.cases.find((c) => c.id === args.caseId);
      if (!x || !isMgr(x.competitionId)) return fail("not_found");
      if (!["confirm", "waive"].includes(args.decision)) return fail("invalid_decision");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      const decided = args.decision === "confirm" ? (args.matches ?? x.suggested) : 0;
      const status = args.decision === "confirm" ? "confirmed" : "waived";
      return put({ cases: lm.cases.map((c) => (c.id === x.id ? { ...c, status, decided, reason: args.reason } : c)) }, { status, decided_matches: decided });
    }
    case "open_discipline_case": {
      if (!isMgr(args.competitionId)) return fail("not_found");
      if (!String(args.reason || "").trim()) return fail("reason_required");
      const x = { id: h.uid("case"), competitionId: args.competitionId, playerId: args.playerId, teamId: args.teamId, sourceMatchId: args.sourceMatchId || null,
        trigger: "manual", suggested: args.matches, decided: args.matches, status: "confirmed", reason: args.reason, createdAt: iso };
      return put({ cases: [...lm.cases, x] }, { case_id: x.id });
    }
    // ── L8 ──
    case "award_official_mvp": {
      const m = match(args.matchId);
      if (!m) return fail("match_not_found");
      const by = rulesOf(m.competitionId)?.mvp?.official_by || ["referee", "manager"];
      const role = by.includes("referee") && isOfficial(m, ["referee"]) ? "referee" : (by.includes("manager") || by.includes("owner")) && isMgr(m.competitionId) ? "manager" : null;
      if (!role) return fail("not_authority");
      if (!["finished", "abandoned"].includes(m.matchStatus)) return fail("match_not_finished");
      const team = inSquad(m, m.homeId, args.playerId) ? m.homeId : inSquad(m, m.awayId, args.playerId) ? m.awayId : null;
      if (!team) return fail("player_not_in_squad");
      const rev = lm.awards.filter((a) => a.matchId === m.id).length + 1;
      if (rev > 1 && !String(args.reason || "").trim()) return fail("reason_required");
      return put({ awards: [...lm.awards.map((a) => (a.matchId === m.id ? { ...a, status: "superseded" } : a)),
        { matchId: m.id, playerId: args.playerId, teamId: team, revision: rev, role, reason: args.reason || null, at: iso, status: "current" }] }, { revision: rev });
    }
    case "match_page": {
      const live = leagueMatchDemoOp(s, "match_live", args, actor, now, h).data;
      if (!live) return { state: s, data: null };
      const m = match(args.matchId); const c = comp(m.competitionId); const lg = s.leagues.find((x) => x.id === c.leagueId);
      const hom = currentHom(m.id); const a = lm.awards.find((x) => x.matchId === m.id && x.status === "current");
      const vote = leagueMatchDemoOp(s, "fan_vote_results", args, actor, now, h).data;
      const form = (tid) => { const f = leagueMatchDemoOp(s, "match_formation", { matchId: m.id, teamId: tid }, actor, now, h).data;
        return f && (f.visibility === "published" || leaderOf(tid) || isMgr(c.id)) ? f : null; };
      const hours = Number(rulesOf(c.id)?.dispute_window_hours ?? 48);
      return { state: s, data: { ...live,
        competition: { id: c.id, name: c.name, slug: c.slug, league_id: lg.id, league_slug: lg.slug, league_name: lg.name, modality: c.modality, format: c.format,
          match_duration_min: c.matchDurationMin ?? 50, youth: Boolean(c.youth) },
        round: { number: m.round, name: null },
        teams: { home: { id: m.homeId, name: teamName(c.id, m.homeId) }, away: { id: m.awayId, name: teamName(c.id, m.awayId) } },
        homologation: hom ? { revision: hom.revision, kind: hom.kind, home_score: hom.home, away_score: hom.away, decided_role: hom.role, created_at: hom.at, regulation_version: c.currentVersion, reason: hom.reason } : null,
        official_mvp: a ? { player_id: a.playerId, name: nameOf(a.playerId), team_id: a.teamId, revision: a.revision, decided_role: a.role } : null,
        fan_vote: vote, formations: { home: form(m.homeId), away: form(m.awayId) },
        dispute: { window_closes_at: hom ? new Date(Date.parse(hom.at) + hours * 3600e3).toISOString() : null,
          open_count: lm.disputes.filter((d) => d.matchId === m.id && d.status === "open").length },
        me: { is_staff: Boolean(live.my_role && live.my_role !== "team_leader"), is_manager: isMgr(c.id), operator_role: live.my_role, can_homologate: live.can_homologate,
          leader_of_team_id: [m.homeId, m.awayId].find((t) => leaderOf(t)) || null, member_of_team_id: [m.homeId, m.awayId].find((t) => leaderOf(t)) || null },
      } };
    }
    case "open_fan_vote": {
      const m = match(args.matchId);
      if (!m || !isMgr(m.competitionId)) return fail("match_not_found");
      if (!rulesOf(m.competitionId)?.mvp?.fan_vote) return fail("fan_vote_disabled");
      if (!["finished", "abandoned"].includes(m.matchStatus)) return fail("match_not_finished");
      const ex = lm.windows.find((w) => w.matchId === m.id);
      if (ex) return { state: s, data: { opens_at: ex.opensAt, closes_at: ex.closesAt } };
      const w = { matchId: m.id, opensAt: iso, closesAt: new Date(now + Math.max(1, Math.min(168, args.hours || 24)) * 3600e3).toISOString() };
      return put({ windows: [...lm.windows, w] }, { opens_at: w.opensAt, closes_at: w.closesAt });
    }
    case "cast_fan_vote": {
      if (!me) return fail("not_authenticated");
      const m = match(args.matchId);
      if (!visibleMatch(m)) return fail("match_not_found");
      const w = lm.windows.find((x) => x.matchId === m.id);
      if (!w || now < Date.parse(w.opensAt) || now >= Date.parse(w.closesAt)) return fail("vote_closed");
      if (args.playerId === me) return fail("no_self_vote");
      const appeared = lm.lineups.some((l) => l.matchId === m.id && l.playerId === args.playerId)
        || (currentHom(m.id)?.stats || []).some((x) => x.playerId === args.playerId && x.appeared)
        || inSquad(m, m.homeId, args.playerId) || inSquad(m, m.awayId, args.playerId);
      if (!appeared) return fail("not_a_candidate");
      return put({ votes: [...lm.votes.filter((v) => !(v.matchId === m.id && v.voter === me)), { matchId: m.id, voter: me, playerId: args.playerId }] },
        { voted_player_id: args.playerId, closes_at: w.closesAt });
    }
    case "fan_vote_results": {
      const m = match(args.matchId);
      if (!visibleMatch(m)) return fail("match_not_found");
      const w = lm.windows.find((x) => x.matchId === m.id);
      if (!w) return { state: s, data: { state: "none" } };
      const closed = now >= Date.parse(w.closesAt);
      const tally = {};
      lm.votes.filter((v) => v.matchId === m.id).forEach((v) => { tally[v.playerId] = (tally[v.playerId] || 0) + 1; });
      return { state: s, data: { state: closed ? "closed" : "open", closes_at: w.closesAt,
        my_vote: lm.votes.find((v) => v.matchId === m.id && v.voter === me)?.playerId ?? null,
        total_votes: closed ? Object.values(tally).reduce((n, x) => n + x, 0) : null,
        items: closed ? Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([pid, n]) => ({ player_id: pid, name: nameOf(pid), votes: n })) : null } };
    }
    case "close_fan_vote_demo": { // local-only shortcut so the walkthrough doesn't wait 24h
      const m = match(args.matchId);
      if (!m || !isMgr(m.competitionId)) return fail("match_not_found");
      return put({ windows: lm.windows.map((w) => (w.matchId === m.id ? { ...w, closesAt: iso } : w)) }, { closed: true });
    }
    default:
      return null;
  }
}
