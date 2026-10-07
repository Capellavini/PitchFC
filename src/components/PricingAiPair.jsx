import { Sparkles, Compass } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { AI_PAIR } from "../lib/pricingCopy";

function Side({ Icon, data, tone }) {
  return (
    <div style={{ ...cardStyle, padding: S.xl, flex: "1 1 0", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.xs }}>
        <Icon size={18} color={tone} aria-hidden />
        <h3 style={{ ...displayFont, fontSize: T.h + 2, margin: 0 }}>{t(data.name)}</h3>
      </div>
      <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: tone, marginBottom: S.sm }}>{t(data.who)}</div>
      <div style={{ fontSize: T.body, color: C.text1, fontWeight: 700, lineHeight: 1.35, marginBottom: S.md }}>{t(data.purpose)}</div>
      <ul style={{ listStyle: "none", margin: `0 0 ${S.md}px`, padding: 0, display: "flex", flexWrap: "wrap", gap: S.sm }}>
        {data.items.map((it) => (
          <li key={it} style={{ fontSize: T.meta, color: C.text2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: "4px 10px" }}>{t(it)}</li>
        ))}
      </ul>
      <div style={{ fontSize: T.meta, color: C.text2 }}>{t(data.included)}</div>
    </div>
  );
}

/** Pitch Copilot (organizer, runs the game) vs Pitch Coach (player,
 *  understands the game) — different customers, different names. */
export default function PricingAiPair() {
  return (
    <section aria-labelledby="pr-ai">
      <h2 id="pr-ai" style={{ ...displayFont, fontSize: "clamp(22px, 4vw, 30px)", margin: `0 0 ${S.lg}px` }}>{t(AI_PAIR.title)}</h2>
      <div className="pr-pair">
        <Side Icon={Sparkles} data={AI_PAIR.copilot} tone={C.accent} />
        <Side Icon={Compass} data={AI_PAIR.coach} tone={C.blue} />
      </div>
    </section>
  );
}
