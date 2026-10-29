// PITCH Ligas — entering the result of a match that has been played.
//
// One pure function used by the quick "Lançar resultado" form, by the Adjunto
// (a sentence in the app or on WhatsApp, or a photo of the súmula) and by
// nothing else: it writes the same events the live súmula writes, then ends
// the match as PROVISIONAL. It never homologates — that stays a decision of
// the Gestor (the result enters the official table only after it).
import { appendEvent, transition, matchScore } from "./core/league.js";
import { SetupError } from "./leagueSetup.js";

const CARD = { yellow: ["card_yellow"], red: ["card_red"], second_yellow: ["card_yellow", "card_red"] };
const int = (v) => Number.isInteger(v) && v >= 0 && v <= 99;

/**
 * @param state league state
 * @param {object} r
 * @param {string} r.matchId
 * @param {{home:number, away:number}} r.score final score, in the match's home/away order
 * @param {{teamId:string, playerId?:string|null, own?:boolean, minute?:number|null}[]} [r.goals]
 *        teamId = the side the goal counts for; an own goal names the player who scored it against himself
 *        (playerId) and the benefiting team in teamId. Goals not listed here are recorded without a scorer.
 * @param {{teamId:string, playerId:string, type:"yellow"|"red"|"second_yellow"}[]} [r.cards]
 * @param {Object<string,string[]>} [r.lineups] teamId → player ids that took part
 * @param {string} [r.by] who gets the credit in the log (e.g. "Adjunto · confirmado pelo Gestor")
 * @param {string} [r.at] ISO instant
 */
export function recordResult(state, { matchId, score, goals = [], cards = [], lineups = null, by = "Gestor", at = null }) {
  const m = state.matches.find((x) => x.id === matchId);
  if (!m) throw new SetupError("not_found", matchId);
  if (!["scheduled", "live"].includes(m.state)) throw new SetupError("result_exists");
  if (!score || !int(score.home) || !int(score.away)) throw new SetupError("score_required");
  const when = at || new Date().toISOString();
  const log0 = state.logs[matchId] || [];
  if (log0.length) throw new SetupError("result_exists");

  const sides = new Set([m.homeId, m.awayId]);
  const playerTeam = Object.fromEntries(state.data.players.map((p) => [p.id, p.teamId]));
  const scored = { [m.homeId]: 0, [m.awayId]: 0 };
  let log = [];
  let n = 0;
  const add = (e) => { log = appendEvent(log, { id: `${matchId}-r${++n}`, matchId, recordedBy: by, recordedAt: when, ...e }); };

  for (const g of goals) {
    if (!sides.has(g.teamId)) throw new SetupError("not_in_match", g.teamId);
    if (g.playerId && !g.own && playerTeam[g.playerId] !== g.teamId) throw new SetupError("not_in_match", g.playerId);
    if (g.playerId && g.own && !sides.has(playerTeam[g.playerId])) throw new SetupError("not_in_match", g.playerId);
    scored[g.teamId] += 1;
    add({ type: g.own ? "own_goal" : "goal", teamId: g.teamId, playerId: g.playerId || null, minute: g.minute ?? null });
  }
  if (scored[m.homeId] > score.home || scored[m.awayId] > score.away) throw new SetupError("scorers_exceed_score");
  // The rest of the score is real but has no scorer yet: kept, and visible, as goals without an author.
  for (const [teamId, total] of [[m.homeId, score.home], [m.awayId, score.away]]) {
    for (let i = scored[teamId]; i < total; i += 1) add({ type: "goal", teamId, playerId: null });
  }
  for (const c of cards) {
    if (!CARD[c.type]) throw new SetupError("invalid", c.type);
    const teamId = playerTeam[c.playerId];
    if (!sides.has(teamId)) throw new SetupError("not_in_match", c.playerId);
    for (const type of CARD[c.type]) add({ type, teamId, playerId: c.playerId });
  }

  let next = { ...m };
  if (next.state === "scheduled") next = transition(next, "live", { role: "manager", by, at: when });
  next = transition(next, "ended_provisional", { role: "manager", by, at: when });
  if (lineups) {
    const kept = {};
    for (const teamId of sides) if (Array.isArray(lineups[teamId])) kept[teamId] = [...new Set(lineups[teamId].filter((id) => playerTeam[id] === teamId))];
    next = { ...next, lineups: { ...(next.lineups || {}), ...kept } };
  }
  const out = {
    ...state,
    matches: state.matches.map((x) => (x.id === matchId ? next : x)),
    logs: { ...state.logs, [matchId]: log },
  };
  // The events must add up to what was asked for; if they don't, nothing is saved.
  const check = matchScore(log, next);
  if (check.home !== score.home || check.away !== score.away) throw new SetupError("invalid", "score_mismatch");
  return out;
}
