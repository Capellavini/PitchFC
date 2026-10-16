import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { usePersistentState } from "../lib/storage";
import {
  demoEntityName, emptyLeagueOrgState, leagueDemoOp, leagueErrorCode, leagueInviteUrl, normCompetitionPage, normFollowing,
  normLeaguePage, normMyLeague, normRegistrations, normRequest, normTeamsPage, registrationUrl, validateRules,
} from "../lib/leagueCloud";

/**
 * PITCH Ligas Fase 2 — thin data layer for the REAL league flows (L1–L3 +
 * fans), same shape as useTeams: every action resolves to { data } or
 * { error: <code> } and never throws; every write is ONE SECURITY DEFINER
 * RPC (supabase/migrations/20261016155000…155500), no direct table writes.
 *
 * Modes:
 *   cloud — Supabase configured: the RPCs. Reads go through the public
 *           RPCs (league_page, competition_page, competition_teams_page)
 *           or RLS-readable tables (my access requests, names for
 *           "Acompanhando").
 *   demo  — no Supabase keys: lib/leagueCloud.leagueDemoOp, a local mirror
 *           of the same rules in localStorage (pitch.v2.leagueOrgDemo).
 *           /league/demo (lib/leagueDemo.js) is a separate showcase and is
 *           never touched from here.
 *
 * `active`: only true on league routes with the `leagues` flag on — the
 * hook does no network work at all otherwise (production users pay nothing).
 *
 * Teams: registration uses the caller's EXISTING Rivals team. `resolveTeam(teamId)`
 * (from useTeams) returns { id, name, role, memberIds, members } — the demo
 * mirror needs it to apply the leader/member rules; cloud re-checks on the server.
 *
 * Not here yet (L4+, see docs/LIGAS-FASE2-PLAN.md §10): fixtures/scheduling,
 * live súmula persistence, homologation, standings, discipline, official
 * MVP, fan votes, fantasy. The seams are the RPCs already deployed by L3
 * (create_fixtures, record_match_event, set_match_phase, match_live).
 */
export function useLeagues({ active = false, cloudStatus, myPlayer, isAdmin: adminFlag = false, demoMe = null, resolveTeam = null }) {
  const cloudCapable = supabaseEnabled && !["off", "failed"].includes(cloudStatus);
  // Local demo has no admin accounts: the lone tester plays the PITCH admin
  // too (approves their own pilot request) so the whole loop is walkable.
  const isAdmin = cloudCapable ? adminFlag : true;
  const meId = cloudCapable ? myPlayer?.id ?? null : demoMe?.id ?? null;
  const signedIn = Boolean(meId);

  const [demo, setDemo] = usePersistentState("leagueOrgDemo", null);
  const demoState = useMemo(() => (demo && demo.v === 1 ? demo : emptyLeagueOrgState()), [demo]);
  const demoRef = useRef(demoState);
  demoRef.current = demoState;
  // Primitive deps only: the player objects may be re-created every render.
  const meName = (cloudCapable ? myPlayer?.nick || myPlayer?.name : demoMe?.nick || demoMe?.name) || null;
  const actor = useMemo(() => (meId ? { id: meId, name: meName, isAdmin } : null), [meId, meName, isAdmin]);

  const [myLeagues, setMyLeagues] = useState([]);
  const [following, setFollowing] = useState({ supporting: [], follows: [] });
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  // ── Plumbing ───────────────────────────────────────────
  const rpc = useCallback(async (name, args, map = (x) => x) => {
    try {
      const r = await supabase.rpc(name, args);
      if (r.error) return { error: leagueErrorCode(r.error) };
      return { data: map(r.data) };
    } catch (e) {
      return { error: leagueErrorCode(e) };
    }
  }, []);
  const demoCall = useCallback((op, args, map = (x) => x, { write = true } = {}) => {
    const r = leagueDemoOp(demoRef.current, op, args, actor);
    if (r.error) return { error: r.error };
    if (write && r.state !== demoRef.current) { demoRef.current = r.state; setDemo(r.state); setRevision((n) => n + 1); }
    return { data: map(r.data) };
  }, [actor, setDemo]);
  /** One action: cloud RPC or demo op, then reload the personal lists. */
  const act = useCallback(async (rpcName, rpcArgs, demoOpName, demoArgs, map, { reload = true } = {}) => {
    if (!signedIn) return { error: "not_authenticated" };
    const r = cloudCapable ? await rpc(rpcName, rpcArgs, map) : demoCall(demoOpName, demoArgs, map);
    if (!r.error && reload) loadRef.current?.();
    return r;
  }, [signedIn, cloudCapable, rpc, demoCall]);
  const read = useCallback(async (rpcName, rpcArgs, demoOpName, demoArgs, map) => (cloudCapable
    ? rpc(rpcName, rpcArgs, map)
    : demoCall(demoOpName, demoArgs, map, { write: false })), [cloudCapable, rpc, demoCall]);

  // ── Personal lists: Minhas ligas, Acompanhando, my pilot requests ──
  const load = useCallback(async () => {
    if (!active || !signedIn) { setMyLeagues([]); setFollowing({ supporting: [], follows: [] }); setMyRequests([]); return; }
    setLoading(true);
    try {
      if (cloudCapable) {
        const [ml, mf, mr] = await Promise.all([
          supabase.rpc("my_leagues"), supabase.rpc("my_following"),
          supabase.from("league_access_requests").select("id,org_name,city,country,expected_teams,context,status,used_by_league_id,created_at")
            .eq("requester_player_id", meId).order("created_at", { ascending: false }),
        ]);
        // Tolerate the migrations not being applied yet (feature flag on a project without them).
        setMyLeagues(ml.error ? [] : (ml.data?.items || []).map(normMyLeague));
        setFollowing(mf.error ? { supporting: [], follows: [] } : normFollowing(mf.data));
        setMyRequests(mr.error ? [] : (mr.data || []).map(normRequest));
      } else {
        const s = demoRef.current;
        setMyLeagues(leagueDemoOp(s, "my_leagues", {}, actor).data.items);
        setFollowing(normFollowing(leagueDemoOp(s, "my_following", {}, actor).data));
        setMyRequests(s.requests.filter((r) => r.requesterId === meId).slice().reverse());
      }
    } finally {
      setLoading(false);
      setRevision((n) => n + 1);
    }
  }, [active, signedIn, cloudCapable, meId, actor]);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => { load(); }, [load]);

  /** Names (+ slugs) for "Acompanhando" rows: { "league:<id>": {name, slug}, … }. */
  const [followNames, setFollowNames] = useState({});
  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    const ids = (type) => following.follows.filter((f) => f.entityType === type).map((f) => f.entityId);
    (async () => {
      const out = {};
      if (cloudCapable) {
        const [lq, cq, tq] = await Promise.all([
          ids("league").length ? supabase.from("leagues").select("id,slug,name").in("id", ids("league")) : { data: [] },
          ids("competition").length ? supabase.from("competitions").select("id,slug,name,league_id,leagues(slug)").in("id", ids("competition")) : { data: [] },
          ids("team").length ? supabase.from("teams").select("id,slug,name").in("id", ids("team")) : { data: [] },
        ]);
        for (const l of lq.data || []) out[`league:${l.id}`] = { name: l.name, slug: l.slug };
        for (const c of cq.data || []) out[`competition:${c.id}`] = { name: c.name, slug: c.leagues?.slug, competitionSlug: c.slug };
        for (const t of tq.data || []) out[`team:${t.id}`] = { name: t.name, teamSlug: t.slug };
      } else {
        for (const f of following.follows) {
          const n = demoEntityName(demoRef.current, f.entityType, f.entityId);
          if (n) out[`${f.entityType}:${f.entityId}`] = n;
        }
      }
      if (alive) setFollowNames(out);
    })().catch(() => {});
    return () => { alive = false; };
  }, [active, cloudCapable, following]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // ── L1: pilot access, league, collaborators ────────────
  const requestPilot = useCallback((fields) => {
    const f = { org_name: (fields.orgName || "").trim(), city: fields.city || null, country: fields.country || "PT",
      expected_teams: fields.expectedTeams ? String(fields.expectedTeams) : null, context: fields.context || null };
    return act("request_league_access", { p_fields: f }, "request_league_access", fields,
      (d) => ({ requestId: d.request_id ?? d.requestId, status: d.status, created: Boolean(d.created) }));
  }, [act]);

  /** Admin: requests to review (with requester contact). */
  const listAccessRequests = useCallback(async (status = "pending") => {
    if (!isAdmin) return { error: "admin_only" };
    if (cloudCapable) return rpc("list_league_access_requests", { p_status: status }, (d) => (d?.items || []).map(normRequest));
    return { data: demoRef.current.requests.filter((r) => !status || r.status === status) };
  }, [isAdmin, cloudCapable, rpc]);

  const reviewRequest = useCallback((requestId, decision, note = null) => act("review_league_access",
    { p_request_id: requestId, p_decision: decision, p_note: note }, "review_league_access", { requestId, decision, note },
    (d) => ({ requestId: d.request_id ?? d.requestId, status: d.status, alreadyReviewed: Boolean(d.already_reviewed ?? d.alreadyReviewed) })), [act]);

  const createLeague = useCallback((name, fields = {}, clientRef = null) => act("create_league",
    { p_name: (name || "").trim(), p_fields: fields.city ? { city: fields.city } : {}, p_client_ref: clientRef }, "create_league", { name, ...fields },
    (d) => ({ leagueId: d.league_id ?? d.leagueId, slug: d.slug, created: d.created !== false })), [act]);

  const updateLeague = useCallback((leagueId, fields) => act("update_league", { p_league_id: leagueId, p_fields: fields },
    "update_league", { leagueId, fields }, (d) => ({ leagueId: d.league_id ?? d.leagueId })), [act]);
  const setLeagueStatus = useCallback((leagueId, status) => act("set_league_status", { p_league_id: leagueId, p_status: status },
    "set_league_status", { leagueId, status }, (d) => ({ status: d.status })), [act]);

  const inviteCollaborator = useCallback((leagueId, role, competitionId = null) => act("create_league_invite",
    { p_league_id: leagueId, p_role: role, p_competition_id: competitionId }, "create_league_invite", { leagueId, role, competitionId },
    (d) => ({ token: d.token, role: d.role ?? role, expiresAt: d.expires_at ?? d.expiresAt, url: leagueInviteUrl(d.token, origin) }), { reload: false }), [act, origin]);

  /** Works logged out. */
  const previewInvite = useCallback((token) => read("league_invite_preview", { p_token: token }, "league_invite_preview", { token },
    (d) => ({ status: d?.status || "not_found", role: d?.role ?? null, league: d?.league ? { name: d.league.name, slug: d.league.slug } : null })), [read]);

  const acceptInvite = useCallback((token) => act("accept_league_invite", { p_token: token }, "accept_league_invite", { token },
    (d) => ({ role: d.role, leagueId: d.league_id ?? d.leagueId ?? null, slug: d.slug ?? null, alreadyMember: Boolean(d.already_member ?? d.alreadyMember) })), [act]);

  /** Public league page (null = not found / not visible). */
  const fetchLeague = useCallback((slug, key = null) => read("league_page", { p_slug: slug, p_key: key }, "league_page", { slug, key },
    (d) => (d ? normLeaguePage({ ...d, my_roles: d.my_roles ?? d.myRoles, view_key: d.view_key ?? d.viewKey }) : null)), [read]);

  // ── L2: competitions + regulation ──────────────────────
  /** fields: { name, format, modality, season, category, youth }; rules: partial regulation (defaults filled). */
  const createCompetition = useCallback(async (leagueId, fields, rules = {}, clientRef = null) => {
    const v = validateRules(rules);
    if (v.error) return v;
    if (!cloudCapable) {
      return act(null, null, "create_competition", { leagueId, fields, rules },
        (d) => ({ competitionId: d.competitionId, slug: d.slug, regulationVersion: d.regulationVersion }));
    }
    // Season / category are reusable rows; create (idempotent on name) when given.
    const extra = {};
    if (fields.season) {
      const s = await rpc("create_season", { p_league_id: leagueId, p_name: fields.season });
      if (s.error) return s;
      extra.season_id = s.data.season_id;
    }
    if (fields.category) {
      const c = await rpc("create_category", { p_league_id: leagueId, p_name: fields.category, p_youth: Boolean(fields.youth) });
      if (c.error) return c;
      extra.category_id = c.data.category_id;
    }
    return act("create_competition", {
      p_league_id: leagueId, p_rules: rules, p_client_ref: clientRef,
      p_fields: { name: (fields.name || "").trim(), format: fields.format || "7v7", modality: fields.modality || "futebol",
        ...(fields.matchDurationMin ? { match_duration_min: String(fields.matchDurationMin) } : {}), ...extra },
    }, null, null, (d) => ({ competitionId: d.competition_id, slug: d.slug, regulationVersion: d.regulation_version }));
  }, [cloudCapable, rpc, act]);

  const publishRegulation = useCallback((competitionId, version, reason = null) => act("publish_regulation",
    { p_competition_id: competitionId, p_version: version, p_reason: reason }, "publish_regulation", { competitionId, version, reason },
    (d) => ({ version: d.version }), { reload: false }), [act]);

  const setCompetitionStatus = useCallback((competitionId, status) => act("set_competition_status",
    { p_competition_id: competitionId, p_status: status }, "set_competition_status", { competitionId, status },
    (d) => ({ status: d.status, unchanged: Boolean(d.unchanged) }), { reload: false }), [act]);

  const fetchCompetition = useCallback(async (leagueSlug, competitionSlug, key = null) => {
    const r = await read("competition_page", { p_league_slug: leagueSlug, p_competition_slug: competitionSlug, p_key: key },
      "competition_page", { leagueSlug, competitionSlug, key }, (d) => (d ? { ...normCompetitionPage(d), draftVersion: d.draft_version ?? null } : null));
    // Cloud: the open draft version (staff only; RLS shows drafts to staff).
    if (cloudCapable && r.data?.isStaff) {
      const q = await supabase.from("competition_regulations").select("version").eq("competition_id", r.data.id).eq("status", "draft").maybeSingle();
      r.data.draftVersion = q.data?.version ?? null;
    }
    return r;
  }, [read, cloudCapable]);

  // ── L2b: registration + squad snapshot ─────────────────
  const createRegistrationLink = useCallback((competitionId, teamId = null) => act("create_registration_link",
    { p_competition_id: competitionId, p_team_id: teamId }, "create_registration_link", { competitionId, teamId },
    (d) => ({ token: d.token, expiresAt: d.expires_at ?? d.expiresAt, url: registrationUrl(d.token, origin) }), { reload: false }), [act, origin]);

  const previewRegistrationLink = useCallback((token) => read("registration_link_preview", { p_token: token }, "registration_link_preview", { token },
    (d) => ({ status: d?.status || "not_found", competition: d?.competition || null, league: d?.league || null, deadline: d?.deadline ?? null,
      forTeam: d?.for_team ?? null })), [read]);

  const registerTeam = useCallback(async (token, teamId) => {
    const team = !cloudCapable && resolveTeam ? await resolveTeam(teamId) : null;
    return act("register_team", { p_token: token, p_team_id: teamId }, "register_team", { token, team },
      (d) => ({ registrationId: d.registration_id ?? d.registrationId, status: d.status, created: Boolean(d.created) }), { reload: false });
  }, [cloudCapable, resolveTeam, act]);

  /** players: [{ playerId, name, shirtNumber, captain }] — active members of the team (server re-checks). */
  const submitSquad = useCallback(async (registrationId, teamId, players) => {
    const team = !cloudCapable && resolveTeam ? await resolveTeam(teamId) : null;
    return act("submit_squad", {
      p_registration_id: registrationId,
      p_players: players.map((p) => ({ player_id: p.playerId, shirt_number: p.shirtNumber ?? null, squad_role: p.captain ? "captain" : "player" })),
    }, "submit_squad", { registrationId, team, players }, (d) => ({ version: d.version, status: d.status }), { reload: false });
  }, [cloudCapable, resolveTeam, act]);

  const decideSquad = useCallback((registrationId, version, decision, note = null) => act("decide_squad",
    { p_registration_id: registrationId, p_version: version, p_decision: decision, p_note: note },
    "decide_squad", { registrationId, version, decision, note }, (d) => ({ status: d.status, version: d.homologated_squad_version ?? d.version }), { reload: false }), [act]);

  const fetchRegistrations = useCallback((competitionId, myTeamIds = []) => read("competition_registrations", { p_competition_id: competitionId },
    "competition_registrations", { competitionId, myTeamIds }, normRegistrations), [read]);

  /** Public: homologated teams + their squads (display names; initials in youth categories). */
  const fetchCompetitionTeams = useCallback((competitionId, key = null) => read("competition_teams_page", { p_competition_id: competitionId, p_key: key },
    "competition_teams_page", { competitionId, key }, (d) => (d ? normTeamsPage(d) : [])), [read]);

  // ── Fans ───────────────────────────────────────────────
  const setSupportedTeam = useCallback((competitionId, teamId) => act("set_supported_team", { p_competition_id: competitionId, p_team_id: teamId },
    "set_supported_team", { competitionId, teamId }, (d) => ({ teamId: d.team_id ?? d.teamId ?? null })), [act]);

  const follow = useCallback((entityType, entityId, on = true, notify = true) => act("follow",
    { p_entity_type: entityType, p_entity_id: entityId, p_on: on, p_notify: notify }, "follow", { entityType, entityId, on, notify },
    (d) => ({ following: Boolean(d.following) })), [act]);

  const isFollowing = useCallback((entityType, entityId) => following.follows.some((f) => f.entityType === entityType && f.entityId === entityId), [following]);
  const supportedTeamOf = useCallback((competitionId) => following.supporting.find((s) => s.competitionId === competitionId)?.teamId ?? null, [following]);

  const resetDemo = useCallback(() => setDemo(null), [setDemo]);

  return {
    mode: cloudCapable ? "cloud" : "demo",
    signedIn, myPlayerId: meId, isAdmin, loading, revision,
    myLeagues, following, followNames, myRequests,
    requestPilot, listAccessRequests, reviewRequest, createLeague, updateLeague, setLeagueStatus,
    inviteCollaborator, previewInvite, acceptInvite, fetchLeague,
    createCompetition, publishRegulation, setCompetitionStatus, fetchCompetition,
    createRegistrationLink, previewRegistrationLink, registerTeam, submitSquad, decideSquad, fetchRegistrations, fetchCompetitionTeams,
    setSupportedTeam, follow, isFollowing, supportedTeamOf,
    refresh: load, resetDemo,
  };
}
