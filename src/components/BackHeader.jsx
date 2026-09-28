import { ArrowLeft } from "lucide-react";
import { C, S, R, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";

/** Header for a PUSHED screen (Game Detail, Group page…): 44px back
 *  button + title (16/800, not the display face — that's for tab
 *  titles) + optional subtitle and right slot. Owns no side margin. */
export default function BackHeader({ title, subtitle, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.lg}px 0` }}>
      <button onClick={onBack} aria-label={t("Voltar")}
        style={{ width: TOUCH.min, height: TOUCH.min, borderRadius: R.control, background: C.surface, border: `1px solid ${C.border}`, color: C.text1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
        <ArrowLeft size={20} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.h, fontWeight: 800, lineHeight: 1.2, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: S.sm }}>{right}</div>}
    </div>
  );
}
