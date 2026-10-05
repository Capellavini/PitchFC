// Treinador Adjunto — the agent's tools (plan §7.3). Read tools return
// compact JSON computed by core; write tools NEVER write: they create a
// pending proposal and return its confirmation prompt. Execution happens
// only in actions.decide after the organizer's "sim" (commands.js).
// group_id is never an input: tools act on link.active_group_id.
//
// Schemas use strict:true, additionalProperties:false and every property
// required (nullable = ["type","null"]). Range checks live in the handlers
// (strict schemas don't carry numeric/string constraints).
import { computeTable, playoffState } from "../core/standings.js";
import { impactoOf, gkScoreOf, reliabilityOf, formaOf, isHot, recentDaysOf, performanceGapFn, togetherStats, podiumTop3, playerKey } from "../core/rankings.js";
import { validateFormat, describeFormat, defaultFormat } from "../core/format.js";
import { lateConfirmers, displayOvr } from "../core/insights.js";
import { resolveNick } from "./commands.js";
import * as teamsflow from "./teamsflow.js";
import { hoursToKickoff } from "./data.js";
import { normalize } from "./identity.js";
import { formatGameWhen, lisbonDateAt, nextLisbonWeekdayAt, lisbonDayKey } from "../time.js";

const H = 36e5;
const obj = (properties) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
const SINCE = { type: "string", enum: ["season", "30d", "90d", "last_n"] };
const N_NULL = { type: ["integer", "null"] };

const FORMAT_SCHEMA = obj({
  type: { type: "string", enum: ["avulso", "campeonato", "custom"] },
  night: obj({
    teams: { type: "integer", description: "2-6" },
    playersPerTeam: { type: "integer", description: "1-11" },
    schedule: { type: "string", enum: ["manual", "round_robin", "winner_stays", "fixed"] },
    legs: { type: "integer", description: "1 = single round robin, 2 = home and away" },
    fixedGames: N_NULL,
    winnerStays: obj({ maxConsecutive: { type: "integer" }, onDraw: { type: "string", enum: ["both_off", "challenger_stays", "longest_on_off"] } }),
    gameMinutes: { type: "integer" },
    goalCap: N_NULL,
  }),
  points: obj({ win: { type: "integer" }, draw: { type: "integer" }, loss: { type: "integer" } }),
  tiebreakers: { type: "array", items: { type: "string", enum: ["pts", "gd", "gf", "h2h", "wins", "ga_fewest", "lots"] } },
  playoffs: obj({ enabled: { type: "boolean" }, qualifiers: { type: "integer" }, byeTop: { type: "boolean" }, thirdPlace: { type: "boolean" }, penalties: { type: "boolean" } }),
});

const DEFS = [
  ["get_roster", "Group roster: player_id (uuid), nick, position, ovr (ovr_rated=false means fewer than 3 peer ratings: show it as e.g. \"70?\"), player_type, role, injured.", obj({})],
  ["get_attendance_status", "Next game: when, venue, spots, who is playing / waiting list / pending / declined, hours to kickoff.", obj({})],
  ["get_player_stats", "Stats per player (player=null for everyone). since: season | 30d | 90d | last_n (with n).", obj({ player: { type: ["string", "null"] }, since: SINCE, n: N_NULL })],
  ["get_together_stats", "How 2-5 players did when on the same team (games, wins, goals for/against).", obj({ players: { type: "array", items: { type: "string" } }, since: SINCE, n: N_NULL })],
  ["get_form", "Recent form (last 5 matchdays) and 'in form' flag; performance_gap_pct is ORGANIZER-ONLY.", obj({ player: { type: ["string", "null"] } })],
  ["get_standings", "Night table. scope tonight = the live matchday in the app; last_night = the last finished matchday.", obj({ scope: { type: "string", enum: ["tonight", "last_night"] } })],
  ["get_format", "The group's saved game format and its description.", obj({})],
  ["get_history", "Last n (1-12) finished matchdays: date, games, goals, results, top 3.", obj({ n: { type: "integer" } })],
  ["get_payments", "Current game payments: price each, who paid, who hasn't.", obj({})],
  ["get_late_confirmers", "Who usually confirms late, from the confirmation log (needs ≥3 weekly cycles).", obj({ cycles: { type: "integer" } })],
  ["get_team_proposal", "The current pending team proposal card for the next game, if any.", obj({})],
  ["switch_group", "Switch the group I'm focused on (only groups the organizer manages). Executes immediately.", obj({ group: { type: "string" } })],
  ["set_prefs", "Organizer preferences (no confirmation): proactive messages on/off, hours before kickoff to propose teams, DM language pt|ptbr|en. null = unchanged.", obj({ proactive: { type: ["boolean", "null"] }, teams_lead_hours: N_NULL, lang: { type: ["string", "null"] } })],
  ["set_format", "PROPOSE saving the group's game format (needs the organizer's yes). 'campeonato' is the night table only, there is no season league.", FORMAT_SCHEMA],
  ["propose_teams", "PROPOSE balanced teams for the next game (validation card; organizer approves with ok).", obj({ num_teams: N_NULL })],
  ["swap_players", "Swap two players between teams in the pending proposal.", obj({ a: { type: "string" }, b: { type: "string" } })],
  ["move_player", "Move a player to team number N (1-based) in the pending proposal.", obj({ player: { type: "string" }, team: { type: "integer" } })],
  ["redraw_teams", "Redraw the pending proposal (optionally with a different number of teams).", obj({ num_teams: N_NULL })],
  ["approve_teams", "Ask the organizer to approve the pending teams (they must reply ok). Does not approve by itself.", obj({})],
  ["send_group_reminder", "PROPOSE posting a reminder in the WhatsApp group (with_names: list who hasn't answered).", obj({ with_names: { type: "boolean" }, mention: { type: "boolean" } })],
  ["publish_open_spots", "PROPOSE posting open spots + the drop-in invite link in the group; extra_spots raises the number of spots.", obj({ extra_spots: N_NULL })],
  ["set_spots", "PROPOSE changing the number of spots (2-35) of the current game and the group default.", obj({ spots: { type: "integer" } })],
  ["change_game_time", "PROPOSE moving the game. date YYYY-MM-DD or weekday 0=Sun..6=Sat (or both null = same day), time HH:MM Lisbon. this_week_only=false also changes the recurring slot.", obj({ date: { type: ["string", "null"] }, weekday: N_NULL, time: { type: "string" }, this_week_only: { type: "boolean" } })],
  ["change_venue", "PROPOSE changing the venue (this week only, or the group default too).", obj({ venue: { type: "string" }, this_week_only: { type: "boolean" } })],
  ["mark_paid", "PROPOSE marking players as paid / unpaid for the current game.", obj({ players: { type: "array", items: { type: "string" } }, paid: { type: "boolean" } })],
  ["cancel_game", "PROPOSE cancelling the current game (the group is told automatically).", obj({ reason: { type: ["string", "null"] } })],
];

/** Tool definitions, sorted by name (stable prompt-cache prefix). */
export const TOOL_DEFS = DEFS.map(([name, description, input_schema]) => ({ name, description, input_schema, strict: true }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const WRITE_TOOLS = new Set(["set_format", "propose_teams", "swap_players", "move_player", "redraw_teams", "send_group_reminder", "publish_open_spots", "set_spots", "change_game_time", "change_venue", "mark_paid", "cancel_game"]);

// ── helpers ────────────────────────────────────────────────
const euros = (cents) => (cents / 100).toFixed(2).replace(".", ",");
const pick = (ctx, ref) => {
  const r = resolveNick(ref, ctx.players);
  if (r.player) return r.player;
  const byId = ctx.players.find((p) => p.uuid === ref);
  if (byId) return byId;
  throw new ToolError(r.ambiguous ? `ambiguous player "${ref}": ${r.ambiguous.join(", ")}` : `unknown player "${ref}" — use get_roster`);
};
export class ToolError extends Error {}

function windowed(summaries, since, n) {
  if (since === "last_n") return summaries.slice(0, Math.max(1, Math.min(12, n || 5)));
  if (since === "30d" || since === "90d") {
    const cut = Date.now() - (since === "30d" ? 30 : 90) * 864e5;
    return summaries.filter((s) => new Date(s.date).getTime() >= cut);
  }
  return summaries;
}

function statsFromSummaries(p, days) {
  const key = playerKey(p);
  const acc = { games: 0, goals: 0, assists: 0, wins: 0, clean_sheets: 0, epic_saves: 0 };
  for (const d of days) {
    const l = (d.summary?.lines ?? []).find((x) => x.key === key);
    if (!l) continue;
    acc.games++; acc.goals += l.goals || 0; acc.assists += l.assists || 0; acc.wins += l.wins || 0;
    acc.clean_sheets += l.cleanSheets || 0; acc.epic_saves += l.epicSaves || 0;
  }
  return acc;
}

/** Table from a finished matchday summary (matches by team name). */
function tableFromSummary(summary, fmt) {
  const ms = (summary?.matches ?? []).filter((m) => m.stage !== "playoff");
  const names = [...new Set(ms.flatMap((m) => [m.homeName, m.awayName]).filter((x) => x && x !== "—"))];
  const matches = ms.map((m) => ({ homeId: m.homeName, awayId: m.awayName,
    events: [...Array(m.homeGoals || 0)].map(() => ({ teamId: m.homeName })).concat([...Array(m.awayGoals || 0)].map(() => ({ teamId: m.awayName }))) }));
  return computeTable(names, matches, { points: fmt.points, tiebreakers: fmt.tiebreakers.filter((x) => x !== "lots") });
}

const row = (r, name) => ({ team: name ?? r.name ?? r.id, played: r.j, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts });

// ── handlers ───────────────────────────────────────────────
// tc = { env, link, me, lang, groupId, ctx(), created: [] }
const H_ = {
  async get_roster(_, tc) {
    const ctx = await tc.ctx();
    return ctx.players.map((p) => { const o = displayOvr(p); return { player_id: p.uuid, nick: p.nick, position: p.position ?? null, ovr: o.ovr, ovr_rated: o.rated, player_type: p.playerType, role: p.role, injured: p.injured }; });
  },
  async get_attendance_status(_, tc) {
    const ctx = await tc.ctx();
    const g = ctx.game;
    if (!g) return { game: null };
    const h = hoursToKickoff(g, tc.env.now());
    const nick = (xs) => xs.map((p) => p.nick);
    return { game_id: g.id, when_iso: g.scheduled_at, when_label: formatGameWhen(g.scheduled_at, tc.lang === "en" ? "en" : "pt"), venue: g.venue ?? null, status: g.status,
      spots: ctx.spots, confirmed: ctx.confirmedCount, playing: nick(ctx.playing), waitlist: nick(ctx.waitlist), pending: nick(ctx.pending), declined: nick(ctx.declined),
      hours_to_kickoff: Math.round(h), teams: !g.teams ? "none" : g.teams_confirmed ? "confirmed" : "draft" };
  },
  async get_player_stats({ player, since, n }, tc) {
    const ctx = await tc.ctx();
    const ps = player ? [pick(ctx, player)] : ctx.players;
    const days = windowed(ctx.summaries, since, n);
    return ps.map((p) => {
      if (since === "season") {
        const games = p.gamesPlayed;
        return { nick: p.nick, since, games, goals: p.goals, assists: p.assists, wins: p.wins, win_pct: games ? Math.round((p.wins / games) * 100) : 0, mvps: p.mvps,
          clean_sheets: p.cleanSheets, epic_saves: p.epicSaves, impacto: Math.round(impactoOf(p) * 10) / 10, gk_score: gkScoreOf(p),
          reliability_pct: reliabilityOf(p, ctx.matchdaysCount ?? ctx.summaries.length), ovr: displayOvr(p).ovr };
      }
      const s = statsFromSummaries(p, days);
      return { nick: p.nick, since, matchdays_in_window: days.length, ...s, ovr: displayOvr(p).ovr };
    });
  },
  async get_together_stats({ players, since, n }, tc) {
    const ctx = await tc.ctx();
    if (!Array.isArray(players) || players.length < 2 || players.length > 5) throw new ToolError("players: 2 to 5 names");
    const ps = players.map((r) => pick(ctx, r));
    const s = togetherStats(ps.map(playerKey), windowed(ctx.summaries, since, n));
    return { players: ps.map((p) => p.nick), games_together: s.gamesTogether, wins_together: s.winsTogether, goals_for: s.goalsFor, goals_against: s.goalsAgainst };
  },
  async get_form({ player }, tc) {
    const ctx = await tc.ctx();
    const recent = recentDaysOf(ctx.summaries);
    const gap = performanceGapFn(ctx.players);
    const ps = player ? [pick(ctx, player)] : ctx.players;
    return ps.map((p) => ({ nick: p.nick, forma: Math.round(formaOf(p, recent) * 10) / 10,
      recent_days: recent.filter((d) => (d.summary?.lines ?? []).some((l) => l.key === p.uuid)).length,
      hot: isHot(p, recent), performance_gap_pct: gap(p), dm_only: true }));
  },
  async get_standings({ scope }, tc) {
    const ctx = await tc.ctx();
    const fmt = validateFormat(ctx.group.game_format ?? defaultFormat("campeonato")).format ?? defaultFormat("campeonato");
    if (scope === "tonight") {
      const md = ctx.game?.live_matchday;
      if (!md) return { live: false };
      const teams = (md.teams ?? ctx.game.teams ?? []).map((t) => ({ id: t.id, name: t.name }));
      const points = md.config?.points ?? fmt.points;
      const tiebreakers = md.config?.tiebreakers ?? fmt.tiebreakers;
      const matches = (md.matches ?? []).filter((m) => m.stage !== "playoff" && !m.isBye);
      const table = computeTable(teams, matches, { points, tiebreakers, seed: ctx.game.id }).map((r) => row(r));
      const po = playoffState(md);
      const name = (id) => teams.find((t) => t.id === id)?.name ?? null;
      return { live: true, mode: md.mode ?? null, matches_played: matches.length, table, playoff_round: po.currentRound, champion: name(po.champion) };
    }
    const last = ctx.matchdays[0];
    if (!last) return { last_night: null };
    return { date: last.played_on, table: tableFromSummary(last.summary, fmt).map((r) => row(r, r.id)) };
  },
  async get_format(_, tc) {
    const ctx = await tc.ctx();
    const v = ctx.group.game_format ? validateFormat(ctx.group.game_format) : null;
    return v?.ok ? { set: true, format: v.format, description: describeFormat(v.format, tc.lang) } : { set: false };
  },
  async get_history({ n }, tc) {
    const ctx = await tc.ctx();
    return ctx.matchdays.slice(0, Math.max(1, Math.min(12, n || 3))).map((m) => ({
      date: m.played_on, n_games: m.n_games, total_goals: m.total_goals,
      results: (m.summary?.matches ?? []).map((x) => `${x.homeName} ${x.homeGoals}-${x.awayGoals} ${x.awayName}`),
      top: podiumTop3(m.summary?.lines).map((l) => ({ nick: l.nick, goals: l.goals || 0, assists: l.assists || 0 })),
    }));
  },
  async get_payments(_, tc) {
    const ctx = await tc.ctx();
    const g = ctx.game;
    if (!g) return { game: null };
    const paid = new Set(ctx.attendances.filter((a) => a.paid).map((a) => a.player_id));
    const each = g.total_cost_cents ? Math.round(g.total_cost_cents / ctx.spots) : null;
    const unpaid = ctx.playing.filter((p) => !paid.has(p.uuid));
    return { price_each_cents: each, price_each_eur: each == null ? null : euros(each), paid: ctx.playing.filter((p) => paid.has(p.uuid)).map((p) => p.nick),
      unpaid: unpaid.map((p) => p.nick), total_due_cents: each == null ? null : each * unpaid.length, total_due_eur: each == null ? null : euros(each * unpaid.length) };
  },
  async get_late_confirmers({ cycles }, tc) {
    const ctx = await tc.ctx();
    const log = await tc.env.store.attendanceLog(ctx.group.id);
    const keep = new Set([...new Set(log.map((r) => String(r.cycle_opened_at ?? r.kickoff)))].slice(-Math.max(3, Math.min(12, cycles || 6))));
    const r = lateConfirmers(log.filter((x) => keep.has(String(x.cycle_opened_at ?? x.kickoff))));
    if (r.insufficient) return { insufficient_data: true, cycles_logged: r.cycles };
    const nick = (id) => ctx.players.find((p) => p.uuid === id)?.nick;
    return r.rows.filter((x) => nick(x.playerId)).map((x) => ({ nick: nick(x.playerId), median_hours_before_kickoff: x.medianHoursBefore, late_pct: x.latePct, cycles: x.confirmations }));
  },
  async get_team_proposal(_, tc) {
    const ctx = await tc.ctx();
    const p = (await tc.env.store.pendingProposals(tc.link.id)).find((x) => x.kind === "teams" && x.game_id === ctx.game?.id);
    if (!p || p.payload?.stage !== "card") return { pending: false };
    return { pending: true, proposal_id: p.id, card: teamsflow.cardText(ctx, p.payload, tc.lang) };
  },
  async switch_group({ group }, tc) {
    const groups = await tc.env.store.managedGroups(tc.link.player_id);
    const n = normalize(group);
    const hit = groups.filter((g) => normalize(g.name) === n);
    const pref = hit.length ? hit : groups.filter((g) => normalize(g.name).includes(n));
    if (pref.length !== 1) return { switched: false, groups: groups.map((g) => g.name) };
    await tc.env.store.updateLink(tc.link.id, { active_group_id: pref[0].id });
    tc.link.active_group_id = pref[0].id;
    return { switched: true, group: pref[0].name };
  },
  async set_prefs({ proactive, teams_lead_hours, lang }, tc) {
    const prefs = { ...(tc.link.prefs ?? {}) };
    if (proactive !== null && proactive !== undefined) prefs.proactive = proactive;
    if (teams_lead_hours != null) prefs.teamsLeadHours = Math.max(3, Math.min(72, teams_lead_hours));
    const fields = { prefs };
    if (lang != null) { if (!["pt", "ptbr", "en"].includes(lang)) throw new ToolError("lang must be pt, ptbr or en"); fields.lang = lang; }
    await tc.env.store.updateLink(tc.link.id, fields);
    Object.assign(tc.link, fields);
    return { saved: true, prefs, lang: fields.lang ?? tc.link.lang ?? null };
  },

  // ── write tools: proposals only ─────────────────────────
  async set_format(input, tc) {
    const v = validateFormat({ v: 1, ...input });
    if (!v.ok) throw new ToolError(`invalid format: ${v.errors.join(", ")}`);
    return propose(tc, "set_format", { format: v.format }, {}, 24, describeFormat(v.format, tc.lang), false);
  },
  async propose_teams({ num_teams }, tc) {
    const ctx = await gameCtx(tc);
    if (ctx.playing.length < 4) throw new ToolError(`only ${ctx.playing.length} players confirmed`);
    const n = num_teams == null ? null : Math.max(2, Math.min(6, num_teams));
    const { proposal, text } = await teamsflow.startCard(tc.env, { link: tc.link, ctx, lang: tc.lang, numTeams: n, forceRedraw: n != null });
    tc.created.push({ id: proposal.id, kind: "teams", summary: "teams" });
    return { status: "pending_confirmation", proposal_id: proposal.id, card: text };
  },
  async swap_players({ a, b }, tc) { return editTeams(tc, { type: "swap", a, b }); },
  async move_player({ player, team }, tc) { return editTeams(tc, { type: "move", player, team }); },
  async redraw_teams({ num_teams }, tc) { return editTeams(tc, { type: "redraw", numTeams: num_teams }); },
  async approve_teams(_, tc) {
    const p = await pendingTeams(tc);
    return { status: "pending_confirmation", proposal_id: p.id, confirm_prompt: "Responde *ok* para confirmar as equipas." };
  },
  async send_group_reminder({ with_names }, tc) {
    const ctx = await gameCtx(tc);
    const summary = `lembrete no grupo (${ctx.confirmedCount}/${ctx.spots}${with_names ? `, sem resposta: ${ctx.pending.map((p) => p.nick).join(", ") || "—"}` : ""})`;
    return propose(tc, "group_reminder", { with_names: Boolean(with_names), mention: false }, gamePre(ctx), 2, summary);
  },
  async publish_open_spots({ extra_spots }, tc) {
    const ctx = await gameCtx(tc);
    const extra = extra_spots == null ? null : Math.max(1, Math.min(10, extra_spots));
    return propose(tc, "open_spots", { extra_spots: extra }, gamePre(ctx), 2, `abrir vagas no grupo${extra ? ` (+${extra} → ${ctx.spots + extra})` : ""}`);
  },
  async set_spots({ spots }, tc) {
    const ctx = await gameCtx(tc);
    if (!Number.isInteger(spots) || spots < 2 || spots > 35) throw new ToolError("spots must be 2-35");
    return propose(tc, "set_spots", { spots }, gamePre(ctx), 6, `vagas ${ctx.spots} → ${spots}`);
  },
  async change_game_time({ date, weekday, time, this_week_only }, tc) {
    const ctx = await gameCtx(tc);
    if (!/^\d{2}:\d{2}$/.test(time ?? "")) throw new ToolError("time must be HH:MM");
    let at;
    if (date) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ToolError("date must be YYYY-MM-DD"); at = lisbonDateAt(date, time); }
    else if (weekday != null) { if (weekday < 0 || weekday > 6) throw new ToolError("weekday 0-6"); at = nextLisbonWeekdayAt(weekday, time); }
    else at = lisbonDateAt(lisbonDayKey(new Date(ctx.game.scheduled_at)), time);
    if (at.getTime() < tc.env.now().getTime()) throw new ToolError("that time is in the past");
    const iso = at.toISOString();
    return propose(tc, "reschedule", { scheduled_at: iso, venue: null, this_week_only }, { ...gamePre(ctx), scheduled_at: ctx.game.scheduled_at }, 24,
      `jogo → ${formatGameWhen(iso, tc.lang === "en" ? "en" : "pt")}${this_week_only ? " (só esta semana)" : " (passa a ser o horário fixo)"}`);
  },
  async change_venue({ venue, this_week_only }, tc) {
    const ctx = await gameCtx(tc);
    const v = String(venue ?? "").trim().slice(0, 80);
    if (!v) throw new ToolError("venue required");
    return propose(tc, "reschedule", { scheduled_at: ctx.game.scheduled_at, venue: v, this_week_only }, { ...gamePre(ctx), scheduled_at: ctx.game.scheduled_at }, 24,
      `local → ${v}${this_week_only ? " (só esta semana)" : " (passa a ser o local habitual)"}`);
  },
  async mark_paid({ players, paid }, tc) {
    const ctx = await gameCtx(tc);
    if (!Array.isArray(players) || !players.length) throw new ToolError("players required");
    const ps = players.map((r) => pick(ctx, r));
    return propose(tc, "mark_paid", { player_ids: ps.map((p) => p.uuid), nicks: ps.map((p) => p.nick), paid }, gamePre(ctx), 24,
      `${ps.map((p) => p.nick).join(", ")} → ${paid ? "pago" : "por pagar"}`);
  },
  async cancel_game({ reason }, tc) {
    const ctx = await gameCtx(tc);
    return propose(tc, "cancel_game", { reason: reason ? String(reason).slice(0, 200) : null }, gamePre(ctx), 24,
      `cancelar o jogo de ${formatGameWhen(ctx.game.scheduled_at, tc.lang === "en" ? "en" : "pt")}`);
  },
};

async function gameCtx(tc) {
  const ctx = await tc.ctx();
  if (!ctx.game || !["open", "full"].includes(ctx.game.status)) throw new ToolError("no open game right now");
  return ctx;
}
const gamePre = (ctx) => ({ cycle: ctx.game.cycle_opened_at ?? null, status: ctx.game.status });

async function pendingTeams(tc) {
  const ctx = await gameCtx(tc);
  const p = (await tc.env.store.pendingProposals(tc.link.id)).find((x) => x.kind === "teams" && x.game_id === ctx.game.id && x.payload?.stage === "card");
  if (!p) throw new ToolError("no pending team proposal — call propose_teams first");
  return p;
}

async function editTeams(tc, cmd) {
  const p = await pendingTeams(tc);
  const ctx = await tc.ctx();
  const { text } = await teamsflow.editCard(tc.env, { link: tc.link, ctx, proposal: p, cmd, lang: tc.lang });
  return { status: "pending_confirmation", proposal_id: p.id, card: text };
}

async function propose(tc, kind, payload, precondition, hours, summary, needsGame = true) {
  const ctx = await tc.ctx();
  const proposal = await tc.env.store.createProposal({
    linkId: tc.link.id, groupId: ctx.group.id, gameId: needsGame ? ctx.game?.id ?? null : null, cycle: needsGame ? ctx.game?.cycle_opened_at ?? null : null,
    kind, payload, precondition, expiresAt: new Date(tc.env.now().getTime() + hours * H).toISOString(),
  });
  tc.created.push({ id: proposal.id, kind, summary });
  const ask = tc.lang === "en" ? "Confirm? (yes/no)" : "Confirmas? (sim/não)";
  return { status: "pending_confirmation", proposal_id: proposal.id, summary, confirm_prompt: `#${proposal.id} ${summary}. ${ask}` };
}

/** Run one tool call. Returns { content: string, is_error }. */
export async function runTool(name, input, tc) {
  const h = H_[name];
  if (!h) return { content: JSON.stringify({ error: `unknown tool ${name}` }), is_error: true };
  try {
    return { content: JSON.stringify(await h(input ?? {}, tc)), is_error: false };
  } catch (e) {
    return { content: JSON.stringify({ error: e instanceof ToolError ? e.message : "internal error" }), is_error: true, internal: !(e instanceof ToolError) ? e : null };
  }
}
