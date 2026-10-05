// Treinador Adjunto — the team-proposal round trip (decisions 3–6), with
// I/O through an injected env (store, sendDm, postGroup, cfg). Used by the
// proactive tick (T-24h), the fast-path commands and the agent's tools.
//
// Proposal kind "teams", payload:
//   { stage: "short_ask" | "card" | "adjust", teams, roster: [uuid…],
//     numTeams, md5, mirrored, fromApp, diff? }
// precondition: { cycle, status }
// md5 = games.teams md5 as last seen/written (adjunto_teams_md5) → the CAS
// in adjunto_apply_teams protects edits made in the app meanwhile.
import { proposeTeams, applyTeamsCommand, renderTeamsCard, rosterDiff, adjustTeams, lineup } from "./teams.js";
import { T } from "./texts.js";
import { formatGameWhen } from "../time.js";

const H = 36e5;
const expiryFor = (game) => new Date(Math.max(Date.now() + H, new Date(game.scheduled_at).getTime())).toISOString();
const cycleOf = (game) => game.cycle_opened_at ?? null;

export function cardText(ctx, payload, lang) {
  return renderTeamsCard({ teams: payload.teams, players: ctx.playing, summaries: ctx.summaries, lang, confirmed: ctx.playing.length, spots: ctx.spots, fromApp: payload.fromApp });
}

/** Mirror the draft into games.teams (teams_confirmed=false) — only when the
 *  game had no teams, or we wrote the current ones ourselves. */
async function mirror(env, { link, game, payload }) {
  if (!env.cfg.adjuntoAutosend) return { ...payload, mirrored: false };
  if (!payload.mirrored && game.teams) return payload; // app's draft: keep it until approval
  const r = await env.store.applyTeams({ gameId: game.id, teams: payload.teams, expectedMd5: payload.md5, actor: link.player_id, confirm: false });
  if (r?.ok) return { ...payload, md5: r.md5, mirrored: true };
  return { ...payload, conflict: r?.reason ?? "error", currentMd5: r?.md5 };
}

/** "Faltam N — proponho ou espero?" (decision 3). */
export async function askShort(env, { link, ctx, lang }) {
  const { game } = ctx;
  const proposal = await env.store.createProposal({
    linkId: link.id, groupId: ctx.group.id, gameId: game.id, cycle: cycleOf(game), kind: "teams",
    payload: { stage: "short_ask", roster: ctx.playing.map((p) => p.uuid) }, precondition: { cycle: cycleOf(game) }, expiresAt: expiryFor(game),
  });
  return { proposal, text: T(lang).teams.shortAsk(ctx.playing.length, ctx.spots, formatGameWhen(game.scheduled_at, lang === "en" ? "en" : "pt")) };
}

/** Build (or rebuild) the validation card proposal. */
export async function startCard(env, { link, ctx, lang, numTeams = null, forceRedraw = false }) {
  const { game } = ctx;
  const fmtTeams = ctx.group.game_format?.night?.teams;
  const n = numTeams ?? (Array.isArray(game.teams) && game.teams.length >= 2 ? game.teams.length : fmtTeams ?? 2);
  const { teams, fromApp } = proposeTeams({ players: ctx.playing, numTeams: n, appTeams: forceRedraw ? null : game.teams, rng: env.rng });
  const md5 = await env.store.teamsMd5(game.id);
  let payload = { stage: "card", teams, roster: ctx.playing.map((p) => p.uuid), numTeams: teams.length, md5, mirrored: false, fromApp };
  if (!fromApp) payload = await mirror(env, { link, game, payload });
  delete payload.conflict; delete payload.currentMd5;
  const proposal = await env.store.createProposal({
    linkId: link.id, groupId: ctx.group.id, gameId: game.id, cycle: cycleOf(game), kind: "teams",
    payload, precondition: { cycle: cycleOf(game) }, expiresAt: expiryFor(game),
  });
  return { proposal, text: cardText(ctx, payload, lang) };
}

/** swap / separate / move / redraw on a pending card. */
export async function editCard(env, { link, ctx, proposal, cmd, lang }) {
  const t = T(lang).teams;
  const r = applyTeamsCommand(proposal.payload.teams, cmd, ctx.playing, { rng: env.rng });
  if (r.error === "ambiguous") return { text: t.ambiguous(r.ref, r.options) };
  if (r.error) return { text: t.unknownPlayer(r.ref) };
  let payload = { ...proposal.payload, teams: r.teams, numTeams: r.teams.length, fromApp: false };
  payload = await mirror(env, { link, game: ctx.game, payload });
  if (payload.conflict === "teams_changed") return startFromApp(env, { link, ctx, lang });
  if (payload.conflict) return { text: t.gameLocked };
  await env.store.updateProposal(proposal.id, { payload });
  return { text: cardText(ctx, payload, lang) };
}

async function startFromApp(env, { link, ctx, lang }) {
  const fresh = await env.loadGroupCtx(ctx.group.id);
  const { text } = await startCard(env, { link, ctx: fresh, lang });
  return { text: `${T(lang).teams.changedInApp}\n\n${text}` };
}

/** "ok" on a card: CAS-confirm, first approval wins (decision 4), then ask
 *  "publico no grupo?" (decision 5). Returns { text, notify: [{link, text}] }. */
export async function approve(env, { link, ctx, proposal, lang, actorNick }) {
  const t = T(lang).teams;
  const { game } = ctx;
  if (!game || !["open", "full"].includes(game.status) || game.live_matchday) {
    await env.store.setProposalStatus(proposal.id, "failed", { decidedBy: link.player_id, error: "game_locked" });
    return { text: t.gameLocked, notify: [] };
  }
  if ((proposal.precondition?.cycle ?? null) !== cycleOf(game)) {
    await env.store.setProposalStatus(proposal.id, "failed", { decidedBy: link.player_id, error: "cycle_changed" });
    return { text: T(lang).failedState, notify: [] };
  }
  if (game.teams_confirmed) {
    await env.store.setProposalStatus(proposal.id, "superseded", { decidedBy: link.player_id, error: "confirmed_in_app" });
    return { text: t.confirmedInApp, notify: [] };
  }
  const payload = proposal.payload;
  if (!env.cfg.adjuntoAutosend) {
    env.log(`[adjunto dry-run] would confirm teams on game ${game.id} as ${link.player_id}`);
  } else {
    const r = await env.store.applyTeams({ gameId: game.id, teams: payload.teams, expectedMd5: payload.md5, actor: link.player_id, confirm: true });
    if (!r?.ok && r?.reason === "teams_changed") {
      await env.store.setProposalStatus(proposal.id, "failed", { decidedBy: link.player_id, error: "teams_changed" });
      const again = await startFromApp(env, { link, ctx, lang });
      return { text: again.text, notify: [] };
    }
    if (!r?.ok) {
      await env.store.setProposalStatus(proposal.id, "failed", { decidedBy: link.player_id, error: r?.reason ?? "error" });
      return { text: r?.reason === "actor_not_manager" ? T(lang).notManager : t.gameLocked, notify: [] };
    }
  }
  const won = await env.store.setProposalStatus(proposal.id, "executed", { decidedBy: link.player_id, error: env.cfg.adjuntoAutosend ? null : "dry_run" });
  if (!won) return { text: t.confirmedInApp, notify: [] };

  // First approval wins: the other managers' pending cards for this game are superseded.
  const notify = [];
  for (const other of (await env.store.pendingForGame(game.id, "teams")) ?? []) {
    if (other.link_id === link.id) continue;
    if (await env.store.setProposalStatus(other.id, "superseded", { decidedBy: link.player_id, error: "approved_by_other" })) notify.push({ linkId: other.link_id, kind: "byOther", nick: actorNick });
  }
  await env.store.createProposal({
    linkId: link.id, groupId: ctx.group.id, gameId: game.id, cycle: cycleOf(game), kind: "publish_teams",
    payload: { lineup: lineup(payload.teams, ctx.playing) }, precondition: { cycle: cycleOf(game) }, expiresAt: expiryFor(game),
  });
  return { text: `${t.approved}\n${t.askPublish}`, notify };
}

/** "sim" to "publico no grupo?" — lineup only (decision 5). */
export async function publish(env, { link, ctx, proposal, lang }) {
  const t = T(lang);
  const r = await env.postGroup(ctx.group, ctx.game?.id ?? null,
    { kind: "teams_confirmed", key: `teams_confirmed:${ctx.game?.id}:${cycleOf(ctx.game ?? {}) ?? "once"}:${proposal.id}`, bypassCap: true },
    { teams: proposal.payload.lineup });
  await env.store.setProposalStatus(proposal.id, r === "sent" || r === "dry" ? "executed" : "failed", { decidedBy: link.player_id, error: r === "sent" ? null : r });
  return { text: groupResultText(t, r, t.teams.published) };
}

export function groupResultText(t, r, okText) {
  if (r === "sent") return okText;
  if (r === "dry") return `${okText} ${t.dryRun}`;
  if (r === "quiet") return t.group.quiet;
  if (r === "no_bot") return t.group.noBot;
  if (r === "skipped") return t.group.already;
  return t.error;
}

/** Tick: roster changed after the proposal → supersede and ask "ajusto?"
 *  (decision 3). Returns a DM text or null. */
export async function rosterCheck(env, { link, ctx, proposal, lang }) {
  const now = ctx.playing.map((p) => p.uuid);
  const diff = rosterDiff(proposal.payload.roster ?? [], now);
  if (!diff.out.length && !diff.in.length) return null;
  if (proposal.payload.stage === "short_ask") {
    await env.store.updateProposal(proposal.id, { payload: { ...proposal.payload, roster: now } });
    return null; // still waiting on "propõe/espera"; nothing to adjust yet
  }
  const allByUuid = new Map(ctx.players.map((p) => [p.uuid, p]));
  const nick = (u) => allByUuid.get(u)?.nick ?? "?";
  const teams = adjustTeams(proposal.payload.teams, diff, allByUuid, ctx.playing);
  await env.store.setProposalStatus(proposal.id, "superseded", { error: "roster_changed" });
  await env.store.createProposal({
    linkId: link.id, groupId: ctx.group.id, gameId: ctx.game.id, cycle: cycleOf(ctx.game), kind: "teams",
    payload: { ...proposal.payload, stage: "adjust", teams, roster: now, diff }, precondition: proposal.precondition, expiresAt: expiryFor(ctx.game),
  });
  return T(lang).teams.diff(diff.out.map(nick), diff.in.map(nick));
}

/** "sim" to "ajusto?" → show the adjusted card. */
export async function acceptAdjust(env, { link, ctx, proposal, lang }) {
  let payload = { ...proposal.payload, stage: "card", fromApp: false };
  payload = await mirror(env, { link, game: ctx.game, payload });
  if (payload.conflict === "teams_changed") return startFromApp(env, { link, ctx, lang });
  delete payload.conflict;
  await env.store.updateProposal(proposal.id, { payload });
  return { text: cardText(ctx, payload, lang) };
}
