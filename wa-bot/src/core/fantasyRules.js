// GENERATED from src/lib/core — do not edit; run npm run sync:core
// ── Pitch Manager (Fantasy) v2 rules — pure, shared ─────────────────
// The SOURCE OF TRUTH for scoring is plpgsql (supabase/migrations/
// 20261019180559_fantasy_v2_foundation.sql: fantasy_v2_night,
// fantasy_v2_player_night, fantasy_v2_score_lineup, fantasy_v2_price).
// This module mirrors it 1:1 for previews, the local demo and Ligas
// Fase 4. Parity is enforced by shared vectors
// (src/lib/core/fixtures/fantasyVectors.json): the JS test runs them
// here, supabase/tests/fantasy_v2_check.sql runs the SAME JSON through
// the SQL functions, and the JS test also asserts the JSON embedded in
// the check equals the fixture file and that FANTASY_V2 equals the
// constant returned by fantasy_v2_rules() in the migration.
//
// Ids are compared as strings everywhere (cloud uuids, demo numbers).
// No imports: copied verbatim into wa-bot/src/core by sync-core.

export const FANTASY_V2 = Object.freeze({
  played: 2,
  goal: { GR: 8, DEF: 7, MED: 5, AVA: 4 },
  assist: { GR: 4, DEF: 4, MED: 4, AVA: 3 },
  save: { GR: 3, DEF: 2, MED: 2, AVA: 2 },
  cleanSheet: { GR: 4, DEF: 3, MED: 1, AVA: 0 },
  win: 1,
  hatTrick: 3,
  hatTrickGoals: 3,
  ownGoal: -2,
  noShow: -3,
  mvp: [10, 6, 3],
  captain: 2,
  transferCost: 4,
  freeTransfersPerRound: 1,
  maxBankedTransfers: 2,
  priceBase: 20,
  priceScale: 1.5,
  priceForm: 3,
  priceMin: 5,
});

const POS = { "Guarda-redes": "GR", Defesa: "DEF", "Médio": "MED", "Avançado": "AVA" };
/** players.position → rule column. Unknown/missing → MED. */
export const posCode = (pos) => POS[pos] || "MED";

const S = (x) => (x == null ? null : String(x));
const arr = (x) => (Array.isArray(x) ? x : []);
const int = (x) => (Number.isFinite(Number(x)) && x !== null && x !== "" ? Math.trunc(Number(x)) : null);

/** Facts about one night (matchdays.summary), independent of any squad.
 *  - appeared: everyone on a team (teamResults[].players) + anyone with a
 *    stat line / event / keeper slot. Legacy summaries without team
 *    rosters fall back to candidates (then nobody is a no-show).
 *  - noShows: candidates (= confirmed & within spots when the organizer
 *    ended the day) who never appeared.
 *  - games: per game of the night, both rosters (by team NAME — an
 *    ambiguous/duplicated name gives an empty roster, so no CS/win can be
 *    attributed for that side), the score, the keepers and the save /
 *    own-goal events. */
export function nightFacts(summary) {
  const s = summary || {};
  const teams = new Map();
  const dupes = new Set();
  const teamIds = [];
  for (const t of arr(s.teamResults)) {
    if (!Array.isArray(t?.players)) continue;
    const name = t.name == null ? "" : String(t.name);
    if (teams.has(name)) dupes.add(name);
    const ids = t.players.map(S).filter((x) => x != null);
    teams.set(name, ids);
    teamIds.push(...ids);
  }
  const appeared = new Set(teamIds);
  const candidates = arr(s.candidates).map((c) => S(c?.key)).filter((x) => x != null);
  if (teamIds.length === 0) candidates.forEach((c) => appeared.add(c));
  for (const l of arr(s.lines)) if (l?.key != null) appeared.add(S(l.key));
  const roster = (name) => {
    const n = name == null ? "" : String(name);
    return !dupes.has(n) && teams.has(n) ? teams.get(n) : [];
  };
  let hasEvents = false;
  const games = arr(s.matches).map((m) => {
    const events = Array.isArray(m?.events) ? m.events : [];
    if (Array.isArray(m?.events)) hasEvents = true;
    for (const e of events) { if (e?.by != null) appeared.add(S(e.by)); if (e?.ast != null) appeared.add(S(e.ast)); }
    if (m?.homeGk != null) appeared.add(S(m.homeGk));
    if (m?.awayGk != null) appeared.add(S(m.awayGk));
    const same = String(m?.homeName ?? "") === String(m?.awayName ?? "");
    const count = (side) => events.filter((e) => e?.side === side && e?.type !== "save").length;
    return {
      home: same ? [] : roster(m?.homeName),
      away: same ? [] : roster(m?.awayName),
      hg: int(m?.homeGoals) ?? count("h"),
      ag: int(m?.awayGoals) ?? count("a"),
      hgk: S(m?.homeGk), agk: S(m?.awayGk),
      saves: events.filter((e) => e?.type === "save" && e?.by != null).map((e) => S(e.by)),
      ogs: events.filter((e) => e?.type === "og" && e?.by != null).map((e) => S(e.by)),
    };
  });
  const noShows = candidates.filter((c) => !appeared.has(c));
  return { appeared: [...appeared], noShows: [...new Set(noShows)], games, hasEvents };
}

/** One real player's points for one night (no captaincy).
 *  podium: { mvp, second, third } (ids or null). */
export function playerNightPoints(pid, summary, position, podium = {}, facts = null, rules = FANTASY_V2) {
  const f = facts || nightFacts(summary);
  const id = S(pid);
  const pc = posCode(position);
  if (!f.appeared.includes(id)) {
    if (f.noShows.includes(id)) return { played: false, noShow: true, pts: rules.noShow, items: { noShow: { n: 1, pts: rules.noShow } } };
    return { played: false, noShow: false, pts: 0, items: {} };
  }
  const line = arr(summary?.lines).find((l) => S(l?.key) === id) || {};
  const goals = int(line.goals) || 0;
  const assists = int(line.assists) || 0;
  let csN = 0, csPts = 0, wins = 0, savesN = 0, savesPts = 0, ogN = 0;
  for (const g of f.games) {
    const home = g.home.includes(id), away = g.away.includes(id);
    if (home && g.ag === 0) { csN++; csPts += id === g.hgk ? rules.cleanSheet.GR : rules.cleanSheet[pc]; }
    if (away && g.hg === 0) { csN++; csPts += id === g.agk ? rules.cleanSheet.GR : rules.cleanSheet[pc]; }
    if ((home && g.hg > g.ag) || (away && g.ag > g.hg)) wins++;
    for (const b of g.saves) if (b === id) { savesN++; savesPts += (id === g.hgk || id === g.agk || pc === "GR") ? rules.save.GR : rules.save[pc]; }
    for (const b of g.ogs) if (b === id) ogN++;
  }
  if (!f.hasEvents) { savesN = int(line.epicSaves) || 0; savesPts = savesN * rules.save[pc]; }
  const items = {};
  const add = (k, n, pts) => { if (n) items[k] = { n, pts }; };
  add("played", 1, rules.played);
  add("goals", goals, goals * rules.goal[pc]);
  add("assists", assists, assists * rules.assist[pc]);
  add("saves", savesN, savesPts);
  add("cleanSheets", csN, csPts);
  add("wins", wins, wins * rules.win);
  if (goals >= rules.hatTrickGoals) add("hatTrick", 1, rules.hatTrick);
  add("ownGoals", ogN, ogN * rules.ownGoal);
  const p = podium || {};
  const rank = S(p.mvp) === id ? 1 : S(p.second) === id ? 2 : S(p.third) === id ? 3 : 0;
  if (rank) add("mvp", rank, rules.mvp[rank - 1]);
  const pts = Object.values(items).reduce((sum, it) => sum + it.pts, 0);
  return { played: true, noShow: false, pts, items };
}

/** Score one locked lineup against one night.
 *  lineup: { starters: [], bench: [] (ordered), captain, vice, transferCost }
 *  positions: { [id]: players.position }
 *  → { total, transferCost, captain (effective ×2 holder or null),
 *      players: [{ id, slot, played, noShow, counted, subFor, subbedBy, mult, base, pts, items }] } */
export function scoreLineup(lineup, summary, positions = {}, podium = {}, rules = FANTASY_V2) {
  const f = nightFacts(summary);
  const starters = arr(lineup?.starters).map(S).filter((x) => x != null);
  const bench = arr(lineup?.bench).map(S).filter((x) => x != null);
  const night = {};
  const pn = (id) => (night[id] ||= playerNightPoints(id, summary, positions?.[id], podium, f, rules));
  const rows = [];
  const used = new Set();
  const subFor = {};
  for (const id of starters) {
    const r = pn(id);
    let subbedBy = null;
    if (!r.played) {
      subbedBy = bench.find((b) => !used.has(b) && pn(b).played) || null;
      if (subbedBy) { used.add(subbedBy); subFor[subbedBy] = id; }
    }
    rows.push({ id, slot: "starter", subbedBy, counted: !subbedBy });
  }
  for (const id of bench) rows.push({ id, slot: "bench", subbedBy: null, counted: used.has(id) });
  const cap = S(lineup?.captain), vice = S(lineup?.vice);
  const eff = cap && starters.includes(cap) && pn(cap).played ? cap
    : vice && starters.includes(vice) && pn(vice).played ? vice : null;
  const transferCost = int(lineup?.transferCost) || 0;
  let total = -transferCost;
  const players = rows.map((r) => {
    const n = pn(r.id);
    const mult = r.counted && r.id === eff ? rules.captain : 1;
    const pts = r.counted ? n.pts * mult : 0;
    total += pts;
    return { id: r.id, slot: r.slot, played: n.played, noShow: n.noShow, counted: r.counted,
      subFor: subFor[r.id] || null, subbedBy: r.subbedBy, mult, base: n.pts, pts, items: n.items };
  });
  return { total, transferCost, captain: eff, players };
}

// ── Conexão da Rodada (v1) ───────────────────────────────────────────
// Optional pair chosen BEFORE the lock: creator (the assist) → finisher
// (the goal). Worth +bonusPerEvent for every normal goal in which the
// finisher scores from the creator's assist, at most maxEvents events per
// round (shared across all games of the night), on top of the base total —
// never multiplied by the captain, never changing a player's own points.
// Pure: the JS mirror for demo/previews. The authoritative apuração
// (SQL) is a later phase; until then a cloud league has no Conexão.
//
// A goal only counts when it is ONE event that carries both ids: totals
// ("Diego has an assist, Lucas a goal") never imply a connection, and an
// event without a stable `id` makes the night "insufficient" instead of
// guessing.
export const FANTASY_CONNECTION = Object.freeze({ version: 1, bonusPerEvent: 3, maxEvents: 2 });

const noBonus = (status) => ({
  status, points: 0, validEventIds: [], awardedEventIds: [], totalValid: 0, awarded: 0, capped: false, provisional: 0, events: [],
});

// Published order of the capped events: game of the night, minute (unknown
// last), then id — never the array position the query happened to return.
const byEventOrder = (a, b) => a.game - b.game || (a.min ?? Infinity) - (b.min ?? Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Why a draft pair can't be saved (null = fine). teams = real teams of
 *  the round when already drawn ([[ids]…]) or null before the draw. */
export function connectionDraftIssue(connection, starters, teams = null) {
  const creator = S(connection?.creator), finisher = S(connection?.finisher);
  if (creator == null && finisher == null) return null;
  if (creator == null) return "incomplete_creator";
  if (finisher == null) return "incomplete_finisher";
  if (creator === finisher) return "same_player";
  const st = arr(starters).map(S);
  if (!st.includes(creator)) return "creator_not_starter";
  if (!st.includes(finisher)) return "finisher_not_starter";
  const drawn = arr(teams).filter((t) => Array.isArray(t));
  const teamOf = (id) => drawn.findIndex((t) => t.map(S).includes(id));
  if (drawn.length && teamOf(creator) !== -1 && teamOf(finisher) !== -1 && teamOf(creator) !== teamOf(finisher)) return "split_teams";
  return null;
}

/** Bonus of one frozen pair against one night's summary.
 *  connection: { creator, finisher } (real player ids); starters: the
 *  FROZEN lineup's starters. status: none | invalid | insufficient |
 *  provisional | no_match | activated. */
export function connectionBonus(connection, starters, summary, rules = FANTASY_CONNECTION) {
  const creator = S(connection?.creator), finisher = S(connection?.finisher);
  if (creator == null && finisher == null) return noBonus("none");
  if (connectionDraftIssue(connection, starters)) return noBonus("invalid");
  const matches = arr(summary?.matches);
  // Without a per-game event list for EVERY game we can't tell a night
  // with no connection from a night we can't evaluate.
  if (!matches.length || !matches.every((m) => Array.isArray(m?.events))) return noBonus("insufficient");
  const games = nightFacts(summary).games;
  const seen = new Set();
  const valid = [];
  let provisional = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    for (const e of m.events) {
      if (e?.type !== "goal" || S(e.by) !== finisher || S(e.ast) !== creator) continue;
      if (e.cancelled === true || e.shootout === true) continue;
      const id = e.id == null || e.id === "" ? null : String(e.id);
      if (id == null) return noBonus("insufficient");
      if (seen.has(id)) continue;
      seen.add(id);
      const team = e.side === "h" ? games[i].home : e.side === "a" ? games[i].away : [];
      if (!team.length) return noBonus("insufficient");
      if (!team.includes(creator) || !team.includes(finisher)) continue;
      if (e.provisional === true) { provisional++; continue; }
      valid.push({ id, game: int(m?.n) ?? i + 1, min: int(e.min), by: finisher, ast: creator });
    }
  }
  valid.sort(byEventOrder);
  const awardedEvents = valid.slice(0, rules.maxEvents);
  const awarded = new Set(awardedEvents.map((e) => e.id));
  return {
    status: valid.length ? "activated" : provisional ? "provisional" : "no_match",
    points: awardedEvents.length * rules.bonusPerEvent,
    validEventIds: valid.map((e) => e.id), awardedEventIds: awardedEvents.map((e) => e.id),
    totalValid: valid.length, awarded: awardedEvents.length, capped: valid.length > rules.maxEvents, provisional,
    events: valid.map((e) => ({ ...e, awarded: awarded.has(e.id) })),
  };
}

/** scoreLineup() + the Conexão as its own line: `total` = base + bonus,
 *  `base` = the untouched scoreLineup total (captain, auto-subs and
 *  transfer cost already inside), `connection` = connectionBonus(). The
 *  pair comes from the frozen lineup (lineup.connection); a lineup without
 *  one scores exactly like scoreLineup(). */
export function scoreLineupWithConnection(lineup, summary, positions = {}, podium = {}, rules = FANTASY_V2, connectionRules = FANTASY_CONNECTION) {
  const r = scoreLineup(lineup, summary, positions, podium, rules);
  const connection = connectionBonus(lineup?.connection, lineup?.starters, summary, connectionRules);
  return { ...r, base: r.total, total: r.total + connection.points, connection };
}

/** A player can be held by at most max(2, ceil(participants/2)) managers. */
export const ownershipCap = (participants) => Math.max(2, Math.ceil((Number(participants) || 0) / 2));

/** Price by form: base + avg(points of the player's last `priceForm`
 *  scored rounds, newest first) × scale, rounded, never below priceMin.
 *  No rounds → base. */
export function priceFromForm(pointsNewestFirst, base = FANTASY_V2.priceBase, scale = FANTASY_V2.priceScale, rules = FANTASY_V2) {
  const form = arr(pointsNewestFirst).slice(0, rules.priceForm).map(Number);
  if (!form.length) return base;
  // sum × scale / n (not avg × scale): both sides then land on exact
  // halves the same way, so JS and SQL round identically.
  const sum = form.reduce((s, x) => s + x, 0);
  return Math.max(rules.priceMin, Math.round(base + (sum * scale) / form.length));
}

/** Transfers for the round being edited, relative to the last locked
 *  lineup. lockedIds null = no lock yet this season → unlimited, free.
 *  free = transfers available this round (banked, 1..2).
 *  → { unlimited, made, free, extra, cost, nextCost } (nextCost = what
 *    ONE more transfer would cost now). */
export function transferState(lockedIds, currentIds, free, rules = FANTASY_V2) {
  if (lockedIds == null) return { unlimited: true, made: 0, free: Infinity, extra: 0, cost: 0, nextCost: 0 };
  const locked = new Set(arr(lockedIds).map(S));
  const made = new Set(arr(currentIds).map(S).filter((x) => !locked.has(x))).size;
  const f = Math.max(0, int(free) ?? rules.freeTransfersPerRound);
  const extra = Math.max(0, made - f);
  return { unlimited: false, made, free: f, extra, cost: extra * rules.transferCost, nextCost: made + 1 > f ? rules.transferCost : 0 };
}

/** Free transfers banked for the next round, after a lock. */
export function nextFreeTransfers(lockedIdsBefore, free, made, rules = FANTASY_V2) {
  if (lockedIdsBefore == null) return rules.freeTransfersPerRound;
  const f = Math.max(0, int(free) ?? rules.freeTransfersPerRound);
  return Math.min(rules.maxBankedTransfers, Math.max(0, f - made) + rules.freeTransfersPerRound);
}

/** Season standings from scored rounds: scores [{ participant_id, round_id, points }],
 *  rounds [{ id, kickoff_at }], window { starts_at, ends_at }.
 *  Ties share the rank (competition ranking: 1,1,3). */
export function seasonStandings(scores, rounds, window) {
  const start = new Date(window.starts_at).getTime(), end = new Date(window.ends_at).getTime();
  const inWindow = new Set(arr(rounds).filter((r) => {
    const k = new Date(r.kickoff_at).getTime();
    return k >= start && k < end;
  }).map((r) => S(r.id)));
  const by = {};
  for (const s of arr(scores)) {
    if (!inWindow.has(S(s.round_id))) continue;
    const row = by[s.participant_id] ||= { participant_id: s.participant_id, points: 0, rounds: 0 };
    row.points += Number(s.points) || 0;
    row.rounds += 1;
  }
  const rows = Object.values(by).sort((a, b) => b.points - a.points);
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1; });
  return rows;
}

/** Europe/Lisbon period containing `at`: Taça do Mês (calendar month) or
 *  Campeonato da Época (1 Aug → 31 Jul). Used by the demo; the cloud
 *  windows come from fantasy_seasons. Returns local-midnight Dates. */
export function seasonWindow(kind, at = new Date()) {
  const d = new Date(at);
  if (kind === "month") {
    return { starts_at: new Date(d.getFullYear(), d.getMonth(), 1), ends_at: new Date(d.getFullYear(), d.getMonth() + 1, 1) };
  }
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return { starts_at: new Date(y, 7, 1), ends_at: new Date(y + 1, 7, 1) };
}
