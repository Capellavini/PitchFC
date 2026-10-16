import { MessageCircle } from "lucide-react";
import { C, S, displayFont } from "../theme";
import { t } from "../lib/i18n";
import LandingChatMock from "./LandingChatMock";

/** "WhatsApp é canal, não inimigo" strip. */
export default function LandingWhatsApp() {
  return (
    <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <section className="lp-split" style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 20px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.whatsapp, marginBottom: S.sm }}>
            <MessageCircle size={14} /> WHATSAPP
          </div>
          <h2 style={{ ...displayFont, fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.1, margin: `0 0 ${S.md}px`, color: C.text1 }}>
            {t("WhatsApp é canal, não inimigo.")}
          </h2>
          <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.65, margin: 0, maxWidth: 460 }}>
            {t("O PITCH vive onde a malta já está. Lembretes, vagas abertas e o Treinador Adjunto — o assistente de IA do organizador — no WhatsApp.")}
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
          <LandingChatMock />
        </div>
      </section>
    </div>
  );
}
