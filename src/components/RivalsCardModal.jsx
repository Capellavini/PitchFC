import { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { SC } from "../lib/rivalsShareCopy";
import { downloadCard, shareCard } from "../lib/postMatchCard";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * Shows a PITCH Rivals share card (rivalsCards.js) as one image with
 * Partilhar (native share sheet with the PNG attached → WhatsApp gets the
 * image itself) and Descarregar. `render` is an async function returning the
 * PNG data URL — the card is drawn when the modal opens, so the data (scorers,
 * head-to-head…) is fresh. Escape or a tap outside closes it.
 * Props: title (dialog + image alt), filename, render, onClose.
 */
export default function RivalsCardModal({ title, filename, render, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: null });
  const closeRef = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(render)
      .then((url) => { if (live) setState({ loading: false, url, error: null }); })
      .catch(() => { if (live) setState({ loading: false, url: null, error: t(SC.cardError) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.88)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: S.lg, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 420, width: "100%" }}>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={t("Fechar")}
          style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, width: TOUCH.min, height: TOUCH.min, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: S.md }}>
          <X size={18} color={C.text2} aria-hidden />
        </button>
        <div aria-live="polite" style={{ width: "100%" }}>
          {state.loading && <div aria-busy="true" style={{ color: C.text2, fontSize: T.body, padding: `${S.xxl}px 0`, textAlign: "center" }}>{t(SC.cardLoading)}</div>}
          {state.error && <div role="alert" style={{ color: C.red, fontSize: T.body, padding: `${S.lg}px 0`, textAlign: "center" }}>{state.error}</div>}
        </div>
        {state.url && (
          <>
            <img src={state.url} alt={title} style={{ width: "100%", borderRadius: R.card, marginBottom: S.md + 2, display: "block" }} />
            <div style={{ display: "flex", gap: S.sm + 2, width: "100%", position: "sticky", bottom: S.md }}>
              <BtnPrimary onClick={() => shareCard(state.url, filename)} style={{ flex: 1, background: C.whatsapp, borderColor: C.whatsapp, color: C.bg }}>
                <Share2 size={16} aria-hidden /> {t("Partilhar")}
              </BtnPrimary>
              <BtnGhost onClick={() => downloadCard(state.url, filename)} style={{ flex: 1 }}>
                <Download size={16} aria-hidden /> {t("Descarregar")}
              </BtnGhost>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
