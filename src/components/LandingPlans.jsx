import { useEffect, useState } from "react";
import { Users, Shield, Trophy } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t, tCtx, getLang } from "../lib/i18n";
import { fmtMoney, marketFromLang, planPrice } from "../lib/plans";
import { cachedMarket, detectMarket } from "../lib/market";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import LandingSection from "./LandingSection";

/** Three plan teasers. Prices come from lib/plans.js (never written here),
 *  in the visitor's own market — same detection as /pricing. */
export default function LandingPlans({ onGo }) {
  const lang = getLang();
  const [market, setMarket] = useState(() => cachedMarket() ?? marketFromLang(lang));
  useEffect(() => { let live = true; detectMarket().then((m) => { if (live && m) setMarket(m); }); return () => { live = false; }; }, []);
  const money = (id) => fmtMoney(planPrice(id, "monthly", "standard", market), market, lang === "en" ? "en" : "pt");
  const groupText = t("Club desde {club}/mês com automação. Club + AI, com o Treinador Adjunto: {ai}/mês.").replace("{club}", money("club")).replace("{ai}", money("club_ai"));
  const plans = [
    { id: "group", Icon: Users, name: tCtx("landing", "Grupo"), label: t("Grátis para começar"), text: groupText, cta: t("Ver planos"), to: "/pricing", primary: true },
    { id: "team", Icon: Shield, name: tCtx("landing", "Equipa"), label: t("Grátis durante o piloto do Rivals."), cta: t("Criar a minha equipa"), to: "/rivals" },
    { id: "league", Icon: Trophy, name: tCtx("landing", "Liga"), label: t("Piloto"), text: t("Condições à medida da tua competição."), cta: t("Falar connosco"), to: "/league" },
  ];
  return (
    <LandingSection eyebrow={t("PLANOS")} title={t("Começa grátis.")}>
      <div className="lp-grid3">
        {plans.map(({ id, Icon, name, label, text, cta, to, primary }) => {
          const Btn = primary ? BtnPrimary : BtnGhost;
          return (
            <div key={id} style={{ ...cardStyle, padding: S.xl, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
                <Icon size={18} color={C.accent} />
                <h3 style={{ ...displayFont, fontSize: 22, margin: 0, color: C.text1 }}>{name}</h3>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.accent, lineHeight: 1.4, marginBottom: S.sm }}>{label}</div>
              <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6, margin: `0 0 ${S.lg}px`, flex: 1 }}>{text || ""}</p>
              <Btn block onClick={() => onGo(to, id)} {...(primary ? {} : { tone: "accent" })}>{cta}</Btn>
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}
