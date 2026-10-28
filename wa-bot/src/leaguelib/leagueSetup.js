// GENERATED from src/lib — do not edit; run npm run sync:core
// PITCH Ligas — building a league by hand: identity, competitions, teams,
// athletes and fixtures. Every function is pure (state in, new state out) and
// throws SetupError with a code the screens translate; nothing here touches
// the registry or the network. The same shapes are what a cloud adapter will
// fill later.
import { roundRobinFixtures } from "../core/standings.js";
import { DEMO_RULES } from "../core/league.js";

export class SetupError extends Error {
  constructor(code, detail = "") { super(detail ? `${code}: ${detail}` : code); this.code = code; }
}

const POSITIONS = ["GR", "DEF", "MED", "AVA"];
const KINDS = ["league", "cup"];
const OUT_KEYS = ["rit", "rem", "pas", "dri", "def", "fis"];
const GK_KEYS = ["div", "man", "kic", "ref", "spd", "pos"];
/** Kit colours cycled for new teams (theme TEAM_COLORS minus white/black). */
export const KIT_COLORS = Object.freeze(["#4895FF", "#FF3B5C", "#00D08A", "#FF9F0A", "#A78BFA", "#E8C547", "#1B3A8C", "#8B1E3F", "#0E5C36", "#C8FF00"]);

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const slug = (s) => clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "x";
const uniqueId = (prefix, base, taken) => { let id = `${prefix}-${slug(base)}`; let n = 2; while (taken.has(id)) id = `${prefix}-${slug(base)}-${n++}`; return id; };
const withData = (state, patch) => ({ ...state, data: { ...state.data, ...patch } });
const initials = (name) => {
  const words = clean(name).split(" ").filter((w) => w.length > 2 || /^[A-ZÀ-Ý]/.test(w));
  const letters = words.length > 1 ? words.map((w) => w[0]).join("") : clean(name).replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.slice(0, 3).toUpperCase() || "EQP";
};

/** The league's name and city. */
export function setLeagueInfo(state, { name, city, fullName }) {
  const n = clean(name);
  if (n.length < 2) throw new SetupError("name_required");
  return withData(state, { league: { ...state.data.league, name: n, city: clean(city), ...(fullName !== undefined ? { fullName: clean(fullName) } : {}) } });
}

/** A new competition: a table (kind "league", N legs) or a knockout cup. */
export function addCompetition(state, f) {
  const name = clean(f.name);
  if (name.length < 2) throw new SetupError("name_required");
  const kind = KINDS.includes(f.kind) ? f.kind : "league";
  const legs = kind === "league" ? Math.max(1, Math.min(4, Math.round(Number(f.legs) || 1))) : null;
  const taken = new Set(state.data.competitions.map((c) => c.id));
  const comp = {
    id: uniqueId("cp", name, taken), leagueId: state.data.league.id, name, short: clean(f.short) || name, season: clean(f.season),
    category: clean(f.category), kind, sponsor: clean(f.sponsor), teamIds: [],
    format: kind === "cup" ? "Eliminatória" : legs === 1 ? "Pontos corridos" : `Pontos corridos · ${legs} voltas`,
    ...(kind === "league" ? { legs, rounds: 0, points: { ...DEMO_RULES.points }, tiebreakers: [...DEMO_RULES.tiebreakers] } : { rounds: 0 }),
  };
  return withData(state, { competitions: [...state.data.competitions, comp] });
}

export function updateCompetition(state, id, patch) {
  if (!state.data.competitions.some((c) => c.id === id)) throw new SetupError("not_found", id);
  const allowed = ["name", "short", "season", "category", "sponsor"];
  return withData(state, {
    competitions: state.data.competitions.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c };
      for (const k of allowed) if (patch[k] !== undefined) next[k] = clean(patch[k]);
      if (clean(next.name).length < 2) throw new SetupError("name_required");
      return next;
    }),
  });
}

export function removeCompetition(state, id) {
  if (state.matches.some((m) => m.competitionId === id)) throw new SetupError("has_matches");
  return withData(state, { competitions: state.data.competitions.filter((c) => c.id !== id) });
}

/** A new team, optionally entered straight into competitions. */
export function addTeam(state, f) {
  const name = clean(f.name);
  if (name.length < 2) throw new SetupError("name_required");
  if (state.data.teams.some((t) => clean(t.name).toLowerCase() === name.toLowerCase())) throw new SetupError("duplicate_team", name);
  const taken = new Set(state.data.teams.map((t) => t.id));
  const team = {
    id: uniqueId("tm", name, taken), name, short: (clean(f.short) || initials(name)).toUpperCase().slice(0, 4),
    color: /^#[0-9A-Fa-f]{6}$/.test(f.color || "") ? f.color : KIT_COLORS[state.data.teams.length % KIT_COLORS.length],
    venue: clean(f.venue),
  };
  const next = withData(state, { teams: [...state.data.teams, team] });
  return setTeamCompetitions(next, team.id, f.competitionIds || []);
}

export function updateTeam(state, id, patch) {
  if (!state.data.teams.some((t) => t.id === id)) throw new SetupError("not_found", id);
  return withData(state, {
    teams: state.data.teams.map((t) => {
      if (t.id !== id) return t;
      const next = { ...t };
      if (patch.name !== undefined) { next.name = clean(patch.name); if (next.name.length < 2) throw new SetupError("name_required"); }
      if (patch.short !== undefined) next.short = clean(patch.short).toUpperCase().slice(0, 4) || t.short;
      if (patch.venue !== undefined) next.venue = clean(patch.venue);
      if (patch.color !== undefined && /^#[0-9A-Fa-f]{6}$/.test(patch.color)) next.color = patch.color;
      return next;
    }),
  });
}

/** Which competitions a team plays (replaces its memberships). A team that
 *  already has matches in a competition can't be taken out of it. */
export function setTeamCompetitions(state, teamId, competitionIds) {
  if (!state.data.teams.some((t) => t.id === teamId)) throw new SetupError("not_found", teamId);
  const want = new Set(competitionIds);
  for (const c of state.data.competitions) {
    const has = (c.teamIds || []).includes(teamId);
    if (has && !want.has(c.id) && state.matches.some((m) => m.competitionId === c.id && (m.homeId === teamId || m.awayId === teamId))) throw new SetupError("team_has_matches", c.name);
  }
  return withData(state, {
    competitions: state.data.competitions.map((c) => {
      const has = (c.teamIds || []).includes(teamId);
      if (want.has(c.id) && !has) return { ...c, teamIds: [...(c.teamIds || []), teamId] };
      if (!want.has(c.id) && has) return { ...c, teamIds: c.teamIds.filter((x) => x !== teamId) };
      return c;
    }),
  });
}

export function removeTeam(state, id) {
  if (state.matches.some((m) => m.homeId === id || m.awayId === id)) throw new SetupError("has_matches");
  return withData(state, {
    teams: state.data.teams.filter((t) => t.id !== id),
    players: state.data.players.filter((p) => p.teamId !== id),
    competitions: state.data.competitions.map((c) => ({ ...c, teamIds: (c.teamIds || []).filter((x) => x !== id) })),
  });
}

const attrsFor = (position) => Object.fromEntries((position === "GR" ? GK_KEYS : OUT_KEYS).map((k) => [k, 60]));

/** "10 Rui Silva", "10;Rui Silva;DEF", "Rui Silva" (one per line, tabs from
 *  Excel work too). Returns { rows, errors } without touching the state. */
export function parseRoster(text) {
  const rows = []; const errors = [];
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    const line = clean(raw.replace(/\t/g, ";"));
    if (!line) return;
    let tokens = line.includes(";") || line.includes(",") ? line.split(/[;,]/).map(clean).filter(Boolean) : line.split(" ");
    let number = null; let position = null;
    if (/^\d{1,3}$/.test(tokens[0])) { number = Number(tokens[0]); tokens = tokens.slice(1); }
    const last = tokens[tokens.length - 1];
    if (tokens.length > 1 && POSITIONS.includes(String(last).toUpperCase())) { position = String(last).toUpperCase(); tokens = tokens.slice(0, -1); }
    const name = clean(tokens.join(" "));
    if (name.length < 2) { errors.push({ line: i + 1, code: "name_required" }); return; }
    rows.push({ name, number, position });
  });
  return { rows, errors };
}

/** Adds athletes to a team from a pasted list. Numbers must be unique in the squad. */
export function addPlayers(state, teamId, text) {
  const team = state.data.teams.find((t) => t.id === teamId);
  if (!team) throw new SetupError("not_found", teamId);
  const { rows, errors } = parseRoster(text);
  if (errors.length) throw new SetupError("invalid_line", String(errors[0].line));
  if (!rows.length) throw new SetupError("nothing_to_add");
  const squad = state.data.players.filter((p) => p.teamId === teamId);
  const used = new Set(squad.map((p) => p.number).filter((n) => n != null));
  const taken = new Set(state.data.players.map((p) => p.id));
  const added = [];
  for (const r of rows) {
    if (r.number != null) { if (used.has(r.number)) throw new SetupError("duplicate_number", String(r.number)); used.add(r.number); }
    const position = r.position || "MED";
    const id = uniqueId(`${teamId}-p`, r.name, taken); taken.add(id);
    const first = r.name.split(" ")[0];
    added.push({
      id, teamId, name: r.name, nick: r.name.split(" ").length > 1 ? `${first} ${r.name.split(" ").slice(-1)[0][0]}.` : r.name,
      position, number: r.number, captain: squad.length + added.length === 0, photo: null, attrs: attrsFor(position),
      foot: "Direito", nationality: "", age: null, price: 5,
    });
  }
  return withData(state, { players: [...state.data.players, ...added] });
}

export function setCaptain(state, teamId, playerId) {
  if (!state.data.players.some((p) => p.id === playerId && p.teamId === teamId)) throw new SetupError("not_found", playerId);
  return withData(state, { players: state.data.players.map((p) => (p.teamId === teamId ? { ...p, captain: p.id === playerId } : p)) });
}

export function removePlayer(state, id) {
  const inLineup = state.matches.some((m) => Object.values(m.lineups || {}).some((ids) => (ids || []).includes(id)));
  const inLog = Object.values(state.logs || {}).some((log) => log.some((e) => e.playerId === id || e.assistId === id));
  if (inLineup || inLog) throw new SetupError("player_has_history");
  return withData(state, { players: state.data.players.filter((p) => p.id !== id) });
}

/** Rounds of a round-robin for the given teams, `legs` times over (odd legs
 *  reverse home/away). An odd number of teams gives one bye per round. */
export function scheduleRounds(teamIds, legs = 1) {
  const n = teamIds.length;
  if (n < 2) return [];
  const perRound = Math.floor(n / 2);
  const flat = roundRobinFixtures(teamIds, false);
  const base = [];
  for (let i = 0; i < flat.length; i += perRound) base.push(flat.slice(i, i + perRound));
  const rounds = [];
  for (let leg = 0; leg < legs; leg++) {
    for (const r of base) rounds.push(leg % 2 === 0 ? r : r.map((f) => ({ homeId: f.awayId, awayId: f.homeId })));
  }
  return rounds;
}

const pad = (n) => String(n).padStart(2, "0");
const addDays = (isoDate, days) => { const d = new Date(`${isoDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
/** Europe/Lisbon (or any IANA zone) wall time → ISO instant. */
export function zonedIso(date, time, timeZone = "Europe/Lisbon") {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asUtc - guess.getTime())).toISOString();
}

const newMatch = (id, competitionId, round, homeId, awayId, kickoff, venue, roundName) => ({
  id, competitionId, round, homeId, awayId, kickoff, venue: venue || "", referee: "", state: "scheduled", history: [], lineups: {},
  officialMvp: null, fanVoteClosed: false, contest: null, var: { enabled: false }, ...(roundName ? { roundName } : {}),
});
const nextMatchId = (state) => {
  const taken = new Set(state.matches.map((m) => m.id)); let n = state.matches.length + 1;
  while (taken.has(`m${n}`)) n++;
  return () => { while (taken.has(`m${n}`)) n++; const id = `m${n}`; taken.add(id); return id; };
};

/** Generates the whole calendar of a league competition. `times` cycle over
 *  the matches of a round; rounds are `everyDays` apart from `startDate`. */
export function generateFixtures(state, { competitionId, startDate, times = ["15:00"], everyDays = 7 }) {
  const comp = state.data.competitions.find((c) => c.id === competitionId);
  if (!comp) throw new SetupError("not_found", competitionId);
  if (comp.kind === "cup") throw new SetupError("cup_not_scheduled_by_rounds");
  if (state.matches.some((m) => m.competitionId === competitionId)) throw new SetupError("calendar_exists");
  const teamIds = comp.teamIds || [];
  if (teamIds.length < 2) throw new SetupError("need_two_teams");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) throw new SetupError("date_required");
  const slots = (times.length ? times : ["15:00"]).filter((x) => /^\d{2}:\d{2}$/.test(x));
  if (!slots.length) throw new SetupError("time_required");
  const venueOf = Object.fromEntries(state.data.teams.map((t) => [t.id, t.venue]));
  const tz = state.data.league.timeZone || "Europe/Lisbon";
  const nid = nextMatchId(state);
  const rounds = scheduleRounds(teamIds, comp.legs || 1);
  const created = rounds.flatMap((fixtures, ri) => fixtures.map((f, i) => newMatch(nid(), competitionId, ri + 1, f.homeId, f.awayId, zonedIso(addDays(startDate, ri * everyDays), slots[i % slots.length], tz), venueOf[f.homeId])));
  return { ...withData(state, { competitions: state.data.competitions.map((c) => (c.id === competitionId ? { ...c, rounds: rounds.length } : c)) }), matches: [...state.matches, ...created] };
}

/** One match, e.g. a cup tie, a final or a friendly. */
export function addMatch(state, { competitionId, homeId, awayId, date, time, venue, round, roundName }) {
  const comp = state.data.competitions.find((c) => c.id === competitionId);
  if (!comp) throw new SetupError("not_found", competitionId);
  if (!homeId || !awayId || homeId === awayId) throw new SetupError("two_different_teams");
  if (!state.data.teams.some((t) => t.id === homeId) || !state.data.teams.some((t) => t.id === awayId)) throw new SetupError("not_found", "team");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) throw new SetupError("date_required");
  const r = Math.max(1, Math.round(Number(round) || 1));
  const home = state.data.teams.find((t) => t.id === homeId);
  const nid = nextMatchId(state);
  const m = newMatch(nid(), competitionId, r, homeId, awayId, zonedIso(date, time, state.data.league.timeZone || "Europe/Lisbon"), clean(venue) || home.venue, clean(roundName) || null);
  const inComp = new Set(comp.teamIds || []);
  const teamIds = [...inComp, ...[homeId, awayId].filter((id) => !inComp.has(id))];
  const next = withData(state, { competitions: state.data.competitions.map((c) => (c.id === competitionId ? { ...c, teamIds: comp.kind === "cup" ? teamIds : c.teamIds, rounds: Math.max(c.rounds || 0, r) } : c)) });
  return { ...next, matches: [...state.matches, m] };
}

/** What is still missing to run the league, in the order to do it. */
export function setupSteps(state) {
  const d = state.data;
  return [
    { id: "league", done: Boolean(clean(d.league.name)), section: "setup" },
    { id: "competition", done: d.competitions.length > 0, section: "overview" },
    { id: "teams", done: d.teams.length >= 2 && d.competitions.some((c) => (c.teamIds || []).length >= 2), section: "registrations" },
    { id: "players", done: d.players.length > 0, section: "registrations" },
    { id: "calendar", done: state.matches.length > 0, section: "calendar" },
  ];
}

/** Moves a match that has not started to another day, time or ground. */
export function rescheduleMatch(state, { matchId, date, time, venue }) {
  const m = state.matches.find((x) => x.id === matchId);
  if (!m) throw new SetupError("not_found", matchId);
  if (m.state !== "scheduled") throw new SetupError("match_started");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) throw new SetupError("date_required");
  const kickoff = zonedIso(date, time, state.data.league.timeZone || "Europe/Lisbon");
  return { ...state, matches: state.matches.map((x) => (x.id === matchId ? { ...x, kickoff, venue: clean(venue) || x.venue } : x)) };
}

/** A notice shown to the fans on the league page (newest first). */
export function addAnnouncement(state, { title, body, at }) {
  const t = clean(title); const b = String(body ?? "").trim().slice(0, 1200);
  if (t.length < 2) throw new SetupError("title_required");
  if (!b) throw new SetupError("body_required");
  const taken = new Set(state.announcements.map((a) => a.id)); let n = state.announcements.length + 1;
  while (taken.has(`a${n}`)) n++;
  return { ...state, announcements: [{ id: `a${n}`, at: at || new Date().toISOString(), title: t.slice(0, 120), body: b }, ...state.announcements] };
}

/** The league's logo (a small PNG data URL) and colour. Passing null clears. */
export function setLeagueBrand(state, { logo, color }) {
  const ok = /^#[0-9A-Fa-f]{6}$/.test(color || "");
  const league = { ...state.data.league };
  if (logo !== undefined) { if (logo) league.logo = logo; else delete league.logo; }
  if (color !== undefined) { if (ok) league.color = color.toUpperCase(); else if (!color) delete league.color; }
  return withData(state, { league });
}

/** A team's emblem (a small PNG data URL). Passing null clears. */
export function setTeamLogo(state, teamId, logo) {
  if (!state.data.teams.some((t) => t.id === teamId)) throw new SetupError("not_found", teamId);
  return withData(state, { teams: state.data.teams.map((t) => { if (t.id !== teamId) return t; const next = { ...t }; if (logo) next.logo = logo; else delete next.logo; return next; }) });
}

/** The guided start is over (finished or skipped): the league opens on its Painel from now on. */
export function finishOnboarding(state) {
  return { ...state, setup: { ...(state.setup || {}), done: true } };
}
