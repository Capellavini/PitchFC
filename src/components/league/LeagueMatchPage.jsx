import { useState } from "react";
import { Video, MapPin, Clock, Shield, AlertTriangle } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { teamById, playerById, fmtKickoff, fmtDateTime, LEAGUE, COMPETITION, competitionById, modOn } from "../../lib/leagueDemo";
import { canCorrect, DEMO_RULES } from "../../lib/core/league";
import BackHeader from "../BackHeader";
import SegmentedControl from "../SegmentedControl";
import Chip from "../Chip";
import TeamCrest from "../TeamCrest";
import LeagueStateChip from "./LeagueStateChip";
import LeagueTimeline from "./LeagueTimeline";
import LeagueLineups from "./LeagueLineups";
import LeagueAwards from "./LeagueAwards";
import LeagueSumula from "./LeagueSumula";
import LeagueLiveControls from "./LeagueLiveControls";
import LeagueCaptainTools from "./LeagueCaptainTools";
import LeagueEventSheet from "./LeagueEventSheet";
import LeagueReasonSheet from "./LeagueReasonSheet";
import LeagueLineupSheet from "./LeagueLineupSheet";

const STARTED = new Set(["live", "ended_provisional", "in_review", "homologated", "walkover"]);
const ENDED = new Set(["ended_provisional", "in_review", "homologated"]);

const REASON_COPY = {
  postponed: { title: "Adiar jogo", text: "O jogo sai do calendário da jornada até ser reagendado. Fica registado na ficha de jogo.", label: "Adiar" },
  in_review: { title: "Enviar para revisão", text: "O resultado continua fora da classificação oficial até ser homologado.", label: "Enviar para revisão" },
  contest: { title: "Contestar resultado", text: "A organização da liga recebe a contestação e decide. O resultado fica em revisão.", label: "Contestar" },
};

/** One league match (the Matchday of the league): score + state, then
 *  ONLY the relevant sections — Resumo · Onzes · Lances · Destaques ·
 *  Vídeos · Ficha de jogo. Actions depend on the demo role. */
export default function LeagueMatchPage({ ctx, matchId }) {
  const { state, derived, role, acc, act, lang, back, open } = ctx;
  const match = state.matches.find((m) => m.id === matchId);
  const [sec, setSec] = useState(null);
  const [sheet, setSheet] = useState(null);

  if (!match) {
    return (
      <div>
        <BackHeader title={t("Jogo não encontrado")} onBack={back} />
        <div style={{ color: C.text2 }}>{t("Este jogo já não existe (a liga pode ter sido limpa).")}</div>
      </div>
    );
  }
  const home = teamById[match.homeId], away = teamById[match.awayId];
  const score = derived.scores[match.id];
  const log = state.logs[match.id] || [];
  const started = STARTED.has(match.state);
  const captainHere = role === "captain" && (match.homeId === acc.teamId || match.awayId === acc.teamId);

  const sections = [
    { id: "resumo", label: LG.secSummary },
    { id: "escalacoes", label: LG.secLineups }, // always: call-up or inscribed squad (scouting) + boards
    started && { id: "lances", label: LG.secTimeline },
    ENDED.has(match.state) && { id: "destaques", label: LG.secHighlights },
    modOn("var") && match.var?.enabled && { id: "videos", label: LG.secVideos },
    (match.history || []).length > 0 && { id: "sumula", label: LG.secReport },
  ].filter(Boolean);
  const current = sections.some((s) => s.id === sec) ? sec : "resumo";

  const statusLine = {
    scheduled: tf(t("A iniciar · {when}"), { when: fmtKickoff(match.kickoff, lang) }),
    postponed: t("Adiado — nova data a anunciar pela organização."),
    cancelled: t("Cancelado — não conta para a classificação."),
    live: t("Em andamento — dados ao vivo, provisórios."),
    ended_provisional: t("Resultado provisório — aguarda homologação da organização."),
    in_review: match.contest ? tf(t("Em revisão — contestado por {team}."), { team: teamById[match.contest.teamId]?.name }) : t("Em revisão pela organização."),
    homologated: match.homologatedBy ? tf(t("Resultado homologado · {by} · {when}"), { by: match.homologatedBy.by, when: fmtDateTime(match.homologatedBy.at, lang) }) : t("Resultado homologado."),
    walkover: t("Vitória por falta de comparência (W.O.)."),
  }[match.state];
  const suspendedHere = Object.values(derived.discipline).filter((d) => d.pending > 0 && (d.teamId === match.homeId || d.teamId === match.awayId));

  const onReason = (kind) => setSheet({ kind: "reason", reasonKind: kind });
  const confirmReason = (kind, reason) => {
    if (kind === "contest") return act.move(match.id, "in_review", { reason }, t("Contestação enviada — o resultado está em revisão."));
    if (kind === "postponed") return act.move(match.id, "postponed", { reason }, t("Jogo adiado."));
    return act.move(match.id, "in_review", { reason }, t("Enviado para revisão."));
  };

  return (
    <div>
      <BackHeader title={`${home.short} – ${away.short}`} subtitle={`${match.roundName ? t(match.roundName) : tf(LG.round, { n: match.round })} · ${t((competitionById[match.competitionId] || COMPETITION).name)} · ${t(COMPETITION.category)}`} onBack={back} />

      <div style={{ ...cardStyle, marginBottom: S.md, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: S.sm }}><LeagueStateChip state={match.state} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: S.sm }}>
          {[home, null, away].map((tm, i) => (tm ? (
            <button key={tm.id} type="button" onClick={() => open({ kind: "team", id: tm.id })} style={{ background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs, minWidth: 0, minHeight: 44, padding: 0 }}>
              <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={44} />
              <span style={{ fontSize: T.meta, fontWeight: 800, maxWidth: "100%", overflowWrap: "anywhere" }}>{tm.name}</span>
            </button>
          ) : (
            <div key="score" style={{ ...displayFont, fontSize: 40, color: started ? C.text1 : C.text2, fontVariantNumeric: "tabular-nums", padding: `0 ${S.sm}px` }}>
              {started ? `${score.home}–${score.away}` : "vs"}
            </div>
          )))}
        </div>
        {score.shootout && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{tf(t("Desempate por penáltis: {h}–{a} (não conta no resultado)"), { h: score.shootout.home, a: score.shootout.away })}</div>}
        <div style={{ fontSize: T.meta, color: ["ended_provisional", "in_review", "live"].includes(match.state) ? C.orange : C.text2, marginTop: S.sm, lineHeight: 1.5 }}>{statusLine}</div>
      </div>

      {sections.length > 1 && <SegmentedControl options={sections} value={current} onChange={setSec} />}

      {current === "resumo" && (
        <>
          {role === "manager" && <LeagueLiveControls match={match} act={act} hasEvents={log.length > 0} onAddEvent={() => setSheet({ kind: "event" })} onReason={onReason} />}
          {captainHere && <LeagueCaptainTools match={match} teamId={acc.teamId} onLineup={() => setSheet({ kind: "lineup" })} onContest={() => onReason("contest")} />}

          <div style={{ ...cardStyle, marginBottom: S.md, display: "grid", gap: S.sm, fontSize: T.body }}>
            {info(Clock, <>{fmtKickoff(match.kickoff, lang)} · {t("hora de Lisboa")} ({LEAGUE.timeZone})</>)}
            {info(MapPin, <>{match.venue}</>)}
            {match.referee && info(Shield, <>{match.referee}</>)}
            {modOn("var") && info(Video, <>{t(match.var?.enabled ? LG.varOn : LG.varOff)}</>)}
          </div>

          {suspendedHere.length > 0 && (
            <div role="note" style={{ display: "flex", gap: S.sm, background: C.redDim, border: `1px solid ${C.red}55`, borderRadius: R.control, padding: S.md, marginBottom: S.md, fontSize: T.meta, lineHeight: 1.5 }}>
              <AlertTriangle size={16} color={C.red} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("Suspensos para o próximo jogo oficial (regras demo):")} {suspendedHere.map((d) => `${playerById[d.playerId].name} (${teamById[d.teamId].short})`).join(", ")}</span>
            </div>
          )}

          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.6, marginBottom: S.lg }}>
            {tf(t("Pontos: vitória {w}, empate {d}, derrota {l}."), { w: (competitionById[match.competitionId] || COMPETITION).points.win, d: (competitionById[match.competitionId] || COMPETITION).points.draw, l: (competitionById[match.competitionId] || COMPETITION).points.loss })} {tf(t("{n} amarelos acumulados = 1 jogo de suspensão; vermelho = {r} jogo."), { n: DEMO_RULES.yellowsForSuspension, r: DEMO_RULES.redSuspensionMatches })}
          </div>

          {started && <><div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.sm }}>{t("Últimos lances")}</div><LeagueTimeline match={match} log={log} /></>}
        </>
      )}
      {current === "escalacoes" && <LeagueLineups ctx={ctx} match={match} />}
      {current === "lances" && (
        <>
          {canCorrect(match, role) && <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t("Gestor: “Corrigir” cria um novo lance que substitui o anterior, com motivo. Nada é apagado.")}</div>}
          {role === "manager" && match.state === "homologated" && <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t("Jogo homologado: para corrigir, reabre-o para revisão no Resumo.")}</div>}
          <LeagueTimeline match={match} log={log} onCorrect={canCorrect(match, role) ? (e) => setSheet({ kind: "correct", event: e }) : null} />
        </>
      )}
      {current === "destaques" && <LeagueAwards ctx={ctx} match={match} />}
      {current === "videos" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.sm }}><Video size={16} color={C.blue} aria-hidden /> {t(LG.varOn)}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6 }}>
            {t("Nenhuma gravação neste jogo. Nesta demonstração não há captura nem envio de vídeo — só o estado do VAR. Um replay para assistir não é evidência de arbitragem e nunca altera uma decisão automaticamente.")}
          </div>
          <Chip style={{ marginTop: S.md }}>{t("Sem gravações")}</Chip>
        </div>
      )}
      {current === "sumula" && <LeagueSumula match={match} log={log} score={score} lang={lang} />}

      {sheet?.kind === "event" && <LeagueEventSheet match={match} onSubmit={(e) => act.addEvent(match.id, e)} onClose={() => setSheet(null)} />}
      {sheet?.kind === "correct" && <LeagueEventSheet match={match} mode="correct" original={sheet.event} onSubmit={(e) => act.correct(match.id, e)} onClose={() => setSheet(null)} />}
      {sheet?.kind === "lineup" && <LeagueLineupSheet match={match} teamId={acc.teamId} discipline={derived.discipline} onSave={(ids) => act.setLineup(match.id, acc.teamId, ids)} onClose={() => setSheet(null)} />}
      {sheet?.kind === "reason" && (
        <LeagueReasonSheet title={t(REASON_COPY[sheet.reasonKind].title)} text={t(REASON_COPY[sheet.reasonKind].text)} confirmLabel={t(REASON_COPY[sheet.reasonKind].label)}
          onConfirm={(reason) => confirmReason(sheet.reasonKind, reason)} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

const info = (Icon, children) => ( <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start", color: C.text1 }}><Icon size={16} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} /><span style={{ minWidth: 0 }}>{children}</span></div>
);
