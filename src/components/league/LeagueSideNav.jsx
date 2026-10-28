import { FlaskConical } from "lucide-react";
import { C, R, S, T, BRAND, displayFont } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { LG } from "../../lib/leagueCopy";
import { LEAGUE } from "../../lib/leagueDemo";
import { deskNavFor } from "../../lib/leagueNav";
import Chip from "../Chip";
import LeagueScopeBar from "./LeagueScopeBar";
import LeagueRoleSwitcher from "./LeagueRoleSwitcher";
import { LeagueSyncChip } from "./LeagueSyncStatus";

/** Desktop navigation, per role: the Gestor gets the work areas and the
 *  competition switcher; captain, athlete and fan get their own five
 *  destinations. The demo-only role switcher sits at the bottom. The league
 *  is a web app on a computer, not a phone column. `badges` is a
 *  { tabId: count } map of what is waiting on this role. */
export default function LeagueSideNav({ tab, onSelect, scope, onScope, role, onRole, badges = {}, live = false, sync }) {
  const NAV = deskNavFor(role).map((n) => ({ ...n, label: n.label || adjuntoName(getLang()) }));
  return (
    <aside style={{
      position: "sticky", top: 0, alignSelf: "start", height: "100vh", boxSizing: "border-box", overflowY: "auto",
      background: C.surface, borderRight: `1px solid ${C.border}`, padding: `${S.xl}px ${S.lg}px`, display: "flex", flexDirection: "column", gap: S.xl,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 32 }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 18 }} />
          <span style={{ ...displayFont, fontSize: T.meta, letterSpacing: "0.12em", color: C.accent }}>LIGAS</span>
        </div>
        <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.15, marginTop: S.md, color: C.text1 }}>{LEAGUE.name}</div>
        <div style={{ marginTop: S.sm }}>
          {live ? <LeagueSyncChip sync={sync} /> : <Chip variant="orange" Icon={FlaskConical} title={t(LG.demoData)}>{t("Demo")}</Chip>}
        </div>
      </div>

      <nav aria-label={t("Navegação da liga")} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map(({ id, Icon, label }) => {
          const active = tab === id;
          return (
            <button key={id} type="button" onClick={() => onSelect(id)} aria-current={active ? "page" : undefined} style={{
              display: "flex", alignItems: "center", gap: S.md, minHeight: 44, padding: `0 ${S.md}px`, cursor: "pointer", textAlign: "left",
              border: "none", borderRadius: R.control, background: active ? C.accentDim : "transparent",
              color: active ? C.accent : C.text1, fontSize: T.body, fontWeight: active ? 800 : 600,
            }}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.8} aria-hidden />
              <span style={{ flex: 1 }}>{t(label)}</span>
              {badges[id] > 0 && (
                <span aria-label={`${badges[id]}`} style={{ minWidth: 22, padding: "1px 7px", borderRadius: 999, background: C.orange, color: C.bg, fontSize: T.min, fontWeight: 900, textAlign: "center" }}>{badges[id]}</span>
              )}
            </button>
          );
        })}
      </nav>

      {role === "manager" && (
        <div>
          <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.sm }}>{t("Competições")}</div>
          <LeagueScopeBar scope={scope} onScope={onScope} vertical />
        </div>
      )}

      {!live && (
        <div style={{ marginTop: "auto" }}>
          <LeagueRoleSwitcher role={role} onRole={onRole} grid />
        </div>
      )}
    </aside>
  );
}
