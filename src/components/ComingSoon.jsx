import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";

/** Neutral "Em breve" card for a section that's designed but not open
 *  yet (behind a feature flag). `preview` adds a small admin-only note
 *  so the owner knows they're seeing something regular users don't. */
export default function ComingSoon({ Icon, title, body, preview = false }) {
  return (
    <div style={{ ...cardStyle, textAlign: "center", padding: "32px 24px", marginBottom: 16 }}>
      {Icon && (
        <div style={{ width: 52, height: 52, borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon size={24} color={C.text2} />
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.text3, marginBottom: 8 }}>{t("EM BREVE")}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 8 }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{body}</div>}
      {preview && (
        <div style={{ fontSize: 11, color: C.accent, marginTop: 16 }}>{t("Pré-visualização de admin — ainda invisível para os jogadores.")}</div>
      )}
    </div>
  );
}
