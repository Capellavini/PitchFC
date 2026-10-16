import { Check } from "lucide-react";
import { C, AVATAR_PALETTE, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";

const SLOTS = ["CS", "JF", "MS", "RO", "DC", "AL", "PN", "TM"];

/** Hero phone #1 — the Jogo screen: the 10-slot grid is the hero. */
export default function LandingGameScreen() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>Fut de Quinta</div>
      <div style={{ fontSize: 10.5, color: C.text2, marginBottom: 12 }}>{t("Qui · 20:00 · Campo 1")}</div>
      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ ...displayFont, fontSize: 28, color: C.text1 }}>8<span style={{ fontSize: 13, color: C.text2, fontWeight: 600, fontStyle: "normal" }}>/10</span></div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: C.orange }}>{t("faltam 2")}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
          {SLOTS.map((ini, i) => {
            const col = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
            return (
              <div key={ini} style={{ aspectRatio: "1", borderRadius: 8, border: `2px solid ${col}`, background: `${col}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, color: col }}>{ini}</div>
            );
          })}
          {[0, 1].map((i) => (
            <div key={`e${i}`} style={{ aspectRatio: "1", borderRadius: 8, border: `2px dashed ${C.border}`, background: C.surface }} />
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, height: 38, borderRadius: 10, background: C.accent, color: C.bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 800 }}>
        <Check size={15} strokeWidth={3} /> {t("Vou jogar")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 10.5, color: C.text2 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
        {t("6/8 já pagaram")}
      </div>
    </div>
  );
}
