import { Lock, ArrowRightLeft } from "lucide-react";
import { C, R, S, T } from "../theme";
import { lisbonTimeLabel } from "../lib/helpers";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";

const fmtLeft = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ${String(min % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)} ${t("dias")}`;
};

/** Transfers counter + lock countdown, above the squad builder.
 *  - kickoffAt: next kickoff (Date) — the round locks there, in the DB.
 *  - inProgress: a round is locked and waiting for its matchday — edits
 *    now count for the NEXT round.
 *  - transfers: transferState() of the squad being edited. */
export default function FantasyLockBar({ kickoffAt, inProgress, transfers, now = Date.now() }) {
  const ko = kickoffAt ? new Date(kickoffAt).getTime() : null;
  const future = ko && ko > now;
  const lockText = inProgress
    ? t("Ronda em curso — as mudanças contam para a próxima ronda.")
    : future
      ? `${t("Fecha às")} ${lisbonTimeLabel(new Date(ko))} · ${t("começo do jogo")} · ${t("faltam")} ${fmtLeft(ko - now)}`
      : t("Fecha no começo do próximo jogo.");

  let trText;
  let trColor = C.text1;
  if (!transfers || transfers.unlimited) {
    trText = t("Transferências ilimitadas até à primeira ronda fechar.");
  } else {
    const left = Math.max(0, transfers.free - transfers.made);
    if (transfers.extra > 0) {
      trText = `${transfers.made} ${t("transferências")} · −${transfers.cost} ${t("pts na próxima ronda")}`;
      trColor = C.orange;
    } else if (left > 0) {
      trText = `${left} ${left === 1 ? t("transferência grátis") : t("transferências grátis")} · ${t("a seguinte custa")} −4`;
    } else {
      trText = `${t("Sem transferências grátis")} · ${t("a próxima custa")} −4`;
      trColor = C.orange;
    }
  }

  const row = { display: "flex", alignItems: "flex-start", gap: S.sm, fontSize: T.meta, lineHeight: 1.4 };
  return (
    <div style={{ padding: `${S.sm}px ${S.md}px`, marginBottom: S.md, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, display: "flex", flexDirection: "column", gap: S.xs }}>
      <div style={{ ...row, color: inProgress ? C.orange : C.text1 }}>
        <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden /> <span style={{ minWidth: 0 }}>{lockText}</span>
      </div>
      <div style={{ ...row, color: trColor }}>
        <ArrowRightLeft size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden /> <span style={{ minWidth: 0 }}>{trText}</span>
      </div>
    </div>
  );
}
