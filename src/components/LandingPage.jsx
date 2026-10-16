import { ArrowRight } from "lucide-react";
import { C, S, R, TOUCH, BRAND, displayFont, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import { trackEvent } from "../lib/analytics";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import LandingHero from "./LandingHero";
import LandingSection from "./LandingSection";
import LandingPathCard from "./LandingPathCard";
import LandingSoloRow from "./LandingSoloRow";
import LandingFeatures from "./LandingFeatures";
import LandingTimeline from "./LandingTimeline";
import LandingWhatsApp from "./LandingWhatsApp";
import LandingPlans from "./LandingPlans";
import LandingFaq from "./LandingFaq";
import LandingFooter from "./LandingFooter";

// Responsive layout lives in a tiny stylesheet (inline styles can't do
// media queries). Only layout here — every colour still comes from C.
const CSS = `
.lp-root *{box-sizing:border-box}
.lp-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:40px;align-items:center}
.lp-phones{display:flex;justify-content:center;align-items:flex-start;padding:8px 0 24px}
.lp-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.lp-feat{display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);gap:48px;align-items:center}
.lp-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center}
@media (max-width:900px){
  .lp-hero,.lp-feat,.lp-split{grid-template-columns:minmax(0,1fr);gap:32px}
  .lp-grid3{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:480px){ .lp-phones{zoom:.82} .lp-hide-sm{display:none !important} }
@media (max-width:360px){ .lp-phones{zoom:.7} }
`;

const go = (path) => { window.location.href = path; };

/** Public marketing page — the entry point before login/signup ("/"). */
export default function LandingPage({ onEnter, lang, onLang }) {
  const enter = (cta) => () => { trackEvent("landing_cta_clicked", { cta }); onEnter(); };
  const goTo = (path, cta) => { trackEvent("landing_cta_clicked", { cta }); go(path); };

  return (
    <div className="lp-root" style={{ background: C.bg, minHeight: "100vh", color: C.text1, overflowX: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <style>{CSS}</style>

      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, padding: "10px 16px" }}>
          <img src={BRAND.logo} alt="PITCH App" style={{ height: 24, flexShrink: 0 }} />
          <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
            {onLang && (
              <select value={lang} onChange={(e) => onLang(e.target.value)} aria-label="Language"
                style={{ minHeight: TOUCH.min, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 6px", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer", colorScheme: "dark" }}>
                <option value="pt">🇵🇹 PT</option>
                <option value="pt-br">🇧🇷 BR</option>
                <option value="en">🇬🇧 EN</option>
              </select>
            )}
            <BtnGhost compact onClick={enter("nav_login")} style={{ minHeight: TOUCH.min, padding: "0 14px", fontSize: 13 }}>{t("Entrar")}</BtnGhost>
            <span className="lp-hide-sm">
              <BtnPrimary compact onClick={enter("nav_signup")} style={{ minHeight: TOUCH.min, padding: "0 14px", fontSize: 13 }}>{t("Criar conta")}</BtnPrimary>
            </span>
          </div>
        </div>
      </header>

      <LandingHero onCreate={enter("hero_create_group")} onLogin={enter("hero_login")} />

      {/* ESCOLHE O TEU CAMINHO */}
      <LandingSection title={t("Escolhe o teu caminho")}>
        <div className="lp-grid3">
          <LandingPathCard primary
            kicker={t("01 · A MALTA")} title={t("Sou Organizador")}
            text={t("Marcas o jogo, a malta confirma com um toque e o PITCH trata das vagas, dos pagamentos e das equipas.")}
            note={t("Grátis para começar")} cta={t("Criar o meu grupo")} onClick={enter("path_organizer")} />
          <LandingPathCard
            kicker={t("02 · O PLANTEL")} title={t("Tenho uma Equipa")}
            text={t("PITCH Rivals: plantel fixo, desafios a outras equipas, convocatória e resultado confirmado pelos dois capitães.")}
            note={t("Grátis para começar")} cta={t("Criar a minha equipa")} onClick={() => goTo("/rivals", "path_team")} />
          <LandingPathCard
            kicker={t("03 · A COMPETIÇÃO")} title={t("Organizo uma Liga")} badge={t("Piloto")}
            text={t("Inscrições, calendário, resultados validados e classificação que jogadores e adeptos acompanham.")}
            note={t("Em piloto com as primeiras ligas")} cta={t("Quero a minha liga no piloto")} onClick={() => goTo("/league", "path_league")} />
        </div>
        <LandingSoloRow onCreateId={enter("path_player")} />
      </LandingSection>

      <LandingFeatures />
      <LandingTimeline />
      <LandingWhatsApp />
      <LandingPlans onGo={(path, id) => goTo(path, `plan_${id}`)} />

      {/* FINAL CTA */}
      <div style={{ ...fieldBackdrop(0.6, 0.92), borderTop: `1px solid ${C.border}` }}>
        <section style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center", padding: "72px 20px" }}>
          <h2 style={{ ...displayFont, fontSize: "clamp(28px, 4.5vw, 42px)", margin: "0 0 10px", color: C.text1 }}>
            {t("Pronto para o próximo jogo?")}
          </h2>
          <p style={{ fontSize: 15, color: C.text2, margin: "0 0 28px" }}>
            {t("Cria a tua conta, monta o teu cartão e entra em campo.")}
          </p>
          <BtnPrimary onClick={enter("final_signup")} style={{ padding: "0 30px", fontSize: 16 }}>
            {t("Criar conta grátis")} <ArrowRight size={18} />
          </BtnPrimary>
        </section>
      </div>

      <LandingFaq />
      <LandingFooter />
    </div>
  );
}
