import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { C, S, T } from "./visual/theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import SectionLabel from "./visual/SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";

/** One round of the Calendário. In a long season only the round that needs attention is
 *  drawn open: 38 rounds × 10 matches at once froze the page for ~3 s (found in the
 *  380-match test). The others are one tap away and render only when opened. */
export default function LeagueCalendarRound({ round, name, matches, scores, lang, onOpen, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const title = name ? t(name) : tf(LG.round, { n: round });
  return (
    <section style={{ marginBottom: S.lg }}>
      <SectionLabel right={
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
          style={{ background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: S.xs, minHeight: 32 }}>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          {open ? t("Esconder") : tf(t("Ver {n} jogos"), { n: matches.length })}
        </button>
      }>{title}</SectionLabel>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", columnGap: S.md }}>
          {matches.map((m) => <LeagueMatchRow key={m.id} match={m} score={scores[m.id]} lang={lang} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}
