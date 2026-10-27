import { C, S, T, TOUCH } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { navFor } from "../../lib/leagueNav";

/** Phone nav — exactly 5 destinations per role (brief §6). `badges` is a
 *  { tabId: count } map for what is waiting on this role. */
export default function LeagueBottomNav({ tab, onSelect, maxWidth, role, badges = {} }) {
  const NAV = navFor(role)
    .map((n) => ({ ...n, label: n.label || adjuntoName(getLang()) }));
  return (
    <nav aria-label={t("Navegação da liga")} style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth, boxSizing: "border-box",
      zIndex: 20, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex",
      padding: `${S.xs}px ${S.xs}px calc(${S.sm}px + env(safe-area-inset-bottom))`,
    }}>
      {NAV.map(({ id, Icon, label }) => {
        const active = tab === id;
        return (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-current={active ? "page" : undefined}
            style={{ flex: 1, minWidth: 0, minHeight: TOUCH.button, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 0 }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Icon size={21} strokeWidth={active ? 2.5 : 1.7} color={active ? C.accent : C.text2} aria-hidden />
              {badges[id] > 0 && <span aria-label={`${badges[id]}`} style={{ position: "absolute", top: -6, right: -10, minWidth: 16, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: C.orange, color: C.bg, fontSize: T.min, fontWeight: 900, lineHeight: "16px", textAlign: "center" }}>{badges[id]}</span>}
            </span>
            <span style={{ fontSize: T.min, fontWeight: active ? 800 : 500, color: active ? C.accent : C.text2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
