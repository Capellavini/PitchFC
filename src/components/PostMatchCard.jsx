import { useEffect, useState } from "react";
import { X, Download, Share2 } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";
import { playerColor } from "../lib/helpers";
import { renderPostMatchCard, dataUrlToFile } from "../lib/postMatchCard";

/** Generates the current player's real post-match share card (their own
 *  goals/assists per game that night, OVR, MVP crown only if they
 *  actually won the vote) and offers Partilhar (Web Share API, so
 *  WhatsApp gets the image itself, not just a link) or Descarregar. */
export default function PostMatchCardModal({ player, group, matchday, groupName, isMVP, onClose }) {
  const [state, setState] = useState({ loading: true, url: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const myKey = player.uuid ?? player.id;
    const myLine = (matchday.lines || []).find((l) => l.key === myKey);
    renderPostMatchCard({
      player, myKey, color: playerColor(group, player), isMVP,
      groupName, dateLabel: matchday.date || "",
      matches: matchday.matches || [],
      aggGoals: myLine?.goals || 0, aggAssists: myLine?.assists || 0,
    })
      .then((url) => { if (!cancelled) setState({ loading: false, url, error: null }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, url: null, error: err.message || t("Falha ao gerar o card.") }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = async () => {
    if (!state.url) return;
    const file = dataUrlToFile(state.url, "pitch-card.png");
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "PITCH" }); } catch { /* user cancelled the share sheet */ }
    } else {
      const a = document.createElement("a");
      a.href = state.url; a.download = "pitch-card.png"; a.click();
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 340, width: "100%" }}>
        <button onClick={onClose} style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}>
          <X size={16} color={C.text2} />
        </button>
        {state.loading && <div style={{ color: C.text2, fontSize: 13, padding: "40px 0" }}>{t("A gerar o teu card…")}</div>}
        {state.error && <div style={{ color: C.red, fontSize: 13, padding: "20px 0" }}>{state.error}</div>}
        {state.url && (
          <>
            <img src={state.url} alt="" style={{ width: "100%", borderRadius: 16, marginBottom: 14, display: "block" }} />
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button onClick={share} style={{ flex: 1, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Share2 size={16} /> {t("Partilhar")}
              </button>
              <a href={state.url} download="pitch-card.png" style={{ flex: 1, background: C.card, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}>
                <Download size={16} /> {t("Descarregar")}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
