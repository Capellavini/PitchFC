import { Play, Square, CheckCircle2, Plus, Repeat, CalendarClock, Send, Ban, Flag, ShieldAlert, Users } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LM } from "../../lib/leagueMatchCopy";
import { roleLabel } from "../../lib/leagueCloudCopy";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/**
 * Operation of a REAL league match — same box and order as the demo's
 * LeagueLiveControls, driven by `perms` (lib/leagueMatches.matchPermissions,
 * i.e. what the caller's role allows; the RPCs re-check). One primary CTA
 * per state:
 *   scheduled → Iniciar · (Gestor) reagendar / adiar / cancelar / W.O. / arbitragem
 *   live      → Registar lance · reenviar último · terminar · interromper
 *   finished  → Homologar (authority) or Enviar para validação (referee/Gestor)
 *   homologated with pending corrections → Homologar correções
 *   abandoned → Decidir jogo interrompido
 * `on(action)` handles everything (sheets / RPCs live in the match page).
 */
export default function LeagueCloudLiveControls({ match, perms, role, on, canResend }) {
  const s = match.state;
  const anything = perms.start || perms.addEvent || perms.end || perms.submit || perms.homologate || perms.rehomologate
    || perms.walkover || perms.abandon || perms.decideAbandoned || perms.schedule || perms.postpone || perms.cancel || perms.assignOfficials;
  if (!anything) return null;
  const box = { ...cardStyle, borderColor: C.accentBorder, marginBottom: S.lg };
  const row = { display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.sm };
  const grow = { flex: "1 1 150px" };
  const hint = (txt) => <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs, lineHeight: 1.5 }}>{txt}</div>;
  return (
    <section style={box} aria-label={t(LM.operation)}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {t(LM.operation)}{role ? ` · ${roleLabel(role === "team_leader" ? "captain" : role)}` : ""}
      </div>

      {(s === "unscheduled" || s === "postponed" || s === "scheduled") && (
        <>
          {s === "scheduled" && perms.start && hint(t("Ao iniciar, os lances passam a ser registados nesta ficha de jogo. Dados ao vivo são provisórios até à homologação."))}
          {s !== "scheduled" && perms.schedule && hint(s === "postponed" ? t("Jogo adiado: agenda uma nova data para o reabrir.") : t("Define data, hora e local para abrir o jogo à operação."))}
          <div style={row}>
            {s === "scheduled" && perms.start && <BtnPrimary onClick={() => on("start")} style={grow}><Play size={16} aria-hidden /> {t(LM.start)}</BtnPrimary>}
            {perms.schedule && (s === "scheduled"
              ? <BtnGhost onClick={() => on("schedule")} style={grow}><CalendarClock size={16} aria-hidden /> {t(LM.reschedule)}</BtnGhost>
              : <BtnPrimary onClick={() => on("schedule")} style={grow}><CalendarClock size={16} aria-hidden /> {t(LM.schedule)}</BtnPrimary>)}
            {perms.postpone && <BtnGhost onClick={() => on("postpone")} style={grow}>{t(LM.postpone)}</BtnGhost>}
            {perms.assignOfficials && <BtnGhost onClick={() => on("officials")} style={grow}><Users size={16} aria-hidden /> {t(LM.officials)}</BtnGhost>}
            {perms.walkover && <BtnGhost onClick={() => on("walkover")} style={grow}><Flag size={16} aria-hidden /> {t(LM.walkover)}</BtnGhost>}
            {perms.cancel && <BtnGhost tone="danger" onClick={() => on("cancel")} style={grow}><Ban size={16} aria-hidden /> {t(LM.cancel)}</BtnGhost>}
          </div>
        </>
      )}

      {s === "live" && (
        <>
          {hint(t("Dados ao vivo são provisórios até à homologação."))}
          <div style={row}>
            {perms.addEvent && <BtnPrimary onClick={() => on("event")} style={grow}><Plus size={16} aria-hidden /> {t(LM.addEvent)}</BtnPrimary>}
            {perms.addEvent && <BtnGhost onClick={() => on("resend")} disabled={!canResend} style={grow} title={t("Reenvia o último lance (ex.: rede instável) — não duplica.")}><Repeat size={16} aria-hidden /> {t("Reenviar último lance")}</BtnGhost>}
            {perms.end && <BtnGhost onClick={() => on("end")} style={grow}><Square size={16} aria-hidden /> {t(LM.end)}</BtnGhost>}
            {perms.abandon && <BtnGhost tone="danger" onClick={() => on("abandon")} style={grow}><ShieldAlert size={16} aria-hidden /> {t(LM.abandon)}</BtnGhost>}
          </div>
        </>
      )}

      {(s === "ended_provisional" || s === "in_review") && (
        <>
          {hint(perms.homologate ? t("Corrige lances na secção Lances (com motivo). Homologar torna o resultado oficial na classificação.")
            : s === "in_review" ? t("Ficha de jogo enviada — aguarda homologação da organização.") : t("Resultado provisório — aguarda validação."))}
          <div style={row}>
            {perms.homologate && <BtnPrimary onClick={() => on("homologate")} style={grow}><CheckCircle2 size={16} aria-hidden /> {t(LM.homologate)}</BtnPrimary>}
            {perms.submit && !perms.homologate && <BtnPrimary onClick={() => on("submit")} style={grow}><Send size={16} aria-hidden /> {t(LM.submit)}</BtnPrimary>}
            {perms.submit && perms.homologate && <BtnGhost onClick={() => on("submit")} style={grow}><Send size={16} aria-hidden /> {t(LM.submit)}</BtnGhost>}
            {perms.addEvent && <BtnGhost onClick={() => on("event")} style={grow}><Plus size={16} aria-hidden /> {t(LM.addEvent)}</BtnGhost>}
          </div>
        </>
      )}

      {s === "homologated" && perms.rehomologate && (
        <>
          {hint(t(LM.pendingRehom))}
          <div style={row}><BtnPrimary onClick={() => on("rehomologate")} style={grow}><CheckCircle2 size={16} aria-hidden /> {t(LM.rehomologate)}</BtnPrimary></div>
        </>
      )}
      {s === "homologated" && !perms.rehomologate && perms.correct && hint(t("Jogo homologado: as correções (com motivo) só contam depois de nova homologação."))}

      {s === "abandoned" && perms.decideAbandoned && (
        <>
          {hint(t("Jogo interrompido: nada conta até a organização decidir (manter resultado, atribuir, anular ou repetir)."))}
          <div style={row}><BtnPrimary onClick={() => on("decideAbandoned")} style={grow}>{t(LM.decideAbandoned)}</BtnPrimary></div>
        </>
      )}
    </section>
  );
}
