import { C } from "../theme";
import { t } from "../lib/i18n";

/** Illustrative WhatsApp group chat with the PITCH bot (landing only). */
export default function LandingChatMock() {
  const bubble = { alignSelf: "flex-start", maxWidth: "88%", background: C.waBubble, color: C.waText, borderRadius: "4px 12px 12px 12px", padding: "9px 12px", fontSize: 13, lineHeight: 1.5 };
  return (
    <div aria-hidden style={{ width: "100%", maxWidth: 320, borderRadius: 16, border: `1px solid ${C.border}`, background: C.waChat, padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: C.bg }}>P</div>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.waText }}>PITCH</span>
      </div>
      <div style={bubble}>{t("⏰ Jogo amanhã às 20:00 — já são 8/10. Faltam 2!")}</div>
      <div style={bubble}>{t("🔓 Abriu vaga! O Rui não pode — quem entra?")}</div>
      <div style={{ alignSelf: "flex-end", maxWidth: "70%", background: C.whatsapp, color: C.waInk, borderRadius: "12px 4px 12px 12px", padding: "9px 12px", fontSize: 13, fontWeight: 700 }}>
        {t("Eu entro! ✋")}
      </div>
      <div style={bubble}>{t("✅ Feito, Tiago. Estás dentro: 10/10.")}</div>
    </div>
  );
}
