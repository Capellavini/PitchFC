import { Sparkles } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { welcomeFor, isWelcomed } from "../../lib/leagueWelcome";
import BtnGhost from "../BtnGhost";

/** First-visit card on a role's home: three lines on what the screen is for,
 *  dismissed for good (per role, per browser). */
export default function LeagueWelcome({ role, seen, onSeen }) {
  const w = welcomeFor(role);
  if (!w || isWelcomed(seen, role)) return null;
  return (
    <section aria-label={t(w.title)} style={{ ...cardStyle, marginBottom: S.xl, borderLeft: `3px solid ${C.accent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
        <Sparkles size={18} color={C.accent} aria-hidden />
        <span style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t(w.title)}</span>
      </div>
      <ol style={{ margin: `0 0 ${S.md}px`, paddingLeft: S.lg, display: "flex", flexDirection: "column", gap: S.xs, fontSize: T.body, lineHeight: 1.5, color: C.text1 }}>
        {w.lines.map((l) => <li key={l}>{t(l)}</li>)}
      </ol>
      <BtnGhost tone="accent" onClick={() => onSeen(role)}>{t("Percebi")}</BtnGhost>
    </section>
  );
}
