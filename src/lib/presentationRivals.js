// Presentation mode (/demo) — PITCH Rivals seed. Starts from the normal demo
// seed (5 invented teams) and adds "FC Amigos", the team of the demo player
// (Carlos "Carlão", demo-me-1): a squad with photos, a played history built
// by running the REAL demo ops (challenge → agree → result → confirm) at
// past timestamps, one agreed upcoming match and one incoming challenge.
// Running the ops (instead of hand-writing rows) keeps every invariant the
// UI relies on: official results, records, H2H, scouting, per-player stats.
import { demoSeed } from "./rivals.js";
import { demoChallengeOp, demoRivalMove, demoSlot, withChallengeSeed } from "./rivalsChallenges.js";
import { demoResultOp, demoRivalResultMove } from "./rivalsResults.js";
import { INITIAL_GROUP } from "../data.js";
import { demoPortrait } from "./demoAvatars.js";

const DAY = 864e5;
const HOUR = 36e5;
const MY_TEAM = "demo-fa";
export const ME = { id: "demo-me-1", nick: "Carlão" };

// player id → (played, goals, assists) spread across the history
const SQUAD_IDS = [1, 2, 6, 5, 3, 7, 4, 8, 12, 11];

function addMyTeam(state, now) {
  const team = {
    id: MY_TEAM, name: "FC Amigos", slug: "fc-amigos", city: "Matosinhos", region: "Porto", country: "PT",
    color: "#C8FF00", secondaryColor: "#0A0F18", logoUrl: null, format: "5v5",
    homeVenue: "PITCH Club — Campo 1", timezone: "Europe/Lisbon", currency: "EUR", listed: true,
    captainId: ME.id, createdAt: new Date(now - 60 * DAY).toISOString(), updatedAt: new Date(now - 60 * DAY).toISOString(), archived: false,
  };
  const members = SQUAD_IDS.map((id, i) => {
    const p = INITIAL_GROUP.find((x) => x.id === id);
    return {
      teamId: MY_TEAM, playerId: id === 1 ? ME.id : `demo-fa-${id}`, nick: p.nick, name: p.name, photoUrl: p.photo ?? null,
      position: p.position, role: i === 0 ? "captain" : i === 1 ? "vice" : "player", status: "active",
      joinedAt: new Date(now - (58 - i) * DAY).toISOString(), leftAt: null,
    };
  });
  return { ...state, teams: [...state.teams, team], members: [...state.members, ...members] };
}

/** Portraits for the rival squads too (their members have no photo in demoSeed). */
function withPortraits(state) {
  return { ...state, members: state.members.map((m) => (m.photoUrl ? m : { ...m, photoUrl: demoPortrait({ seed: `${m.teamId}${m.nick}` }) })) };
}

// kickoff 20:00 local, `daysAgo` days back
const PAST = [
  { opp: "demo-t-mu", daysAgo: 5,  mine: 4, theirs: 2 },
  { opp: "demo-t-pc", daysAgo: 12, mine: 5, theirs: 3 },
  { opp: "demo-t-lm", daysAgo: 19, mine: 2, theirs: 3 },
  { opp: "demo-t-mu", daysAgo: 26, mine: 3, theirs: 3 },
  { opp: "demo-t-lx", daysAgo: 33, mine: 6, theirs: 1 },
  { opp: "demo-t-pc", daysAgo: 41, mine: 4, theirs: 1 },
];

function playPast(state, spec, now) {
  const kickoff = demoSlot(now, -spec.daysAgo, 20);
  const kickMs = Date.parse(kickoff);
  let t = kickMs - 3 * DAY;
  const squad = state.members.filter((m) => m.teamId === MY_TEAM).map((m) => m.playerId);
  const created = demoChallengeOp(state, "create_challenge", {
    fromTeamId: MY_TEAM, toTeamId: spec.opp,
    terms: { kickoffAt: kickoff, venueName: "PITCH Club — Campo 1", format: "5v5", durationMin: 60, costCents: 6000, costSplit: "split", fieldResponsible: "challenger" },
  }, ME, t);
  if (created.error) return state;
  let s = created.state;
  const id = created.data.challengeId;
  for (let i = 0; i < 4; i += 1) {
    t += HOUR;
    const mv = demoRivalMove(s, id, [MY_TEAM], t);
    if (mv) { s = mv.state; continue; }
    const ch = s.challenges.find((c) => c.id === id);
    if (ch?.status === "pending" && ch.turnTeamId === MY_TEAM) {
      const r = demoChallengeOp(s, "respond_challenge", { challengeId: id, version: ch.currentVersion, action: "accept" }, ME, t);
      if (r.error) return state;
      s = r.state;
      continue;
    }
    break;
  }
  const ch = s.challenges.find((c) => c.id === id);
  const m = (s.matches || []).find((x) => x.challengeId === id);
  if (!ch || ch.status !== "agreed" || !m) return state;
  const played = Date.parse(m.kickoffAt) + 2 * HOUR;
  const home = m.homeTeamId === MY_TEAM;
  // my side's squad sheet: who played + a goals/assists spread matching the score
  const lineup = demoResultOp(s, "set_match_lineup", { matchId: m.id, playerIds: squad.slice(0, 8) }, ME, played);
  if (!lineup.error) s = lineup.state;
  const scorers = squad.filter((pid) => !["demo-fa-4"].includes(pid));
  const tally = new Map();
  for (let g = 0; g < spec.mine; g += 1) {
    const sc = scorers[(g * 3 + spec.daysAgo) % scorers.length];
    const as = scorers[(g * 3 + spec.daysAgo + 2) % scorers.length];
    tally.set(sc, { ...(tally.get(sc) || { goals: 0, assists: 0 }), goals: (tally.get(sc)?.goals || 0) + 1 });
    if (as !== sc && g % 2 === 0) tally.set(as, { ...(tally.get(as) || { goals: 0, assists: 0 }), assists: (tally.get(as)?.assists || 0) + 1 });
  }
  const stats = demoResultOp(s, "set_match_player_stats", { matchId: m.id, stats: [...tally].map(([playerId, v]) => ({ playerId, ...v })) }, ME, played);
  if (!stats.error) s = stats.state;
  const rep = demoResultOp(s, "report_match_result", {
    matchId: m.id, homeScore: home ? spec.mine : spec.theirs, awayScore: home ? spec.theirs : spec.mine, note: null,
  }, ME, played);
  if (rep.error) return state;
  s = rep.state;
  const conf = demoRivalResultMove(s, m.id, [MY_TEAM], played + HOUR);
  return conf ? conf.state : s;
}

function upcoming(state, now) {
  const rivalTeam = "demo-t-pc";
  const kickoff = demoSlot(now, 3, 21);
  const created = demoChallengeOp(state, "create_challenge", {
    fromTeamId: MY_TEAM, toTeamId: rivalTeam,
    terms: { kickoffAt: kickoff, venueName: "PITCH Club — Campo 1", format: "5v5", durationMin: 60, costCents: 6000, costSplit: "split", fieldResponsible: "challenger", note: "Revanche! Trazemos coletes." },
  }, ME, now - 2 * HOUR);
  if (created.error) return state;
  let s = created.state;
  const id = created.data.challengeId;
  let t = now - HOUR;
  for (let i = 0; i < 4; i += 1) {
    const mv = demoRivalMove(s, id, [MY_TEAM], t);
    if (mv) { s = mv.state; t += 10 * 60e3; continue; }
    const ch = s.challenges.find((c) => c.id === id);
    if (ch?.status === "pending" && ch.turnTeamId === MY_TEAM) {
      const r = demoChallengeOp(s, "respond_challenge", { challengeId: id, version: ch.currentVersion, action: "accept" }, ME, t);
      if (r.error) break;
      s = r.state; t += 10 * 60e3; continue;
    }
    break;
  }
  return s;
}

function incoming(state, now) {
  const r = demoChallengeOp(state, "create_challenge", {
    fromTeamId: "demo-t-lm", toTeamId: MY_TEAM,
    terms: { kickoffAt: demoSlot(now, 6, 21), venueName: "Maia Soccer", format: "5v5", durationMin: 60, costCents: 7000, costSplit: "split", fieldResponsible: "challenger", note: "Bora fechar a série? Nós jogamos em casa." },
  }, { id: "demo-t-lm-p0", nick: "Gonçalo" }, now - 3 * HOUR);
  return r.error ? state : r.state;
}

export function presentationRivalsSeed(now = Date.now()) {
  let s = withPortraits(addMyTeam(demoSeed(now), now));
  s = { ...s, challenges: [], matches: [] };
  for (const spec of PAST) s = playPast(s, spec, now);
  s = upcoming(s, now);
  s = incoming(s, now);
  return withChallengeSeed(s, now);
}
