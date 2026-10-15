import { LifeBuoy, MessageCircle } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { supportWhatsAppUrl } from "../lib/rivals";

/** "Precisas de ajuda? Fala connosco" → the PITCH bot's WhatsApp, with the
 *  match pre-filled. Shown when a result is stuck (4 proposals) or has
 *  waited more than 7 days. We never decide for anyone — we help sort it.
 *  Props: count (revisions), stale (bool), team / opp (names), when. */
export default function ResultHelpCard({ count = 0, stuck = false, stale = false, team, opp, when }) {
  const href = supportWhatsAppUrl(tf(MC.helpMessage, { team: team || "", opp: opp || "", when: when || "" }));
  return (
    <div role="note" style={{ background: C.orangeDim, border: `1px solid ${C.orange}55`, borderRadius: R.control, padding: S.md, marginTop: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.body, fontWeight: 800, color: C.text1 }}>
        <LifeBuoy size={18} color={C.orange} aria-hidden style={{ flexShrink: 0 }} /> {t(MC.helpTitle)}
      </div>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.xs }}>
        {stuck ? tf(MC.helpLimit, { n: Math.max(count, 3) }) : stale ? t(MC.helpStale) : null}
        {(stuck || stale) ? " " : ""}{t(MC.helpBody)}
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{
          marginTop: S.md, minHeight: TOUCH.min, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm,
          padding: `0 ${S.lg}px`, borderRadius: R.control, background: C.whatsapp, color: C.bg, fontWeight: 800, fontSize: T.body, textDecoration: "none", boxSizing: "border-box",
        }}>
        <MessageCircle size={16} aria-hidden /> {t(MC.helpOpen)}
      </a>
    </div>
  );
}
