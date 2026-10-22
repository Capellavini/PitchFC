import { Play, Square, CheckCircle2, RotateCcw, Plus, Repeat, Video, CalendarClock } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** Gestor-only match operation, by state: start → register events →
 *  end (provisional) → homologate / send to review; reopen a homologated
 *  match for review; postpone; VAR on/off (state only). One primary CTA. */
export default function LeagueLiveControls({ match, act, onAddEvent, onReason }) {
  const s = match.state;
  const box = { ...cardStyle, borderColor: C.accentBorder, marginBottom: S.lg };
  const row = { display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.sm };
  const grow = { flex: "1 1 150px" };
  return (
    <section style={box} aria-label={t("Operação do jogo (Gestor)")}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("Operação do jogo · Gestor")}</div>
      {s === "scheduled" && (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{t("Ao iniciar, os lances passam a ser registados nesta ficha de jogo. O relógio não é partilhado nesta demo.")}</div>
          <div style={row}>
            <BtnPrimary onClick={() => act.move(match.id, "live", {}, t("Jogo iniciado."))} style={grow}><Play size={16} aria-hidden /> {t("Iniciar jogo")}</BtnPrimary>
            <BtnGhost onClick={() => onReason("postponed")} style={grow}><CalendarClock size={16} aria-hidden /> {t("Adiar")}</BtnGhost>
            <BtnGhost onClick={() => act.toggleVar(match.id)} style={grow}><Video size={16} aria-hidden /> {match.var?.enabled ? t("Desligar VAR") : t("Ativar VAR")}</BtnGhost>
          </div>
        </>
      )}
      {s === "postponed" && (
        <div style={row}><BtnPrimary onClick={() => act.move(match.id, "scheduled", {}, t("Jogo reagendado."))} style={grow}>{t("Voltar a agendar")}</BtnPrimary></div>
      )}
      {s === "live" && (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{t("Dados ao vivo são provisórios até à homologação.")}</div>
          <div style={row}>
            <BtnPrimary onClick={onAddEvent} style={grow}><Plus size={16} aria-hidden /> {t("Registar lance")}</BtnPrimary>
            <BtnGhost onClick={() => act.resendLast(match.id)} disabled={!act.hasLast(match.id)} style={grow} title={t("Simula um reenvio do último lance (ex.: rede instável) — não duplica.")}><Repeat size={16} aria-hidden /> {t("Reenviar último lance")}</BtnGhost>
            <BtnGhost onClick={() => act.move(match.id, "ended_provisional", {}, t("Jogo terminado — resultado provisório."))} style={grow}><Square size={16} aria-hidden /> {t("Terminar jogo")}</BtnGhost>
          </div>
        </>
      )}
      {(s === "ended_provisional" || s === "in_review") && (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs }}>{t("Corrige lances na secção Lances (com motivo). Homologar torna o resultado oficial na classificação.")}</div>
          <div style={row}>
            <BtnPrimary onClick={() => act.move(match.id, "homologated", {}, t("Resultado homologado — já conta na classificação oficial."))} style={grow}><CheckCircle2 size={16} aria-hidden /> {t("Homologar")}</BtnPrimary>
            {s === "ended_provisional" && <BtnGhost onClick={() => onReason("in_review")} style={grow}>{t("Enviar para revisão")}</BtnGhost>}
          </div>
        </>
      )}
      {s === "homologated" && (
        <div style={row}><BtnGhost onClick={() => onReason("in_review")} style={grow}><RotateCcw size={16} aria-hidden /> {t("Reabrir para revisão")}</BtnGhost></div>
      )}
    </section>
  );
}
