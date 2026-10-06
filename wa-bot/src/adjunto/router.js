// Treinador Adjunto — DM entry point (plan §6 router.js). Order:
//   identity → (unlinked: code | activation phrase | SILENCE)
//   → per-link mutex + burst coalescing → takeover check → budget
//   → choose_group → onboarding → menu choice → pending proposals (fast
//   path) → quick commands → agent (or degraded notice).
//
// Silence rule: an unlinked sender gets no reply, no typing, no read
// receipt — except (a) an activation code (valid → welcome; invalid/expired
// → "gera outro na app", max 3/hour/jid) and (b) the activation phrase
// (decision 11; "não encontrei…" max 1/jid/24h). The bot never sends read
// receipts in DMs at all.
//
// Everything with side effects goes through `env` (see index.js), so the
// router is tested end-to-end with fakes.
import { resolveDmIdentity, parseActivationCode, isActivationPhrase, phraseLang, maskJid, isDmJid, bareJid } from "./identity.js";
import { parseYesNo, parseTeamsCommand, parseQuickCommand, parseChoice, proposalRef } from "./commands.js";
import * as onboarding from "./onboarding.js";
import * as actions from "./actions.js";
import * as teamsflow from "./teamsflow.js";
import { runAgentTurn } from "./agent.js";
import { TOOL_DEFS, runTool } from "./tools.js";
import { budgetState, addUsage } from "./budget.js";
import { T, dmLang } from "./texts.js";
import { snapshot, formatSet } from "./data.js";
import { tableLine } from "./tick.js";
import { describeFormat } from "../core/format.js";
import { computeTable } from "../core/standings.js";
import { phonesMatch } from "../roster.js";
import { formatGameWhen, lisbonDayKey } from "../time.js";

const H = 36e5;
const MENU_TTL_H = 12;

/** Text of a DM (plain, extended, captions; ephemeral unwrapped). */
export function extractText(m) {
  const inner = m?.message?.ephemeralMessage?.message ?? m?.message;
  return (inner?.conversation ?? inner?.extendedTextMessage?.text ?? inner?.imageMessage?.caption ?? inner?.videoMessage?.caption ?? "").trim();
}

export function makeRouter(env) {
  const locks = new Map();
  const bursts = new Map();
  const degradedNoticed = new Set();
  const lidMapping = () => env.lidMapping?.() ?? null;

  const withLock = (key, fn) => {
    const prev = locks.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    locks.set(key, next);
    next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
    return next;
  };

  // ── unlinked senders ─────────────────────────────────────
  async function throttled(jid, kind, windowH, max) {
    const since = new Date(env.now().getTime() - windowH * H).toISOString();
    if ((await env.store.countDmReplies(jid, kind, since)) >= max) return true;
    await env.store.noteDmReply(jid, kind);
    return false;
  }

  async function handleCode(id, text) {
    const code = parseActivationCode(text);
    const lang = phraseLang(text);
    const row = await env.store.consumeCode(code, id.chatJid);
    let ok = Boolean(row);
    let group = null;
    if (row) {
      const mem = await env.store.membership(row.player_id, row.group_id);
      group = await env.store.groupRow(row.group_id);
      ok = Boolean(mem && !mem.banned && ["organizer", "assistant"].includes(mem.role) && group?.adjunto_enabled);
    }
    if (!ok) {
      env.log(`adjunto: invalid/expired code from ${maskJid(id.chatJid)}`);
      if (await throttled(id.chatJid, "code_invalid", 1, 3)) return;
      return env.sendDm(id.chatJid, T(lang).codeInvalid, { unlinked: true });
    }
    if (id.pn) {
      const p = await env.store.playerRow(row.player_id);
      if (p?.phone && !phonesMatch(p.phone, id.pn)) env.log("adjunto: code accepted although the sender's number differs from players.phone");
    }
    const link = await env.store.upsertLink({ playerId: row.player_id, waJid: id.chatJid, waLid: id.lid, waPn: id.pn, activeGroupId: row.group_id });
    env.log(`adjunto: linked player ${row.player_id.slice(0, 8)} by code (${group.name})`);
    return welcome(link, group);
  }

  async function handlePhrase(id, text) {
    const lang = phraseLang(text);
    const notFound = async (why) => {
      env.log(`adjunto: activation phrase from ${maskJid(id.chatJid)} not matched (${why})`);
      if (await throttled(id.chatJid, "phrase_not_found", 24, 1)) return;
      return env.sendDm(id.chatJid, T(lang).notFound, { unlinked: true });
    };
    if (!id.pn) return notFound("no phone number (unmapped @lid)");
    const rows = await env.store.findOrganizerByPhone(id.pn);
    const players = [...new Set(rows.map((r) => r.player_id))];
    if (!rows.length) return notFound("no organizer/assistant with this phone in an enabled group");
    if (players.length > 1) return notFound(`phone shared by ${players.length} players (dirty data)`);
    const link = await env.store.upsertLink({ playerId: players[0], waJid: id.chatJid, waLid: id.lid, waPn: id.pn, activeGroupId: rows.length === 1 ? rows[0].group_id : null });
    env.log(`adjunto: linked player ${players[0].slice(0, 8)} by phrase (${rows.length} group(s))`);
    if (rows.length === 1) return welcome(link, await env.store.groupRow(rows[0].group_id));
    return chooseGroup(link, rows.map((r) => ({ id: r.group_id, name: r.group_name })), lang);
  }

  async function chooseGroup(link, candidates, lang) {
    const th = await env.store.getThread(link.id);
    await env.store.saveThread(th, { mode: "choose_group", step: null, draft: { candidates, lang } });
    return env.sendDm(link, T(lang).chooseGroup(candidates.map((c) => c.name)));
  }

  async function welcome(link, group) {
    const player = await env.store.playerRow(link.player_id);
    const others = (await env.store.managedGroups(link.player_id)).filter((g) => g.id !== group.id).map((g) => g.name);
    const lang = dmLang(link.lang, group.wa_bot_lang);
    const fset = formatSet(group);
    const th = await env.store.getThread(link.id);
    if (fset) await env.store.saveThread(th, { mode: "idle", step: null, draft: {} });
    else { const s = onboarding.start(lang); await env.store.saveThread(th, { mode: "onboarding", step: s.state.step, draft: s.state }); }
    return env.sendDm(link, T(lang).welcome({ nick: player?.nick ?? player?.name ?? "", group: group.name, formatDesc: fset ? describeFormat(group.game_format, lang) : null, others }), { groupId: group.id });
  }

  // ── entry points ─────────────────────────────────────────
  async function onDirectMessage(m) {
    const jid = m?.key?.remoteJid;
    if (!isDmJid(jid) || m.key.fromMe) return;
    const text = extractText(m);
    if (!text) return;
    const id = await resolveDmIdentity(m.key, lidMapping());
    const link = await env.store.findLink(id);
    if (!link) {
      if (parseActivationCode(text)) return handleCode(id, text);
      if (isActivationPhrase(text)) return handlePhrase(id, text);
      env.log(`adjunto: ignored DM from unlinked ${maskJid(id.chatJid)}`);
      return; // SILENCE
    }
    if (!link.enabled) return;
    const patch = { last_inbound_at: env.now().toISOString() };
    if (id.lid && !link.wa_lid) patch.wa_lid = id.lid;
    if (id.pn && !link.wa_pn) patch.wa_pn = id.pn;
    await env.store.updateLink(link.id, patch).catch((e) => env.log("adjunto link touch failed:", e.message));
    return coalesce(link, id, text);
  }

  /** fromMe DM not sent by the bot → a human took over that chat for 30 min. */
  function onOwnMessage(m) {
    const jid = m?.key?.remoteJid;
    if (!isDmJid(jid) || !m.key.fromMe) return;
    const jids = [bareJid(jid), bareJid(m.key.remoteJidAlt)].filter(Boolean);
    let started = false;
    for (const j of jids) started = env.takeover.onOwnMessage(j, m.key.id) || started;
    if (started) env.log(`adjunto: human reply in ${maskJid(jid)} — quiet for 30 min`);
  }

  function coalesce(link, id, text) {
    const ms = env.cfg.adjuntoBurstMs ?? 4000;
    if (ms <= 0) return withLock(link.id, () => handleLinked(link, id, text));
    const b = bursts.get(link.id);
    if (b) { b.texts.push(text); return b.promise; }
    const nb = { texts: [text] };
    nb.promise = new Promise((r) => setTimeout(r, ms)).then(() => {
      bursts.delete(link.id);
      return withLock(link.id, () => handleLinked(link, id, nb.texts.join("\n")));
    });
    bursts.set(link.id, nb);
    return nb.promise;
  }

  async function handleLinked(link, id, text) {
    const now = env.now();
    const day = lisbonDayKey(now);
    await env.store.appendMessage(link.id, link.active_group_id, "user", text).catch((e) => env.log("adjunto append failed:", e.message));
    env.logMessage?.({ groupId: link.active_group_id, kind: "adjunto_in", question: text, answer: "", askerId: link.player_id }).catch(() => {});
    let usage = await env.store.getUsage(day, link.player_id);
    usage = { ...(usage ?? {}), msgs_in: (usage?.msgs_in ?? 0) + 1 };
    await env.store.saveUsage(day, link.player_id, usage);
    const budget = budgetState({ usage, globalUsdMicros: await env.store.globalUsdMicros(day), limits: env.cfg.adjuntoLimits });
    if (budget.warnGlobal) env.log("adjunto: global daily budget ≥80%");
    if (budget.mode === "ignore") return env.log(`adjunto: link ${link.id.slice(0, 8)} over the daily message cap, ignoring`);
    if (env.takeover.isActive([link.wa_jid, link.wa_lid, id.chatJid])) return env.log(`adjunto: human takeover active, not replying (${maskJid(id.chatJid)})`);

    const groups = await env.store.managedGroups(link.player_id);
    const say = (txt, groupId) => env.sendDm(link, txt, { groupId: groupId ?? link.active_group_id });
    const baseLang = dmLang(link.lang, groups.find((g) => g.id === link.active_group_id)?.lang ?? groups[0]?.lang);
    if (!groups.length) return say(T(baseLang).notManager);

    if (parseActivationCode(text)) return handleCode(id, text);
    let thread = await env.store.getThread(link.id);

    if (thread.mode === "choose_group") {
      const cands = thread.draft?.candidates ?? [];
      // Same language as the menu we sent (not the first group's language).
      const menuLang = thread.draft?.lang ?? baseLang;
      // Repeating the activation phrase restarts the choice with a FRESH
      // group list (the stored one may predate a group created since —
      // Vini hit this on 2026-10-06), instead of "responde com o número".
      if (isActivationPhrase(text)) {
        if (groups.length === 1) {
          await env.store.updateLink(link.id, { active_group_id: groups[0].id });
          link.active_group_id = groups[0].id;
          return welcome(link, await env.store.groupRow(groups[0].id));
        }
        return chooseGroup(link, groups.map((g) => ({ id: g.id, name: g.name })), menuLang);
      }
      const k = parseChoice(text, cands.length);
      const byName = cands.filter((c) => c.name.toLowerCase().includes(text.trim().toLowerCase()));
      const pick = k ? cands[k - 1] : byName.length === 1 ? byName[0] : null;
      if (!pick || !groups.some((g) => g.id === pick.id)) return say(T(menuLang).chooseGroupAgain(cands.length));
      await env.store.updateLink(link.id, { active_group_id: pick.id });
      link.active_group_id = pick.id;
      return welcome(link, await env.store.groupRow(pick.id));
    }

    let active = groups.find((g) => g.id === link.active_group_id);
    if (!active) {
      if (groups.length > 1) return chooseGroup(link, groups.map((g) => ({ id: g.id, name: g.name })), baseLang);
      active = groups[0];
      await env.store.updateLink(link.id, { active_group_id: active.id });
      link.active_group_id = active.id;
    }
    if (isActivationPhrase(text)) return welcome(link, await env.store.groupRow(active.id));

    const lang = dmLang(link.lang, active.lang);
    const t = T(lang);
    const ctx = await env.loadGroupCtx(active.id);
    const me = ctx.players.find((p) => p.uuid === link.player_id) ?? { nick: "?", role: "organizer" };
    const sayG = (txt) => say(txt, active.id);

    // ── onboarding (format) ──
    if (thread.mode === "onboarding") {
      const r = onboarding.step(thread.draft?.step ? thread.draft : { step: thread.step ?? "type", draft: thread.draft?.draft ?? {} }, text, lang);
      if (r.done) {
        if (env.cfg.adjuntoAutosend) await env.store.setGameFormat(active.id, r.done);
        else env.log(`[adjunto dry-run] would set game_format on ${active.name}: ${JSON.stringify(r.done)}`);
        await env.store.appendMessage(link.id, active.id, "event", `[formato guardado: ${describeFormat(r.done, lang)}]`).catch(() => {});
      }
      await env.store.saveThread(thread, r.state ? { mode: "onboarding", step: r.state.step, draft: r.state } : { mode: "idle", step: null, draft: {} });
      return sayG(r.done && !env.cfg.adjuntoAutosend ? `${r.reply} ${t.dryRun}` : r.reply);
    }

    const tc = { env, link, me, lang, groupId: active.id, ctx: async () => ctx, created: [] };

    // ── menu choice after a proactive DM ("1" / "2") ──
    const menu = thread.draft?.menu;
    if (menu && now - new Date(menu.at) < MENU_TTL_H * H && menu.gameId === ctx.game?.id) {
      const k = parseChoice(text, menu.options.length);
      if (k) {
        const opt = menu.options[k - 1];
        await env.store.saveThread(thread, { mode: "idle", step: null, draft: { ...thread.draft, menu: null } });
        const input = opt === "group_reminder" ? { with_names: true, mention: false }
          : opt === "open_spots" ? { extra_spots: null }
            : opt === "set_spots" ? { spots: Math.max(2, ctx.confirmedCount) } : { reason: null };
        const r = await runTool(opt === "group_reminder" ? "send_group_reminder" : opt === "open_spots" ? "publish_open_spots" : opt, input, tc);
        const out = JSON.parse(r.content);
        return sayG(r.is_error ? t.failedState : out.confirm_prompt);
      }
    }

    // ── fast path: pending proposals ──
    const pend = (await env.store.pendingProposals(link.id)).filter((p) => p.group_id === active.id);
    if (pend.length) {
      const ref = proposalRef(text);
      const teamsP = pend.find((p) => p.kind === "teams");
      const tcmd = teamsP && (!ref || ref === teamsP.id) ? parseTeamsCommand(text) : null;
      const decideOn = async (proposal, decision) => {
        const r = await actions.decide(env, { link, proposal, decision, lang, ctx, me });
        await env.store.appendMessage(link.id, active.id, "event", `[#${proposal.id} ${proposal.kind}: ${decision === "yes" ? "sim" : "não"}]`).catch(() => {});
        for (const n of r.notify ?? []) await notifyOther(n, active);
        return sayG(r.text);
      };
      // yes/no go to the teams card only when it is the newest pending item
      // (or referenced by #id); edits always target the teams card.
      const isDecision = tcmd && ["approve", "reject"].includes(tcmd.type);
      if (tcmd && (!isDecision || pend[0].id === teamsP.id || ref === teamsP.id)) {
        if (tcmd.type === "approve" || tcmd.type === "propose_now") return decideOn(teamsP, "yes");
        if (tcmd.type === "reject" || tcmd.type === "wait") return decideOn(teamsP, "no");
        if (teamsP.payload?.stage === "short_ask") return decideOn(teamsP, "yes"); // an edit means "go ahead"
        return sayG((await teamsflow.editCard(env, { link, ctx, proposal: teamsP, cmd: tcmd, lang })).text);
      }
      const yn = parseYesNo(text);
      if (yn) return decideOn(ref ? pend.find((p) => p.id === ref) ?? pend[0] : pend[0], yn);
    }

    // ── quick commands ──
    const qc = parseQuickCommand(text);
    if (qc) return quick(qc, { link, thread, ctx, lang, t, groups, tc, sayG });

    // ── agent (or degraded) ──
    if (!env.anthropic || budget.mode === "degraded") {
      const k = `${link.player_id}|${day}`;
      if (degradedNoticed.has(k)) return env.log(`adjunto: degraded (${budget.reason ?? "no client"}), already noticed today`);
      degradedNoticed.add(k);
      return sayG(t.degraded(env.cfg.appUrl));
    }
    const history = (await env.store.recentMessages(link.id, { limit: env.cfg.adjuntoWindowTurns + 1 })).slice(0, -1);
    let urow = usage;
    const res = await runAgentTurn({
      client: env.anthropic, model: env.cfg.adjuntoModel, lang, tools: TOOL_DEFS, runTool: async (n, i) => {
        const r = await runTool(n, i, tc);
        if (r.internal) env.log(`adjunto tool ${n} failed:`, r.internal.message);
        return r;
      },
      history, snapshot: snapshot({ ctx, link, me, lang, otherGroups: groups.filter((g) => g.id !== active.id), proposals: pend, appUrl: env.cfg.appUrl, now }),
      userText: text, effort: env.cfg.adjuntoEffort, maxRounds: env.cfg.adjuntoMaxRounds, fallback: env.cfg.adjuntoFallback,
      onRequest: (u, model) => { urow = addUsage(urow, u, model); },
    });
    urow = { ...urow, turns: (urow.turns ?? 0) + 1 };
    await env.store.saveUsage(day, link.player_id, urow).catch((e) => env.log("adjunto usage save failed:", e.message));
    if (res.stop === "error") env.log("adjunto agent error:", res.error?.message);
    if (res.stop === "guard") env.log(`adjunto guard_violation: ${res.violations?.join(", ")}`);
    let reply = res.text;
    // A team card produced this turn must reach the organizer verbatim even
    // if the model paraphrased it (its numbers come from code, not the model).
    if (tc.card && !reply.includes(tc.card.split("\n").at(-1))) reply = `${reply ? `${reply}\n\n` : ""}${tc.card}`;
    for (const p of tc.created) {
      if (!reply.includes(`#${p.id}`) && p.kind !== "teams") reply += `\n#${p.id} ${p.summary}. ${lang === "en" ? "Confirm? (yes/no)" : "Confirmas? (sim/não)"}`;
      await env.store.appendMessage(link.id, active.id, "event", `[#${p.id} pendente: ${p.summary}]`).catch(() => {});
    }
    return sayG(reply);
  }

  async function notifyOther(n, group) {
    const links = await env.store.activeLinks();
    const other = links.find((l) => l.id === n.linkId);
    if (!other) return;
    const lang = dmLang(other.lang, group.lang);
    if (n.kind === "byOther") await env.sendDm(other, T(lang).teams.byOther(n.nick), { groupId: group.id });
  }

  async function quick(qc, { link, thread, ctx, lang, t, groups, tc, sayG }) {
    switch (qc.type) {
      case "help": return sayG(t.help);
      case "pause": await env.store.updateLink(link.id, { prefs: { ...(link.prefs ?? {}), proactive: false } }); return sayG(t.paused);
      case "resume": await env.store.updateLink(link.id, { prefs: { ...(link.prefs ?? {}), proactive: true } }); return sayG(t.resumed);
      case "lang": await env.store.updateLink(link.id, { lang: qc.lang }); return env.sendDm(link, T(qc.lang).langSet);
      case "format": {
        const s = onboarding.start(lang);
        await env.store.saveThread(thread, { mode: "onboarding", step: s.state.step, draft: s.state });
        return sayG(s.reply);
      }
      case "group": {
        const r = JSON.parse((await runTool("switch_group", { group: qc.name }, tc)).content);
        if (!r.switched) return sayG(t.unknownGroup(groups.map((g) => g.name)));
        return welcome(link, await env.store.groupRow(link.active_group_id));
      }
      case "status": {
        if (!ctx.game) return sayG(t.noGame);
        const when = formatGameWhen(ctx.game.scheduled_at, lang === "en" ? "en" : "pt");
        return sayG(t.p.status({ when, venue: ctx.game.venue, c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots, pending: ctx.pending.map((p) => p.nick), late: null, menu: false }));
      }
      case "table": {
        const md = ctx.game?.live_matchday;
        if (md) {
          const teams = (md.teams ?? ctx.game.teams ?? []).map((x) => ({ id: x.id, name: x.name }));
          const rows = computeTable(teams, (md.matches ?? []).filter((m) => m.stage !== "playoff" && !m.isBye), { points: md.config?.points, tiebreakers: md.config?.tiebreakers, seed: ctx.game.id });
          return sayG(`📊 ${tableLine(rows, lang)}`);
        }
        const r = JSON.parse((await runTool("get_standings", { scope: "last_night" }, tc)).content);
        if (!r.table?.length) return sayG(t.noGame);
        return sayG(`📊 ${r.date}: ${r.table.map((x, i) => `${i + 1}. ${x.team} ${x.pts} pts`).join(" · ")}`);
      }
      case "teams": {
        if (!ctx.game || !["open", "full"].includes(ctx.game.status)) return sayG(t.noGame);
        const r = JSON.parse((await runTool("get_team_proposal", {}, tc)).content);
        if (r.pending) return sayG(r.card);
        if (ctx.playing.length < 4) return sayG(t.p.status({ when: formatGameWhen(ctx.game.scheduled_at, lang === "en" ? "en" : "pt"), venue: ctx.game.venue, c: Math.min(ctx.confirmedCount, ctx.spots), s: ctx.spots, pending: [], late: null, menu: false }));
        return sayG((await teamsflow.startCard(env, { link, ctx, lang })).text);
      }
      default: return undefined;
    }
  }

  return { onDirectMessage, onOwnMessage, _handleLinked: handleLinked };
}
