import { Trophy } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { CUP } from "../../lib/leagueDemo";
import { competitionRounds } from "../../lib/leagueGroups";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";

/** The cup has no table: its "classificação" is the bracket, phase by phase.
 *  The next phase is created once the ties of the current one are official. */
export default function LeagueCupPhase({ ctx }) {
  const { state, derived, lang, open } = ctx;
  const [group] = competitionRounds(state.matches, CUP.id);
  const phases = group?.rounds || [];
  const allOfficial = phases.length > 0 && phases.every((p) => p.matches.every((m) => ["homologated", "walkover"].includes(m.state)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
        <Trophy size={20} color={C.accent} aria-hidden />
        <h2 style={{ margin: 0, fontSize: T.h }}>{t(CUP.name)}</h2>
      </div>
      {phases.map((p) => (
        <section key={p.round} style={{ marginBottom: S.xl }}>
          <SectionLabel>{t(p.name || `Fase ${p.round}`)}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", columnGap: S.md }}>
            {p.matches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={(id) => open({ kind: "match", id })} />)}
          </div>
        </section>
      ))}
      <section>
        <SectionLabel>{t("Final")}</SectionLabel>
        <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>
          {allOfficial ? t("A final pode ser criada: as meias-finais estão homologadas.") : t("A final fica por definir até as duas meias-finais estarem homologadas.")}
        </div>
      </section>
    </div>
  );
}
