import { Home, Zap, Swords } from "lucide-react";
import { C } from "../theme";
import { t } from "../lib/i18n";

const ITEMS = [
  { Icon: Home,   title: "O Social agora está na Home", body: "Publicações do grupo e dos amigos, logo abaixo do que tens para fazer." },
  { Icon: Zap,    title: "Jogo → Jogar", body: "A grelha de vagas continua lá. Em \"Grupos\" tens o plantel, as stats e a votação MVP." },
  { Icon: Swords, title: "Matchday no centro", body: "Acende quando há jogo hoje ou falta a tua resposta. O sorteio de equipas vive aqui." },
];

/** One-time "Novidades" bottom sheet for EXISTING users after the 7→5
 *  tab change (same overlay pattern as FirstRunTour). Dismissal is
 *  persisted by PitchApp (usePersistentState, which already try/catches
 *  localStorage). Brand-new users never see it — the tour covers them. */
export default function WhatsNewSheet({ onDone }) {
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("Novidades")}
        style={{ width: "100%", maxWidth: 430, background: C.bg, borderTop: `1px solid ${C.border}`, borderRadius: "20px 20px 0 0", padding: "24px 16px calc(24px + env(safe-area-inset-bottom))" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: C.accent, marginBottom: 8 }}>{t("NOVIDADES")}</div>
        <div style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", color: C.text1, marginBottom: 16 }}>{t("A app ficou mais simples")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
          {ITEMS.map(({ Icon, title, body }) => (
            <div key={title} style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={19} color={C.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{t(title)}</div>
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, marginTop: 2 }}>{t(body)}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onDone}
          style={{ width: "100%", minHeight: 48, background: C.accent, color: C.bg, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {t("Percebi")}
        </button>
      </div>
    </div>
  );
}
