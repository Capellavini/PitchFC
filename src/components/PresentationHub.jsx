import { C, R, S, T, BRAND, displayFont, fieldBackdrop } from "../theme";
import { PERSONAS, LANGS, enterPersona, setPresentationLang } from "../lib/presentationPersonas";
import { getLang } from "../lib/i18n";

/** /demo — launcher for meetings: pick who you present as, no login. All data
 *  is invented and stays in this browser (see lib/presentation.js). */
export default function PresentationHub() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text1, ...fieldBackdrop(0.55, 0.96), fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: `${S.xxl}px ${S.lg}px ${S.xxl * 2}px` }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 30, display: "block", marginBottom: S.xl }} />
        <div style={{ display: "inline-block", fontSize: T.meta, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: R.pill, padding: "4px 12px", marginBottom: S.md }}>
          Versão de apresentação
        </div>
        <h1 style={{ ...displayFont, fontSize: "clamp(34px, 7vw, 60px)", lineHeight: 1.02, margin: `0 0 ${S.md}px`, textTransform: "uppercase" }}>
          A casa do futebol amador
        </h1>
        <p style={{ fontSize: T.h - 3, color: C.text2, lineHeight: 1.5, maxWidth: 620, margin: `0 0 ${S.xxl}px` }}>
          Escolhe o ponto de vista. Tudo funciona de verdade — confirmar presença, sortear equipas, jogar o Matchday, Fantasy, desafios, liga — sobre dados fictícios, sem login.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: S.md }}>
          {PERSONAS.map((p) => (
            <button key={p.id} onClick={() => enterPersona(p.id)} style={{
              textAlign: "left", cursor: "pointer", background: `${C.card}EE`, border: `1px solid ${C.border}`, borderRadius: R.card,
              padding: S.lg, color: C.text1, minHeight: 168, display: "flex", flexDirection: "column", gap: S.sm, font: "inherit",
            }}>
              <span style={{ fontSize: 30 }} aria-hidden>{p.emoji}</span>
              <span style={{ ...displayFont, fontSize: T.h + 2, textTransform: "uppercase" }}>{p.title}</span>
              <span style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45, flex: 1 }}>{p.blurb}</span>
              <span style={{ fontSize: T.meta + 1, fontWeight: 800, color: C.accent }}>{p.who} →</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.xl }}>
          <span style={{ fontSize: T.meta + 1, color: C.text3 }}>Idioma</span>
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setPresentationLang(l.id)} aria-pressed={getLang() === l.id} style={{
              minWidth: 44, minHeight: 36, borderRadius: R.pill, cursor: "pointer", font: "inherit", fontSize: T.meta + 1, fontWeight: 800,
              border: `1px solid ${getLang() === l.id ? C.accent : C.border}`, background: getLang() === l.id ? `${C.accent}22` : "transparent",
              color: getLang() === l.id ? C.accent : C.text2,
            }}>{l.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: S.md, marginTop: S.xl, fontSize: T.meta + 1, color: C.text3 }}>
          <a href="/apresentacao" style={{ color: C.text2 }}>Apresentação comercial</a>
          <a href="/pricing" style={{ color: C.text2 }}>Preços</a>
          <a href="/league" style={{ color: C.text2 }}>Página para Ligas</a>
          <a href="/rivals" style={{ color: C.text2 }}>Página Rivals</a>
        </div>
        <p style={{ fontSize: T.meta, color: C.text3, marginTop: S.md }}>
          Jogadores, resultados e fotos são inventados. Nada é enviado para servidores; as alterações ficam só neste navegador e podem ser repostas a qualquer momento.
        </p>
      </div>
    </div>
  );
}
