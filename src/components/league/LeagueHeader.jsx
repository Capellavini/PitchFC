import { ChevronRight, FlaskConical } from "lucide-react";
import { C, S, T, BRAND, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG } from "../../lib/leagueCopy";
import { LEAGUE, COMPETITION } from "../../lib/leagueDemo";
import Chip from "../Chip";
import LeagueRoleSwitcher from "./LeagueRoleSwitcher";

/** League top bar: PITCH logo + demo chip, then league → competition/season
 *  → category (always legible, above all data) and the demo-only role
 *  switcher. PITCH Ligas is a standalone product: no link back to the other
 *  PITCH apps and no context switcher. `compact` (entry screen) shows only
 *  the top row; `slim` (pushed screens) keeps the top row + breadcrumb. */
export default function LeagueHeader({ role, onRole, compact, slim }) {
  const crumbs = [LEAGUE.name, COMPETITION.name, `${t(COMPETITION.category)} · ${t(COMPETITION.format)}`];
  return (
    <header style={{ padding: `${S.md}px 0 ${S.md}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        <span style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: S.sm }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 18 }} />
          <span style={{ ...displayFont, fontSize: T.meta, letterSpacing: "0.12em", color: C.accent }}>LIGAS</span>
        </span>
        <Chip variant="orange" Icon={FlaskConical} title={t(LG.demoData)}>{t("Demo")}</Chip>
      </div>
      {compact ? null : (
        <>
          <nav aria-label={t("Contexto da liga")} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: T.meta, color: C.text2 }}>
            {crumbs.map((c, i) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                {i > 0 && <ChevronRight size={12} aria-hidden />}
                <span style={{ fontWeight: i === 0 ? 800 : 600, color: i === 0 ? C.text1 : C.text2 }}>{c}</span>
              </span>
            ))}
          </nav>
          {!slim && <>
          <h1 style={{ ...displayFont, fontSize: T.title - 6, lineHeight: 1.1, margin: `${S.xs}px 0 ${S.md}px`, color: C.text1 }}>
            {LEAGUE.name}
          </h1>
          <LeagueRoleSwitcher role={role} onRole={onRole} />
          </>}
          <div aria-hidden style={{ height: 1, background: C.border, marginTop: slim ? S.sm : S.lg }} />
        </>
      )}
    </header>
  );
}
