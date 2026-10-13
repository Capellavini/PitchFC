import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { usePersistentState } from "../lib/storage";
import {
  demoMyTeams, demoInvitePreview, demoOp, demoSeed, emptyRecord, listTeamsLocal, normDirectoryItem, normMember,
  normRecord, normTeam, rivalsErrorCode, sortRoster, teamInviteUrl,
} from "../lib/rivals";
import {
  demoChallengeInvite, demoChallengeOp, demoIncomingChallenge, demoMyChallenges, demoRivalMove, normChallenge,
  normChallengeInvite, pendingActionCount, termsToRpc, withChallengeSeed, challengeInviteUrl,
} from "../lib/rivalsChallenges";

const RIVAL_DELAY_MS = 1800; // demo: the simulated rival captain "thinks" this long

/**
 * PITCH Rivals — teams data layer (PR2). Group ≠ Team: a Team is a
 * permanent competitive identity (crest, captain/vice, squad by invite).
 *
 * Every WRITE is one SECURITY DEFINER RPC (migration 20260101007000) —
 * there are no direct table writes anywhere in the app. Reads use the
 * read-only RLS policies (my memberships, a team + its active squad) or
 * the preview RPCs (team_profile / team_invite_preview also work logged
 * out; list_teams is the signed-in directory).
 *
 * Modes, like the rest of the app:
 *   cloud — Supabase configured. Actions work as soon as there's a session
 *           (even before the player card exists: the server answers
 *           rivals:no_profile); myTeams loads once the player exists
 *           (status ready OR needsGroup — team-only players have no group).
 *   demo  — no Supabase keys: localStorage (pitch.v2.rivalsDemo) mutated
 *           by rivals.js demoOp(), a mirror of the RPC rules.
 *
 * Every action resolves to { data } or { error: <code> } — never throws.
 * Turn a code into copy with rivalsError(code) (lib/rivalsCopy).
 *
 * Challenges (PR5, migration 20261013140000): `challenges` = every
 * challenge of my teams (my_challenges RPC; demo: rivalsChallenges.js
 * mirror) with versions + the shared match; `pendingActions` = how many
 * need me (a leader). Actions map 1:1 to the RPCs. In demo mode a
 * simulated rival captain answers shortly after it becomes their turn.
 * EXTENSION POINT (PR6–PR7): results, RSVP, lineup and records plug in
 * here (same {data}|{error} contract, same realtime channel).
 */

const TEAM_COLS = "id,name,slug,city,region,country,color,secondary_color,logo_url,preferred_format,home_venue,timezone,currency,listed,captain_id,created_at,archived_at";
const MEMBER_COLS = "player_id,role,status,joined_at,players(nick,name,photo_url,position)";

const camelToRpc = (f = {}) => {
  const map = { name: "name", city: "city", region: "region", country: "country", listed: "listed", color: "color",
    secondaryColor: "secondary_color", homeVenue: "home_venue", format: "preferred_format", logoUrl: "logo_url",
    timezone: "timezone", currency: "currency" };
  const out = {};
  for (const [k, v] of Object.entries(f)) if (map[k] && v !== undefined) out[map[k]] = v === "" ? null : v;
  return out;
};
const normInvite = (r) => r && ({
  token: r.token, expiresAt: r.expires_at ?? r.expiresAt, maxUses: r.max_uses ?? r.maxUses ?? null,
  uses: r.uses ?? 0, createdAt: r.created_at ?? r.createdAt, revokedAt: r.revoked_at ?? r.revokedAt ?? null,
  url: teamInviteUrl(r.token, typeof window !== "undefined" ? window.location.origin : undefined),
});

export function useTeams({ cloudStatus, myPlayer, demoMe, uploadMedia }) {
  const cloudCapable = supabaseEnabled && !["off", "failed"].includes(cloudStatus);
  const cloudReady = cloudCapable && ["ready", "needsGroup"].includes(cloudStatus) && Boolean(myPlayer?.id);
  const meId = cloudCapable ? myPlayer?.id ?? null : demoMe?.id ?? null;

  // ── Cloud state ────────────────────────────────────────
  const [cloudTeams, setCloudTeams] = useState([]);
  const [cloudChallenges, setCloudChallenges] = useState([]);
  const [loading, setLoading] = useState(cloudCapable);
  const [revision, setRevision] = useState(0);

  // ── Demo state ─────────────────────────────────────────
  const [demo, setDemo] = usePersistentState("rivalsDemo", null);
  const demoState = useMemo(() => withChallengeSeed(demo && demo.v === 1 ? demo : demoSeed()), [demo]);
  const demoRef = useRef(demoState);
  demoRef.current = demoState;

  // load() reads the CURRENT session through refs: an action started on an
  // earlier render (e.g. accepting an invite right after the player card
  // is created) must not reload with a stale "no player yet" view.
  const liveRef = useRef({});
  liveRef.current = { cloudReady, cloudCapable, cloudStatus, playerId: myPlayer?.id };
  const load = useCallback(async () => {
    const { cloudReady: ready, cloudCapable: capable, cloudStatus: status, playerId } = liveRef.current;
    if (!ready) { setCloudTeams([]); setCloudChallenges([]); setLoading(capable && (status === "loading" || status === "needsProfile")); return; }
    // Challenges load independently: tolerate migration 20261013140000 not applied yet.
    const challengesQ = supabase.rpc("my_challenges").then((r) => {
      if (r.error) throw r.error;
      setCloudChallenges(r.data?.items ?? []);
    }).catch((e) => { console.warn("PITCH Rivals: challenges unavailable", e?.message || e); setCloudChallenges([]); });
    try {
      const mq = await supabase.from("team_members").select(`role,status,joined_at,teams(${TEAM_COLS})`)
        .eq("player_id", playerId).eq("status", "active");
      if (mq.error) throw mq.error;
      const rows = (mq.data ?? []).filter((m) => m.teams && !m.teams.archived_at);
      const ids = rows.map((m) => m.teams.id);
      let counts = {};
      if (ids.length) {
        const cq = await supabase.from("team_members").select("team_id").in("team_id", ids).eq("status", "active");
        counts = (cq.data ?? []).reduce((acc, r) => ({ ...acc, [r.team_id]: (acc[r.team_id] || 0) + 1 }), {});
      }
      setCloudTeams(rows.map((m) => ({ ...normTeam(m.teams), role: m.role, since: m.joined_at, memberCount: counts[m.teams.id] || 1, record: emptyRecord() }))
        .sort((a, b) => String(a.since).localeCompare(String(b.since))));
    } catch (e) {
      // Tolerate the Rivals migration not being applied yet: no teams.
      console.warn("PITCH Rivals: teams unavailable", e?.message || e);
      setCloudTeams([]);
    } finally {
      await challengesQ;
      setLoading(false);
      setRevision((n) => n + 1);
    }
  }, []);

  useEffect(() => { load(); }, [load, cloudReady, myPlayer?.id]);

  // Realtime: roster / team changes → debounced reload (RLS applies).
  const timer = useRef(null);
  useEffect(() => {
    if (!cloudReady) return undefined;
    const bump = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 250); };
    const ch = supabase.channel(`pitch-rivals-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_challenges" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_matches" }, bump)
      .subscribe();
    return () => { clearTimeout(timer.current); supabase.removeChannel(ch); };
  }, [cloudReady, load]);

  const myTeams = useMemo(
    () => (cloudCapable ? cloudTeams : (meId ? demoMyTeams(demoState, meId) : [])),
    [cloudCapable, cloudTeams, demoState, meId],
  );

  // ── Plumbing ───────────────────────────────────────────
  const rpc = useCallback(async (name, args, map = (x) => x, { reload = true } = {}) => {
    if (!cloudCapable) return { error: "unknown" };
    try {
      const r = await supabase.rpc(name, args);
      if (r.error) return { error: rivalsErrorCode(r.error) };
      if (reload) await load();
      return { data: map(r.data) };
    } catch (e) {
      return { error: rivalsErrorCode(e) };
    }
  }, [cloudCapable, load]);

  const demoCall = useCallback((op, args, map = (x) => x) => {
    if (!demoMe?.id) return { error: "not_authenticated" };
    const r = demoOp(demoRef.current, op, args, demoMe);
    if (r.error) return { error: r.error };
    demoRef.current = r.state;
    setDemo(r.state);
    setRevision((n) => n + 1);
    return { data: map(r.data) };
  }, [demoMe, setDemo]);

  // ── Teams ──────────────────────────────────────────────
  const createTeam = useCallback(async (fields) => {
    const { name, ...rest } = fields || {};
    if (cloudCapable) {
      return rpc("create_team", { p_name: (name || "").trim(), p_fields: camelToRpc(rest) },
        (d) => ({ teamId: d.team_id, slug: d.slug, created: d.created }));
    }
    const r = demoCall("create_team", { name, fields: rest });
    // Demo: a rival challenges the new team so the inbox has something to answer.
    if (!r.error && r.data.created) {
      const next = demoIncomingChallenge(demoRef.current, r.data.teamId);
      if (next !== demoRef.current) { demoRef.current = next; setDemo(next); }
    }
    return r;
  }, [cloudCapable, rpc, demoCall, setDemo]);

  const updateTeam = useCallback(async (teamId, fields) => (cloudCapable
    ? rpc("update_team", { p_team_id: teamId, p_fields: camelToRpc(fields) }, (d) => ({ teamId: d.team_id, slug: d.slug }))
    : demoCall("update_team", { teamId, fields })), [cloudCapable, rpc, demoCall]);

  const archiveTeam = useCallback(async (teamId) => (cloudCapable
    ? rpc("archive_team", { p_team_id: teamId }, () => ({ teamId }))
    : demoCall("archive_team", { teamId })), [cloudCapable, rpc, demoCall]);

  /** One team + its active squad (captain, vice, players) + my role. */
  const fetchTeam = useCallback(async (teamId) => {
    if (!teamId) return { error: "team_not_found" };
    if (cloudCapable) {
      try {
        const [tq, mq] = await Promise.all([
          supabase.from("teams").select(TEAM_COLS).eq("id", teamId).maybeSingle(),
          supabase.from("team_members").select(MEMBER_COLS).eq("team_id", teamId).eq("status", "active"),
        ]);
        if (tq.error) return { error: rivalsErrorCode(tq.error) };
        if (!tq.data) return { error: "team_not_found" };
        const members = sortRoster((mq.data ?? []).map(normMember));
        return { data: { team: normTeam(tq.data), members, myRole: members.find((m) => m.playerId === meId)?.role ?? null, record: emptyRecord() } };
      } catch (e) {
        return { error: rivalsErrorCode(e) };
      }
    }
    const s = demoRef.current;
    const team = s.teams.find((x) => x.id === teamId);
    if (!team) return { error: "team_not_found" };
    const members = sortRoster(s.members.filter((m) => m.teamId === teamId && m.status === "active"));
    return { data: { team, members, myRole: members.find((m) => m.playerId === meId)?.role ?? null, record: emptyRecord() } };
  }, [cloudCapable, meId]);

  /** Public identity by slug (?team=) — works logged out (team_profile). */
  const fetchPublicTeam = useCallback(async (slug) => {
    if (cloudCapable) {
      const r = await rpc("team_profile", { p_slug: slug }, (d) => d, { reload: false });
      if (r.error) return r;
      if (!r.data) return { error: "team_not_found" };
      const d = r.data;
      return { data: { team: normTeam(d), memberCount: Number(d.member_count || 0), myRole: d.my_role ?? null, record: normRecord(d.record) } };
    }
    const s = demoRef.current;
    const team = s.teams.find((x) => x.slug === slug);
    if (!team) return { error: "team_not_found" };
    const active = s.members.filter((m) => m.teamId === team.id && m.status === "active");
    return { data: { team, memberCount: active.length, myRole: active.find((m) => m.playerId === meId)?.role ?? null, record: emptyRecord() } };
  }, [cloudCapable, rpc, meId]);

  /** The team directory (signed-in only). */
  const listTeams = useCallback(async ({ country = "PT", region = null, city = null, format = null, query = null, onlyNear = false, limit = 30, offset = 0 } = {}) => {
    if (cloudCapable) {
      return rpc("list_teams", {
        p_country: country, p_region: region || null, p_city: city || null, p_format: format || null,
        p_query: query || null, p_limit: limit, p_offset: offset, p_only_near: onlyNear,
      }, (d) => ({ items: (d?.items ?? []).map(normDirectoryItem), hasMore: Boolean(d?.has_more) }), { reload: false });
    }
    return { data: listTeamsLocal(demoRef.current, { country, region, city, format, query, onlyNear, limit, offset }, meId) };
  }, [cloudCapable, rpc, meId]);

  const uploadBadge = useCallback(async (file) => {
    if (!file) return { error: "unknown" };
    if (!/^image\//.test(file.type)) return { error: "badge_not_image" };
    if (file.size > 2 * 1024 * 1024) return { error: "badge_too_big" };
    if (!uploadMedia) return { error: "unknown" };
    const r = await uploadMedia(file);
    return r?.url ? { data: r.url } : { error: rivalsErrorCode(r?.error) };
  }, [uploadMedia]);

  // ── Invites ────────────────────────────────────────────
  /** The team's live invite link (created on first ask); rotate → new one. */
  const getInvite = useCallback(async (teamId, { rotate = false, maxUses = null } = {}) => (cloudCapable
    ? rpc("create_team_invite", { p_team_id: teamId, p_rotate: rotate, p_ttl_days: 14, p_max_uses: maxUses }, normInvite, { reload: false })
    : demoCall("create_team_invite", { teamId, rotate, maxUses }, normInvite)), [cloudCapable, rpc, demoCall]);

  const revokeInvite = useCallback(async (teamId) => (cloudCapable
    ? rpc("revoke_team_invite", { p_team_id: teamId }, (d) => ({ revoked: d?.revoked ?? 0 }), { reload: false })
    : demoCall("revoke_team_invite", { teamId })), [cloudCapable, rpc, demoCall]);

  /** What a ?tjoin= link points at — works logged out. */
  const previewInvite = useCallback(async (token) => {
    if (cloudCapable) {
      return rpc("team_invite_preview", { p_token: token }, (d) => ({
        status: d?.status || "not_found", expiresAt: d?.expires_at ?? null,
        team: d?.team ? { ...normTeam(d.team), memberCount: Number(d.team.member_count || 0) } : null,
        invitedBy: d?.invited_by ?? null, alreadyMember: Boolean(d?.already_member),
      }), { reload: false });
    }
    return { data: demoInvitePreview(demoRef.current, token, meId) };
  }, [cloudCapable, rpc, meId]);

  const acceptInvite = useCallback(async (token) => (cloudCapable
    ? rpc("accept_team_invite", { p_token: token }, (d) => ({ teamId: d.team_id, slug: d.slug, name: d.name, alreadyMember: Boolean(d.already_member) }))
    : demoCall("accept_team_invite", { token })), [cloudCapable, rpc, demoCall]);

  // ── Roster ─────────────────────────────────────────────
  const setMemberRole = useCallback(async (teamId, playerId, role) => (cloudCapable
    ? rpc("set_member_role", { p_team_id: teamId, p_player_id: playerId, p_role: role }, (d) => ({ role: d.role, demoted: d.demoted }))
    : demoCall("set_member_role", { teamId, playerId, role })), [cloudCapable, rpc, demoCall]);

  const transferCaptaincy = useCallback(async (teamId, playerId) => (cloudCapable
    ? rpc("transfer_captaincy", { p_team_id: teamId, p_player_id: playerId }, (d) => ({ captainId: d.captain_id, previousCaptainRole: d.previous_captain_role }))
    : demoCall("transfer_captaincy", { teamId, playerId })), [cloudCapable, rpc, demoCall]);

  const removeMember = useCallback(async (teamId, playerId) => (cloudCapable
    ? rpc("remove_team_member", { p_team_id: teamId, p_player_id: playerId }, () => ({ playerId }))
    : demoCall("remove_team_member", { teamId, playerId })), [cloudCapable, rpc, demoCall]);

  const leaveTeam = useCallback(async (teamId) => (cloudCapable
    ? rpc("leave_team", { p_team_id: teamId }, (d) => ({ archived: Boolean(d?.archived) }))
    : demoCall("leave_team", { teamId })), [cloudCapable, rpc, demoCall]);

  // ── Challenges ─────────────────────────────────────────
  const challenges = useMemo(() => {
    const now = Date.now();
    if (cloudCapable) return cloudChallenges.map((r) => normChallenge(r, now));
    return meId ? demoMyChallenges(demoState, meId, now) : [];
  }, [cloudCapable, cloudChallenges, demoState, meId]);
  const pendingActions = useMemo(() => pendingActionCount(challenges), [challenges]);
  const myTeamIdsRef = useRef([]);
  myTeamIdsRef.current = myTeams.map((tm) => tm.id);

  // Demo: the rival captain answers a moment after it becomes their turn.
  const rivalTimers = useRef([]);
  useEffect(() => () => rivalTimers.current.forEach(clearTimeout), []);
  const scheduleRival = useCallback((challengeId) => {
    const step = () => {
      const mv = demoRivalMove(demoRef.current, challengeId, myTeamIdsRef.current);
      if (!mv) return;
      demoRef.current = mv.state;
      setDemo(mv.state);
      setRevision((n) => n + 1);
      // Chain (accept → confirm the pitch …) until the rival has nothing left to do.
      rivalTimers.current.push(setTimeout(step, RIVAL_DELAY_MS));
    };
    rivalTimers.current.push(setTimeout(step, RIVAL_DELAY_MS));
  }, [setDemo]);

  const demoChallengeCall = useCallback((op, args, map = (x) => x, challengeIdOf = null) => {
    if (!demoMe?.id) return { error: "not_authenticated" };
    const r = demoChallengeOp(demoRef.current, op, args, demoMe);
    if (r.error) return { error: r.error };
    demoRef.current = r.state;
    setDemo(r.state);
    setRevision((n) => n + 1);
    const cid = challengeIdOf ? challengeIdOf(r.data) : null;
    if (cid) scheduleRival(cid);
    return { data: map(r.data) };
  }, [demoMe, setDemo, scheduleRival]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const withUrl = (d) => (d?.token ? { ...d, url: challengeInviteUrl(d.token, origin) } : d);

  /** New challenge: toTeamId null → claimable link. terms = camelCase. */
  const createChallenge = useCallback(async ({ fromTeamId, toTeamId = null, terms, clientRef }) => (cloudCapable
    ? rpc("create_challenge", { p_from_team: fromTeamId, p_to_team: toTeamId, p_terms: termsToRpc(terms), p_client_ref: clientRef || null },
      (d) => withUrl({ challengeId: d.challenge_id, token: d.token, status: d.status, mode: d.mode, created: d.created, expiresAt: d.expires_at }))
    : demoChallengeCall("create_challenge", { fromTeamId, toTeamId, terms, clientRef }, withUrl, (d) => d.challengeId)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [cloudCapable, rpc, demoChallengeCall]);

  /** accept | decline the current version (asTeamId + token claim a link). */
  const respondChallenge = useCallback(async (challengeId, version, action, { asTeamId = null, token = null, reason = null } = {}) => (cloudCapable
    ? rpc("respond_challenge", { p_challenge_id: challengeId, p_version: version, p_action: action, p_as_team: asTeamId, p_token: token, p_reason: reason },
      (d) => ({ challengeId: d.challenge_id, status: d.status, matchId: d.match_id, alreadyAgreed: Boolean(d.already_agreed) }))
    : demoChallengeCall("respond_challenge", { challengeId, version, action, asTeamId, token, reason }, (x) => x, (d) => (d.status === "agreed" ? d.challengeId : null))),
  [cloudCapable, rpc, demoChallengeCall]);

  const counterChallenge = useCallback(async (challengeId, baseVersion, terms, { asTeamId = null, token = null } = {}) => (cloudCapable
    ? rpc("counter_challenge", { p_challenge_id: challengeId, p_base_version: baseVersion, p_terms: termsToRpc(terms), p_as_team: asTeamId, p_token: token },
      (d) => ({ challengeId: d.challenge_id, version: d.version, status: d.status, turnTeamId: d.turn_team_id }))
    : demoChallengeCall("counter_challenge", { challengeId, baseVersion, terms, asTeamId, token }, (x) => x, (d) => d.challengeId)),
  [cloudCapable, rpc, demoChallengeCall]);

  const cancelChallenge = useCallback(async (challengeId, reason = null) => (cloudCapable
    ? rpc("cancel_challenge", { p_challenge_id: challengeId, p_reason: reason },
      (d) => ({ challengeId: d.challenge_id, status: d.status, matchStatus: d.match_status }))
    : demoChallengeCall("cancel_challenge", { challengeId, reason })), [cloudCapable, rpc, demoChallengeCall]);

  const proposeMatchChange = useCallback(async (matchId, baseVersion, terms, { asTeamId = null } = {}) => (cloudCapable
    ? rpc("propose_match_change", { p_match_id: matchId, p_base_version: baseVersion, p_terms: termsToRpc(terms), p_as_team: asTeamId },
      (d) => ({ matchId: d.match_id, challengeId: d.challenge_id, version: d.version }))
    : demoChallengeCall("propose_match_change", { matchId, baseVersion, terms, asTeamId }, (x) => x, (d) => d.challengeId)),
  [cloudCapable, rpc, demoChallengeCall]);

  const respondMatchChange = useCallback(async (matchId, version, action, { asTeamId = null } = {}) => (cloudCapable
    ? rpc("respond_match_change", { p_match_id: matchId, p_version: version, p_action: action, p_as_team: asTeamId },
      (d) => ({ matchId: d.match_id, accepted: Boolean(d.accepted), fieldStatus: d.field_status }))
    : demoChallengeCall("respond_match_change", { matchId, version, action, asTeamId })), [cloudCapable, rpc, demoChallengeCall]);

  const setFieldStatus = useCallback(async (matchId, status, note = null) => (cloudCapable
    ? rpc("set_field_status", { p_match_id: matchId, p_status: status, p_note: note }, (d) => ({ matchId: d.match_id, fieldStatus: d.field_status }))
    : demoChallengeCall("set_field_status", { matchId, status, note })), [cloudCapable, rpc, demoChallengeCall]);

  /** What a ?desafio= link is — works logged out (get_challenge_invite). */
  const previewChallenge = useCallback(async (token) => {
    if (cloudCapable) return rpc("get_challenge_invite", { p_token: token }, normChallengeInvite, { reload: false });
    return { data: demoChallengeInvite(demoRef.current, token, meId) };
  }, [cloudCapable, rpc, meId]);

  const resetDemo = useCallback(() => setDemo(null), [setDemo]);

  return {
    mode: cloudCapable ? "cloud" : "demo",
    loading: cloudCapable ? loading : false,
    revision,
    myPlayerId: meId,
    myTeams,
    createTeam, updateTeam, archiveTeam, fetchTeam, fetchPublicTeam, listTeams, uploadBadge,
    getInvite, revokeInvite, previewInvite, acceptInvite,
    setMemberRole, transferCaptaincy, removeMember, leaveTeam,
    challenges, pendingActions,
    createChallenge, respondChallenge, counterChallenge, cancelChallenge,
    proposeMatchChange, respondMatchChange, setFieldStatus, previewChallenge,
    refresh: load, resetDemo,
  };
}
