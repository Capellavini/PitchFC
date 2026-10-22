import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Clock, Shield, AlertTriangle, Flag } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../../theme";
import { getLang, t } from "../../lib/i18n";
import { EVENT_LABEL, tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { leagueCloudError, roleLabel } from "../../lib/leagueCloudCopy";
import { fmtDateTime, fmtKickoff } from "../../lib/leagueDemo";
import { CLOUD_EVENT_TYPES, SCORE_STATES, matchPermissions, newCloudEventId } from "../../lib/leagueMatches";
import BackHeader from "../BackHeader";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import RivalsCrest from "../RivalsCrest";
import SectionLabel from "../SectionLabel";
import SegmentedControl from "../SegmentedControl";
import LeagueStateChip from "./LeagueStateChip";
import LeagueTimeline from "./LeagueTimeline";
import LeagueEventSheet from "./LeagueEventSheet";
import LeagueReasonSheet from "./LeagueReasonSheet";
import LeagueTacticsPanel from "./LeagueTacticsPanel";
import LeagueCloudLiveControls from "./LeagueCloudLiveControls";
import LeagueCloudScheduleSheet from "./LeagueCloudScheduleSheet";
import LeagueCloudOfficialsSheet from "./LeagueCloudOfficialsSheet";
import LeagueCloudAwards from "./LeagueCloudAwards";
import LeagueCloudTeamSheet from "./LeagueCloudTeamSheet";
import LeagueCloudWalkoverSheet from "./LeagueCloudWalkoverSheet";
import LeagueCloudAbandonedSheet from "./LeagueCloudAbandonedSheet";

const REASONS = {
  postpone: { title: "Adiar jogo", text: "O jogo sai do calendário da jornada até ser reagendado (o mesmo jogo, sem perder nada). Fica registado na ficha de jogo.", label: "Adiar" },
  cancel: { title: "Cancelar jogo", text: "Cancelado é definitivo e nunca conta para a classificação. Só é possível antes de haver lances.", label: "Cancelar jogo" },
  abandon: { title: "Interromper jogo", text: "Os lances ficam guardados. Nada conta até a organização decidir.", label: "Interromper" },
  rehomologate: { title: "Homologar correções", text: "Cria uma nova revisão oficial do resultado com as correções feitas depois da homologação.", label: "Homologar" },
  dispute: { title: "Contestar resultado", text: "A organização recebe a contestação e decide. O resultado oficial mantém-se até lá.", label: "Contestar" },
  disputeDecide: { title: "Decidir contestação", text: "Dar razão não altera números por si: corrige os lances (com motivo) e homologa de novo.", label: "Guardar decisão" },
};

/** One REAL league match — the Matchday of the league. Same structure as
 *  the demo LeagueMatchPage (Resumo · Onzes · Lances · Destaques · Ficha de
 *  jogo), fed by match_page and acting through the L4–L8 RPCs. Every
 *  lifecycle action quotes the match `seq` (league:stale_seq → reload).
 *  Not here for cloud leagues yet: VAR (L9) and fantasy (L10). */
export default function LeagueCloudMatchPage({ leagues, competition, dir, profile, matchId, viewKey, isManager, ui, onBack, onChanged }) {
  const [page, setPage] = useState(undefined);
  const [lineups, setLineups] = useState({});
  const [history, setHistory] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [suspendedIds, setSuspendedIds] = useState([]);
  const [sec, setSec] = useState(null);
  const [sheet, setSheet] = useState(null);
  const lastEvent = useRef(null);
  const lang = getLang();

  const load = useCallback(async () => {
    const r = await leagues.fetchMatch(matchId, viewKey);
    if (r.error) { ui.fail(r.error); setPage(null); return; }
    setPage(r.data);
    if (!r.data || !leagues.signedIn) return;
    const [lq, hq, dq, sq] = await Promise.all([
      r.data.lineups !== undefined ? Promise.resolve({ data: sheetIds(r.data.lineups) }) : leagues.fetchLineups(matchId),
      r.data.me?.isStaff || r.data.me?.memberOfTeamId ? leagues.fetchEventHistory(matchId) : Promise.resolve({ data: [] }),
      r.data.me?.isStaff || r.data.me?.memberOfTeamId ? leagues.fetchDisputes(competition.id, null) : Promise.resolve({ data: { items: [] } }),
      leagues.fetchDiscipline(competition.id, viewKey),
    ]);
    setLineups(lq.data || {});
    setHistory(hq.data || []);
    setDisputes((dq.data?.items || []).filter((d) => d.matchId === matchId));
    setSuspendedIds((sq.data?.suspended || []).filter((x) => x.matches > x.served).map((x) => x.playerId));
  }, [leagues, matchId, viewKey, competition.id, ui]);
  useEffect(() => { load(); }, [load]);

  const rules = competition.regulation?.rules || null;
  const perms = useMemo(() => (page ? matchPermissions(page, {
    isManager, signedIn: leagues.signedIn, rules,
    leaderTeamIds: leagues.leaderTeams.filter((x) => ["captain", "vice"].includes(x.role)).map((x) => x.id),
    memberTeamIds: leagues.leaderTeams.map((x) => x.id),
  }) : {}), [page, isManager, leagues.signedIn, leagues.leaderTeams, rules]);

  if (page === undefined) return <BackHeader title="…" onBack={onBack} />;
  if (!page) {
    return (
      <div>
        <BackHeader title={t("Jogo não encontrado")} onBack={onBack} />
        <div style={{ color: C.text2 }}>{t("Este jogo não existe ou não é público.")}</div>
      </div>
    );
  }

  const m = { ...page.match, lineups };
  const home = dir.teamById[m.homeId] || { name: page.teams?.home?.name || "—", short: "?", color: null };
  const away = dir.teamById[m.awayId] || { name: page.teams?.away?.name || "—", short: "?", color: null };
  const started = SCORE_STATES.has(m.state);
  const official = page.score.state === "homologated";
  const seq = m.seq;
  const squadOf = (tid) => dir.players.filter((p) => p.teamId === tid);
  const appeared = (tid) => (lineups[tid]?.length ? lineups[tid].map((id) => dir.playerById[id]).filter(Boolean) : squadOf(tid));
  const candidates = [...appeared(m.homeId), ...appeared(m.awayId)];
  const roundN = page.round?.number;

  /** RPC → { ok } for sheets; errors to the shell; stale_seq reloads. */
  const run = async (fn, okMsg, { reloadAll = false } = {}) => {
    const r = await fn();
    if (r?.error) {
      ui.fail(r.error);
      if (r.error === "stale_seq" || r.error === "stale_event" || r.error === "stale_formation") load();
      return { message: leagueCloudError(r.error) };
    }
    if (okMsg) ui.ok(okMsg);
    await load();
    if (reloadAll) onChanged?.();
    return { ok: true, data: r.data };
  };

  const recordEvent = (event, post = false) => run(async () => {
    const r = await leagues.recordEvent(m.id, event, { post });
    if (!r.error) lastEvent.current = event;
    if (!r.error && r.data?.duplicate) return { data: r.data };
    return r;
  }, event.supersedes ? t("Correção registada.") : t("Lance registado."));

  const on = (action) => {
    switch (action) {
      case "start": return run(() => leagues.setMatchPhase(m.id, "live", seq), t("Jogo iniciado."), { reloadAll: true });
      case "end": return run(() => leagues.setMatchPhase(m.id, "finished", seq), t("Jogo terminado — resultado provisório."), { reloadAll: true });
      case "submit": return run(() => leagues.setMatchPhase(m.id, "submitted", seq), t("Ficha de jogo enviada para validação."), { reloadAll: true });
      case "homologate": return run(() => leagues.homologateMatch(m.id, seq), t("Resultado homologado — já conta na classificação oficial."), { reloadAll: true });
      case "resend": return lastEvent.current ? recordEvent(lastEvent.current) : null;
      default: return setSheet({ kind: action });
    }
  };

  const statusLine = {
    unscheduled: t("Por agendar — a organização ainda não marcou data."),
    scheduled: m.kickoff ? tf(t("A iniciar · {when}"), { when: fmtKickoff(m.kickoff, lang) }) : t("Agendado."),
    postponed: m.statusReason ? tf(t("Adiado — {reason}"), { reason: m.statusReason }) : t("Adiado — nova data a anunciar pela organização."),
    cancelled: t("Cancelado — não conta para a classificação."),
    live: t("Em andamento — dados ao vivo, não oficiais."),
    ended_provisional: t("Resultado provisório — aguarda homologação da organização."),
    in_review: t("Ficha de jogo em validação pela organização."),
    abandoned: t("Interrompido — aguarda decisão da organização."),
    homologated: page.homologation
      ? tf(t("Resultado homologado · {by} · {when}"), { by: roleLabel(page.homologation.role || "manager"), when: fmtDateTime(page.homologation.at, lang) })
        + (page.homologation.kind === "walkover" ? ` · ${t("W.O.")}` : page.homologation.kind === "annulled" ? ` · ${t("anulado — não conta")}` : page.homologation.kind === "awarded" ? ` · ${t("resultado atribuído")}` : "")
      : t("Resultado homologado."),
  }[m.state];

  const sections = [
    { id: "resumo", label: LM.secSummary },
    { id: "onzes", label: LM.secLineups },
    started && { id: "lances", label: LM.secTimeline },
    ["ended_provisional", "in_review", "homologated", "abandoned"].includes(m.state) && { id: "destaques", label: LM.secAwards },
    (history.length > 0 || page.homologation) && { id: "ficha", label: LM.secReport },
  ].filter(Boolean).map((x) => ({ ...x, label: t(x.label) }));
  const current = sections.some((s) => s.id === sec) ? sec : "resumo";
  const suspendedHere = suspendedIds.map((id) => dir.playerById[id]).filter((p) => p && (p.teamId === m.homeId || p.teamId === m.awayId));
  const myDisputeOpen = disputes.some((d) => d.status === "open" && d.teamId === perms.leaderTeamId);

  return (
    <div>
      <BackHeader title={`${home.short} – ${away.short}`} subtitle={[roundN ? tf(LM.round, { n: roundN }) : null, competition.name].filter(Boolean).join(" · ")} onBack={onBack} />

      <div style={{ ...cardStyle, marginBottom: S.md, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: S.xs, marginBottom: S.sm, flexWrap: "wrap" }}>
          <LeagueStateChip state={m.state} />
          {started && <Chip variant={official ? "green" : "orange"}>{t(official ? LM.official : LM.unofficial)}</Chip>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: S.sm }}>
          {[home, null, away].map((tm, i) => (tm ? (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, minWidth: 0 }}>
              <RivalsCrest initials={(tm.short || "?").slice(0, 2)} color={tm.color} size={44} />
              <span style={{ fontSize: T.meta, fontWeight: 800, maxWidth: "100%", overflowWrap: "anywhere" }}>{tm.name}</span>
            </div>
          ) : (
            <div key="score" style={{ ...displayFont, fontSize: 40, color: started ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums", padding: `0 ${S.sm}px` }}>
              {started && page.score.home != null ? `${page.score.home}–${page.score.away}` : "vs"}
            </div>
          )))}
        </div>
        <div style={{ fontSize: T.meta, color: ["ended_provisional", "in_review", "live", "abandoned"].includes(m.state) ? C.orange : C.text2, marginTop: S.sm, lineHeight: 1.5 }}>{statusLine}</div>
        {page.score.pendingRehomologation && <div style={{ fontSize: T.meta, color: C.orange, marginTop: S.xs }}>{t(LM.pendingRehom)}</div>}
      </div>

      {sections.length > 1 && <SegmentedControl options={sections} value={current} onChange={setSec} />}

      {current === "resumo" && (
        <>
          <LeagueCloudLiveControls match={m} perms={perms} role={page.me?.operatorRole || page.myRole} on={on} canResend={Boolean(lastEvent.current)} />

          {perms.dispute && (
            <section style={{ ...cardStyle, marginBottom: S.lg, borderColor: C.blueBorder }} aria-label={t("Ferramentas do capitão")}>
              <div style={{ fontSize: T.meta, fontWeight: 800, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.xs }}>{t("Capitão")} · {dir.teamById[perms.leaderTeamId]?.name}</div>
              {myDisputeOpen
                ? <div style={{ fontSize: T.body, color: C.text2 }}>{t("A tua contestação está aberta — aguarda decisão da organização.")}</div>
                : (
                  <>
                    <div style={{ fontSize: T.body, color: C.text1, marginBottom: S.sm }}>
                      {t("Se algo está errado na ficha de jogo, contesta com motivo — a organização decide.")}
                      {page.dispute?.windowClosesAt ? ` ${tf(t("Prazo: {when}."), { when: fmtDateTime(page.dispute.windowClosesAt, lang) })}` : ""}
                    </div>
                    <BtnGhost block tone="danger" onClick={() => setSheet({ kind: "dispute" })}><Flag size={16} aria-hidden /> {t(LM.dispute)}</BtnGhost>
                  </>
                )}
            </section>
          )}

          {disputes.filter((d) => d.status === "open").map((d) => (
            <div key={d.id} role="note" style={{ ...cardStyle, marginBottom: S.md, borderColor: C.orange }}>
              <div style={{ fontSize: T.meta, fontWeight: 800, color: C.orange, marginBottom: S.xs }}>{t(LM.disputes)} · {dir.teamById[d.teamId]?.name || "—"}</div>
              <div style={{ fontSize: T.body, marginBottom: d.canDecide || perms.decideDispute ? S.sm : 0 }}>“{d.reason}”</div>
              {(d.canDecide || perms.decideDispute) && (
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                  <BtnGhost tone="accent" onClick={() => setSheet({ kind: "disputeDecide", dispute: d, decision: "upheld" })} style={{ flex: "1 1 120px" }}>{t(LM.uphold)}</BtnGhost>
                  <BtnGhost onClick={() => setSheet({ kind: "disputeDecide", dispute: d, decision: "rejected" })} style={{ flex: "1 1 120px" }}>{t(LM.rejectDispute)}</BtnGhost>
                </div>
              )}
              {d.teamId === perms.leaderTeamId && <BtnGhost compact onClick={() => run(() => leagues.decideDispute(d.id, "withdrawn", null), t("Contestação retirada."))} style={{ marginTop: S.sm }}>{t(LM.withdraw)}</BtnGhost>}
            </div>
          ))}

          <div style={{ ...cardStyle, marginBottom: S.md, display: "grid", gap: S.sm, fontSize: T.body }}>
            {info(Clock, <>{m.kickoff ? fmtKickoff(m.kickoff, lang) : t(LM.tbd)}{m.timezone ? ` · ${m.timezone}` : ""}</>)}
            {info(MapPin, <>{m.venue || t("Local por definir")}</>)}
            {info(Shield, <>{page.officials.length ? page.officials.map((o) => `${o.name} (${roleLabel(o.role)})`).join(" · ") : t("Arbitragem e mesa por atribuir")}</>)}
          </div>

          {suspendedHere.length > 0 && (
            <div role="note" style={{ display: "flex", gap: S.sm, background: C.redDim, border: `1px solid ${C.red}55`, borderRadius: R.control, padding: S.md, marginBottom: S.md, fontSize: T.meta, lineHeight: 1.5 }}>
              <AlertTriangle size={16} color={C.red} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("Suspensos (decisão da organização):")} {suspendedHere.map((p) => `${p.name} (${dir.teamById[p.teamId]?.short})`).join(", ")}</span>
            </div>
          )}

          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.6, marginBottom: S.lg }}>
            {tf(t("Regulamento v{v}: {fmt}, vitória {w} pts."), { v: competition.regulation?.version ?? "—", fmt: `${profile.label}${profile.halves ? ` · 2×${profile.halves.minutes} min` : ""}`, w: rules?.points?.win ?? 3 })}
            {profile.rollingSubs ? ` ${t("Substituições livres.")}` : ""}
          </div>

          {started && <><div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.sm }}>{t("Últimos lances")}</div><LeagueTimeline match={m} log={page.log} dir={dir} /></>}
        </>
      )}

      {current === "onzes" && [m.homeId, m.awayId].map((tid) => {
        const saved = lineups[tid] ?? null;
        const squadIds = (saved?.length ? saved : squadOf(tid).map((p) => p.id));
        const formation = tid === m.homeId ? page.formations?.home : page.formations?.away;
        return (
          <section key={tid} style={{ marginBottom: S.xl }}>
            <SectionLabel>{dir.teamById[tid]?.name || "—"}</SectionLabel>
            {(perms.teamSheet || saved) && (
              <LeagueCloudTeamSheet team={dir.teamById[tid]} squad={squadOf(tid)} sheet={saved} suspendedIds={suspendedIds} profile={profile}
                canEdit={Boolean(perms.teamSheet)} onSave={(ids) => run(async () => {
                  const r = await leagues.setLineup(m.id, tid, ids);
                  if (!r.error) setLineups((x) => ({ ...x, [tid]: ids }));
                  return r;
                }, t("Ficha da equipa guardada."))} />
            )}
            {profile.tacticsSupported ? (
              <LeagueTacticsPanel match={m} teamId={tid} lang={lang} dir={dir} outfield={profile.outfield} squadIds={squadIds.filter((id) => !suspendedIds.includes(id))}
                blockedIds={suspendedIds.filter((id) => dir.playerById[id]?.teamId === tid)} published={formation || null}
                canEdit={perms.formation ? perms.formation(tid) : false}
                onSave={(board) => run(() => leagues.saveFormation(m.id, tid, board.formation, board.slots, "published", formation?.version ?? null), t("Onze publicado."))} />
            ) : (
              <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Quadro tático indisponível para este formato.")}</div>
            )}
          </section>
        );
      })}

      {current === "lances" && (
        <>
          {perms.correct && <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{perms.correctNeedsReason ? t("Ficha de jogo fechada: correções só pela autoridade, com motivo, e contam na próxima homologação.") : t("“Corrigir” cria um novo lance que substitui o anterior, com motivo. Nada é apagado.")}</div>}
          {perms.correct && perms.correctNeedsReason && <BtnGhost block onClick={() => setSheet({ kind: "event", post: true })} style={{ marginBottom: S.md }}>{t("Acrescentar lance em falta (com motivo)")}</BtnGhost>}
          <LeagueTimeline match={m} log={page.log} dir={dir} onCorrect={perms.correct ? (e) => setSheet({ kind: "correct", event: e }) : null} />
        </>
      )}

      {current === "destaques" && (
        <LeagueCloudAwards page={page} dir={dir} perms={perms} candidates={candidates}
          onAward={(pid, reason) => run(() => leagues.awardOfficialMvp(m.id, pid, reason), t("Craque oficial definido."))}
          onOpenVote={() => run(() => leagues.openFanVote(m.id, 24), t("Votação dos adeptos aberta por 24 h."))}
          onVote={(pid) => run(() => leagues.castFanVote(m.id, pid), t("Voto registado. Podes mudá-lo até a votação fechar."))}
          onCloseDemo={leagues.mode === "demo" && isManager ? () => run(() => leagues.closeFanVoteDemo(m.id), t("Votação dos adeptos fechada.")) : null} />
      )}

      {current === "ficha" && (
        <div>
          {page.homologation && (
            <div style={{ ...cardStyle, marginBottom: S.md, fontSize: T.body, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 800 }}>{tf(t("Homologação · revisão {n}"), { n: page.homologation.revision })}</div>
              <div style={{ color: C.text2, fontSize: T.meta }}>
                {page.homologation.kind === "annulled" ? t("Anulado") : `${page.homologation.home}–${page.homologation.away}`} · {roleLabel(page.homologation.role || "manager")} · {fmtDateTime(page.homologation.at, lang)}
                {page.homologation.reason ? ` · “${page.homologation.reason}”` : ""}
              </div>
            </div>
          )}
          {history.length > 0 && (
            <>
              <SectionLabel>{t("Histórico de lances (incluindo correções)")}</SectionLabel>
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {history.map((e) => (
                  <li key={e.id} style={{ borderBottom: `1px solid ${C.border}`, padding: `${S.sm}px 0`, fontSize: T.meta, color: e.effective ? C.text1 : C.text2, textDecoration: e.effective ? "none" : "line-through" }}>
                    <b>#{e.seq}</b> · {e.action === "void" ? t("Anulação") : t(EVENT_LABEL[e.type] || e.type)}{e.minute != null ? ` · ${e.minute}'` : ""}
                    {e.playerId ? ` · ${dir.playerById[e.playerId]?.name || "—"}` : ""} · {dir.teamById[e.teamId]?.short || ""}
                    <span style={{ display: "block", color: C.text2 }}>{e.recordedBy || "—"}{e.recordedRole ? ` (${roleLabel(e.recordedRole === "team_leader" ? "captain" : e.recordedRole)})` : ""}{e.recordedAt ? ` · ${fmtDateTime(e.recordedAt, lang)}` : ""}{e.reason ? ` · “${e.reason}”` : ""}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {sheet?.kind === "event" && (
        <LeagueEventSheet match={m} dir={dir} types={CLOUD_EVENT_TYPES} makeId={newCloudEventId} needsReason={Boolean(sheet.post || perms.correctNeedsReason)}
          onSubmit={(e) => recordEvent(e, Boolean(sheet.post || perms.correctNeedsReason))} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "correct" && (
        <LeagueEventSheet match={m} dir={dir} mode="correct" original={sheet.event} types={CLOUD_EVENT_TYPES} makeId={newCloudEventId}
          onSubmit={(e) => recordEvent(e, perms.correctNeedsReason)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "schedule" && (
        <LeagueCloudScheduleSheet match={m} onClose={() => setSheet(null)}
          onSave={(iso, venue) => run(() => leagues.scheduleMatch(m.id, iso, venue, seq), t("Jogo agendado."), { reloadAll: true })} />
      )}
      {sheet?.kind === "officials" && (
        <LeagueCloudOfficialsSheet leagues={leagues} competition={competition} match={m} officials={page.officials.filter((o) => o.playerId)} onChanged={load} onClose={() => setSheet(null)} />
      )}
      {["postpone", "cancel", "abandon", "rehomologate", "dispute"].includes(sheet?.kind) && (
        <LeagueReasonSheet title={t(REASONS[sheet.kind].title)} text={t(REASONS[sheet.kind].text)} confirmLabel={t(REASONS[sheet.kind].label)} minLength={sheet.kind === "dispute" ? 5 : 1}
          onClose={() => setSheet(null)} onConfirm={(reason) => {
            if (sheet.kind === "postpone") return run(() => leagues.setMatchOff(m.id, "postponed", reason), t("Jogo adiado."), { reloadAll: true });
            if (sheet.kind === "cancel") return run(() => leagues.setMatchOff(m.id, "cancelled", reason), t("Jogo cancelado."), { reloadAll: true });
            if (sheet.kind === "abandon") return run(() => leagues.abandonMatch(m.id, reason, seq), t("Jogo interrompido."), { reloadAll: true });
            if (sheet.kind === "rehomologate") return run(() => leagues.homologateMatch(m.id, seq, reason), t("Correções homologadas — nova revisão oficial."), { reloadAll: true });
            return run(() => leagues.openDispute(m.id, reason, []), t("Contestação enviada à organização."));
          }} />
      )}
      {sheet?.kind === "walkover" && <LeagueCloudWalkoverSheet home={home} away={away} match={m} onClose={() => setSheet(null)}
        onConfirm={(absent, reason) => run(() => leagues.recordWalkover(m.id, absent, reason, seq), t("W.O. registado e homologado."), { reloadAll: true })} />}
      {sheet?.kind === "decideAbandoned" && <LeagueCloudAbandonedSheet onClose={() => setSheet(null)}
        onConfirm={(decision, payload, reason) => run(() => leagues.decideAbandoned(m.id, decision, payload, reason, seq), t("Decisão registada."), { reloadAll: true })} />}
      {sheet?.kind === "disputeDecide" && (
        <LeagueReasonSheet title={t(REASONS.disputeDecide.title)} text={`${t(sheet.decision === "upheld" ? LM.uphold : LM.rejectDispute)} — ${t(REASONS.disputeDecide.text)}`}
          confirmLabel={t(REASONS.disputeDecide.label)} onClose={() => setSheet(null)}
          onConfirm={(note) => run(() => leagues.decideDispute(sheet.dispute.id, sheet.decision, note), t("Contestação decidida."))} />
      )}
    </div>
  );
}

/** { teamId: sheet|null } → { teamId: [ids] } for the teams whose sheet I may see. */
const sheetIds = (sheets) => Object.fromEntries(Object.entries(sheets || {}).filter(([, s]) => s).map(([tid, s]) => [tid, s.players.map((p) => p.id)]));

const info = (Icon, children) => (
  <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start", color: C.text1 }}><Icon size={16} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ minWidth: 0 }}>{children}</span></div>
);
