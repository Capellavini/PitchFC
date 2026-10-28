// Adjunto da Liga — what an open sentence or a document can become in the app.
//
// The model never writes anything. It proposes: "add this team", "move this
// match", "post this notice". Every proposal is resolved against the real
// league (names → ids, in code, never by the model), dry-run on a copy of the
// state, shown to the Gestor as a card, and applied only on confirmation.
// The same catalog serves the in-app chat and, later, the WhatsApp bot, so a
// proposal means the same thing in both. Pure: state in, state out.
import * as S from "./leagueSetup.js";
import { recordResult } from "./leagueResults.js";
import { SETUP_ERROR } from "./leagueSetupCopy.js";
import { MODULES, setModule, moduleOn } from "./leagueModules.js";

export class ProposalError extends Error {
  constructor(code, detail = "") { super(detail ? `${code}: ${detail}` : code); this.code = code; this.detail = detail; }
}

export const MAX_PROPOSALS = 60;

export const PROPOSAL_ERROR = Object.freeze({
  unknown_kind: "Não sei fazer isto.",
  team_missing: "Falta indicar a equipa.",
  team_unknown: "Não encontrei essa equipa na liga.",
  team_ambiguous: "Há mais de uma equipa com esse nome. Escreve o nome completo.",
  competition_missing: "Falta indicar a competição.",
  competition_unknown: "Não encontrei essa competição.",
  competition_ambiguous: "Há mais de uma competição com esse nome. Escreve o nome completo.",
  player_missing: "Falta indicar o atleta.",
  player_unknown: "Não encontrei esse atleta na equipa.",
  player_ambiguous: "Há mais de um atleta com esse nome na equipa.",
  match_unknown: "Não encontrei esse jogo no calendário.",
  match_ambiguous: "Há mais de um jogo entre estas equipas. Indica a jornada ou a competição.",
  module_unknown: "Não conheço esse módulo.",
  roster_empty: "Não há atletas para acrescentar.",
  score_missing: "Falta o resultado (golos de cada equipa).",
  same_team: "Escolhe duas equipas diferentes.",
  match_played: "Esse jogo já tem resultado. Para o corrigir usa Lances, com motivo.",
  match_unplayed_unknown: "Não encontrei um jogo por jogar entre estas equipas. Se for um jogo novo, marca-o primeiro.",
});

/** Human text for any error thrown while preparing a proposal. */
export function errorText(e) {
  if (e instanceof S.SetupError) return SETUP_ERROR[e.code] || "Não foi possível aplicar.";
  if (e instanceof ProposalError) return PROPOSAL_ERROR[e.code] || "Não foi possível aplicar.";
  return "Não foi possível aplicar.";
}

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const str = (v, n = 120) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : "");
const time = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim()); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""; };
const fmtDate = (d) => d.split("-").reverse().join("/");

/** One entry out of `list` for a free-text reference: exact first, then a
 *  unique partial match. Anything else is an error the Gestor can read. */
function pick(list, ref, keys, code) {
  const q = norm(ref);
  if (!q) throw new ProposalError(`${code}_missing`);
  const exact = list.filter((x) => keys(x).some((k) => norm(k) === q));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new ProposalError(`${code}_ambiguous`, ref);
  const loose = list.filter((x) => keys(x).some((k) => { const n = norm(k); return n.length >= 3 && (n.includes(q) || (n.length >= 4 && q.includes(n))); }));
  if (loose.length === 1) return loose[0];
  throw new ProposalError(loose.length ? `${code}_ambiguous` : `${code}_unknown`, ref);
}
const findTeam = (s, ref) => pick(s.data.teams, ref, (t) => [t.id, t.name, t.short], "team");
const findCompetition = (s, ref) => {
  if (!norm(ref) && s.data.competitions.length === 1) return s.data.competitions[0];
  return pick(s.data.competitions, ref, (c) => [c.id, c.name, c.short], "competition");
};
const findPlayer = (s, teamId, ref) => pick(s.data.players.filter((p) => p.teamId === teamId), ref, (p) => [p.id, p.name, p.nick], "player");

const POSITION_WORDS = [[/^gr$|guarda|goalkeeper|keeper|\bgk\b/, "GR"], [/^def|defesa|defender|lateral|central/, "DEF"], [/^med|medio|midfield|\bmid\b/, "MED"], [/^ava|avancado|ponta|atacante|forward|striker/, "AVA"]];
const position = (v) => { const q = norm(v); if (!q) return ""; return (POSITION_WORDS.find(([rx]) => rx.test(q)) || [])[1] || ""; };

function matchOf(s, a) {
  const home = findTeam(s, a.home), away = findTeam(s, a.away);
  const comp = norm(a.competition) ? findCompetition(s, a.competition) : null;
  let found = s.matches.filter((m) => [m.homeId, m.awayId].sort().join() === [home.id, away.id].sort().join());
  if (comp) found = found.filter((m) => m.competitionId === comp.id);
  if (a.round) found = found.filter((m) => m.round === a.round);
  if (found.length > 1) found = found.filter((m) => m.state === "scheduled");
  if (!found.length) throw new ProposalError("match_unknown");
  if (found.length > 1) throw new ProposalError("match_ambiguous");
  return { match: found[0], home, away };
}

const lisbonDay = (iso) => { try { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };

/** The match a played result belongs to: the two teams, any home/away order, a game still to be played.
 *  With several candidates (two legs, league and cup) the date, competition or round decides; never a guess. */
function playedMatchOf(s, a) {
  const x = findTeam(s, a.home), y = findTeam(s, a.away);
  if (x.id === y.id) throw new ProposalError("same_team");
  const comp = norm(a.competition) ? findCompetition(s, a.competition) : null;
  const between = s.matches.filter((m) => [m.homeId, m.awayId].sort().join() === [x.id, y.id].sort().join() && (!comp || m.competitionId === comp.id) && (!a.round || m.round === a.round));
  let open = between.filter((m) => ["scheduled", "live"].includes(m.state));
  if (!open.length) throw new ProposalError(between.length ? "match_played" : "match_unplayed_unknown");
  if (open.length > 1) {
    // Several games still to play (two legs, league and cup). With a day, the one on that day (or clearly nearest) wins;
    // without it, only a game whose time has already passed can be the one that was just played.
    if (a.date) {
      const exact = open.filter((m) => lisbonDay(m.kickoff) === a.date);
      if (exact.length === 1) open = exact;
      else {
        const ref = Date.parse(`${a.date}T12:00:00Z`);
        const ranked = open.map((m) => ({ m, d: Math.abs(Date.parse(m.kickoff) - ref) })).sort((p, q) => p.d - q.d);
        if (ranked[1].d - ranked[0].d < 2 * 864e5) throw new ProposalError("match_ambiguous");
        open = [ranked[0].m];
      }
    } else {
      const past = open.filter((m) => Date.parse(m.kickoff) <= Date.now());
      if (past.length !== 1) throw new ProposalError("match_ambiguous");
      open = past;
    }
  }
  return { match: open[0], x, y };
}

/** A person named in a sentence or on a sheet → { player, team } within the two teams of the match. */
function personIn(s, teams, ref, teamRef) {
  const pool = teamRef ? [findTeam(s, teamRef)] : teams;
  const hits = [];
  for (const tm of pool) {
    try { hits.push({ player: findPlayer(s, tm.id, ref), team: tm }); } catch (e) { if (e.code === "player_ambiguous") throw e; }
  }
  if (hits.length === 1) return hits[0];
  throw new ProposalError(hits.length ? "player_ambiguous" : "player_unknown", ref);
}

const obj = (properties, required = []) => ({ type: "object", additionalProperties: false, required, properties });
const text = (maxLength, description) => ({ type: "string", maxLength, ...(description ? { description } : {}) });

/** id → { label, description (for the model), schema, clean(args), run(state, args) → { state, line } } */
export const PROPOSALS = Object.freeze({
  set_league_info: {
    label: "Nome da liga",
    description: "Define ou corrige o nome e a cidade da liga.",
    schema: obj({ name: text(80), city: text(60) }, ["name"]),
    clean: (a) => ({ name: str(a.name, 80), city: str(a.city, 60) }),
    run: (s, a) => ({ state: S.setLeagueInfo(s, a), line: `Liga «${a.name}»${a.city ? ` · ${a.city}` : ""}` }),
  },
  add_competition: {
    label: "Nova competição",
    description: "Cria um campeonato (kind league, com 1 a 4 voltas) ou uma taça (kind cup).",
    schema: obj({ name: text(80), kind: { type: "string", enum: ["league", "cup"] }, legs: { type: "integer", minimum: 1, maximum: 4 }, season: text(20), sponsor: text(80) }, ["name", "kind"]),
    clean: (a) => ({ name: str(a.name, 80), kind: a.kind === "cup" ? "cup" : "league", legs: Math.min(4, Math.max(1, Math.round(Number(a.legs)) || 1)), season: str(a.season, 20), sponsor: str(a.sponsor, 80) }),
    run: (s, a) => ({ state: S.addCompetition(s, a), line: `${a.kind === "cup" ? "Taça" : "Campeonato"} «${a.name}»${a.kind === "league" ? ` · ${a.legs} ${a.legs === 1 ? "volta" : "voltas"}` : ""}` }),
  },
  add_team: {
    label: "Nova equipa",
    description: "Inscreve uma equipa. `competitions` são nomes de competições já existentes (ou criadas antes neste pedido); se só existir uma, pode ficar vazio.",
    schema: obj({ name: text(80), venue: text(80, "Campo onde joga em casa"), competitions: { type: "array", maxItems: 6, items: text(80) } }, ["name"]),
    clean: (a) => ({ name: str(a.name, 80), venue: str(a.venue, 80), competitions: (Array.isArray(a.competitions) ? a.competitions : []).slice(0, 6).map((x) => str(x, 80)).filter(Boolean) }),
    run: (s, a) => {
      const comps = a.competitions.length ? a.competitions.map((c) => findCompetition(s, c)) : (s.data.competitions.length === 1 ? [s.data.competitions[0]] : []);
      return { state: S.addTeam(s, { name: a.name, venue: a.venue, competitionIds: comps.map((c) => c.id) }), line: `Equipa «${a.name}»${comps.length ? ` em ${comps.map((c) => c.short || c.name).join(", ")}` : ""}` };
    },
  },
  add_players: {
    label: "Plantel",
    description: "Acrescenta atletas a uma equipa. Só nomes, número (opcional) e posição GR/DEF/MED/AVA (opcional). Nunca contactos, licenças ou datas de nascimento.",
    schema: obj({
      team: text(80),
      players: { type: "array", minItems: 1, maxItems: 40, items: obj({ name: text(80), number: { type: ["integer", "null"], minimum: 0, maximum: 999 }, position: text(20) }, ["name"]) },
    }, ["team", "players"]),
    clean: (a) => ({
      team: str(a.team, 80),
      players: (Array.isArray(a.players) ? a.players : []).slice(0, 40).map((p) => ({ name: str(p?.name, 80).replace(/[;,]/g, " "), number: Number.isInteger(p?.number) && p.number >= 0 && p.number <= 999 ? p.number : null, position: position(p?.position) })).filter((p) => p.name),
    }),
    run: (s, a) => {
      if (!a.players.length) throw new ProposalError("roster_empty");
      const team = findTeam(s, a.team);
      const lines = a.players.map((p) => [p.number, p.name, p.position].filter((x) => x !== null && x !== "").join(";")).join("\n");
      return { state: S.addPlayers(s, team.id, lines), line: `${a.players.length} ${a.players.length === 1 ? "atleta" : "atletas"} em «${team.name}»` };
    },
  },
  set_captain: {
    label: "Capitão",
    description: "Define o capitão de uma equipa já com plantel.",
    schema: obj({ team: text(80), player: text(80) }, ["team", "player"]),
    clean: (a) => ({ team: str(a.team, 80), player: str(a.player, 80) }),
    run: (s, a) => { const team = findTeam(s, a.team); const p = findPlayer(s, team.id, a.player); return { state: S.setCaptain(s, team.id, p.id), line: `Capitão de «${team.name}»: ${p.name}` }; },
  },
  generate_fixtures: {
    label: "Calendário",
    description: "Gera o calendário de um campeonato (todas as jornadas, ida e volta conforme as voltas). `times` são as horas dos jogos de cada jornada (HH:MM). Só se a competição ainda não tiver calendário.",
    schema: obj({ competition: text(80), start_date: text(10, "AAAA-MM-DD, data da primeira jornada"), times: { type: "array", minItems: 1, maxItems: 6, items: text(5) }, every_days: { type: "integer", minimum: 1, maximum: 30 } }, ["competition", "start_date"]),
    clean: (a) => ({ competition: str(a.competition, 80), start_date: date(a.start_date), times: (Array.isArray(a.times) ? a.times : []).map(time).filter(Boolean).slice(0, 6), every_days: Math.min(30, Math.max(1, Math.round(Number(a.every_days)) || 7)) }),
    run: (s, a) => {
      const comp = findCompetition(s, a.competition);
      const before = s.matches.length;
      const next = S.generateFixtures(s, { competitionId: comp.id, startDate: a.start_date, times: a.times.length ? a.times : ["15:00"], everyDays: a.every_days });
      const rounds = next.data.competitions.find((c) => c.id === comp.id).rounds;
      return { state: next, line: `Calendário de «${comp.short || comp.name}»: ${rounds} jornadas, ${next.matches.length - before} jogos, a partir de ${fmtDate(a.start_date)}` };
    },
  },
  add_match: {
    label: "Novo jogo",
    description: "Marca um jogo avulso (final, meia-final, amigável) ou acrescenta um jogo a uma taça.",
    schema: obj({ competition: text(80), home: text(80), away: text(80), date: text(10, "AAAA-MM-DD"), time: text(5, "HH:MM"), venue: text(80), round: { type: "integer", minimum: 1, maximum: 60 }, round_name: text(40, "ex.: Meias-finais, Final") }, ["home", "away", "date", "time"]),
    clean: (a) => ({ competition: str(a.competition, 80), home: str(a.home, 80), away: str(a.away, 80), date: date(a.date), time: time(a.time), venue: str(a.venue, 80), round: Number.isInteger(a.round) && a.round > 0 ? Math.min(60, a.round) : 1, round_name: str(a.round_name, 40) }),
    run: (s, a) => {
      const comp = findCompetition(s, a.competition); const home = findTeam(s, a.home); const away = findTeam(s, a.away);
      return { state: S.addMatch(s, { competitionId: comp.id, homeId: home.id, awayId: away.id, date: a.date, time: a.time, venue: a.venue, round: a.round, roundName: a.round_name }), line: `${a.round_name || "Jogo"}: ${home.name} – ${away.name}, ${fmtDate(a.date)} às ${a.time}` };
    },
  },
  reschedule_match: {
    label: "Mudar jogo",
    description: "Muda a data, a hora ou o campo de um jogo que ainda não começou. Identifica o jogo pelas duas equipas (e, se jogarem mais de uma vez, a jornada ou a competição).",
    schema: obj({ home: text(80), away: text(80), competition: text(80), round: { type: "integer", minimum: 1, maximum: 60 }, date: text(10, "AAAA-MM-DD"), time: text(5, "HH:MM"), venue: text(80) }, ["home", "away", "date", "time"]),
    clean: (a) => ({ home: str(a.home, 80), away: str(a.away, 80), competition: str(a.competition, 80), round: Number.isInteger(a.round) && a.round > 0 ? Math.min(60, a.round) : 0, date: date(a.date), time: time(a.time), venue: str(a.venue, 80) }),
    run: (s, a) => {
      const { match, home, away } = matchOf(s, a);
      return { state: S.rescheduleMatch(s, { matchId: match.id, date: a.date, time: a.time, venue: a.venue }), line: `${home.name} – ${away.name} passa para ${fmtDate(a.date)} às ${a.time}${a.venue ? ` · ${a.venue}` : ""}` };
    },
  },
  record_result: {
    label: "Resultado",
    description: "Lança o resultado de um jogo já jogado: as duas equipas (pela ordem em que foram nomeadas), os golos de cada uma, quem marcou e os cartões. É a ÚNICA forma de registar um resultado. Fica sempre PROVISÓRIO: a homologação é da direção. Usa os nomes tal como foram ditos; quem resolve atletas e jogo é o sistema. Não inventes marcadores nem cartões que não foram mencionados.",
    schema: obj({
      home: text(80, "Primeira equipa nomeada"), away: text(80, "Segunda equipa nomeada"),
      home_goals: { type: "integer", minimum: 0, maximum: 99 }, away_goals: { type: "integer", minimum: 0, maximum: 99 },
      competition: text(80), round: { type: "integer", minimum: 1, maximum: 60 }, date: text(10, "AAAA-MM-DD, dia do jogo, se for dito"),
      scorers: { type: "array", maxItems: 40, items: obj({ player: text(80), team: text(80), goals: { type: "integer", minimum: 1, maximum: 20 }, own_goal: { type: "boolean", description: "Autogolo: o golo conta para a outra equipa" } }, ["player"]) },
      cards: { type: "array", maxItems: 40, items: obj({ player: text(80), team: text(80), type: { type: "string", enum: ["yellow", "red", "second_yellow"] } }, ["player", "type"]) },
      appeared: { type: "array", maxItems: 2, description: "Quem jogou, só se vier numa súmula", items: obj({ team: text(80), players: { type: "array", maxItems: 40, items: text(80) } }, ["team", "players"]) },
    }, ["home", "away", "home_goals", "away_goals"]),
    clean: (a) => ({
      home: str(a.home, 80), away: str(a.away, 80),
      home_goals: Number.isInteger(a.home_goals) && a.home_goals >= 0 && a.home_goals <= 99 ? a.home_goals : null,
      away_goals: Number.isInteger(a.away_goals) && a.away_goals >= 0 && a.away_goals <= 99 ? a.away_goals : null,
      competition: str(a.competition, 80), round: Number.isInteger(a.round) && a.round > 0 ? Math.min(60, a.round) : 0, date: date(a.date),
      scorers: (Array.isArray(a.scorers) ? a.scorers : []).slice(0, 40).map((x) => ({ player: str(x?.player, 80), team: str(x?.team, 80), goals: Number.isInteger(x?.goals) ? Math.min(20, Math.max(1, x.goals)) : 1, own_goal: x?.own_goal === true })).filter((x) => x.player),
      cards: (Array.isArray(a.cards) ? a.cards : []).slice(0, 40).map((x) => ({ player: str(x?.player, 80), team: str(x?.team, 80), type: ["yellow", "red", "second_yellow"].includes(x?.type) ? x.type : "yellow" })).filter((x) => x.player),
      appeared: (Array.isArray(a.appeared) ? a.appeared : []).slice(0, 2).map((x) => ({ team: str(x?.team, 80), players: (Array.isArray(x?.players) ? x.players : []).slice(0, 40).map((p) => str(p, 80)).filter(Boolean) })).filter((x) => x.team),
    }),
    run: (s, a) => {
      if (a.home_goals === null || a.away_goals === null) throw new ProposalError("score_missing");
      const { match, x, y } = playedMatchOf(s, a);
      const goalsOf = { [x.id]: a.home_goals, [y.id]: a.away_goals };
      const teams = [x, y];
      const other = (id) => (id === x.id ? y : x);
      const goals = [];
      for (const sc of a.scorers) {
        const { player, team } = personIn(s, teams, sc.player, sc.team);
        for (let i = 0; i < sc.goals; i += 1) goals.push(sc.own_goal ? { teamId: other(team.id).id, playerId: player.id, own: true } : { teamId: team.id, playerId: player.id });
      }
      const cards = a.cards.map((c) => { const { player, team } = personIn(s, teams, c.player, c.team); return { teamId: team.id, playerId: player.id, type: c.type }; });
      const lineups = {}; const missing = [];
      for (const ap of a.appeared) {
        const tm = findTeam(s, ap.team);
        if (![match.homeId, match.awayId].includes(tm.id)) continue;
        lineups[tm.id] = [];
        for (const nm of ap.players) { try { lineups[tm.id].push(findPlayer(s, tm.id, nm).id); } catch { missing.push(nm); } }
      }
      const next = recordResult(s, {
        matchId: match.id, score: { home: goalsOf[match.homeId], away: goalsOf[match.awayId] }, goals, cards,
        lineups: Object.keys(lineups).length ? lineups : null, by: "Adjunto · confirmado pela direção", at: new Date().toISOString(),
      });
      const named = a.scorers.map((sc) => `${sc.own_goal ? "autogolo " : ""}${sc.player}${sc.goals > 1 ? ` (${sc.goals})` : ""}`).join(", ");
      const carded = a.cards.map((c) => `${c.player} (${c.type === "red" ? "vermelho" : c.type === "second_yellow" ? "2.º amarelo" : "amarelo"})`).join(", ");
      const unnamed = a.home_goals + a.away_goals - goals.length;
      return {
        state: next,
        line: `${x.name} ${a.home_goals}–${a.away_goals} ${y.name}${named ? ` · golos: ${named}` : ""}${unnamed > 0 ? (named ? ` · ${unnamed} sem marcador` : " · sem marcadores") : ""}${carded ? ` · cartões: ${carded}` : ""}${missing.length ? ` · fora do plantel: ${missing.join(", ")}` : ""} — fica por homologar`,
      };
    },
  },
  post_announcement: {
    label: "Comunicado",
    description: "Publica um comunicado da organização, visível aos adeptos na página da liga. Texto curto, factual, sem contactos.",
    schema: obj({ title: text(120), body: text(1200) }, ["title", "body"]),
    clean: (a) => ({ title: str(a.title, 120), body: typeof a.body === "string" ? a.body.trim().slice(0, 1200) : "" }),
    run: (s, a) => ({ state: S.addAnnouncement(s, a), line: `Comunicado «${a.title}»` }),
  },
  set_module: {
    label: "Módulo",
    description: `Liga ou desliga um módulo da liga. Módulos: ${MODULES.map((m) => m.id).join(", ")}.`,
    schema: obj({ module: { type: "string", enum: MODULES.map((m) => m.id) }, on: { type: "boolean" } }, ["module", "on"]),
    clean: (a) => ({ module: str(a.module, 30), on: a.on === true }),
    run: (s, a) => {
      const m = MODULES.find((x) => x.id === a.module);
      if (!m) throw new ProposalError("module_unknown", a.module);
      return { state: { ...s, modules: setModule(s.modules, a.module, a.on) }, line: `${a.on ? "Ligar" : "Desligar"} «${m.name}»` };
    },
  },
});

export const PROPOSAL_KINDS = Object.freeze(Object.keys(PROPOSALS));

/** Screens the Adjunto can send the Gestor to (the "orientações"). */
export const OPEN_SCREENS = Object.freeze({
  homologate: "Homologar", results: "Lançar resultado", contest: "Decidir contestação", live: "Abrir jogo", lineups: "Ver convocatórias", calendar: "Abrir calendário",
  discipline: "Ver disciplina", reports: "Fichas de jogo", recap: "Preparar resumo", setup: "Liga e módulos", registrations: "Equipas e atletas",
});

/** Cleans what the model sent for one proposal (shape and limits only). */
export function cleanProposal(kind, args) {
  const k = PROPOSALS[kind];
  if (!k) return null;
  try { return { kind, args: k.clean(args && typeof args === "object" ? args : {}) }; } catch { return null; }
}

/**
 * Dry-runs a batch, in order, each item on the state the previous ones left.
 * An item that cannot be applied is reported and skipped; the rest still go.
 * `state` in the result is the league after every item that works.
 * @param {{kind: string, args: object}[]} items
 */
export function prepareBatch(state, items) {
  let cur = state;
  const out = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, MAX_PROPOSALS)) {
    const k = PROPOSALS[it?.kind];
    if (!k) { out.push({ kind: String(it?.kind), ok: false, line: "—", error: PROPOSAL_ERROR.unknown_kind }); continue; }
    const args = k.clean(it.args && typeof it.args === "object" ? it.args : {});
    try {
      const r = k.run(cur, args);
      cur = r.state;
      out.push({ kind: it.kind, ok: true, line: r.line });
    } catch (e) {
      out.push({ kind: it.kind, ok: false, line: k.label + (args.name ? ` «${args.name}»` : args.team ? ` · ${args.team}` : ""), error: errorText(e) });
    }
  }
  return { items: out, state: cur, applied: out.filter((x) => x.ok).length, failed: out.filter((x) => !x.ok).length };
}

/**
 * What the model may know about the league: structure and counts, never
 * athlete names, contacts or licences.
 */
export function adjuntoContext(state, { now = Date.now() } = {}) {
  const d = state.data;
  const team = Object.fromEntries(d.teams.map((t) => [t.id, t.name]));
  const comp = Object.fromEntries(d.competitions.map((c) => [c.id, c.name]));
  const squad = {};
  for (const p of d.players) squad[p.teamId] = (squad[p.teamId] || 0) + 1;
  const byState = {};
  for (const m of state.matches) byState[m.state] = (byState[m.state] || 0) + 1;
  const upcoming = state.matches.filter((m) => m.state === "scheduled" && m.kickoff && Date.parse(m.kickoff) >= now - 36e5)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff)).slice(0, 12)
    .map((m) => ({ competition: comp[m.competitionId], round: m.round, home: team[m.homeId], away: team[m.awayId], kickoff: m.kickoff, venue: m.venue || null }));
  return {
    league: { name: d.league.name || null, city: d.league.city || null },
    competitions: d.competitions.slice(0, 12).map((c) => ({ name: c.name, kind: c.kind, legs: c.legs || null, teams: (c.teamIds || []).length, rounds: c.rounds || 0 })),
    teams: d.teams.slice(0, 80).map((t) => ({ name: t.name, venue: t.venue || null, athletes: squad[t.id] || 0, competitions: d.competitions.filter((c) => (c.teamIds || []).includes(t.id)).map((c) => c.name) })),
    today: lisbonDay(now),
    matches: { total: state.matches.length, byState },
    upcoming,
    awaitingResult: state.matches.filter((m) => m.state === "scheduled" && m.kickoff && Date.parse(m.kickoff) < now)
      .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff)).slice(0, 12)
      .map((m) => ({ competition: comp[m.competitionId], round: m.round, home: team[m.homeId], away: team[m.awayId], date: lisbonDay(m.kickoff) })),
    modulesOn: MODULES.filter((m) => moduleOn(state, m.id)).map((m) => m.id),
  };
}
