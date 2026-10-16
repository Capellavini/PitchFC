import { useMemo } from "react";
import { ClipboardList, FileCheck2, ListOrdered, IdCard, Heart, X, PlayCircle } from "lucide-react";
import { C, R, S, T, TOUCH, BRAND, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import { LP } from "../lib/leaguePageCopy";
import { STATE_LABEL } from "../lib/leagueCopy";
import { buildLeagueDemoSeed, deriveLeague, LEAGUE } from "../lib/leagueDemo";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import RivalsCrest from "./RivalsCrest";
import LandingSection from "./LandingSection";
import LandingFaq from "./LandingFaq";
import LandingFooter from "./LandingFooter";
import LeagueLeadForm from "./LeagueLeadForm";

const CSS = `
.lgp-root *{box-sizing:border-box}
.lgp-root{scroll-behavior:smooth}
@media(max-width:640px){.lgp-hide-sm{display:none!important}}
`;

const BENEFITS = [
  [ClipboardList, LP.b1t, LP.b1], [FileCheck2, LP.b2t, LP.b2], [ListOrdered, LP.b3t, LP.b3],
  [IdCard, LP.b4t, LP.b4], [Heart, LP.b5t, LP.b5],
];
const FAQ = [{ q: LP.q1, a: LP.a1 }, { q: LP.q2, a: LP.a2 }, { q: LP.q3, a: LP.a3 }, { q: LP.q4, a: LP.a4 }];

/**
 * /league — "PITCH para Ligas": the public page for organizers of
 * EXISTING amateur leagues (PITCH does not run a league). Pilot request
 * form (submit_lead, source "league"), the public demo (/league/demo —
 * fictional league, labelled as demo, local data only) and the fan entry
 * ("Sou adepto" → /league/demo?entrada=adepto). Full width, no app shell.
 * The hero's mini table is a real projection of the demo seed (same core
 * as the app), not a drawing.
 */
export default function LeaguePage({ onEnterApp, onDemo, onFan, lang, onLang }) {
  const table = useMemo(() => deriveLeague(buildLeagueDemoSeed()).table.slice(0, 4), []);
  const goPilot = () => document.getElementById("piloto")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="lgp-root" style={{ background: C.bg, color: C.text1, minHeight: "100vh", overflowX: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <style>{CSS}</style>

      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, padding: "10px 16px" }}>
          <a href="/" aria-label="PITCH" style={{ display: "inline-flex", alignItems: "center", minHeight: TOUCH.min, flexShrink: 0 }}><img src={BRAND.logo} alt="PITCH" style={{ height: 22 }} /></a>
          <nav className="lgp-hide-sm" aria-label={t(LP.eyebrow)} style={{ display: "flex", gap: S.lg }}>
            {[["#ganhas", LP.navBenefits], ["#como", LP.navHow], ["#faq", LP.navFaq]].map(([href, label]) => (
              <a key={href} href={href} style={{ color: C.text2, textDecoration: "none", fontSize: 13, fontWeight: 600, minHeight: TOUCH.min, display: "inline-flex", alignItems: "center" }}>{t(label)}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
            {onLang && (
              <select value={lang} onChange={(e) => onLang(e.target.value)} aria-label="Language"
                style={{ minHeight: TOUCH.min, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 6px", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer", colorScheme: "dark" }}>
                <option value="pt">🇵🇹 PT</option>
                <option value="pt-br">🇧🇷 BR</option>
                <option value="en">🇬🇧 EN</option>
              </select>
            )}
            <span className="lgp-hide-sm"><BtnGhost compact onClick={onDemo} style={{ minHeight: TOUCH.min, padding: "0 12px", fontSize: 13 }}>{t(LP.ctaDemo)}</BtnGhost></span>
            <span className="lgp-hide-sm"><BtnPrimary compact onClick={goPilot} style={{ minHeight: TOUCH.min, padding: "0 14px", fontSize: 13 }}>{t(LP.navPilot)}</BtnPrimary></span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ ...fieldBackdrop(0.55, 0.97), borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(40px,8vw,96px) 20px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
              <Chip variant="lime">{t(LP.badge)}</Chip>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.16em", color: C.accent }}>{t(LP.eyebrow)}</span>
            </div>
            <h1 style={{ ...displayFont, fontSize: "clamp(34px, 6.4vw, 62px)", lineHeight: 1.02, margin: `0 0 ${S.lg}px` }}>
              {t(LP.h1)}<br /><span style={{ color: C.accent }}>{t(LP.h1Accent)}</span>
            </h1>
            <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: C.text2, lineHeight: 1.6, maxWidth: 560, margin: `0 0 ${S.xl}px` }}>{t(LP.sub)}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: S.md }}>
              <BtnPrimary onClick={goPilot} style={{ flex: "1 1 240px", minHeight: 52, fontSize: T.body + 1 }}>{t(LP.ctaPilot)}</BtnPrimary>
              <BtnGhost onClick={onDemo} style={{ flex: "1 1 180px", minHeight: 52, fontSize: T.body + 1 }}><PlayCircle size={18} aria-hidden /> {t(LP.ctaDemo)}</BtnGhost>
            </div>
            <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LP.demoNote)}</div>
          </div>

          {/* real projection of the demo seed — labelled as demo */}
          <div style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 440 }}>
            <div style={{ ...cardStyle, background: `${C.card}F2` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
                <span style={{ fontSize: T.min, color: C.text2, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{t(LP.tableLabel)}</span>
                <Chip variant="green">{t(STATE_LABEL.homologated)}</Chip>
              </div>
              {table.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ width: 16, fontSize: T.meta, fontWeight: 800, color: C.text2 }}>{i + 1}</span>
                  <RivalsCrest initials={r.short.slice(0, 2)} color={r.color} size={22} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ fontSize: T.meta, color: C.text2 }}>{r.j} {t(LP.played)}</span>
                  <span style={{ ...displayFont, fontSize: T.cardTitle, width: 28, textAlign: "right" }}>{r.pts}</span>
                </div>
              ))}
              <div style={{ fontSize: T.min, color: C.text2, marginTop: S.sm }}>{LEAGUE.name} · {t(LP.fictional)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <LandingSection title={t(LP.painTitle)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: S.sm }}>
          {[LP.pain1, LP.pain2, LP.pain3].map((p) => (
            <div key={p} style={{ ...cardStyle, display: "flex", gap: S.md, alignItems: "flex-start" }}>
              <span aria-hidden style={{ width: 28, height: 28, borderRadius: 14, background: C.redDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={16} color={C.red} /></span>
              <span style={{ fontSize: T.body + 1, lineHeight: 1.45 }}>{t(p)}</span>
            </div>
          ))}
        </div>
      </LandingSection>

      {/* BENEFITS */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <LandingSection id="ganhas" title={t(LP.benefitsTitle)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: S.md }}>
            {BENEFITS.map(([Icon, title, text]) => (
              <div key={title} style={{ ...cardStyle, padding: S.xl }}>
                <span aria-hidden style={{ width: 44, height: 44, borderRadius: R.control, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: S.md }}><Icon size={20} color={C.accent} /></span>
                <h3 style={{ fontSize: T.cardTitle + 1, fontWeight: 800, margin: `0 0 ${S.xs}px` }}>{t(title)}</h3>
                <p style={{ fontSize: T.body, color: C.text2, lineHeight: 1.55, margin: 0 }}>{t(text)}</p>
              </div>
            ))}
          </div>
        </LandingSection>
      </div>

      {/* HOW THE PILOT WORKS */}
      <LandingSection id="como" title={t(LP.howTitle)}>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: S.md }}>
          {[LP.how1, LP.how2, LP.how3].map((s, i) => (
            <li key={s} style={{ ...cardStyle, display: "flex", gap: S.md, alignItems: "flex-start" }}>
              <span style={{ ...displayFont, fontSize: 30, color: C.accent, lineHeight: 1, minWidth: 28 }}>{i + 1}</span>
              <span style={{ fontSize: T.body + 1, lineHeight: 1.5 }}>{t(s)}</span>
            </li>
          ))}
        </ol>
        <p style={{ textAlign: "center", fontSize: T.body, color: C.text2, margin: `${S.xl}px 0 0` }}>{t(LP.howNote)}</p>
      </LandingSection>

      {/* FAN BAND */}
      <div style={{ ...fieldBackdrop(0.8, 0.95), borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 20px", display: "flex", flexWrap: "wrap", gap: S.lg, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ ...displayFont, fontSize: "clamp(22px, 3.4vw, 30px)", lineHeight: 1.15, flex: "1 1 320px", minWidth: 0 }}>{t(LP.fanTitle)}</div>
          <BtnGhost tone="accent" onClick={onFan} style={{ flex: "0 1 220px", minHeight: 52 }}><Heart size={18} aria-hidden /> {t(LP.fanCta)}</BtnGhost>
        </div>
      </div>

      {/* PILOT FORM */}
      <LandingSection id="piloto" title={t(LP.formTitle)} sub={t(LP.formSub)} style={{ maxWidth: 820 }}>
        <LeagueLeadForm />
      </LandingSection>

      <LandingFaq items={FAQ} title={t(LP.faqTitle)} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t(LP.footerLine)}</div>
        {onEnterApp && <BtnGhost compact onClick={onEnterApp} style={{ minHeight: TOUCH.min }}>{t(LP.enterApp)}</BtnGhost>}
      </div>
      <LandingFooter />
    </div>
  );
}
