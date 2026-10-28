import { FlaskConical, Menu } from "lucide-react";
import { C, S, T, TOUCH, BRAND, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG } from "../../lib/leagueCopy";
import { LEAGUE, COMPETITION } from "../../lib/leagueDemo";
import Chip from "../Chip";
import LeagueRoleSwitcher from "./LeagueRoleSwitcher";
import LeagueScopeBar from "./LeagueScopeBar";
import LeagueMark from "./LeagueMark";
import { LeagueSyncChip } from "./LeagueSyncStatus";

/** League top bar. PITCH Ligas is a standalone product: no link back to the
 *  other PITCH apps and no context switcher.
 *  - `desktop` (Gestor on a computer): just the page title; the sidebar has
 *    the logo, the competitions and the demo role switcher.
 *  - phone, Gestor: logo + demo chip + "Mais", league name, the competition
 *    switcher, and the demo role switcher folded away.
 *  - phone, followers: logo + chip, breadcrumb, role switcher.
 *  `compact` (entry screen) shows only the top row; `slim` (pushed screens)
 *  keeps the top row + breadcrumb. */
export default function LeagueHeader({ role, onRole, compact, slim, desktop = false, title, subtitle, scope, onScope, onMore, live = false, sync }) {
  if (desktop) {
    return (
      <header style={{ marginBottom: S.xl }}>
        <h1 style={{ ...displayFont, fontSize: T.title, lineHeight: 1.1, margin: 0, color: C.text1 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: T.body, color: C.text2, marginTop: S.xs }}>{subtitle}</div>}
      </header>
    );
  }
  const manager = role === "manager";
  const crumbs = [`${t(COMPETITION.category)} · ${t(COMPETITION.format)}`, COMPETITION.name];
  return (
    <header style={{ padding: `${S.md}px 0 ${S.md}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <span style={{ display: "inline-flex", alignItems: "center", minHeight: 44, gap: S.sm }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 18 }} />
          <span style={{ ...displayFont, fontSize: T.meta, letterSpacing: "0.12em", color: C.accent }}>LIGAS</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: S.sm }}>
          {live
            ? <LeagueSyncChip sync={sync} />
            : <Chip variant="orange" Icon={FlaskConical} title={t(LG.demoData)}>{t("Demo")}</Chip>}
          {manager && !compact && (
            <button type="button" onClick={onMore} aria-label={t("Mais")} style={{ width: TOUCH.min, height: TOUCH.min, display: "grid", placeItems: "center", background: "none", border: `1px solid ${C.border}`, borderRadius: 999, color: C.text1, cursor: "pointer" }}>
              <Menu size={18} aria-hidden />
            </button>
          )}
        </span>
      </div>
      {compact ? null : (
        <>
          {!slim && (
            <div style={{ display: "flex", alignItems: "center", gap: S.md, margin: `${S.xs}px 0 ${S.md}px` }}>
              {live && <LeagueMark size={44} />}
              <h1 style={{ ...displayFont, fontSize: T.title - 6, lineHeight: 1.1, margin: 0, color: C.text1, minWidth: 0 }}>{LEAGUE.name}</h1>
            </div>
          )}
          {manager
            ? <LeagueScopeBar scope={scope} onScope={onScope} />
            : (
              <div aria-label={t("Contexto da liga")} style={{ fontSize: T.meta, color: C.text2, fontWeight: 600 }}>{crumbs.join(" · ")}</div>
            )}
          {!slim && !live && (
            <details style={{ marginTop: S.md }}>
              <summary style={{ cursor: "pointer", fontSize: T.meta, color: C.text2, minHeight: TOUCH.min, display: "flex", alignItems: "center" }}>{t("Ver como (só na demonstração)")}</summary>
              <LeagueRoleSwitcher role={role} onRole={onRole} />
            </details>
          )}
          <div aria-hidden style={{ height: 1, background: C.border, marginTop: slim ? S.sm : S.md }} />
        </>
      )}
    </header>
  );
}
