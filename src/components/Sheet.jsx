import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { C, S, T, TOUCH, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";

/**
 * Bottom sheet (mobile-first modal): dimmed backdrop, panel anchored to
 * the bottom, scrollable body, title row with a 44px close target, and an
 * optional sticky footer (the sheet's one primary action).
 *
 * A11y: role="dialog" + aria-modal + aria-labelledby the title; Escape and
 * a backdrop tap close it; focus moves into the panel on open and returns
 * to whatever had it before on close.
 */
export default function Sheet({ title, onClose, children, footer }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector("input, select, textarea, button:not([data-sheet-close]), [href], [tabindex]:not([tabindex='-1'])");
    (first || panel)?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current?.(); } };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: `${C.bg}D9`, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 430, maxHeight: "92vh", display: "flex", flexDirection: "column", boxSizing: "border-box",
          background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", outline: "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, padding: `${S.sm}px ${S.sm}px ${S.xs}px ${S.lg}px` }}>
          <div id={titleId} style={{ ...displayFont, fontSize: T.cardTitle + 1, color: C.text1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <button type="button" data-sheet-close onClick={onClose} aria-label={t(RC.close)}
            style={{ width: TOUCH.min, height: TOUCH.min, flexShrink: 0, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: `${S.xs}px ${S.lg}px ${S.lg}px` }}>{children}</div>
        {footer && <div style={{ padding: `${S.md}px ${S.lg}px calc(${S.md}px + env(safe-area-inset-bottom))`, borderTop: `1px solid ${C.border}` }}>{footer}</div>}
      </div>
    </div>
  );
}
