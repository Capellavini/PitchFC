import { Check } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";

const STEPS = ["Equipas", "Jogo", "Stats"];

/**
 * MatchdayStepper — the mockup's "Lineup · Match · Stats" progress line
 * at the top of Matchday: which of the three states the day is in.
 * Current step = lime (active state), done steps = green check, next = muted.
 *
 * While the day is live the steps double as the screen's navigation
 * (Equipas = teams, Jogo = live scoring, Stats = the day's stats and
 * standings) — pass `onSelect` + `view` to make them tappable. `view` is
 * the step currently on screen (underlined); `step` stays the data state.
 *
 * Props: step 0 (before) | 1 (live) | 2 (after); view?; onSelect?(i).
 */
export default function MatchdayStepper({ step = 0, view = step, onSelect = null }) {
  return (
    <ol aria-label={t("Progresso do dia de jogo")} style={{ display: "flex", alignItems: "stretch", gap: S.sm, listStyle: "none", margin: `0 0 ${S.xl}px`, padding: 0 }}>
      {STEPS.map((label, i) => {
        const done = i < step, active = i === step;
        const shown = onSelect ? i === view : active;
        const color = active ? C.accent : done ? C.green : C.text2;
        const inner = (
          <>
            <div style={{ height: 3, borderRadius: 2, background: active ? C.accent : done ? C.green : C.border, marginBottom: S.sm }} />
            <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.meta, fontWeight: shown ? 800 : 700, color: shown ? C.text1 : C.text2 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? C.accent : "transparent", border: `1.5px solid ${color}`,
                color: active ? C.bg : color, fontSize: T.min, fontWeight: 900,
              }}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ overflowWrap: "break-word", minWidth: 0, textDecoration: onSelect && shown ? "underline" : "none", textUnderlineOffset: 4, textDecorationThickness: 2 }}>{t(label)}</span>
            </div>
          </>
        );
        return (
          <li key={label} aria-current={active ? "step" : undefined} style={{ flex: 1, minWidth: 0 }}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(i)} aria-pressed={shown}
                style={{ width: "100%", minHeight: 44, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit" }}>
                {inner}
              </button>
            ) : inner}
          </li>
        );
      })}
    </ol>
  );
}
