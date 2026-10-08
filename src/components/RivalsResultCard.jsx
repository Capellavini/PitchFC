import { BadgeCheck, RotateCcw, Share2 } from "lucide-react";
import { C, R, S, T, displayFont } from "../theme";
import RivalsCrest from "./RivalsCrest";

// Coletes FC's last 5 confirmed games — letter + color, never color alone.
const FORM = ["V", "V", "E", "D", "V"];
const formColor = { V: C.green, E: C.text2, D: C.red };

/**
 * Shareable result card mock for /rivals — the "post it in the group"
 * moment after both captains confirm. Pure JSX, one image for screen readers.
 */
export default function RivalsResultCard() {
  return (
    <div role="img"
      aria-label="Exemplo de resultado confirmado pelos dois capitães: Coletes FC 3, Os Galácticos 2. Confronto número 4. Confronto direto: Coletes FC 2 vitórias, 1 empate, Os Galácticos 1 vitória. Botões: Revanche e Partilhar."
      style={{ position: "relative", overflow: "hidden", background: `linear-gradient(165deg, ${C.card} 0%, ${C.surface} 100%)`, border: `1px solid ${C.accentBorder}`, borderRadius: R.card + 4, padding: S.lg + 4, maxWidth: 420, width: "100%", margin: "0 auto", boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 0%, ${C.accentDim} 0%, transparent 60%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
          <span style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.14em", color: C.accent }}>CONFRONTO #4</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.greenDim, color: C.green, borderRadius: R.pill, padding: "5px 10px", fontSize: T.min, fontWeight: 800 }}>
            <BadgeCheck size={13} /> Confirmado pelos dois
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.sm, flex: 1, minWidth: 0 }}>
            <RivalsCrest initials="CF" color={C.accent} size={52} />
            <span style={{ fontSize: T.meta, fontWeight: 800, textAlign: "center" }}>Coletes FC</span>
          </div>
          <div style={{ ...displayFont, fontSize: "clamp(44px, 13vw, 60px)", lineHeight: 1, whiteSpace: "nowrap" }}>
            3<span style={{ color: C.text3, margin: "0 4px" }}>–</span>2
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.sm, flex: 1, minWidth: 0 }}>
            <RivalsCrest initials="OG" color={C.blue} size={52} />
            <span style={{ fontSize: T.meta, fontWeight: 800, textAlign: "center" }}>Os Galácticos</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm, marginTop: S.lg }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md }}>
            <div style={{ fontSize: T.min, color: C.text2, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 6 }}>CONFRONTO DIRETO</div>
            <div style={{ ...displayFont, fontSize: 18 }}>
              <span style={{ color: C.accent }}>2</span><span style={{ color: C.text3 }}> · </span>1<span style={{ color: C.text3 }}> · </span><span style={{ color: C.blue }}>1</span>
            </div>
            <div style={{ fontSize: T.min, color: C.text2, marginTop: 2 }}>V · E · D</div>
          </div>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md }}>
            <div style={{ fontSize: T.min, color: C.text2, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 6 }}>ÚLTIMOS 5</div>
            <div style={{ display: "flex", gap: 4 }}>
              {FORM.map((r, i) => (
                <span key={i} style={{ width: 20, height: 20, borderRadius: 5, background: `${formColor[r]}26`, color: formColor[r], fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{r}</span>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
          <div style={{ flex: 1, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.accent, color: C.bg, borderRadius: R.control, fontWeight: 800, fontSize: T.body }}>
            <RotateCcw size={16} /> Revanche?
          </div>
          <div style={{ minHeight: 48, padding: `0 ${S.lg}px`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${C.border}`, color: C.text1, borderRadius: R.control, fontWeight: 800, fontSize: T.body }}>
            <Share2 size={16} /> Partilhar
          </div>
        </div>
      </div>
    </div>
  );
}
