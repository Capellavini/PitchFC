import { Sparkles } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";

/**
 * A tiny, clearly-labelled example exchange ("Pitch, we're missing two
 * players for Sunday.") — makes Pitch Copilot read as a product feature
 * rather than another bullet. Static copy, not a live chat.
 *
 * Props: name (product name), label ("Example"), ask, reply (PT-PT source strings).
 */
export default function PricingAiDemo({ name, label, ask, reply }) {
  return (
    <div style={{ marginTop: S.lg, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.min, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent, marginBottom: S.sm }}>
        <Sparkles size={13} aria-hidden /> {t(name)} · {t(label)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: C.card, border: `1px solid ${C.border}`, borderRadius: `${R.card}px ${R.card}px 4px ${R.card}px`, padding: `${S.sm}px ${S.md}px`, fontSize: T.body, color: C.text1, lineHeight: 1.35 }}>
          {t(ask)}
        </div>
        <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: `${R.card}px ${R.card}px ${R.card}px 4px`, padding: `${S.sm}px ${S.md}px`, fontSize: T.body, color: C.text1, lineHeight: 1.35 }}>
          {t(reply)}
        </div>
      </div>
    </div>
  );
}
