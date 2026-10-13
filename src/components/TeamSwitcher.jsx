import { Plus } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";

/** Team switcher inside Rivals — only rendered when I'm in more than one
 *  team. Horizontal pills (crest + name) + "Nova equipa". */
export default function TeamSwitcher({ teams, value, onChange, onNew }) {
  const pill = (active) => ({
    flex: "0 0 auto", display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, maxWidth: 220,
    padding: `0 ${S.md}px 0 6px`, borderRadius: R.pill, cursor: "pointer", fontSize: T.meta + 1, fontWeight: active ? 800 : 600,
    background: active ? C.accentDim : "transparent", color: active ? C.text1 : C.text2,
    border: `1px solid ${active ? C.accentBorder : C.border}`,
  });
  return (
    <div role="tablist" aria-label={t(RC.switchTeam)} style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: S.lg, paddingBottom: 2 }}>
      {teams.map((tm) => (
        <button key={tm.id} type="button" role="tab" aria-selected={tm.id === value} onClick={() => onChange(tm.id)} style={pill(tm.id === value)}>
          <TeamBadge team={tm} size={30} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</span>
        </button>
      ))}
      {onNew && (
        <button type="button" onClick={onNew} style={{ ...pill(false), padding: `0 ${S.md}px` }}>
          <Plus size={16} /> {t(RC.newTeam)}
        </button>
      )}
    </div>
  );
}
