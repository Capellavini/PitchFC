import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { COMPETITIONS } from "../../lib/leagueDemo";

/** Which competition the Gestor is looking at: all of them, or one. A league
 *  runs several at once (league table + cup), so this is always one tap away.
 *  `vertical` is the desktop sidebar list. */
export default function LeagueScopeBar({ scope, onScope, vertical = false }) {
  const options = [{ id: "all", label: t("Todas") }, ...COMPETITIONS.map((c) => ({ id: c.id, label: t(c.short) }))];
  return (
    <div role="group" aria-label={t("Competição")} style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: S.xs, flexWrap: "wrap", overflowX: vertical ? "visible" : "auto" }}>
      {options.map((o) => {
        const on = scope === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onScope(o.id)} aria-pressed={on} style={{
            minHeight: vertical ? 40 : TOUCH.min, padding: `0 ${S.md}px`, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
            borderRadius: vertical ? R.control : 999, border: `1px solid ${on ? C.accentBorder : C.border}`,
            background: on ? C.accentDim : "transparent", color: on ? C.accent : C.text2, fontSize: T.meta, fontWeight: on ? 800 : 600,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}
