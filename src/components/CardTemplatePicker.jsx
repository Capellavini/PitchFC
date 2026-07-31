import { Shield, Watch } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";

/** Lets the player choose which share card to generate from the same
 *  "Gerar o meu card" entry point: the FUT-style match card (existing)
 *  or the Strava-style workout card (watch stats + game photo). */
export default function CardTemplatePicker({ onPick, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 14, textAlign: "center" }}>{t("Que cartão queres gerar?")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => onPick("match")} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: 16, textAlign: "left", cursor: "pointer", width: "100%" }}>
            <Shield size={22} color={C.accent} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{t("Cartão de jogo")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{t("Estilo FUT — golos, assistências e MVP da noite.")}</div>
            </div>
          </button>
          <button onClick={() => onPick("workout")} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: 16, textAlign: "left", cursor: "pointer", width: "100%" }}>
            <Watch size={22} color={C.accent} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{t("Cartão de treino")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{t("Estilo Strava — foto + dados do relógio.")}</div>
            </div>
          </button>
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", padding: 8 }}>{t("Cancelar")}</button>
      </div>
    </div>
  );
}
