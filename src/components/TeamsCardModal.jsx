import { useEffect, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";
import { playerColor } from "../lib/helpers";
import { renderTeamsCard } from "../lib/teamsCard";
import { shareCard, downloadCard } from "../lib/postMatchCard";

/** Renders the drawn teams as one shareable image (name, captain, OVR,
 *  photos) so the organizer doesn't have to screenshot the editor —
 *  Partilhar opens the share sheet with the PNG attached (WhatsApp gets
 *  the image itself), Descarregar saves it. */
export default function TeamsCardModal({ teams, group, meta, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: null });

  useEffect(() => {
    let cancelled = false;
    renderTeamsCard({ teams, group, meta, colorOf: (p) => playerColor(group, p) })
      .then((url) => { if (!cancelled) setState({ loading: false, url, error: null }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, url: null, error: err.message || t("Falha ao gerar o card.") }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const file = "pitch-equipas.png";
  return (
    <div onClick={onClose} role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.88)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("Card das equipas")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 420, width: "100%" }}>
        <button onClick={onClose} aria-label={t("Fechar")} style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}>
          <X size={18} color={C.text2} />
        </button>
        {state.loading && <div style={{ color: C.text2, fontSize: 13, padding: "40px 0" }}>{t("A gerar o card das equipas…")}</div>}
        {state.error && <div style={{ color: C.red, fontSize: 13, padding: "20px 0" }}>{state.error}</div>}
        {state.url && (
          <>
            <img src={state.url} alt={t("Card das equipas")} style={{ width: "100%", borderRadius: 16, marginBottom: 14, display: "block" }} />
            <div style={{ display: "flex", gap: 10, width: "100%", position: "sticky", bottom: 12 }}>
              <button onClick={() => shareCard(state.url, file)} style={{ flex: 1, minHeight: 48, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Share2 size={16} /> {t("Partilhar")}
              </button>
              <button onClick={() => downloadCard(state.url, file)} style={{ flex: 1, minHeight: 48, background: C.card, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Download size={16} /> {t("Descarregar")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
