// PITCH Ligas — a captain asks for a new athlete, the Gestor decides.
//
// In a league the roster is registered by the organisation, so a captain's "Acrescentar atleta" never
// inserts anything: the server (league_captain_save_squad) stores a request in state.data.playerRequests
// and these pure functions are how the Gestor's app approves or refuses it.
//   request = { id, teamId, name, number|null, position|null, status: "pending"|"approved"|"refused",
//               requestedAt, decidedAt?, playerId?, reason? }
import { SetupError, addPlayer } from "./leagueSetup.js";
import { reenrollAthletes } from "./leagueSeason.js";

const KEEP_DECIDED = 60; // the archive of decided requests is bounded: the state document has a size limit

const list = (state) => (Array.isArray(state?.data?.playerRequests) ? state.data.playerRequests : []);
const withRequests = (state, playerRequests) => ({ ...state, data: { ...state.data, playerRequests } });

/** Requests waiting for the Gestor (all teams, or one), oldest first. */
export const pendingPlayerRequests = (state, teamId = null) =>
  list(state).filter((r) => r.status === "pending" && (!teamId || r.teamId === teamId)).sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)));

/** A captain's own requests, newest first (pending and decided). */
export const teamPlayerRequests = (state, teamId) =>
  list(state).filter((r) => r.teamId === teamId).sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));

const decide = (state, id, patch) => {
  const rq = list(state).find((r) => r.id === id && r.status === "pending");
  if (!rq) throw new SetupError("request_not_found", id);
  const decidedAt = patch.at || new Date().toISOString();
  const next = list(state).map((r) => (r.id === id ? { ...r, ...patch.fields, decidedAt } : r));
  // keep every pending one and only the most recent decided ones
  const decided = next.filter((r) => r.status !== "pending").sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt))).slice(0, KEEP_DECIDED);
  const keep = new Set(decided.map((r) => r.id));
  return { rq, next: next.filter((r) => r.status === "pending" || keep.has(r.id)) };
};

/** Approve: the athlete joins the team's squad and the request is closed. A number already taken is an error
 *  the Gestor can read (nothing changes); they can refuse, or fix the number in Inscrições and approve again. */
export function approvePlayerRequest(state, id, { at = null } = {}) {
  const rq = list(state).find((r) => r.id === id && r.status === "pending");
  if (!rq) throw new SetupError("request_not_found", id);
  if (rq.reuseId) {
    // a former athlete asked back by the captain: the profile (same id) returns from the pool; if the Gestor already
    // re-registered them, the request is simply closed
    const there = state.data.players.some((p) => p.id === rq.reuseId);
    const joined = there ? state : reenrollAthletes(state, [{ id: rq.reuseId, teamId: rq.teamId }]);
    const { next } = decide(joined, id, { at, fields: { status: "approved", playerId: rq.reuseId } });
    return withRequests(joined, next);
  }
  const before = state.data.players.length;
  const joined = addPlayer(state, rq.teamId, { name: rq.name, number: rq.number, position: rq.position || "" });
  const player = joined.data.players[before];
  const { next } = decide(joined, id, { at, fields: { status: "approved", playerId: player.id } });
  return withRequests(joined, next);
}

/** Refuse, with an optional reason the captain will see. */
export function refusePlayerRequest(state, id, { reason = "", at = null } = {}) {
  const { next } = decide(state, id, { at, fields: { status: "refused", reason: String(reason || "").trim().slice(0, 200) || undefined } });
  return withRequests(state, next);
}
