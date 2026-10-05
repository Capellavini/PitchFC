import { useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { analyticsConfigured } from "../lib/analytics";
import { getConsent, getVersion, subscribe, isPreferencesOpen, setAnalyticsConsent } from "../lib/consent";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

// One-tap, no-login pages where a banner would sit on top of the only
// button the person came for (confirm attendance, rate a friend) — and
// owner-only screens. Nothing is tracked there without a prior "yes", and
// the banner simply shows up on their next normal visit.
const isTransactional = () => {
  const { pathname, search } = window.location;
  const q = new URLSearchParams(search);
  return q.has("confirm") || q.has("rate") || pathname.startsWith("/admin") || pathname.startsWith("/roadmap");
};

/** First-visit consent banner. Reject is exactly as easy as accept (same
 *  size, same row, one tap). Only renders when a GA4 property is
 *  configured — with nothing optional to consent to, there is nothing to ask.
 *  Reopened on purpose from Settings / the legal pages via openPreferences(). */
export default function CookieConsent() {
  useSyncExternalStore(subscribe, getVersion);
  const [, rerender] = useReducer((n) => n + 1, 0);
  const ref = useRef(null);

  useEffect(() => {
    window.addEventListener("pitch:lang", rerender);
    return () => window.removeEventListener("pitch:lang", rerender);
  }, []);

  const visible = analyticsConfigured() && (isPreferencesOpen() || (getConsent() === null && !isTransactional()));

  // Keep page content scrollable above the banner instead of hidden under it.
  useEffect(() => {
    if (!visible || !ref.current) return undefined;
    const el = ref.current;
    const before = document.body.style.paddingBottom;
    const apply = () => { document.body.style.paddingBottom = `${el.offsetHeight}px`; };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); document.body.style.paddingBottom = before; };
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60, display: "flex", justifyContent: "center", padding: `${S.md}px ${S.md}px calc(${S.md}px + env(safe-area-inset-bottom))`, pointerEvents: "none",
      // Mounted beside <PitchApp />, so it inherits nothing from the pages' own font setup.
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <div ref={ref} role="dialog" aria-label={t("Cookies e privacidade")}
        style={{ ...cardStyle, width: "100%", maxWidth: 520, boxSizing: "border-box", pointerEvents: "auto" }}>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>{t("Cookies e privacidade")}</div>
        <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.5, marginBottom: S.sm }}>
          {t("Usamos armazenamento essencial para a app funcionar (sessão, idioma, tema). Com a tua permissão, usamos também o Google Analytics para perceber como a app é usada e melhorá-la. Nunca para publicidade.")}
        </div>
        <a href="/privacidade#cookies" style={{ display: "inline-block", fontSize: T.meta, color: C.text2, textDecoration: "underline", marginBottom: S.md }}>
          {t("Saber mais na Política de Privacidade")}
        </a>
        <div style={{ display: "flex", gap: S.sm }}>
          <BtnGhost onClick={() => setAnalyticsConsent(false)} style={{ flex: 1 }}>{t("Só o essencial")}</BtnGhost>
          <BtnPrimary onClick={() => setAnalyticsConsent(true)} style={{ flex: 1 }}>{t("Aceitar analytics")}</BtnPrimary>
        </div>
      </div>
    </div>
  );
}
