// Local demo of Pitch Manager v2 — runs the SAME pure rules the server
// mirrors (src/lib/core/fantasyRules.js) over the seeded matchdays, so the
// demo shows exactly what cloud mode would: per-round scores with the
// breakdown, prices by form, ownership cap, transfers, Taça do Mês +
// Campeonato (and last month's champions). Pure: no React, no storage.
import {
  FANTASY_V2, FANTASY_CONNECTION, nightFacts, playerNightPoints, scoreLineup, scoreLineupWithConnection, connectionDraftIssue,
  priceFromForm, seasonWindow, seasonStandings, ownershipCap,
} from "./core/fantasyRules";
import { squadCostBasis, nextPricesPaid } from "./fantasy";

const fk = (id) => String(id);
const iso = (d) => new Date(d).toISOString();

/** Normalise a squad like save_fantasy_squad does: dedupe, bench ⊆ squad
 *  (in order), exactly squadSize starters (overflow → end of bench, a
 *  short XI is filled from the bench), captain/vice must start. */
export function normalizeSquad({ playerIds, reserveIds, captainId, viceId }, squadSize) {
  const ids = [...new Set((playerIds || []).map(fk))];
  let bench = [...new Set((reserveIds || []).map(fk))].filter((x) => ids.includes(x));
  let starters = ids.filter((x) => !bench.includes(x));
  while (starters.length > squadSize) { bench = [...bench, starters[starters.length - 1]]; starters = starters.slice(0, -1); }
  while (starters.length < squadSize && bench.length) { starters = [...starters, bench[0]]; bench = bench.slice(1); }
  const cap = captainId != null && starters.includes(fk(captainId)) ? fk(captainId) : null;
  const vice = viceId != null && starters.includes(fk(viceId)) && fk(viceId) !== cap ? fk(viceId) : null;
  return { player_ids: [...starters, ...bench], reserve_ids: bench, captain_id: cap, vice_captain_id: vice };
}

/** { creatorId, finisherId } (any id type) → the squad row's shape. */
export const connectionRow = (c) => (c?.creatorId != null && c?.finisherId != null ? { creator_id: fk(c.creatorId), finisher_id: fk(c.finisherId) } : null);

/** connectionConfig (demo seed): { fromDayId, locked: { [dayId]: { creator, finisher } } } — the pairs "I"
 *  froze for past rounds, and the first round the rule applies to. Older
 *  rounds never get a bonus retroactively. */
export function buildDemoFantasy({ group, localDays, mySquad, lockedSquad = null, rivals, budget, squadSize, startsWeeksAgo, connectionConfig = null, now = Date.now() }) {
  const fGroup = group.map((p) => ({ ...p, uuid: fk(p.id) }));
  const me = fGroup.find((p) => p.isMe);
  const positions = Object.fromEntries(fGroup.map((p) => [p.uuid, p.position]));
  const startsAt = new Date(now - startsWeeksAgo * 7 * 24 * 3600 * 1000 - 3600 * 1000);
  const allDays = (localDays || [])
    .filter((d) => d.playedOn && d.summary)
    .map((d) => ({ ...d, kickoff_at: iso(`${d.playedOn}T20:00:00`) }))
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
  const days = allDays.filter((d) => new Date(d.kickoff_at) >= startsAt);
  // Nights before the v2 start = the closed "Temporada 1" (mirrors the
  // restart of real leagues: old run closed, champion recorded).
  const legacyDays = allDays.filter((d) => new Date(d.kickoff_at) < startsAt);
  const rounds = days.map((d) => ({ id: `r-${d.id}`, league_id: "demo-league", kickoff_at: d.kickoff_at, status: "scored", matchday_id: d.id }));

  const base = FANTASY_V2.priceBase;
  const basePaid = (ids) => Object.fromEntries(ids.map((id) => [id, base]));
  const mine = normalizeSquad({ playerIds: mySquad.player_ids, reserveIds: mySquad.reserve_ids, captainId: mySquad.captain_id, viceId: mySquad.vice_captain_id }, squadSize);
  const squads = [
    { participant_id: me?.uuid, ...mine, prices_paid: mySquad.prices_paid || basePaid(mine.player_ids), budget_adjustment: 30,
      locked_player_ids: (mySquad.locked_player_ids || mySquad.player_ids || []).map(fk), free_transfers: mySquad.free_transfers ?? 1,
      connection: connectionConfig ? (mySquad.connection ?? null) : null },
    ...rivals.filter((r) => fk(r.participant) !== me?.uuid).map((r) => {
      const n = normalizeSquad({ playerIds: r.player_ids, reserveIds: r.player_ids.slice(squadSize), captainId: r.captain_id, viceId: r.player_ids[1] }, squadSize);
      return { participant_id: fk(r.participant), ...n, prices_paid: basePaid(n.player_ids), budget_adjustment: 0, locked_player_ids: n.player_ids, free_transfers: 1 };
    }),
  ];

  // Past rounds are scored from the LOCKED lineup (mine: the seed squad,
  // as if locked at the last kickoff; rivals: their squads) — so editing
  // my squad in the demo changes the next round, never a scored one, like
  // the server snapshot. Same scoreLineup() the server mirrors.
  const myLocked = lockedSquad
    ? normalizeSquad({ playerIds: lockedSquad.player_ids, reserveIds: lockedSquad.reserve_ids, captainId: lockedSquad.captain_id, viceId: lockedSquad.vice_captain_id }, squadSize)
    : mine;
  const lockedOf = (s) => (s.participant_id === me?.uuid ? { ...s, ...myLocked } : s);
  const lineupOf = (s0) => {
    const s = lockedOf(s0);
    return { starters: s.player_ids.filter((x) => !s.reserve_ids.includes(x)), bench: s.reserve_ids, captain: s.captain_id, vice: s.vice_captain_id, transferCost: 0 };
  };
  const scores = [];
  const roundPlayers = [];
  // The rule is versioned per league and starts at a round: before it,
  // breakdown.connection is null (not "no connection").
  const connStart = connectionConfig?.fromDayId ? days.findIndex((d) => d.id === connectionConfig.fromDayId) : -1;
  rounds.forEach((r, i) => {
    const d = days[i];
    const podium = { mvp: d.mvpKey ?? null };
    const connectionOn = connStart >= 0 && i >= connStart;
    squads.forEach((s) => {
      // Round frozen with the pair I chose for THAT round (rivals pick none in the demo).
      const frozen = connectionOn && s.participant_id === me?.uuid ? connectionConfig.locked?.[d.id] : null;
      const lineup = { ...lineupOf(s), connection: frozen ? { creator: fk(frozen.creator), finisher: fk(frozen.finisher) } : null };
      const b = connectionOn ? scoreLineupWithConnection(lineup, d.summary, positions, podium) : scoreLineup(lineup, d.summary, positions, podium);
      scores.push({ id: `${r.id}-${s.participant_id}`, league_id: "demo-league", round_id: r.id, matchday_id: d.id, participant_id: s.participant_id,
        points: b.total, breakdown: connectionOn ? { ...b, connectionPair: frozen ? { creator_id: fk(frozen.creator), finisher_id: fk(frozen.finisher) } : null } : b,
        captain_id: lockedOf(s).captain_id, vice_captain_id: lockedOf(s).vice_captain_id, transfer_cost: 0 });
    });
    const f = nightFacts(d.summary);
    [...new Set([...f.appeared, ...f.noShows])].forEach((id) => {
      roundPlayers.push({ round_id: r.id, player_id: id, points: playerNightPoints(id, d.summary, positions[id], podium, f).pts });
    });
  });

  // Price by form: last 3 scored rounds the player had points in.
  const newestFirst = [...rounds].reverse();
  const lastId = newestFirst[0]?.id;
  const prices = Object.fromEntries(fGroup.map((p) => {
    const form = newestFirst.map((r) => roundPlayers.find((x) => x.round_id === r.id && x.player_id === p.uuid)).filter(Boolean);
    const pts = form.map((x) => x.points);
    const prevPts = form.filter((x) => x.round_id !== lastId).map((x) => x.points);
    return [p.uuid, { price: priceFromForm(pts), prev: lastId ? priceFromForm(prevPts) : null }];
  }));

  const at = new Date(now);
  const monthW = seasonWindow("month", at);
  const seasonW = seasonWindow("season", at);
  const prevMonthW = seasonWindow("month", new Date(monthW.starts_at.getTime() - 24 * 3600 * 1000));
  const win = (w) => ({ starts_at: iso(w.starts_at), ends_at: iso(w.ends_at) });
  const label = (w, kind) => (kind === "month"
    ? `${w.starts_at.getFullYear()}-${String(w.starts_at.getMonth() + 1).padStart(2, "0")}`
    : `${w.starts_at.getFullYear()}/${String((w.starts_at.getFullYear() + 1) % 100).padStart(2, "0")}`);
  const seasons = [
    { id: "demo-month", kind: "month", status: "open", label: label(monthW, "month"), ...win(monthW) },
    { id: "demo-season", kind: "season", status: "open", label: label(seasonW, "season"), ...win(seasonW) },
  ];
  const prevStandings = seasonStandings(scores, rounds, win(prevMonthW));
  if (prevStandings.length) {
    seasons.push({ id: "demo-month-prev", kind: "month", status: "closed", label: label(prevMonthW, "month"), ...win(prevMonthW),
      standings: prevStandings, champion_ids: prevStandings.filter((r) => r.rank === 1).map((r) => r.participant_id) });
  }
  const legacyRounds = legacyDays.map((d) => ({ id: `legacy-${d.id}`, kickoff_at: d.kickoff_at }));
  const legacyScores = legacyDays.flatMap((d, i) => squads.map((s) => ({ participant_id: s.participant_id, round_id: legacyRounds[i].id,
    points: scoreLineup(lineupOf(s), d.summary, positions, { mvp: d.mvpKey ?? null }).total })));
  const legacyStandings = legacyRounds.length
    ? seasonStandings(legacyScores, legacyRounds, { starts_at: legacyRounds[0].kickoff_at, ends_at: iso(startsAt) }) : [];
  if (legacyStandings.length) {
    seasons.push({ id: "demo-legacy", kind: "legacy", status: "closed", label: "Temporada 1", starts_at: legacyRounds[0].kickoff_at, ends_at: iso(startsAt),
      standings: legacyStandings, champion_ids: legacyStandings.filter((r) => r.rank === 1).map((r) => r.participant_id) });
  }
  const trophies = [
    ...prevStandings.filter((r) => r.participant_id === me?.uuid && r.rank <= 3)
      .map((r) => ({ id: "demo-trophy-month", kind: "month", rank: r.rank, points: r.points, season: { kind: "month", label: label(prevMonthW, "month") } })),
    ...legacyStandings.filter((r) => r.participant_id === me?.uuid && r.rank <= 3)
      .map((r) => ({ id: "demo-trophy-legacy", kind: "legacy", rank: r.rank, points: r.points, season: { kind: "legacy" } })),
  ];

  const priceOf = (id) => prices[id]?.price ?? base;
  /** Same checks as save_fantasy_squad (budget, ownership cap, injured) plus
   *  the Conexão: it must still be two distinct starters of the squad being
   *  saved — `connection` undefined keeps the saved one (and fails if the
   *  new squad orphaned it), null removes it. */
  const validate = (next, connection) => {
    if (next.player_ids.length < squadSize) return "fantasy:squad_incomplete";
    if (connectionConfig) {
      const row = connection === undefined ? squads[0].connection : connection;
      const starters = next.player_ids.filter((id) => !next.reserve_ids.includes(id));
      if (row && connectionDraftIssue({ creator: row.creator_id, finisher: row.finisher_id }, starters)) return "fantasy:connection_invalid";
    }
    const prev = new Set(squads[0].player_ids);
    const added = next.player_ids.filter((id) => !prev.has(id));
    if (added.some((id) => fGroup.find((p) => p.uuid === id)?.injured)) return "fantasy:injured";
    const others = squads.slice(1).filter((s) => s.player_ids.length);
    const cap = ownershipCap(others.length + 1);
    if (added.some((id) => others.filter((s) => s.player_ids.includes(id)).length >= cap)) return "fantasy:ownership_cap";
    const paid = nextPricesPaid(squads[0].prices_paid, next.player_ids, priceOf);
    if (squadCostBasis(paid) > budget + squads[0].budget_adjustment) return "fantasy:over_budget";
    return { prices_paid: paid };
  };

  return {
    group: fGroup, me,
    fantasyLeague: { id: "demo-league", name: "Pitch Manager", budget, squad_size: squadSize, mode: "classic", rules_version: 2,
      v2_started_at: iso(startsAt), starts_at: iso(startsAt), created_at: iso(startsAt), scoring_weights: { priceBase: base },
      connection_rules: connectionConfig ? { enabled: true, version: FANTASY_CONNECTION.version, bonus_per_event: FANTASY_CONNECTION.bonusPerEvent, max_events: FANTASY_CONNECTION.maxEvents } : null },
    fantasySquads: squads, fantasyScores: scores, fantasyTradeOffers: [], fantasyRounds: rounds, fantasyRoundPlayers: roundPlayers,
    fantasySeasons: seasons, fantasyPrices: prices, trophies, validate,
  };
}
