import { useState } from "react";
import { C, R, S, T, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC } from "../lib/rivalsCopy";
import BtnGhost from "./BtnGhost";

/** Inline "are you sure?" for a destructive step (decline / cancel) with
 *  an optional reason (≤280). onConfirm(reason) may be async. */
export default function ReasonConfirm({ text, confirmLabel, onConfirm, onCancel, busy }) {
  const [reason, setReason] = useState("");
  return (
    <div role="alertdialog" aria-label={text} style={{ background: C.surface, border: `1px solid ${C.red}55`, borderRadius: R.control, padding: S.md, marginTop: S.sm }}>
      <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, marginBottom: S.sm }}>{text}</div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={280} placeholder={t(CC.reasonPlaceholder)}
        aria-label={t(CC.reasonPlaceholder)} style={{ ...inputStyle(), marginBottom: S.sm }} />
      <div style={{ display: "flex", gap: S.sm }}>
        <BtnGhost tone="danger" onClick={() => onConfirm(reason.trim() || null)} disabled={busy} style={{ flex: 1 }}>{confirmLabel || t(RC.confirm)}</BtnGhost>
        <BtnGhost onClick={onCancel} disabled={busy} style={{ flex: 1 }}>{t(RC.cancel)}</BtnGhost>
      </div>
    </div>
  );
}
