import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import Sheet from "../Sheet";
import BtnPrimary from "../BtnPrimary";

/** A state change that needs a written reason (contest, send back to
 *  review, reopen, postpone). The reason is mandatory — the domain
 *  rejects an empty one too. onConfirm(reason) → { ok } closes. */
export default function LeagueReasonSheet({ title, text, confirmLabel, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const submit = () => {
    if (!reason.trim()) { setError(t("Indica um motivo — é obrigatório.")); return; }
    const r = onConfirm(reason.trim());
    if (r?.ok) onClose();
  };
  return (
    <Sheet title={title} onClose={onClose} footer={<BtnPrimary block onClick={submit}>{confirmLabel}</BtnPrimary>}>
      {text && <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, marginBottom: S.md }}>{text}</div>}
      <label htmlFor="lg-reason" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("Motivo (obrigatório)")}</label>
      <textarea id="lg-reason" value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} rows={3} maxLength={280}
        style={{ ...inputStyle(), minHeight: 88, resize: "vertical" }} />
      {error && <div role="alert" style={{ color: C.red, fontSize: T.meta, marginTop: S.sm }}>{error}</div>}
    </Sheet>
  );
}
