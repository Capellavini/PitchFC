import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import LandingSection from "./LandingSection";

const STEPS = [
  { n: "01", when: "Antes", title: "Combina e confirma.", text: "Marca o jogo, partilha o link no WhatsApp e vê as vagas a encher." },
  { n: "02", when: "Durante", title: "Joga e regista.", text: "Equipas equilibradas, golos e assistências ao vivo, VAR se quiseres." },
  { n: "03", when: "Depois", title: "Continua a competição.", text: "Estatísticas, MVP, rankings e Fantasy." },
];

/** "Antes · Durante · Depois" — PITCH is there for the whole match cycle. */
export default function LandingTimeline() {
  return (
    <LandingSection eyebrow={t("COMO FUNCIONA")} title={t("Antes · Durante · Depois")}>
      <div className="lp-grid3">
        {STEPS.map((s) => (
          <div key={s.n} style={{ ...cardStyle, padding: S.xl, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: C.accent, marginBottom: S.md }}>
              {s.n} · {t(s.when).toUpperCase()}
            </div>
            <h3 style={{ ...displayFont, fontSize: 21, margin: `0 0 ${S.sm}px`, color: C.text1 }}>{t(s.title)}</h3>
            <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6, margin: 0 }}>{t(s.text)}</p>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
