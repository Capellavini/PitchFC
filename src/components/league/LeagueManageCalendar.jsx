import { C, S, T } from "./visual/theme";
import { t } from "../../lib/i18n";
import { competitionRounds, openRounds } from "../../lib/leagueGroups";
import LeagueCalendarRound from "./LeagueCalendarRound";
import LeagueFixturesForm from "./LeagueFixturesForm";

/** Calendário: every competition of the league, by round or phase. Postpone /
 *  start lives on each match page. A long season opens only the round that needs attention. */
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
      {groups.map(({ competition, rounds }) => {
        const open = openRounds(rounds);
        return (
          <div key={competition.id} style={{ marginBottom: S.xl }}>
            <h2 style={{ fontSize: T.h, margin: `0 0 ${S.md}px`, color: C.text1 }}>{t(competition.short)}</h2>
            {rounds.map(({ round, name, matches }) => (
              <LeagueCalendarRound key={round} round={round} name={name} matches={matches} scores={derived.scores} lang={lang} onOpen={openMatch} defaultOpen={open.has(round)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
