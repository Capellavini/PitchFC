import { Home, CalendarDays, ListOrdered, Gamepad2, Menu } from "lucide-react";
import { C, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { LG } from "../../lib/leagueCopy";

const NAV = [
  { id: "inicio", Icon: Home, label: LG.navHome },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "fantasy", Icon: Gamepad2, label: LG.navFantasy },
  { id: "mais", Icon: Menu, label: LG.navMore },
];

/** League follow nav — exactly 5 destinations (brief §6). */
export default function LeagueBottomNav({ tab, onSelect, maxWidth }) {
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
