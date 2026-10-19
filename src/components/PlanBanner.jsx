import { Info, X } from "lucide-react";
import { C, S, R, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import BtnGhost from "./BtnGhost";

/**
 * Gentle, organizer-only plan notice (trial ending in ≤3 days, Free group
 * past 20 players). Informs — never blocks anything behind it.
 * Props: text (already translated), actionLabel + onAction, onDismiss?
 * (shows the ✕; omit for a notice that just stays while it's true).
 */
export default function PlanBanner({ text, actionLabel, onAction, onDismiss }) {
  return (
    <div role="status" style={{ display: "flex", gap: S.md, alignItems: "flex-start", background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.card, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg }}>
      <Info size={18} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.45 }}>{text}</div>
        {onAction && <BtnGhost compact tone="accent" onClick={onAction} style={{ marginTop: S.sm }}>{actionLabel}</BtnGhost>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={t("Fechar")}
          style={{ width: TOUCH.min, height: TOUCH.min, margin: `-${S.md}px -${S.md}px 0 0`, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}
