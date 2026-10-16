import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";

/** Calendário: rounds/fixtures (generated once with core
 *  roundRobinFixtures). Postpone / start lives on each match page. */
export default function LeagueManageCalendar({ ctx, openMatch }) {
  const { state, derived, lang } = ctx;
  const rounds = [...new Set(state.matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {t("Calendário gerado por pontos corridos (uma volta). Abre um jogo para iniciar, adiar ou ligar o VAR. Grupos e mata-mata não são oferecidos nesta fase.")}
      </div>
      {rounds.map((r) => (
        <section key={r} style={{ marginBottom: S.lg }}>
          <SectionLabel>{tf(LG.round, { n: r })}</SectionLabel>
          {state.matches.filter((m) => m.round === r).map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} />)}
        </section>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Jornadas 4–5 por publicar.")}</div>
    </div>
  );
}
