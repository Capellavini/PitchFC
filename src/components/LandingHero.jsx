import { ArrowRight } from "lucide-react";
import { C, S, displayFont, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import LandingPhone from "./LandingPhone";
import LandingGameScreen from "./LandingGameScreen";
import LandingMatchdayScreen from "./LandingMatchdayScreen";

/** Landing hero — the acquisition hook stays the organizer's pain. */
export default function LandingHero({ onCreate, onLogin }) {
  return (
    <div style={{ ...fieldBackdrop(0.55, 0.97), borderBottom: `1px solid ${C.border}` }}>
      <div className="lp-hero" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 20px 56px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.accent, marginBottom: S.lg }}>
            {t("PARA QUEM JOGA À BOLA TODAS AS SEMANAS")}
          </div>
          <h1 style={{ ...displayFont, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1.04, margin: `0 0 ${S.lg}px`, color: C.text1 }}>
            {t("O teu jogo da semana,")}<br />
            <span style={{ color: C.accent }}>{t("sem o caos do grupo.")}</span>
          </h1>
          <p style={{ fontSize: 16, color: C.text2, lineHeight: 1.6, margin: `0 0 ${S.xl + 4}px`, maxWidth: 480 }}>
            {t("Confirmações, dinheiro, equipas e estatísticas num só sítio. Para ninguém voltar a perguntar «então, jogamos ou não?».")}
          </p>
          <div style={{ display: "flex", gap: S.md, flexWrap: "wrap" }}>
            <BtnPrimary onClick={onCreate} style={{ padding: "0 24px", fontSize: 15 }}>
              {t("Criar o meu grupo grátis")} <ArrowRight size={17} />
            </BtnPrimary>
            <BtnGhost onClick={onLogin} style={{ padding: "0 24px", fontSize: 15 }}>{t("Já tenho conta")}</BtnGhost>
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: S.lg }}>{t("Uma conta para organizar, jogar e competir.")}</div>
        </div>
        <div className="lp-phones">
          <LandingPhone width={232} tilt={-4}>
            <LandingGameScreen />
          </LandingPhone>
          <LandingPhone width={208} tilt={5} style={{ marginLeft: -14, marginTop: 64, position: "relative", zIndex: 1 }}>
            <LandingMatchdayScreen />
          </LandingPhone>
        </div>
      </div>
    </div>
  );
}
