import { supabase } from "./supabase";
import { leagueErrorCode } from "./leagueCloud";

/** One RPC → { data } or { error: <code> } (the same contract as the workspace hook). */
export const rpc = async (name, args) => {
  try {
    const r = await supabase.rpc(name, args);
    return r.error ? { error: leagueErrorCode(r.error) } : { data: r.data };
  } catch (e) {
    return { error: leagueErrorCode(e) };
  }
};

/** Everything the roles need from the server. The owner's calls (invites, members) and the
 *  member's calls (preview/accept, my leagues, the league as I see it, the captain's squad). */
export const rolesApi = Object.freeze({
  // owner
  invites: () => rpc("league_invites_list", {}),
  members: () => rpc("league_members_list", {}),
  createInvite: (role, teamId, playerId = null, maxUses = null) =>
    rpc("league_invite_create", { p_role: role, p_team_id: teamId, p_player_id: playerId, p_max_uses: maxUses }),
  revokeInvite: (id) => rpc("league_invite_revoke", { p_invite: id }),
  removeMember: (id) => rpc("league_member_remove", { p_member: id }),
  // anyone with the link / a member
  preview: (token) => rpc("league_invite_preview", { p_token: token }),
  accept: (token) => rpc("league_invite_accept", { p_token: token }),
  myLeagues: () => rpc("league_my_memberships", {}),
  memberState: (workspaceId) => rpc("league_member_state", { p_workspace: workspaceId }),
  claim: (workspaceId, playerId) => rpc("league_athlete_claim", { p_workspace: workspaceId, p_player_id: playerId }),
  version: () => rpc("league_workspace_version", {}),
  saveSquad: (workspaceId, teamId, players) =>
    rpc("league_captain_save_squad", { p_workspace: workspaceId, p_team_id: teamId, p_players: players }),
});
