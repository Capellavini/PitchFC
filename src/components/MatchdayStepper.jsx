import { Check } from "lucide-react";
import { C, S, T } from "../theme";
import { t } from "../lib/i18n";

const STEPS = ["Equipas", "Jogo", "Stats"];

/**
 * MatchdayStepper — the mockup's "Lineup · Match · Stats" progress line
 * at the top of Matchday: which of the three states the day is in.
 * Informational only (not tappable) — the state is decided by the data.
 * Current step = lime (active state), done steps = green check, next = muted.
 *
 * Props: step 0 (before) | 1 (live) | 2 (after).
 */
export default function MatchdayStepper({ step = 0 }) {
  return (
    <ol aria-label={t("Progresso do dia de jogo")} style={{ display: "flex", alignItems: "center", gap: S.sm, listStyle: "none", margin: `0 0 ${S.xl}px`, padding: 0 }}>
      {STEPS.map((label, i) => {
        const done = i < step, active = i === step;
        const color = active ? C.accent : done ? C.green : C.text2;
        return (
          <li key={label} aria-current={active ? "step" : undefined} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ height: 3, borderRadius: 2, background: active ? C.accent : done ? C.green : C.border, marginBottom: S.sm }} />
            <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.meta, fontWeight: active ? 800 : 700, color: active ? C.text1 : C.text2 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? C.accent : "transparent", border: `1.5px solid ${color}`,
                color: active ? C.bg : color, fontSize: T.min, fontWeight: 900,
              }}>
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ overflowWrap: "break-word", minWidth: 0 }}>{t(label)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
