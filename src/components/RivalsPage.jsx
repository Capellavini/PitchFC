import { useEffect } from "react";
import { ArrowRight, Link2, Shield, Swords, Trophy } from "lucide-react";
import { C, R, S, T, BRAND, displayFont, fieldBackdrop } from "../theme";
import { trackEvent } from "../lib/analytics";
import BtnPrimary from "./BtnPrimary";
import RivalsChallengeCard from "./RivalsChallengeCard";
import RivalsResultCard from "./RivalsResultCard";
import RivalsSignupForm from "./RivalsSignupForm";
import RivalsFaq from "./RivalsFaq";

const MAXW = 1120;
const TITLE = "PITCH Rivals — O próximo jogo começa com um desafio";
const DESCRIPTION = "Combina data, campo e custo numa só proposta. Cria a tua equipa no PITCH Rivals, convida o plantel e prepara o próximo desafio. Grátis.";

const CSS = `
.rv-root *{box-sizing:border-box}
.rv-wrap{max-width:${MAXW}px;margin:0 auto;padding:0 16px}
@media(min-width:600px){.rv-wrap{padding:0 24px}}
.rv-sec{padding:clamp(56px,9vw,104px) 0}
.rv-hero{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;align-items:center}
.rv-split{display:grid;grid-template-columns:minmax(0,1fr);gap:40px;align-items:center}
.rv-steps{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
.rv-feats{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
.rv-form-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.rv-ctas{display:flex;flex-direction:column;gap:10px}
.rv-navlink{color:${C.text2};text-decoration:none;font-size:14px;font-weight:700;min-height:44px;display:inline-flex;align-items:center}
.rv-navlink:hover{color:${C.text1}}
.rv-hide-sm{display:none!important}
@media(min-width:560px){
  .rv-ctas{flex-direction:row;flex-wrap:wrap}
  .rv-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rv-feats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rv-steps{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(min-width:760px){.rv-hide-sm{display:inline-flex!important}}
@media(min-width:960px){
  .rv-hero{grid-template-columns:minmax(0,1.3fr) minmax(0,.9fr);gap:48px}
  .rv-h1{font-size:clamp(48px,5vw,64px)!important}
  .rv-nowrap{white-space:nowrap}
  .rv-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px}
  .rv-steps{grid-template-columns:repeat(4,minmax(0,1fr))}
  .rv-feats{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@keyframes rvpulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes rvfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.rv-pulse{animation:rvpulse 1.6s ease-in-out infinite}
.rv-float{animation:rvfloat 6s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.rv-pulse,.rv-float{animation:none}}
`;

const STEPS = [
  [Shield, "Junta a equipa", "Escolhe o nome e as cores. Convida os jogadores com um link."],
  [Link2, "Lança o desafio", "Propõe quando, onde e como jogar. Envia ao capitão rival."],
  [Swords, "Acertem os detalhes", "O rival aceita ou sugere alterações. Quem trata do campo fica definido."],
  [Trophy, "O resultado é dos dois", "Um capitão regista o placar. O outro confirma antes de entrar no histórico."],
];

const eyebrow = { fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.accent, margin: 0 };
const h2 = { ...displayFont, fontSize: "clamp(28px, 5vw, 46px)", lineHeight: 1.02, margin: `${S.sm}px 0 ${S.md}px` };
const lead = { fontSize: "clamp(15px, 2vw, 18px)", color: C.text2, lineHeight: 1.6, margin: 0, maxWidth: 640 };
const ghostBtn = {
  minHeight: 48, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm,
  background: "transparent", color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control,
  padding: `0 ${S.lg + 4}px`, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
};

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
};

/** Sets <title> + meta description while the page is mounted, restores on leave. */
function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (created) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    const prevDesc = meta.getAttribute("content");
    document.title = title;
    meta.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      if (created) meta.remove(); else meta.setAttribute("content", prevDesc ?? "");
    };
  }, [title, description]);
}

/**
 * PITCH Rivals (Teams & Challenges) — early-access landing page, routes
 * /rivals and /desafios (alias). Public, full width, no app shell, works
 * logged-out. Feature isn't live yet (docs/TEAMS-CHALLENGES-SPEC.md): copy
 * must never claim field bookings, payments or automatic charges.
 * The form creates the captain account + team (RivalsSignupForm, decision
 * 2026-10-13 a) and still files the lead (submit_lead, source "rivals").
 * `account` comes from PitchApp (auth + the create-team intent hand-off).
 */
export default function RivalsPage({ account }) {
  usePageMeta(TITLE, DESCRIPTION);
  useEffect(() => { trackEvent("rivals_page_viewed", { path: window.location.pathname }); }, []);

  const toForm = (where) => { trackEvent("rivals_cta_clicked", { where }); scrollTo("inscrever"); };

  return (
    <div className="rv-root" style={{ background: C.bg, color: C.text1, minHeight: "100vh", overflowX: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── nav ── */}
      <nav aria-label="PITCH Rivals" style={{ position: "sticky", top: 0, zIndex: 20, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div className="rv-wrap" style={{ display: "flex", alignItems: "center", gap: S.lg, height: 60 }}>
          <a href="/" aria-label="PITCH — página inicial" style={{ display: "flex", alignItems: "center", minHeight: 44 }}>
            <img src={BRAND.logo} alt="PITCH" style={{ height: 22, display: "block" }} />
          </a>
          <span className="rv-hide-sm" style={{ ...displayFont, fontSize: 15, color: C.accent, letterSpacing: "0.04em" }}>RIVALS</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: S.lg }}>
            <a className="rv-navlink rv-hide-sm" href="#como-funciona" onClick={(e) => { e.preventDefault(); scrollTo("como-funciona"); }}>Como funciona</a>
            <a className="rv-navlink rv-hide-sm" href="#faq" onClick={(e) => { e.preventDefault(); scrollTo("faq"); }}>FAQ</a>
            <BtnPrimary onClick={() => toForm("nav")} style={{ minHeight: 44, fontSize: 13 }}>Criar equipa</BtnPrimary>
          </div>
        </div>
      </nav>

      <main>
        {/* ── 1. hero + challenge card ── */}
        <header style={{ ...fieldBackdrop(0.6, 0.97), borderBottom: `1px solid ${C.border}` }}>
          <div className="rv-wrap rv-hero" style={{ paddingTop: "clamp(40px,8vw,96px)", paddingBottom: "clamp(48px,8vw,96px)" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: S.sm, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.pill, padding: "6px 12px", marginBottom: S.lg }}>
                <span className="rv-pulse" style={{ width: 8, height: 8, borderRadius: 4, background: C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: C.accent }}>PITCH RIVALS · ACESSO ANTECIPADO</span>
              </div>
              <h1 className="rv-h1" style={{ ...displayFont, fontSize: "clamp(40px, 11vw, 64px)", lineHeight: 0.96, margin: `0 0 ${S.lg + 4}px` }}>
                O próximo jogo<br />da tua equipa<br /><span style={{ color: C.accent }}>começa com<br />um desafio.</span>
              </h1>
              <p style={{ ...lead, marginBottom: S.xl + 4, color: C.text1, opacity: 0.86 }}>
                Combina data, campo e custo numa só proposta. Envia o link ao rival, acerta os detalhes e entra em campo.
              </p>
              <div className="rv-ctas">
                <BtnPrimary onClick={() => toForm("hero")} style={{ minHeight: 52, fontSize: 16, padding: "0 26px" }}>
                  Criar a minha equipa <ArrowRight size={18} aria-hidden />
                </BtnPrimary>
                <button type="button" onClick={() => scrollTo("como-funciona")} style={{ ...ghostBtn, minHeight: 52 }}>Como funciona</button>
              </div>
              <p style={{ fontSize: T.meta, color: C.text2, margin: `${S.lg}px 0 0` }}>Grátis · Futebol 5, 7 e 11 · A mesma conta PITCH</p>
            </div>
            <RivalsChallengeCard />
          </div>
        </header>

        {/* ── 3. como funciona ── */}
        <section id="como-funciona" className="rv-sec" aria-labelledby="rv-how" style={{ scrollMarginTop: 60 }}>
          <div className="rv-wrap">
            <p style={eyebrow}>Menos vai e vem. Mais futebol.</p>
            <h2 id="rv-how" style={h2}>Do convite ao apito final.</h2>
            <p style={{ ...lead, marginBottom: S.xxl }}>Os detalhes ficam no PITCH. O link vai pelo WhatsApp.</p>
            <ol className="rv-steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {STEPS.map(([Icon, title, body], i) => (
                <li key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.lg + 4, position: "relative", overflow: "hidden" }}>
                  <span aria-hidden style={{ ...displayFont, position: "absolute", right: 12, top: 0, fontSize: 64, lineHeight: 1, color: C.text3, opacity: 0.6 }}>{i + 1}</span>
                  <div style={{ width: 40, height: 40, borderRadius: R.control, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: S.md }}>
                    <Icon size={20} color={C.accent} aria-hidden />
                  </div>
                  <h3 style={{ ...displayFont, fontSize: 20, margin: `0 0 ${S.sm}px` }}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Passo {i + 1}: </span>{title}</h3>
                  <p style={{ fontSize: T.body + 1, color: C.text2, lineHeight: 1.55, margin: 0 }}>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 5. result card ── */}
        <section className="rv-sec" aria-labelledby="rv-history">
          <div className="rv-wrap rv-split">
            <div>
              <p style={eyebrow}>Cada jogo conta</p>
              <h2 id="rv-history" style={h2}>Hoje é um jogo.<br />Amanhã é uma rivalidade.</h2>
              <p style={{ ...lead, marginBottom: S.lg }}>
                Vitórias, empates, derrotas e confrontos diretos no mesmo lugar. Um histórico construído com resultados confirmados pelas duas equipas.
              </p>
              <p style={lead}>
                Perderam? O próximo desafio pode ser a revanche.
              </p>
            </div>
            <div><RivalsResultCard /><p style={{ ...lead, fontSize: T.meta, textAlign: "center", marginTop: S.md }}>Exemplo do histórico · resultados e estatísticas em desenvolvimento.</p></div>
          </div>
        </section>

        {/* ── 6. early-access form ── */}
        <section id="inscrever" className="rv-sec" aria-labelledby="rv-form" style={{ ...fieldBackdrop(0.8, 0.97), borderTop: `1px solid ${C.border}`, scrollMarginTop: 60 }}>
          <div className="rv-wrap rv-split">
            <div>
              <p style={eyebrow}>Começa pela tua equipa</p>
              <h2 id="rv-form" style={h2}>O nome é vosso.<br />O próximo rival também.</h2>
              <p style={{ ...lead, marginBottom: S.lg }}>Cria a tua conta e dá o primeiro passo para montar a equipa. Depois de confirmares o email, convida o plantel e prepara o primeiro desafio.</p>
              <p style={{ ...lead, fontSize: T.meta }}>Já tens conta PITCH? Usa a mesma conta. Os desafios abrem por fases.</p>
            </div>
            <RivalsSignupForm account={account} />
          </div>
        </section>

        {/* ── 7. FAQ ── */}
        <section id="faq" className="rv-sec" aria-labelledby="rv-faq" style={{ scrollMarginTop: 60 }}>
          <div className="rv-wrap" style={{ maxWidth: 760 }}>
            <p style={eyebrow}>Antes de entrar em campo</p>
            <h2 id="rv-faq" style={{ ...h2, marginBottom: S.xl }}>O que precisas de saber.</h2>
            <RivalsFaq />
          </div>
        </section>

      </main>

      <footer style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="rv-wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: S.md, paddingTop: S.xl, paddingBottom: S.xl }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
            <img src={BRAND.logo} alt="PITCH" style={{ height: 18, display: "block" }} />
            <span style={{ fontSize: T.meta, color: C.text2 }}>PITCH Rivals · Futebol amador, equipa a equipa.</span>
          </div>
          <a href="/" className="rv-navlink" style={{ gap: 6 }}>pitch-fc.com <ArrowRight size={14} aria-hidden /></a>
        </div>
      </footer>
    </div>
  );
}
