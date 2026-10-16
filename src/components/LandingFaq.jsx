import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import LandingSection from "./LandingSection";

const ITEMS = [
  { q: "Preciso de uma conta diferente para grupo, equipa e liga?", a: "Não. Uma conta, um PITCH ID; os grupos, equipas e ligas ligam-se a ela." },
  { q: "E se eu só quiser jogar?", a: "Entras pelo link do teu grupo. Jogar, confirmar e ver as tuas estatísticas é grátis." },
  { q: "Os jogadores pagam alguma coisa?", a: "Não para jogar. Os planos pagos são para o organizador que quer automatizar." },
  { q: "Como funciona o Pitch VAR?", a: "Com o VAR ligado, os telemóveis da malta filmam e guardam os lances dos golos. Os vídeos na nuvem apagam-se 3 horas depois do jogo." },
  { q: "As Ligas já estão disponíveis?", a: "Estamos em piloto com as primeiras ligas. Deixa o teu contacto e falamos contigo." },
];

/** Landing FAQ accordion (one open at a time). `items` = [{ q, a }] PT-PT
 *  source strings (t() applied here); defaults to the home landing FAQ. */
export default function LandingFaq({ items = ITEMS, title } = {}) {
  const [open, setOpen] = useState(null);
  return (
    <LandingSection id="faq" title={title || t("Perguntas frequentes")} style={{ maxWidth: 760 }}>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {items.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={it.q} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <button type="button" aria-expanded={isOpen} aria-controls={`lp-faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}
                style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, background: "none", border: "none", color: C.text1, padding: `${S.md}px ${S.lg}px`, fontSize: T.body + 1, fontWeight: 700, textAlign: "left", cursor: "pointer", lineHeight: 1.35 }}>
                <span>{t(it.q)}</span>
                <ChevronDown size={18} color={C.text2} aria-hidden style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {isOpen && <div id={`lp-faq-${i}`} style={{ padding: `0 ${S.lg}px ${S.lg}px`, fontSize: T.body, color: C.text2, lineHeight: 1.6 }}>{t(it.a)}</div>}
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}
