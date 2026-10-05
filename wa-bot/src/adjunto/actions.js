// Treinador Adjunto — executing a proposal after the organizer's explicit
// "sim" (parsed in commands.js, never by the model). Re-checks the
// precondition, then writes the SAME tables/columns/RPCs the app uses
// (plan §7.3). env is injected (store, postGroup, cfg, log, loadGroupCtx),
// so tests assert exact payloads with a fake store.
import * as teamsflow from "./teamsflow.js";
import { T } from "./texts.js";
import { validateFormat, describeFormat } from "../core/format.js";
import { formatGameWhen } from "../time.js";

const cycleOf = (game) => game?.cycle_opened_at ?? null;

/** Common precondition: the game a proposal was made for is still the same
 *  open/full game, in the same weekly cycle. */
export function gameStillValid(proposal, game) {
  if (!proposal.game_id) return true;
  if (!game || game.id !== proposal.game_id) return false;
  if (!["open", "full"].includes(game.status) || game.live_matchday) return false;
  const pc = proposal.precondition ?? {};
  if ("cycle" in pc && (pc.cycle ?? null) !== cycleOf(game)) return false;
  if (pc.scheduled_at && new Date(pc.scheduled_at).getTime() !== new Date(game.scheduled_at).getTime()) return false;
  return true;
}

/** Organizer said yes/no to `proposal`. Returns { text, notify: [] }. */
export async function decide(env, { link, proposal, decision, lang, ctx, me }) {
  const t = T(lang);
  if (decision === "no") {
    if (proposal.kind === "teams" && proposal.payload?.stage === "short_ask") {
      await env.store.setProposalStatus(proposal.id, "rejected", { decidedBy: link.player_id, error: "wait" });
      return { text: t.teams.waiting, notify: [] };
    }
    await env.store.setProposalStatus(proposal.id, "rejected", { decidedBy: link.player_id });
    return { text: proposal.kind === "publish_teams" ? t.teams.notPublished : t.rejected(proposal.id), notify: [] };
  }

  if (proposal.kind === "teams") {
    const stage = proposal.payload?.stage;
    if (stage === "short_ask") return { ...(await teamsflow.startCard(env, { link, ctx, lang })), notify: [] };
    if (stage === "adjust") return { ...(await teamsflow.acceptAdjust(env, { link, ctx, proposal, lang })), notify: [] };
    return teamsflow.approve(env, { link, ctx, proposal, lang, actorNick: me?.nick ?? "?" });
  }
  if (proposal.kind === "publish_teams") return { ...(await teamsflow.publish(env, { link, ctx, proposal, lang })), notify: [] };

  if (!gameStillValid(proposal, ctx.game)) {
    await env.store.setProposalStatus(proposal.id, "failed", { decidedBy: link.player_id, error: "precondition" });
    return { text: t.failedState, notify: [] };
  }
  return { text: await execute(env, { link, proposal, ctx, lang }), notify: [] };
}

const done = async (env, link, proposal, okText, lang) => {
  const dry = !env.cfg.adjuntoAutosend;
  await env.store.setProposalStatus(proposal.id, "executed", { decidedBy: link.player_id, error: dry ? "dry_run" : null });
  return dry ? `${okText} ${T(lang).dryRun}` : okText;
};

async function execute(env, { link, proposal, ctx, lang }) {
  const t = T(lang);
  const p = proposal.payload ?? {};
  const { group, game } = ctx;
  const live = env.cfg.adjuntoAutosend;
  const would = (what) => env.log(`[adjunto dry-run] would ${what} (proposal #${proposal.id})`);

  switch (proposal.kind) {
    case "set_format": {
      const v = validateFormat(p.format);
      if (!v.ok) { await env.store.setProposalStatus(proposal.id, "failed", { error: v.errors.join(",") }); return t.error; }
      if (live) await env.store.setGameFormat(group.id, v.format); else would(`set game_format on ${group.id}`);
      return done(env, link, proposal, t.ob.saved(describeFormat(v.format, lang)), lang);
    }
    case "set_spots": {
      if (live) await env.store.setSpots(group.id, game?.id ?? null, p.spots); else would(`set spots=${p.spots}`);
      return done(env, link, proposal, t.done(`${p.spots}`), lang);
    }
    case "mark_paid": {
      if (live) await env.store.setPaid(game.id, p.player_ids, p.paid); else would(`set paid=${p.paid} for ${p.player_ids.length}`);
      return done(env, link, proposal, t.done(p.nicks.join(", ")), lang);
    }
    case "cancel_game": {
      if (live && !(await env.store.cancelGame(game.id))) {
        await env.store.setProposalStatus(proposal.id, "failed", { error: "not_open" });
        return t.failedState;
      }
      if (!live) would(`cancel game ${game.id}`);
      // The group's "cancelled" message comes from events.js on the next poll (no duplicate here).
      return done(env, link, proposal, t.done("❌"), lang);
    }
    case "reschedule": {
      if (live) {
        const r = await env.store.rescheduleGame({
          gameId: game.id, scheduledAt: p.scheduled_at, thisWeekOnly: p.this_week_only, venue: p.venue ?? null,
          expectedScheduledAt: proposal.precondition?.scheduled_at ?? null, actor: link.player_id,
        });
        if (!r?.ok) { await env.store.setProposalStatus(proposal.id, "failed", { error: r?.reason ?? "error" }); return t.failedState; }
      } else would(`reschedule game ${game.id} → ${p.scheduled_at}${p.venue ? ` @ ${p.venue}` : ""}`);
      await env.store.setProposalStatus(proposal.id, "executed", { decidedBy: link.player_id, error: live ? null : "dry_run" });
      const newGame = { ...game, scheduled_at: p.scheduled_at, venue: p.venue ?? game.venue };
      const r = await env.postGroup(group, game.id, { kind: "rescheduled", key: `rescheduled:${game.id}:${p.scheduled_at}:${p.venue ?? ""}`, urgent: true }, { game: newGame });
      return teamsflow.groupResultText(t, r, t.done(formatGameWhen(p.scheduled_at, lang === "en" ? "en" : "pt")));
    }
    case "group_reminder": {
      const r = await env.postGroup(group, game.id, { kind: "adj_reminder", key: `adj_reminder:${game.id}:${cycleOf(game) ?? "once"}`, bypassCap: true },
        { game, confirmed: ctx.confirmedCount, spots: ctx.spots, pending: p.with_names ? ctx.pending.map((x) => x.nick) : [] });
      if (r === "sent") await env.suppressAutoReminder?.(group, game); // the automatic 24h one won't repeat it
      await env.store.setProposalStatus(proposal.id, r === "sent" || r === "dry" ? "executed" : "failed", { decidedBy: link.player_id, error: r === "sent" ? null : r });
      return teamsflow.groupResultText(t, r, t.group.sent);
    }
    case "open_spots": {
      let spots = ctx.spots;
      if (p.extra_spots) {
        spots += p.extra_spots;
        if (live) await env.store.setSpots(group.id, game.id, spots); else would(`raise spots to ${spots}`);
      }
      const token = group.invite_token_avulso || group.invite_token;
      const r = await env.postGroup(group, game.id, { kind: "open_spots", key: `open_spots:${game.id}:${cycleOf(game) ?? "once"}:${spots}`, bypassCap: true },
        { game, confirmed: ctx.confirmedCount, spots, inviteLink: token ? `${env.cfg.appUrl}/?join=${token}` : null });
      await env.store.setProposalStatus(proposal.id, r === "sent" || r === "dry" ? "executed" : "failed", { decidedBy: link.player_id, error: r === "sent" ? null : r });
      return teamsflow.groupResultText(t, r, t.group.sent);
    }
    default:
      await env.store.setProposalStatus(proposal.id, "failed", { error: "unknown_kind" });
      return t.error;
  }
}
