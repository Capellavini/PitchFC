import { useState } from "react";
import { X, Zap, Swords, Trophy, User as UserIcon } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";

// Copy is a first draft (Cris) — Leo owns final wording/tone. Kept short
// on purpose: this is a dismissible orientation, not a feature tour.
const STEPS = [
  { Icon: Zap, title: "A grelha é o essencial", body: "10 lugares, preenchidos ou vazios. Confirma ou recusa num toque — é a primeira pergunta: \"temos jogo?\"" },
  { Icon: Swords, title: "Matchday", body: "No dia do jogo, o organizador regista golos e assistências ao vivo. É o que alimenta as tuas estatísticas." },
  { Icon: Trophy, title: "Compete", body: "Classificações, MVP e fiabilidade da equipa — a memória do grupo, jogo após jogo." },
  { Icon: UserIcon, title: "Perfil", body: "O teu cartão estilo FUT. Os atributos sobem com as avaliações dos teus colegas de equipa." },
];

/** One-time orientation overlay — 3-4 dismissible cards shown after the
 *  first successful login (see usage in PitchApp.jsx, gated by the
 *  "tourSeen_v1" localStorage flag via usePersistentState). Skippable at
 *  any step; never shown again once dismissed or completed. */
export default function FirstRunTour({ onDone }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const { Icon, title, body } = STEPS[step];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.88)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...cardStyle, width: "100%", maxWidth: 340, padding: 24, position: "relative" }}>
        <button onClick={onDone} aria-label={t("Fechar")}
          style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: C.text3, cursor: "pointer", padding: 4, display: "flex" }}>
          <X size={18} />
        </button>

        <div style={{ width: 48, height: 48, borderRadius: 14, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Icon size={22} color={C.accent} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 8 }}>{t(title)}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 22 }}>{t(body)}</div>

        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? C.accent : C.border, transition: "width 0.2s" }} />
          ))}
        </div>

        <button onClick={() => (last ? onDone() : setStep((s) => s + 1))}
          style={{ width: "100%", background: C.accent, color: "#0A0F18", border: "none", borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {last ? t("Percebi, vamos a isto ⚽") : t("Seguinte")}
        </button>
      </div>
    </div>
  );
}
