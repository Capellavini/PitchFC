import { C, BRAND, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { analyticsConfigured } from "../lib/analytics";
import { openPreferences } from "../lib/consent";

const link = () => ({ fontSize: 12, color: C.text2, textDecoration: "none", minHeight: TOUCH.min, display: "inline-flex", alignItems: "center" });

/** Landing footer: logo, legal links, cookie preferences (only when GA is configured). */
export default function LandingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 20px" }}>
        <img src={BRAND.logo} alt="PITCH App" style={{ height: 20, opacity: 0.7 }} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <a href="/privacidade" style={link()}>{t("Privacidade")}</a>
          <a href="/termos" style={link()}>{t("Termos")}</a>
          {analyticsConfigured() && (
            <button type="button" onClick={openPreferences} style={{ ...link(), background: "none", border: "none", padding: 0, cursor: "pointer" }}>{t("Cookies")}</button>
          )}
          <div style={{ fontSize: 12, color: C.text3 }}>{t("PITCH Club · Matosinhos — Porto · versão beta")}</div>
        </div>
      </div>
    </footer>
  );
}
