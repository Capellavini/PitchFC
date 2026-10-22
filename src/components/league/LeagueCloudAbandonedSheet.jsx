import { useState } from "react";
import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import LeagueReasonSheet from "./LeagueReasonSheet";

const pill = (active) => ({
  minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontWeight: 700, fontSize: T.meta, flex: "1 1 120px",
  border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "transparent", color: active ? C.bg : C.text1,
});

/** Abandoned match (decide_abandoned_match): keep the score / award one /
 *  annul / replay (a new fixture in the same round), with a reason. */
export default function LeagueCloudAbandonedSheet({ onConfirm, onClose }) {
  const [decision, setDecision] = useState("keep_score");
  const [h, setH] = useState(""); const [a, setA] = useState("");
  const opts = [["keep_score", t("Manter o resultado")], ["award", t("Atribuir resultado")], ["annul", t("Anular (não conta)")], ["replay", t("Repetir o jogo")]];
  const num = { width: 72, minHeight: TOUCH.min, textAlign: "center", fontSize: T.body, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control };
  return (
    <LeagueReasonSheet title={t("Decidir jogo interrompido")} text={t("Escolhe a decisão. Fica registada com motivo.")} confirmLabel={t("Decidir")} onClose={onClose}
      onConfirm={(reason) => {
        if (decision === "award" && (h === "" || a === "")) return { message: t("Indica o resultado atribuído.") };
        return onConfirm(decision, decision === "award" ? { home_score: Number(h), away_score: Number(a) } : {}, reason);
      }}>
      <div role="radiogroup" aria-label={t("Decisão")} style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.md }}>
        {opts.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={decision === id} onClick={() => setDecision(id)} style={pill(decision === id)}>{label}</button>)}
      </div>
      {decision === "award" && (
        <div style={{ display: "flex", gap: S.sm, alignItems: "center", marginBottom: S.md }}>
          <input aria-label={t("Golos da equipa da casa")} inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, "").slice(0, 2))} style={num} />
          <span>–</span>
          <input aria-label={t("Golos da equipa visitante")} inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 2))} style={num} />
        </div>
      )}
    </LeagueReasonSheet>
  );
}
