import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { competitionRounds } from "../../lib/leagueGroups";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";
import LeagueFixturesForm from "./LeagueFixturesForm";

/** Calendário: every competition of the league, by round or phase. Postpone /
 *  start lives on each match page. */
export default function LeagueManageCalendar({ ctx, openMatch }) {
  const { state, derived, lang, scope = "all" } = ctx;
  const groups = competitionRounds(state.matches, scope);
  return (
    <div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {t("Abre um jogo para iniciar, adiar ou ligar o VAR. O calendário avisa quando dois jogos disputam o mesmo local.")}
      </div>
      <LeagueFixturesForm ctx={ctx} />
      {groups.length === 0 && <div style={{ color: C.text2, fontSize: T.body }}>{t("Ainda não há jogos.")}</div>}
      {groups.map(({ competition, rounds }) => (
        <div key={competition.id} style={{ marginBottom: S.xl }}>
          <h2 style={{ fontSize: T.h, margin: `0 0 ${S.md}px`, color: C.text1 }}>{t(competition.short)}</h2>
          {rounds.map(({ round, name, matches }) => (
            <section key={round} style={{ marginBottom: S.lg }}>
              <SectionLabel>{name ? t(name) : tf(LG.round, { n: round })}</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", columnGap: S.md }}>
                {matches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} />)}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
