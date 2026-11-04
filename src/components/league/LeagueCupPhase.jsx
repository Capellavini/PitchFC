import { Trophy } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { competitionRounds } from "../../lib/leagueGroups";
import { competitionTitle, teamById } from "../../lib/leagueDemo";
import { cupBracket } from "../../lib/leagueSeason";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueCupNextPhase from "./LeagueCupNextPhase";

/** The cup has no table: its "classificação" is the bracket, phase by phase.
 *  The next phase is created once the ties of the current one are official. */
export default function LeagueCupPhase({ ctx, competition }) {
  const { state, derived, lang, open, role } = ctx;
  const [group] = competitionRounds(state.matches, competition.id);
  const phases = group?.rounds || [];
  const bracket = cupBracket(state, competition);
  const champion = bracket.champion ? teamById[bracket.champion.teamId] : null;
  const winnerOf = Object.fromEntries(bracket.phases.flatMap((p) => p.ties.map((x) => [x.matchId, x])));
  const allOfficial = phases.length > 0 && phases.every((p) => p.matches.every((m) => ["homologated", "walkover"].includes(m.state)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
        <Trophy size={20} color={C.accent} aria-hidden />
        <h2 style={{ margin: 0, fontSize: T.h }}>{t(competitionTitle(competition))}</h2>
      </div>
      {phases.map((p) => (
        <section key={p.round} style={{ marginBottom: S.xl }}>
          <SectionLabel>{t(p.name || `Fase ${p.round}`)}</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", columnGap: S.md }}>
            {p.matches.map((m) => (
              <div key={m.id}>
                <LeagueMatchRow match={m} score={derived.scores[m.id]} lang={lang} onOpen={(id) => open({ kind: "match", id })} />
                {winnerOf[m.id]?.winnerId && teamById[winnerOf[m.id].winnerId] && (
                  <div style={{ fontSize: T.meta, color: C.text2, margin: `-4px 0 ${S.sm}px ${S.md}px` }}>
                    {t("Passa")}: <strong style={{ color: C.text1 }}>{teamById[winnerOf[m.id].winnerId].name}</strong>
                    {winnerOf[m.id].shootout ? ` (${t("pen.")} ${winnerOf[m.id].shootout.home}–${winnerOf[m.id].shootout.away})` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {role === "manager" && !champion && !ctx.store?.readOnly && <LeagueCupNextPhase ctx={ctx} competition={competition} />}
      <section>
        <SectionLabel>{champion ? t("Campeão") : t("Final")}</SectionLabel>
        {champion ? (
          <div style={{ ...cardStyle, borderColor: C.accentBorder, display: "flex", alignItems: "center", gap: S.md }}>
            <Trophy size={28} color={C.accent} aria-hidden />
            <div><div style={{ fontSize: T.h, fontWeight: 900 }}>{champion.name}</div><div style={{ fontSize: T.meta, color: C.text2 }}>{t(competitionTitle(competition))}</div></div>
          </div>
        ) : (
        <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>
          {allOfficial ? t("A final pode ser criada: as meias-finais estão homologadas.") : t("A final fica por definir até as duas meias-finais estarem homologadas.")}
        </div>
        )}
      </section>
    </div>
  );
}
