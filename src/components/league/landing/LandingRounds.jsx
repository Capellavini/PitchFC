import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../../../theme";
import { t } from "../../../lib/i18n";
import { tf } from "../../../lib/leagueCopy";
import LandingMatchRow from "./LandingMatchRow";

const step = { width: TOUCH.min, height: TOUCH.min, display: "grid", placeItems: "center", background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, color: C.text1, cursor: "pointer", flexShrink: 0 };

/** The calendar round by round: ‹ Jornada 5 › with its games. Opens on the current round. */
export default function LandingRounds({ comp, lang }) {
  const rounds = comp.rounds;
  const start = Math.max(0, rounds.findIndex((r) => r.n === comp.currentRound));
  const [i, setI] = useState(start);
  useEffect(() => { setI(start); }, [comp.id, start]);
  if (!rounds.length) return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, padding: S.lg, color: C.text2, fontSize: T.body }}>{t("O calendário aparece aqui quando a liga o publicar.")}</div>;
  const at = Math.min(i, rounds.length - 1);
  const round = rounds[at];
  const word = comp.kind === "cup" ? t("Ronda") : t("Jornada");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
        <button type="button" style={{ ...step, opacity: at === 0 ? 0.4 : 1 }} disabled={at === 0} onClick={() => setI(at - 1)} aria-label={t("Jornada anterior")}><ChevronLeft size={20} aria-hidden /></button>
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.1 }}>{word} {round.n}</div>
          <div style={{ fontSize: T.meta, color: C.text2 }}>
            {round.n === comp.currentRound ? t("jornada atual") : tf(t("{a} de {b}"), { a: at + 1, b: rounds.length })}
          </div>
        </div>
        <button type="button" style={{ ...step, opacity: at === rounds.length - 1 ? 0.4 : 1 }} disabled={at === rounds.length - 1} onClick={() => setI(at + 1)} aria-label={t("Jornada seguinte")}><ChevronRight size={20} aria-hidden /></button>
      </div>
      {round.matches.map((m) => <LandingMatchRow key={m.id} match={m} lang={lang} />)}
    </div>
  );
}
