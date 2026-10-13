import { Minus, Plus } from "lucide-react";
import { C, R, T, TOUCH, displayFont } from "../theme";
import { RC, tf } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";

/** One side of a result: crest + name + big score + −/+ (44px), with a
 *  live region so screen readers hear the new score. (Used by the result
 *  sheet in PR7.) */
export default function ScoreStepper({ team, value, onChange, disabled }) {
  const btn = { width: TOUCH.min, height: TOUCH.min, borderRadius: R.control, background: C.card, border: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const name = { team: team?.name || "" };
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <TeamBadge team={team} size={48} />
      <div style={{ fontSize: T.meta + 0.5, fontWeight: 700, color: C.text1, textAlign: "center", minHeight: 32, overflowWrap: "anywhere" }}>{team?.name}</div>
      <div aria-live="polite" style={{ ...displayFont, fontSize: 44, color: C.text1, lineHeight: 1 }}>{value}</div>
      {!disabled && (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" aria-label={tf(RC.scoreLess, name)} onClick={() => onChange(Math.max(0, value - 1))} style={btn}><Minus size={16} /></button>
          <button type="button" aria-label={tf(RC.scoreMore, name)} onClick={() => onChange(Math.min(99, value + 1))} style={btn}><Plus size={16} /></button>
        </div>
      )}
    </div>
  );
}
