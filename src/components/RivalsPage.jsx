import { useEffect } from "react";
import { ArrowRight, CheckCheck, Handshake, History, Link2, RotateCcw, Shield, Swords, Trophy, Users } from "lucide-react";
import { C, R, S, T, BRAND, displayFont, fieldBackdrop } from "../theme";
import { trackEvent } from "../lib/analytics";
import BtnPrimary from "./BtnPrimary";
import RivalsChallengeCard from "./RivalsChallengeCard";
import RivalsResultCard from "./RivalsResultCard";
import RivalsLeadForm from "./RivalsLeadForm";
import RivalsFaq from "./RivalsFaq";

const MAXW = 1120;
const TITLE = "PITCH Rivals — A tua equipa contra a cidade";
const DESCRIPTION = "Cria a tua equipa, desafia rivais por link e deixa o resultado para a história — confirmado pelos dois lados. PITCH Rivals: em breve, inscreve a tua equipa no acesso antecipado.";

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
  .rv-h1{font-size:clamp(52px,5.4vw,72px)!important}
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
  [Shield, "Cria a equipa", "Nome, escudo, cores e capitão. Convidas o plantel — cada jogador usa o mesmo perfil PITCH."],
  [Link2, "Desafia por link", "Propões data, hora, campo, formato e custo. Mandas o link ao capitão rival no WhatsApp."],
  [Swords, "Jogam", "O rival aceita ou contrapropõe. Fica tudo combinado por escrito — depois é só aparecer e jogar."],
  [Trophy, "Resultado confirmado", "Um capitão regista, o outro confirma. Entra no histórico das duas equipas. Revanche?"],
];

const FEATURES = [
  [Shield, "Identidade da equipa", "Escudo, cores, capitão, vice e plantel. Uma equipa a sério, que dura mais do que uma noite."],
  [Handshake, "Negociação clara", "Data, campo, formato e custo numa proposta. Não dá? Contrapropõe — e vês exatamente o que mudou."],
  [CheckCheck, "Resultado sem discussões", "Só conta quando os dois capitães confirmam. Se alguém contesta, corrige-se e confirma-se de novo."],
  [History, "Histórico e rivalidades", "Vitórias, empates e derrotas, confronto direto e os últimos 5. A rivalidade fica escrita."],
  [RotateCcw, "Revanche num toque", "Perdeste? A revanche abre uma proposta nova com os dados do último jogo. O rival só tem de aceitar."],
  [Users, "O mesmo PITCH da semana", "Já jogam a pelada no PITCH? É a mesma app e o mesmo perfil. O grupo da semana fica igual."],
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
 * Leads go to `leads` via submit_lead() with source "rivals".
 */
export default function RivalsPage() {
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
            <BtnPrimary onClick={() => toForm("nav")} style={{ minHeight: 44, fontSize: 13 }}>Inscrever equipa</BtnPrimary>
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
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: C.accent }}>PITCH RIVALS · EM BREVE</span>
              </div>
              <h1 className="rv-h1" style={{ ...displayFont, fontSize: "clamp(40px, 11vw, 64px)", lineHeight: 0.96, margin: `0 0 ${S.lg + 4}px` }}>
                A tua equipa<br /><span className="rv-nowrap">contra <span style={{ color: C.accent }}>a cidade.</span></span>
              </h1>
              <p style={{ ...lead, marginBottom: S.xl + 4, color: C.text1, opacity: 0.86 }}>
                Cria a tua equipa, desafia rivais por link e deixa o resultado para a história — confirmado pelos dois lados.
              </p>
              <div className="rv-ctas">
                <BtnPrimary onClick={() => toForm("hero")} style={{ minHeight: 52, fontSize: 16, padding: "0 26px" }}>
                  Inscrever a minha equipa <ArrowRight size={18} aria-hidden />
                </BtnPrimary>
                <button type="button" onClick={() => scrollTo("como-funciona")} style={{ ...ghostBtn, minHeight: 52 }}>Como funciona</button>
              </div>
              <p style={{ fontSize: T.meta, color: C.text2, margin: `${S.lg}px 0 0` }}>Grátis · F5, F7 e F11 · para equipas amadoras que querem jogar a sério</p>
            </div>
            <RivalsChallengeCard />
          </div>
        </header>

        {/* ── 3. como funciona ── */}
        <section id="como-funciona" className="rv-sec" aria-labelledby="rv-how" style={{ scrollMarginTop: 60 }}>
          <div className="rv-wrap">
            <p style={eyebrow}>Como funciona</p>
            <h2 id="rv-how" style={h2}>Do link ao resultado, em 4 jogadas.</h2>
            <p style={{ ...lead, marginBottom: S.xxl }}>Sem tabelas, sem grupos de WhatsApp a discutir horários. Um desafio, uma resposta, um resultado que fica.</p>
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

        {/* ── 4. features ── */}
        <section className="rv-sec" aria-labelledby="rv-why" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <div className="rv-wrap">
            <p style={eyebrow}>Porque é diferente</p>
            <h2 id="rv-why" style={h2}>Honra em jogo. Regras claras.</h2>
            <p style={{ ...lead, marginBottom: S.xxl }}>Tudo o que um jogo entre equipas precisa — e nada do que o atrapalha.</p>
            <div className="rv-feats">
              {FEATURES.map(([Icon, title, body]) => (
                <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.lg + 4 }}>
                  <Icon size={22} color={C.accent} aria-hidden />
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: `${S.md}px 0 ${S.xs + 2}px` }}>{title}</h3>
                  <p style={{ fontSize: T.body + 1, color: C.text2, lineHeight: 1.55, margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. result card ── */}
        <section className="rv-sec" aria-labelledby="rv-history">
          <div className="rv-wrap rv-split">
            <div>
              <p style={eyebrow}>Fica para a história</p>
              <h2 id="rv-history" style={h2}>O resultado fica. A rivalidade também.</h2>
              <p style={{ ...lead, marginBottom: S.lg }}>
                Cada jogo confirmado pelos dois capitães entra no histórico das duas equipas: vitórias, empates e derrotas, confronto direto e os últimos 5.
              </p>
              <p style={lead}>
                Partilha no grupo, provoca à vontade — e quando o rival quiser vingança, a revanche está a um toque.
              </p>
            </div>
            <RivalsResultCard />
          </div>
        </section>

        {/* ── 6. early-access form ── */}
        <section id="inscrever" className="rv-sec" aria-labelledby="rv-form" style={{ ...fieldBackdrop(0.8, 0.97), borderTop: `1px solid ${C.border}`, scrollMarginTop: 60 }}>
          <div className="rv-wrap" style={{ maxWidth: 760 }}>
            <p style={{ ...eyebrow, textAlign: "center" }}>Acesso antecipado</p>
            <h2 id="rv-form" style={{ ...h2, textAlign: "center" }}>Inscreve a tua equipa.</h2>
            <p style={{ ...lead, textAlign: "center", margin: `0 auto ${S.xl + 4}px` }}>
              Estamos a abrir o PITCH Rivals por fases. Deixa os dados do capitão e falamos contigo no WhatsApp para marcar o primeiro desafio.
            </p>
            <RivalsLeadForm />
          </div>
        </section>

        {/* ── 7. FAQ ── */}
        <section id="faq" className="rv-sec" aria-labelledby="rv-faq" style={{ scrollMarginTop: 60 }}>
          <div className="rv-wrap" style={{ maxWidth: 760 }}>
            <p style={eyebrow}>Perguntas frequentes</p>
            <h2 id="rv-faq" style={{ ...h2, marginBottom: S.xl }}>Antes do apito.</h2>
            <RivalsFaq />
          </div>
        </section>

        {/* ── 8. footer CTA ── */}
        <section className="rv-sec" style={{ paddingTop: 0 }}>
          <div className="rv-wrap">
            <div style={{ textAlign: "center", padding: "clamp(32px,6vw,56px) 20px", background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.card + 4 }}>
              <h2 style={{ ...displayFont, fontSize: "clamp(28px, 5.4vw, 48px)", lineHeight: 1.02, margin: `0 0 ${S.md}px` }}>
                Escolhe o rival.<br />Marca o jogo. <span style={{ color: C.accent }}>Fica para a história.</span>
              </h2>
              <p style={{ ...lead, margin: `0 auto ${S.xl}px` }}>PITCH Rivals chega em breve. As primeiras equipas jogam primeiro.</p>
              <BtnPrimary onClick={() => toForm("footer")} style={{ minHeight: 52, fontSize: 16, padding: "0 26px" }}>
                Inscrever a minha equipa <ArrowRight size={18} aria-hidden />
              </BtnPrimary>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="rv-wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: S.md, paddingTop: S.xl, paddingBottom: S.xl }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
            <img src={BRAND.logo} alt="PITCH" style={{ height: 18, display: "block" }} />
            <span style={{ fontSize: T.meta, color: C.text2 }}>PITCH Rivals · em breve</span>
          </div>
          <a href="/" className="rv-navlink" style={{ gap: 6 }}>pitch-fc.com <ArrowRight size={14} aria-hidden /></a>
        </div>
      </footer>
    </div>
  );
}
