import { C, S, T, TOUCH } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { FOLLOW_NAV, MANAGER_NAV } from "../../lib/leagueNav";

/** Phone nav — exactly 5 destinations per role (brief §6). */
export default function LeagueBottomNav({ tab, onSelect, maxWidth, role }) {
  const NAV = (role === "manager" ? MANAGER_NAV.filter((n) => n.phone !== false) : FOLLOW_NAV)
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
            <Icon size={21} strokeWidth={active ? 2.5 : 1.7} color={active ? C.accent : C.text2} aria-hidden />
            <span style={{ fontSize: T.min, fontWeight: active ? 800 : 500, color: active ? C.accent : C.text2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
