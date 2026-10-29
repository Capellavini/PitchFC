import { Link2, ArrowRight } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { connectionIssueText } from "../lib/fantasyConnectionCopy";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";

/**
 * FantasyConnectionCard — the Conexão da Rodada block next to the pitch.
 * It only reflects state: the pair is final when the server answered the
 * save (`saved`), otherwise it is a draft. States:
 *  - empty: invite to create one (optional, never blocks the lineup).
 *  - draft: pair chosen but not stored — says so, and offers the save.
 *  - saved: stored for `roundNo` until the lock.
 *  - invalid: a member left the starters → pick another or drop it.
 *
 * Props:
 *  - pair            { creator, finisher } players (objects with .nick) | null
 *  - saved           the stored pair equals the draft.
 *  - issue           connectionDraftIssue() code | null.
 *  - roundNo         number of the round being edited.
 *  - dirty           the squad has unsaved changes too (copy only).
 *  - saving / error  save in flight / last save error (draft kept).
 *  - onEdit, onRemove, onSave
 */
export default function FantasyConnectionCard({ pair, saved, issue, roundNo, saving = false, error = null, onEdit, onRemove, onSave }) {
  const round = String(roundNo).padStart(2, "0");
  const box = { ...cardStyle, padding: `${S.md}px ${S.lg}px`, marginBottom: S.md, borderColor: issue ? C.red : pair && !saved ? C.orange : C.border };
  const eyebrow = { display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.sm };

  if (!pair && !issue) {
    return (
      <section aria-label={t("Conexão da ronda")} style={box}>
        <div style={eyebrow}><Link2 size={14} aria-hidden /> {t("Conexão da ronda")} · {t("Opcional")}</div>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>{t("Cria a tua conexão da ronda")}</div>
        <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.45, marginBottom: S.md }}>
          {t("Escolhe quem dá a assistência e quem marca. +3 por golo, máximo +6, sem multiplicador. Não custa transferências.")}
        </div>
        <BtnPrimary block onClick={onEdit}><Link2 size={16} /> {t("Escolher a dupla")}</BtnPrimary>
      </section>
    );
  }

  const names = pair ? `${pair.creator?.nick ?? "?"} → ${pair.finisher?.nick ?? "?"}` : null;
  return (
    <section aria-label={t("Conexão da ronda")} style={box}>
      <div style={{ ...eyebrow, justifyContent: "space-between", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: S.sm }}><Link2 size={14} aria-hidden /> {t("Conexão da ronda")} {round}</span>
        <span style={{ flexShrink: 0 }}>
          {issue ? <Chip variant="red">{t("Por resolver")}</Chip> : saved ? <Chip variant="green">{t("Guardada")}</Chip> : <Chip variant="orange">{t("Rascunho")}</Chip>}
        </span>
      </div>
      {names && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", fontSize: T.h, fontWeight: 900, color: C.text1 }}>
            <span style={{ overflowWrap: "anywhere" }}>{pair.creator?.nick ?? "?"}</span>
            <ArrowRight size={18} color={C.accent} aria-hidden />
            <span style={{ overflowWrap: "anywhere" }}>{pair.finisher?.nick ?? "?"}</span>
          </div>
          {/* Direction in words: never only a colour or an arrow. */}
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs, lineHeight: 1.4 }}>
            {t("Assistência de")} <strong style={{ color: C.text1 }}>{pair.creator?.nick ?? "?"}</strong> {t("para golo de")} <strong style={{ color: C.text1 }}>{pair.finisher?.nick ?? "?"}</strong>
          </div>
        </>
      )}
      {issue && (
        <div role="alert" style={{ marginTop: S.sm, padding: `${S.sm}px ${S.md}px`, borderRadius: R.control, background: C.redDim, border: `1px solid ${C.red}55`, color: C.red, fontSize: T.meta, fontWeight: 700, lineHeight: 1.4 }}>
          {connectionIssueText(issue, pair)}
        </div>
      )}
      {!issue && (
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.4 }}>
          {saved ? `${t("Conexão guardada para a ronda")} ${round}. ${t("Podes alterá-la até ao fecho.")}` : t("Ainda não guardada — confirma abaixo para valer na ronda.")}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{error}</div>}
      <div style={{ display: "flex", gap: S.sm, marginTop: S.md, flexWrap: "wrap" }}>
        {!saved && pair && !issue && (
          <BtnPrimary onClick={onSave} disabled={saving} style={{ flex: "1 1 200px" }}>{saving ? t("Um momento…") : t("Guardar conexão e escalação")}</BtnPrimary>
        )}
        <BtnGhost onClick={onEdit} style={{ flex: "1 1 120px", minHeight: TOUCH.min }}>{issue ? t("Escolher outro") : t("Alterar")}</BtnGhost>
        <BtnGhost onClick={onRemove} style={{ flex: "1 1 120px", minHeight: TOUCH.min }}>{issue ? t("Continuar sem conexão") : t("Remover")}</BtnGhost>
      </div>
    </section>
  );
}
