// Treinador Adjunto — the proactive pass, run from index.js loop() after the
// group pass (own try/catch there). For every enabled link × managed group:
// roster-change checks on pending team proposals, then decideAdjunto() and
// the templated DMs (zero LLM). Claims "dm_*" rows in bot_announcements so
// a restart never repeats a DM; dry-run logs once per key and claims nothing.
import { decideAdjunto, URGENT } from "./proactive.js";
import * as teamsflow from "./teamsflow.js";
import { T, dmLang } from "./texts.js";
import { formatSet } from "./data.js";
import { computeTable, buildKnockoutRound1 } from "../core/standings.js";
import { podiumTop3 } from "../core/rankings.js";
import { lateConfirmers } from "../core/insights.js";
import { validateFormat, defaultFormat } from "../core/format.js";
import { formatGameWhen, formatGameTime, lisbonDayKey } from "../time.js";

const startOfLisbonDayIso = (now) => new Date(new Date(`${lisbonDayKey(now)}T00:00:00Z`).getTime() - 36e5).toISOString();
const fmtOf = (group) => (group.game_format && validateFormat(group.game_format).ok ? validateFormat(group.game_format).format : defaultFormat("campeonato"));

/** "1. Coletes 10 pts (3V 1E) · 2. …" from table rows. */
export function tableLine(rows, lang = "pt") {
  const W = lang === "en" ? ["W", "D"] : ["V", "E"];
  return rows.map((r, i) => `${i + 1}. ${r.name ?? r.id} ${r.pts} pts (${r.w}${W[0]} ${r.d}${W[1]})`).join(" · ");
}

/** P7 text from a matchdays row. */
export function summaryText(md, group, lang) {
  const s = md.summary ?? {};
  const f = fmtOf(group);
  const ms = (s.matches ?? []).filter((m) => m.stage !== "playoff");
  const names = [...new Set(ms.flatMap((m) => [m.homeName, m.awayName]).filter((x) => x && x !== "—"))];
  const table = computeTable(names, ms.map((m) => ({ homeId: m.homeName, awayId: m.awayName,
    events: [...Array(m.homeGoals || 0)].map(() => ({ teamId: m.homeName })).concat([...Array(m.awayGoals || 0)].map(() => ({ teamId: m.awayName }))) })),
  { points: f.points, tiebreakers: f.tiebreakers.filter((x) => x !== "lots") });
  const finalM = (s.matches ?? []).filter((m) => m.stage === "playoff").at(-1);
  const top = podiumTop3(s.lines ?? []).map((l) => `${l.nick} ${l.goals || 0}G ${l.assists || 0}A`).join(" · ");
  const header = lang === "en" ? `🏁 Night done — ${md.n_games ?? (s.matches ?? []).length} games, ${md.total_goals ?? 0} goals` : `🏁 Noite fechada — ${md.n_games ?? (s.matches ?? []).length} jogos, ${md.total_goals ?? 0} golos`;
  return T(lang).p.summary({
    header,
    table: table.length >= 2 && group.game_format?.type !== "avulso" ? tableLine(table, lang) : null,
    final: finalM ? `🏆 ${finalM.homeName} ${finalM.homeGoals}-${finalM.awayGoals} ${finalM.awayName}` : null,
    top: top ? `⭐ ${top}` : null,
  });
}

/** P6 text from a live matchday. */
export function groupStageText(game, group, lang) {
  const md = game.live_matchday;
  const teams = (md.teams ?? game.teams ?? []).map((t) => ({ id: t.id, name: t.name }));
  const f = fmtOf(group);
  const rows = computeTable(teams, (md.matches ?? []).filter((m) => m.stage !== "playoff" && !m.isBye),
    { points: md.config?.points ?? f.points, tiebreakers: md.config?.tiebreakers ?? f.tiebreakers, seed: game.id });
  const q = Math.min(md.config?.finalistas ?? 2, rows.length);
  const pairs = buildKnockoutRound1(rows.slice(0, q).map((r) => r.id), Boolean(md.config?.byePrimeiro));
  const name = (id) => teams.find((t) => t.id === id)?.name ?? "—";
  const semis = pairs.map(([a, b]) => (b ? `${name(a)} vs ${name(b)}` : `${name(a)} ➜`)).join(" · ");
  return T(lang).p.groupStage({ table: tableLine(rows, lang), semis });
}

export function makeTicker(env) {
  const prev = new Map();       // `${link}:${game}` -> confirmed count last seen
  const dryLogged = new Set();

  async function sendProactive(link, group, gameId, ev, buildText, menu) {
    const claimKind = `dm_${ev.kind.replace(/^adj_/, "")}`;
    if (!env.cfg.adjuntoAutosend) {
      if (dryLogged.has(ev.key)) return;
      dryLogged.add(ev.key);
      const text = await buildText();
      if (text) env.log(`[adjunto dry-run] proactive ${ev.kind} -> ${group.name} (link ${link.id.slice(0, 8)})\n${text}\n`);
      return;
    }
    const id = await env.claim(group.id, gameId, claimKind, ev.key);
    if (!id) return; // already sent
    try {
      const text = await buildText();
      if (!text) { await env.markSent(id); return; }
      await env.sendDm(link, text, { groupId: group.id, eventKind: ev.kind });
      await env.markSent(id);
      if (menu) await setMenu(link, menu);
    } catch (e) {
      await env.unclaim(id);
      env.log(`adjunto proactive ${ev.kind} failed (will retry):`, e.message);
    }
  }

  async function setMenu(link, menu) {
    const th = await env.store.getThread(link.id);
    if (th.mode !== "idle") return;
    await env.store.saveThread(th, { mode: "idle", step: null, draft: { ...(th.draft ?? {}), menu: { ...menu, at: env.now().toISOString() } } });
  }

  async function tickPair(link, g, ctxCache) {
    if (!ctxCache.has(g.id)) ctxCache.set(g.id, await env.loadGroupCtx(g.id));
    const ctx = ctxCache.get(g.id);
    const me = ctx.players.find((p) => p.uuid === link.player_id);
    if (!me || !["organizer", "assistant"].includes(me.role)) return;
    const lang = dmLang(link.lang, ctx.group.wa_bot_lang);
    const t = T(lang);
    const pre = g.id !== link.active_group_id ? t.p.prefix(ctx.group.name) : "";
    const { game } = ctx;
    const now = env.now();

    // Pending team card vs. reality: confirmed in the app, or roster changed.
    let gameProps = [];
    if (game) {
      gameProps = (await env.store.gameProposals(link.id, game.id)) ?? [];
      const pend = gameProps.find((p) => p.kind === "teams" && p.status === "pending");
      if (pend) {
        const full = (await env.store.pendingProposals(link.id)).find((p) => p.id === pend.id);
        if (full && game.teams_confirmed) {
          if (await env.store.setProposalStatus(full.id, "superseded", { error: "confirmed_in_app" })) await env.sendDm(link, pre + t.teams.confirmedInApp, { groupId: g.id, eventKind: "adj_teams" });
        } else if (full && env.cfg.adjuntoAutosend) {
          const msg = await teamsflow.rosterCheck(env, { link, ctx, proposal: full, lang });
          if (msg) await env.sendDm(link, pre + msg, { groupId: g.id, eventKind: "adj_teams_superseded" });
        }
      }
    }

    const cyc = game?.cycle_opened_at ?? null;
    const thisCycle = gameProps.filter((p) => (p.cycle ?? null) === cyc);
    const executed = thisCycle.filter((p) => p.status === "executed");
    const key = game ? `${link.id}:${game.id}` : null;
    const prevConfirmed = key && prev.has(key) ? prev.get(key) : null;

    const events = decideAdjunto({
      link, game, spots: ctx.spots, confirmed: ctx.confirmedCount, waitlist: ctx.waitlist.length, prevConfirmed,
      teamsWaiting: thisCycle.some((p) => p.kind === "teams" && p.status === "rejected" && p.error === "wait"),
      formatSet: formatSet(ctx.group), matchdays: ctx.matchdays, now,
      sentToday: await env.store.countProactiveSince(link.id, startOfLisbonDayIso(now), [...URGENT].map((k) => `dm_${k.replace(/^adj_/, "")}`)),
      lastOwnActionAt: executed[0]?.decided_at ?? null,
      p1Acted: executed.some((p) => p.kind === "group_reminder" || p.kind === "open_spots"),
      dailyCap: env.cfg.adjuntoDmDailyCap,
    });
    if (key) prev.set(key, ctx.confirmedCount);

    const when = game ? formatGameWhen(game.scheduled_at, lang === "en" ? "en" : "pt") : "";
    for (const ev of events) {
      const gid = ["adj_summary", "adj_format_nudge"].includes(ev.kind) ? null : game?.id ?? null;
      switch (ev.kind) {
        case "adj_status":
          await sendProactive(link, g, gid, ev, async () => {
            const log = await env.store.attendanceLog(g.id);
            const lc = lateConfirmers(log);
            const pendingIds = new Set(ctx.pending.map((p) => p.uuid));
            const rows = lc.insufficient ? [] : lc.rows.filter((r) => pendingIds.has(r.playerId) && r.latePct >= 50)
              .slice(0, 4).map((r) => ({ nick: ctx.players.find((p) => p.uuid === r.playerId)?.nick, h: r.medianHoursBefore }));
            const late = lc.insufficient ? t.p.lateLearning : rows.length ? t.p.lateLine(rows) : null;
            return pre + t.p.status({ when, venue: game.venue, c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots, pending: ctx.pending.map((p) => p.nick), late });
          }, { kind: "status", gameId: game.id, options: ["group_reminder", "open_spots"] });
          break;
        case "adj_hint":
          await sendProactive(link, g, gid, ev, async () => pre + t.p.reminderHint({ c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots,
            at: formatGameTime(new Date(new Date(game.scheduled_at).getTime() - 24 * 36e5).toISOString()) }), { kind: "hint", gameId: game.id, options: ["group_reminder"] });
          break;
        case "adj_gameday":
          await sendProactive(link, g, gid, ev, async () => pre + t.p.gameday({ c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots }),
            { kind: "gameday", gameId: game.id, options: ["open_spots", "set_spots", "cancel_game"] });
          break;
        case "adj_spot":
          await sendProactive(link, g, gid, ev, async () => pre + t.p.spot({ nick: null, c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots }),
            { kind: "spot", gameId: game.id, options: ["open_spots", "group_reminder"] });
          break;
        case "adj_teams": case "adj_teams_full":
          if (thisCycle.some((p) => p.kind === "teams" && p.status === "pending")) break;
          await sendProactive(link, g, gid, ev, async () => {
            const r = ev.full || ctx.playing.length >= ctx.spots
              ? await teamsflow.startCard(env, { link, ctx, lang })
              : await teamsflow.askShort(env, { link, ctx, lang });
            return pre + r.text;
          });
          break;
        case "adj_groupstage":
          await sendProactive(link, g, gid, ev, async () => pre + groupStageText(game, ctx.group, lang));
          break;
        case "adj_summary": {
          const md = ctx.matchdays.find((m) => m.id === ev.matchdayId);
          if (md) await sendProactive(link, g, gid, ev, async () => pre + summaryText(md, ctx.group, lang));
          break;
        }
        case "adj_unfinished":
          await sendProactive(link, g, gid, ev, async () => pre + t.p.unfinished(env.cfg.appUrl));
          break;
        case "adj_format_nudge":
          await sendProactive(link, g, gid, ev, async () => pre + t.p.formatNudge);
          break;
        default: break;
      }
    }
  }

  return async function tickAdjunto() {
    const links = await env.store.activeLinks();
    const ctxCache = new Map();
    for (const link of links) {
      try {
        if (env.takeover?.isActive([link.wa_jid, link.wa_lid])) continue;
        for (const g of await env.store.managedGroups(link.player_id)) await tickPair(link, g, ctxCache);
      } catch (e) { env.log(`adjunto tick error (link ${link.id.slice(0, 8)}):`, e.message); }
    }
  };
}
