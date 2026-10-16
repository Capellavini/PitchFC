import { ChevronRight, Settings2, ArrowLeft, FlaskConical } from "lucide-react";
import { C, S, T, BRAND, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG } from "../../lib/leagueCopy";
import { LEAGUE, COMPETITION } from "../../lib/leagueDemo";
import Chip from "../Chip";
import BtnGhost from "../BtnGhost";
import LeagueRoleSwitcher from "./LeagueRoleSwitcher";
import LeagueContextSwitcher from "./LeagueContextSwitcher";

/** League-context top bar: PITCH logo + context switcher + demo chip,
 *  then league → competition/season → category (always legible, above
 *  all data), the demo-only role switcher and — Gestor only — "Gerir
 *  liga". `compact` (entry screen) shows only the top row; `slim` (pushed
 *  screens) keeps the top row + breadcrumb. */
export default function LeagueHeader({ ctx, contexts, role, onRole, inManage, onManage, onExitManage, compact, slim }) {
  const crumbs = [LEAGUE.name, COMPETITION.name, `${t(COMPETITION.category)} · ${t(COMPETITION.format)}`];
  return (
    <header style={{ padding: `${S.md}px 0 ${S.md}px` }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        <a href="/" aria-label={t("Voltar à app PITCH")} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, paddingRight: S.xs }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 18 }} />
        </a>
        <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex" }}>
          {!compact && <LeagueContextSwitcher contexts={contexts} role={role} supportTeamId={ctx.state.prefs.supportTeamId} />}
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
            {inManage ? t("Gestão da liga") : LEAGUE.name}
          </h1>
          <LeagueRoleSwitcher role={role} onRole={onRole} />
          {role === "manager" && (
            <div style={{ marginTop: S.md }}>
              {inManage
                ? <BtnGhost block onClick={onExitManage}><ArrowLeft size={16} aria-hidden /> {t(LG.backToLeague)}</BtnGhost>
                : <BtnGhost block tone="accent" onClick={onManage}><Settings2 size={16} aria-hidden /> {t(LG.manage)}</BtnGhost>}
            </div>
          )}
          </>}
          <div aria-hidden style={{ height: 1, background: C.border, marginTop: slim ? S.sm : S.lg }} />
        </>
      )}
    </header>
  );
}
