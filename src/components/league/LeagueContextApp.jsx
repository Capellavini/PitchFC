import { useEffect, useMemo, useRef, useState } from "react";
import { C, S } from "../../theme";
import { getLang, t } from "../../lib/i18n";
import { usePersistentState } from "../../lib/storage";
import {
  appendEvent, transition, setOfficialMvp, castFanVote, validateFantasyPicks, LeagueError, setTactics,
} from "../../lib/core/league";
import {
  buildLeagueDemoSeed, normalizeLeagueState, deriveLeague, ROLE_ACCOUNTS, LEAGUE_DEMO_KEY, PLAYERS,
} from "../../lib/leagueDemo";
import { LG, leagueError } from "../../lib/leagueCopy";
import LeagueHeader from "./LeagueHeader";
import LeagueBottomNav from "./LeagueBottomNav";
import LeagueEntry from "./LeagueEntry";
import LeagueHome from "./LeagueHome";
import LeagueMatches from "./LeagueMatches";
import LeagueTable from "./LeagueTable";
import LeagueFantasy from "./LeagueFantasy";
import LeagueMore from "./LeagueMore";
import LeagueMatchPage from "./LeagueMatchPage";
import LeagueTeamPage from "./LeagueTeamPage";
import LeaguePlayerPage from "./LeaguePlayerPage";
import LeagueManage from "./LeagueManage";
import LeaguePlayersDirectory from "./LeaguePlayersDirectory";
import LeagueCompare from "./LeagueCompare";
import LeagueToast from "./LeagueToast";

const SHELL_W = 430; // same column as the app shell

/**
 * League CONTEXT of the app (PITCH Ligas, Fase 1 demo — route
 * /league/demo). The app shell adapts to this context the way team-only
 * users get their own nav: Início · Jogos · Classificação · Fantasy ·
 * Mais, a header with league → competition → category, a context
 * switcher (Meus grupos / Minhas equipas / Minhas ligas / Acompanhando)
 * and — Gestor only — "Gerir liga" (a separate area with no follow nav).
 *
 * Everything runs on the deterministic demo seed in this browser
 * (localStorage pitch.v2.leagueDemo); every write is a pure function from
 * lib/core/league.js applied to that local state. No backend, no
 * Supabase. The role switcher only changes which demo account you look
 * through — it never grants anything real.
 *
 * Props: contexts { groups: [{id,name}], teams: [{id,name}] } from the
 * app (local demo session); entry "fan" → start the "Sou adepto" flow.
 */
export default function LeagueContextApp({ contexts, entry = null }) {
  const [raw, setRaw] = usePersistentState(LEAGUE_DEMO_KEY, null);
  const state = useMemo(() => normalizeLeagueState(raw), [raw]);
  const [tab, setTab] = usePersistentState("leagueDemoTab", "inicio");
  const [stack, setStack] = usePersistentState("leagueDemoStack", []);
  const [entryMode, setEntryMode] = useState(entry); // "fan" forces the fan flow once
  const [toast, setToast] = useState(null);
  const lastEvent = useRef({});

  // ?entrada=adepto is a one-shot entry; drop it from the URL so a reload
  // lands in the league context, not back at the start of the flow.
  useEffect(() => {
    if (!entry) return;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("entrada");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch { /* ignore */ }
  }, [entry]);

  const role = state.viewer?.role || "fan";
  const derived = useMemo(() => deriveLeague(state), [state]);
  const acc = ROLE_ACCOUNTS[role] || ROLE_ACCOUNTS.fan;
  const lang = getLang();
  // The management area exists only for the Gestor role — a persisted
  // stack can't reopen it under another role (direct-route guard).
  const visible = (stack || []).filter((v) => v && (v.kind !== "manage" || role === "manager"));
  const view = visible[visible.length - 1] || null;

  const notify = (msg, tone = "ok") => setToast({ msg, tone, n: Date.now() });
  const top = () => { try { window.scrollTo(0, 0); } catch { /* jsdom */ } };
  const open = (v) => { setStack((s) => [...(s || []), v]); top(); };
  const back = () => { setStack((s) => (s || []).slice(0, -1)); top(); };
  const goTab = (id) => { setTab(id); setStack([]); top(); };

  /** Apply a pure update to the demo state; LeagueError → toast. */
  const apply = (fn, okMsg) => {
    try {
      const next = fn(state);
      if (next === state) return { same: true };
      setRaw(next);
      if (okMsg) notify(okMsg);
      return { ok: true };
    } catch (e) {
      notify(e instanceof LeagueError ? leagueError(e) : t("Não foi possível guardar. Tenta outra vez."), "error");
      return { error: e };
    }
  };
  const setMatch = (s, id, fn) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? fn(m) : m)) });
  const now = () => new Date().toISOString();
  const who = role === "manager" ? t("Gestor (demo)") : `${t(acc.label)} (demo)`;

  const changeRole = (r) => {
    apply((s) => ({ ...s, viewer: { ...(s.viewer || {}), role: r, entered: true } }));
    if (r !== "manager") setStack((s) => (s || []).filter((v) => v.kind !== "manage"));
  };

  const act = {
    enter: ({ role: r, supportTeamId }) => {
      apply((s) => ({
        ...s, viewer: { role: r, entered: true },
        prefs: supportTeamId ? { ...s.prefs, supportTeamId, followTeamIds: [...new Set([...(s.prefs.followTeamIds || []).filter((x) => x !== s.prefs.supportTeamId), supportTeamId])] } : s.prefs,
      }));
      setEntryMode(null); setTab("inicio"); setStack([]); top();
    },
    addEvent: (matchId, event) => {
      const full = { ...event, matchId, recordedBy: who, recordedAt: event.recordedAt || now() };
      const r = apply((s) => {
        const log = s.logs[matchId] || [];
        const next = appendEvent(log, full);
        if (next === log) return s; // idempotent resend → no-op
        return { ...s, logs: { ...s.logs, [matchId]: next } };
      }, t("Lance registado."));
      if (r.same) notify(t("Reenvio ignorado — este lance já estava registado (mesmo identificador)."));
      if (r.ok || r.same) lastEvent.current[matchId] = full;
      return r;
    },
    resendLast: (matchId) => {
      const e = lastEvent.current[matchId];
      if (!e) { notify(t("Ainda não registaste nenhum lance neste jogo nesta sessão."), "error"); return; }
      act.addEvent(matchId, e);
    },
    hasLast: (matchId) => Boolean(lastEvent.current[matchId]),
    correct: (matchId, event) => apply((s) => ({
      ...s, logs: { ...s.logs, [matchId]: appendEvent(s.logs[matchId] || [], { ...event, matchId, recordedBy: who, recordedAt: now() }) },
    }), t("Correção registada — classificação e estatísticas recalculadas.")),
    move: (matchId, to, opts = {}, okMsg) => apply((s) => setMatch(s, matchId, (m) => {
      const next = transition(m, to, { role, by: who, at: now(), teamId: acc.teamId, ...opts });
      if (to !== "live") return next;
      // Kick-off with a call-up still missing: the demo fills it with the
      // inscribed squad minus suspended players, so appearances (and the
      // MVP candidates) exist. A real league requires the call-up.
      const auto = (tid) => (next.lineups?.[tid]?.length ? next.lineups[tid]
        : PLAYERS.filter((p) => p.teamId === tid && !(derived.discipline[p.id]?.pending > 0)).map((p) => p.id));
      return { ...next, lineups: { ...next.lineups, [m.homeId]: auto(m.homeId), [m.awayId]: auto(m.awayId) } };
    }), okMsg),
    setMvp: (matchId, playerId) => apply((s) => setMatch(s, matchId, (m) => setOfficialMvp(m, playerId, { role, by: who, at: now() })), t("Craque oficial definido.")),
    closeVote: (matchId) => apply((s) => setMatch(s, matchId, (m) => ({ ...m, fanVoteClosed: true })), t("Votação da torcida fechada.")),
    vote: (matchId, playerId) => apply((s) => ({
      ...s, fanVotes: castFanVote(s.fanVotes, s.matches.find((m) => m.id === matchId), acc.accountId, playerId),
    }), t("Voto registado. Podes mudá-lo até a votação fechar.")),
    setLineup: (matchId, teamId, ids) => apply((s) => setMatch(s, matchId, (m) => ({ ...m, lineups: { ...m.lineups, [teamId]: ids } })), t("Convocatória guardada.")),
    setTactics: (matchId, teamId, board) => apply((s) => setMatch(s, matchId, (m) => setTactics(m, teamId, board, {
      role, myTeamId: acc.teamId, by: `${state.viewer?.role === "manager" ? t("Gestor (demo)") : `${PLAYERS.find((p) => p.id === acc.playerId)?.name || "—"} (${t(acc.label)})`}`,
      at: now(), suspendedIds: Object.values(derived.discipline).filter((d) => d.pending > 0).map((d) => d.playerId),
    })), t("Formação publicada.")),
    toggleVar: (matchId) => apply((s) => setMatch(s, matchId, (m) => ({ ...m, var: { enabled: !m.var?.enabled } }))),
    setPicks: (ids, players) => {
      const errors = validateFantasyPicks(ids, players);
      if (errors.length) return { errors };
      apply((s) => ({ ...s, fantasy: { ...s.fantasy, [acc.accountId]: ids } }), t("Equipa de Fantasy guardada (só neste navegador)."));
      return { ok: true };
    },
    // Pitch Manager squad (same shape the group demo persists): one write for the lineup AND its Conexão.
    setFantasySquad: (squad) => apply((s) => ({ ...s, fantasyV2: { ...(s.fantasyV2 || {}), [acc.accountId]: squad } }), t("Equipa guardada (só neste navegador).")),
    setPrefs: (patch) => apply((s) => ({ ...s, prefs: { ...s.prefs, ...patch } })),
    reset: () => { setRaw(buildLeagueDemoSeed()); setStack([]); setTab("inicio"); lastEvent.current = {}; notify(t(LG.resetDone)); },
  };

  const ctx = { state, derived, role, acc, lang, open, back, act, notify, goTab };
  const entering = entryMode === "fan" || !state.viewer?.entered;
  const inManage = !entering && view?.kind === "manage";
  const pushed = !entering && view && view.kind !== "manage";

  let body;
  if (entering) body = <LeagueEntry key={entryMode || "choose"} startAt={entryMode === "fan" ? "fan" : "choose"} onEnter={act.enter} />;
  else if (inManage) body = <LeagueManage ctx={ctx} section={view.section} onSection={(sec) => setStack((s) => [...(s || []).filter((v) => v.kind !== "manage"), { kind: "manage", section: sec }])} />;
  else if (view?.kind === "match") body = <LeagueMatchPage key={view.id} ctx={ctx} matchId={view.id} />;
  else if (view?.kind === "team") body = <LeagueTeamPage key={view.id} ctx={ctx} teamId={view.id} />;
  else if (view?.kind === "player") body = <LeaguePlayerPage key={view.id} ctx={ctx} playerId={view.id} />;
  else if (view?.kind === "players") body = <LeaguePlayersDirectory ctx={ctx} />;
  else if (view?.kind === "compare") body = <LeagueCompare ctx={ctx} />;
  else if (tab === "jogos") body = <LeagueMatches ctx={ctx} />;
  else if (tab === "classificacao") body = <LeagueTable ctx={ctx} />;
  else if (tab === "fantasy") body = <LeagueFantasy ctx={ctx} />;
  else if (tab === "mais") body = <LeagueMore ctx={ctx} />;
  else body = <LeagueHome ctx={ctx} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, overflowX: "hidden" }}>
      <div style={{ maxWidth: SHELL_W, margin: "0 auto", padding: `0 ${S.lg}px ${entering || inManage ? S.xxl : 104}px`, boxSizing: "border-box" }}>
        <LeagueHeader ctx={ctx} contexts={contexts} role={role} onRole={changeRole} inManage={inManage} compact={entering} slim={pushed}
          onManage={() => open({ kind: "manage", section: "overview" })}
          onExitManage={() => setStack((s) => (s || []).filter((v) => v.kind !== "manage"))} />
        {body}
      </div>
      {!entering && !inManage && <LeagueBottomNav tab={tab} onSelect={goTab} maxWidth={SHELL_W} />}
      <LeagueToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
