import { Check, Circle, ChevronRight } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { setupSteps } from "../../lib/leagueSetup";
import { SETUP_STEP } from "../../lib/leagueSetupCopy";
import SectionLabel from "../SectionLabel";

/** "Montar a liga": the first steps of a league, computed from what exists.
 *  Shows on the Gestor's Painel until everything is done, then disappears. */
export default function LeagueSetupChecklist({ ctx }) {
  const steps = setupSteps(ctx.state);
  if (steps.every((s) => s.done)) return null;
  const next = steps.find((s) => !s.done);
  return (
    <section aria-label={t("Montar a liga")} style={{ marginBottom: S.xl }}>
      <SectionLabel>{t("Montar a liga")} · {steps.filter((s) => s.done).length}/{steps.length}</SectionLabel>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {steps.map((s, i) => {
          const copy = SETUP_STEP[s.id];
          const isNext = s === next;
          return (
            <button key={s.id} type="button" onClick={() => ctx.open({ kind: "manage", section: s.section })}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: S.md, minHeight: 64, padding: `${S.sm}px ${S.md}px`, background: isNext ? C.accentDim : "none", border: "none", borderTop: i ? `1px solid ${C.border}` : "none", color: C.text1, cursor: "pointer", textAlign: "left" }}>
              {s.done ? <Check size={20} color={C.green} aria-hidden style={{ flexShrink: 0 }} /> : <Circle size={20} color={isNext ? C.accent : C.text2} aria-hidden style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: T.body, fontWeight: 800, color: s.done ? C.text2 : C.text1, textDecoration: s.done ? "line-through" : "none" }}>{t(copy.title)}</span>
                {!s.done && <span style={{ display: "block", fontSize: T.meta, color: C.text2, lineHeight: 1.4 }}>{t(copy.hint)}</span>}
              </span>
              {!s.done && <ChevronRight size={18} color={C.text2} aria-hidden />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
