// PITCH Ligas — closing a season: who won, a record that never changes, and the next season.
//
// Pure functions over the league state. The engine already derives every number (tables, scorers, ties); closing a
// season FREEZES them into state.data.seasons[] — an append-only archive — so the live document can start over
// without losing the history. Nothing here decides a champion on its own authority: the table's first place and the
// cup's final winner are proposals; the Gestor can name someone else with a note (a club thrown out by the
// disciplinary board, as happens in real leagues) and that is recorded as `decidedBy: "manual"`.
//
//   season = { id, label, closedAt, closedBy, competitions: [competition], teams: [...], players: [...], notes: [...] }
//   competition = { id, name, short, kind: "league"|"cup", legs, sponsor, champion: { teamId, name, decidedBy, note? } | null,
//                   table?: [{ pos, teamId, j, w, d, l, gf, ga, gd, pts }], bracket?: [{ round, name, ties: [...] }],
//                   scorers: [{ playerId, name, teamId, goals, assists, games }], discipline: [{ teamId, yellows, reds }],
//                   matches: [{ id, round, roundName, kickoff, homeId, awayId, home, away, shootout, scorers: [[playerId, goals]] }] }
import { activeEvents, countedMatches, matchScore, playerStats, standings } from "./core/league.js";
import { SetupError } from "./leagueSetup.js";

const OFFICIAL = new Set(["homologated", "walkover"]);
const DONE = new Set(["homologated", "walkover", "cancelled"]);
const MAX_SCORERS = 20;
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const slug = (s) => clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "x";

/** The matches that belong to a competition (matches without a competitionId belong to the first league). */
export function competitionMatches(state, competition) {
  const first = (state.data.competitions || []).find((c) => c.kind !== "cup") || (state.data.competitions || [])[0];
  return (state.matches || []).filter((m) => (m.competitionId || first?.id) === competition.id);
}

/** Who goes through a tie: the better score, then the shoot-out, then a walkover's winner. null = undecided. */
export function tieWinner(match, score) {
  if (!match || !OFFICIAL.has(match.state)) return null;
  if (match.state === "walkover") return match.walkover?.winnerId || null;
  if (!score) return null;
  if (score.home !== score.away) return score.home > score.away ? match.homeId : match.awayId;
  const sh = score.shootout;
  if (sh && sh.home !== sh.away) return sh.home > sh.away ? match.homeId : match.awayId;
  return null;
}

/** A cup as a bracket: phase by phase, every tie with its winner; the champion is the winner of the last phase
 *  once that phase is a single official tie. */
export function cupBracket(state, competition) {
  const ms = competitionMatches(state, competition);
  const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
  const phases = rounds.map((round) => {
    const inRound = ms.filter((m) => m.round === round).sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
    return {
      round, name: inRound.find((m) => m.roundName)?.roundName || null,
      ties: inRound.map((m) => {
        const sc = matchScore(state.logs?.[m.id] || [], m);
        return { matchId: m.id, homeId: m.homeId, awayId: m.awayId, home: sc.home, away: sc.away, shootout: sc.shootout, state: m.state, winnerId: tieWinner(m, sc) };
      }),
    };
  });
  const last = phases[phases.length - 1];
  const final = last && last.ties.length === 1 ? last.ties[0] : null;
  return { phases, champion: final?.winnerId ? { teamId: final.winnerId, matchId: final.matchId } : null };
}

/** What is still in the way of closing: any game without an official result, a cup without a winner. */
export function seasonChecklist(state) {
  const comps = (state.data.competitions || []).filter((c) => !c.closedSeasonId);
  const blockers = [];
  let games = 0;
  for (const c of comps) {
    const ms = competitionMatches(state, c);
    games += ms.length;
    const open = ms.filter((m) => !DONE.has(m.state));
    if (open.length) {
      const contested = open.filter((m) => m.state === "in_review").length;
      blockers.push({ kind: "open", competitionId: c.id, count: open.length, contested, matchIds: open.map((m) => m.id) });
    }
    if (c.kind === "cup" && ms.length && !open.length && !cupBracket(state, c).champion) blockers.push({ kind: "no_winner", competitionId: c.id, count: 1 });
  }
  return { competitions: comps.length, games, blockers, canClose: comps.length > 0 && games > 0 && blockers.length === 0 };
}

/** The champion the engine proposes for each open competition (what the Gestor will confirm or override). */
export function proposedChampions(state) {
  const out = {};
  for (const c of (state.data.competitions || []).filter((x) => !x.closedSeasonId)) {
    if (c.kind === "cup") { const ch = cupBracket(state, c).champion; out[c.id] = ch ? { teamId: ch.teamId, decidedBy: "final" } : null; continue; }
    const table = leagueTable(state, c);
    out[c.id] = table[0] && table[0].j > 0 ? { teamId: table[0].id, decidedBy: "table" } : null;
  }
  return out;
}

function leagueTable(state, c) {
  const ids = c.teamIds?.length ? c.teamIds : (state.data.teams || []).map((t) => t.id);
  const byId = Object.fromEntries((state.data.teams || []).map((t) => [t.id, t]));
  const comp = { ...c, teams: ids.map((id) => byId[id]).filter(Boolean) };
  return standings(comp, competitionMatches(state, c), state.logs || {});
}

/** The league the people in it will remember: nothing more than needed to show it again. */
function archiveCompetition(state, c, override) {
  const teams = Object.fromEntries((state.data.teams || []).map((t) => [t.id, t]));
  const players = Object.fromEntries((state.data.players || []).map((p) => [p.id, p]));
  const ms = competitionMatches(state, c);
  const counted = countedMatches(ms);
  const stats = playerStats(counted, state.logs || {});
  const scorers = Object.values(stats).filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists || String(players[a.playerId]?.name).localeCompare(String(players[b.playerId]?.name)))
    .slice(0, MAX_SCORERS)
    .map((s) => ({ playerId: s.playerId, name: players[s.playerId]?.name || "—", teamId: players[s.playerId]?.teamId || null, goals: s.goals, assists: s.assists, games: s.games }));
  const cards = {};
  for (const s of Object.values(stats)) {
    const tid = players[s.playerId]?.teamId; if (!tid) continue;
    const row = (cards[tid] ||= { teamId: tid, yellows: 0, reds: 0 });
    row.yellows += s.yellows; row.reds += s.reds;
  }
  const matches = counted.map((m) => {
    const log = state.logs?.[m.id] || [];
    const sc = matchScore(log, m);
    const by = {};
    for (const e of activeEvents(log)) if (e.type === "goal" && e.playerId) by[e.playerId] = (by[e.playerId] || 0) + 1;
    return { id: m.id, round: m.round, roundName: m.roundName || null, kickoff: m.kickoff || null, homeId: m.homeId, awayId: m.awayId, home: sc.home, away: sc.away, shootout: sc.shootout, scorers: Object.entries(by) };
  });

  let champion = null;
  const named = (teamId, decidedBy, note) => ({ teamId, name: teams[teamId]?.name || "—", decidedBy, ...(note ? { note: clean(note).slice(0, 300) } : {}) });
  const entry = { id: c.id, name: c.name, short: c.short || c.name, kind: c.kind || "league", legs: c.legs || null, sponsor: c.sponsor || "", category: c.category || "" };
  if (c.kind === "cup") {
    const b = cupBracket(state, c);
    entry.bracket = b.phases.map((p) => ({ round: p.round, name: p.name, ties: p.ties.map((t) => ({ matchId: t.matchId, homeId: t.homeId, awayId: t.awayId, home: t.home, away: t.away, shootout: t.shootout, winnerId: t.winnerId })) }));
    if (b.champion) champion = named(b.champion.teamId, "final");
  } else {
    const table = leagueTable(state, c);
    entry.table = table.map((r, i) => ({ pos: i + 1, teamId: r.id, j: r.j, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts }));
    if (table[0] && table[0].j > 0) champion = named(table[0].id, "table");
  }
  if (override?.teamId) {
    if (!teams[override.teamId]) throw new SetupError("not_found", override.teamId);
    // a decision by hand always carries its reason: it is what the public page will say
    if (!clean(override.note)) throw new SetupError("note_required");
    champion = named(override.teamId, "manual", override.note);
  }
  return { ...entry, champion, scorers, discipline: Object.values(cards), matches };
}

/** Freeze every open competition into a new entry of data.seasons. `overrides` = { [competitionId]: { teamId, note } }. */
export function closeSeason(state, { label, at = null, by = "Gestor", overrides = {} } = {}) {
  const lb = clean(label);
  if (lb.length < 2) throw new SetupError("name_required");
  const check = seasonChecklist(state);
  if (!check.canClose) throw new SetupError("season_not_ready");
  const seasons = state.data.seasons || [];
  if (seasons.some((s) => s.label.toLowerCase() === lb.toLowerCase())) throw new SetupError("season_exists");
  const open = (state.data.competitions || []).filter((c) => !c.closedSeasonId);
  const id = `ep-${slug(lb)}`;
  const comps = open.map((c) => archiveCompetition(state, c, overrides[c.id]));
  const teamIds = new Set(comps.flatMap((c) => [...(c.table || []).map((r) => r.teamId), ...(c.bracket || []).flatMap((p) => p.ties.flatMap((t) => [t.homeId, t.awayId])), ...c.matches.flatMap((m) => [m.homeId, m.awayId])]));
  const teams = (state.data.teams || []).filter((t) => teamIds.has(t.id)).map((t) => ({ id: t.id, name: t.name, short: t.short, color: t.color, venue: t.venue || "" }));
  const ids = new Set([...comps.flatMap((c) => c.scorers.map((s) => s.playerId)), ...comps.flatMap((c) => c.matches.flatMap((m) => m.scorers.map(([p]) => p)))]);
  const players = (state.data.players || []).filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, name: p.name, number: p.number ?? null, position: p.position || null, teamId: p.teamId }));
  const season = { id, label: lb, closedAt: at || new Date().toISOString(), closedBy: by, competitions: comps, teams, players, notes: [] };
  const closed = new Set(open.map((c) => c.id));
  return {
    ...state,
    data: {
      ...state.data,
      seasons: [...seasons, season],
      competitions: state.data.competitions.map((c) => (closed.has(c.id) ? { ...c, closedSeasonId: id } : c)),
    },
  };
}

/** A note on a closed season ("correction by the direction: …"). The tables themselves are never edited. */
export function annotateSeason(state, seasonId, text, { at = null, by = "Gestor" } = {}) {
  const note = clean(text).slice(0, 400);
  if (!note) throw new SetupError("note_required");
  if (!(state.data.seasons || []).some((s) => s.id === seasonId)) throw new SetupError("not_found", seasonId);
  return { ...state, data: { ...state.data, seasons: state.data.seasons.map((s) => (s.id === seasonId ? { ...s, notes: [...(s.notes || []), { at: at || new Date().toISOString(), by, text: note }] } : s)) } };
}

/** "2026/27" → "2027/28"; "2026" → "2027"; anything else → "". */
export function nextSeasonLabel(label) {
  const m = /^(\d{4})\s*[/-]\s*(\d{2}|\d{4})$/.exec(clean(label));
  if (m) { const a = Number(m[1]) + 1; return `${a}/${String(a + 1).slice(-2)}`; }
  const y = /^(\d{4})$/.exec(clean(label));
  return y ? String(Number(y[1]) + 1) : "";
}

/** Start the next season: new competitions (same name, format, rules, sponsor and teams), no matches, no events.
 *  Teams stay — they are the same identity from season to season — but SQUADS DO NOT: registering athletes usually
 *  involves fees and paperwork, so every squad starts empty. Each athlete's profile (same id, so the account and the
 *  history stay linked) moves to data.athletePool, and the Gestor re-registers whoever the organisation accepts back
 *  (reenrollAthletes). The closed competitions leave the live document (they live on in data.seasons), which is
 *  what keeps it small. */
export function newSeason(state, { label } = {}) {
  const lb = clean(label);
  if (lb.length < 2) throw new SetupError("name_required");
  const comps = state.data.competitions || [];
  const closed = comps.filter((c) => c.closedSeasonId);
  if (!closed.length) throw new SetupError("season_not_closed");
  if (comps.some((c) => !c.closedSeasonId)) throw new SetupError("season_not_closed");
  const gone = new Set(closed.map((c) => c.id));
  const first = comps.find((c) => c.kind !== "cup") || comps[0];
  const taken = new Set(comps.map((c) => c.id));
  const last = closed[closed.length - 1]?.season || "";
  const alreadyIn = new Set((state.data.athletePool || []).map((x) => x.id));
  const pool = [
    ...(state.data.athletePool || []),
    ...(state.data.players || []).filter((p) => !alreadyIn.has(p.id)).map((p) => ({ ...p, teamId: null, captain: false, pastTeamId: p.teamId, pastSeason: last })),
  ];
  const goneMatches = new Set((state.matches || []).filter((m) => gone.has(m.competitionId || first?.id)).map((m) => m.id));
  const fresh = closed.map((c) => {
    let id = `cp-${slug(c.name)}-${slug(lb)}`; let n = 2;
    while (taken.has(id)) id = `cp-${slug(c.name)}-${slug(lb)}-${n++}`;
    taken.add(id);
    const { closedSeasonId, ...rest } = c; // eslint-disable-line no-unused-vars
    return { ...rest, id, season: lb, rounds: 0 };
  });
  return {
    ...state,
    matches: (state.matches || []).filter((m) => !gone.has(m.competitionId || first?.id)),
    logs: Object.fromEntries(Object.entries(state.logs || {}).filter(([id]) => !goneMatches.has(id))),
    fanVotes: {},
    data: { ...state.data, competitions: fresh, players: [], athletePool: pool },
  };
}

/** Athlete profiles waiting to be registered again, newest team first: [{ ...player, pastTeamId }]. */
export const athletePool = (state) => (Array.isArray(state?.data?.athletePool) ? state.data.athletePool : []);

/** The organisation accepts athletes back: each entry { id, teamId? } returns from the pool into a squad
 *  (teamId defaults to the team they played for). Profile and id are kept, so the athlete's account and history
 *  link up again. A shirt number already taken in that squad is left blank for the Gestor to set. */
export function reenrollAthletes(state, entries) {
  const pool = athletePool(state);
  const picked = new Map();
  for (const e of entries || []) {
    const p = pool.find((x) => x.id === e.id);
    if (!p) throw new SetupError("not_found", String(e.id));
    const teamId = e.teamId || p.pastTeamId;
    if (!(state.data.teams || []).some((t) => t.id === teamId)) throw new SetupError("not_found", String(teamId));
    picked.set(p.id, { p, teamId });
  }
  if (!picked.size) throw new SetupError("nothing_to_add");
  const players = [...state.data.players];
  for (const { p, teamId } of picked.values()) {
    const taken = players.some((x) => x.teamId === teamId && p.number != null && x.number === p.number);
    const { pastTeamId, pastSeason, ...profile } = p; // eslint-disable-line no-unused-vars
    players.push({ ...profile, teamId, number: taken ? null : p.number ?? null, captain: false });
  }
  return { ...state, data: { ...state.data, players, athletePool: pool.filter((x) => !picked.has(x.id)) } };
}
