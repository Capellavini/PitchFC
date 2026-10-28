import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf, STATE_LABEL } from "../../lib/leagueCopy";
import { TEAMS, competitionTitle } from "../../lib/leagueDemo";
import { competitionRounds } from "../../lib/leagueGroups";
import SectionLabel from "../SectionLabel";
import Chip from "../Chip";
import LeagueMatchRow from "./LeagueMatchRow";

/** Jogos: calendar by competition and round with state chips, filter by
 *  team. Opening a match goes to its match page (where the Matchday lives). */
export default function LeagueMatches({ ctx }) {
  const { state, derived, lang, open, acc, scope = "all" } = ctx;
  const [teamId, setTeamId] = useState("");
  const list = state.matches.filter((m) => !teamId || m.homeId === teamId || m.awayId === teamId);
  const groups = competitionRounds(list, scope);
  const counts = groups.flatMap((g) => g.rounds.flatMap((r) => r.matches)).reduce((o, m) => ({ ...o, [m.state]: (o[m.state] || 0) + 1 }), {});
  const followId = acc.teamId || state.prefs.supportTeamId;

  return (
    <div>
      <label htmlFor="lg-team-filter" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("Filtrar por equipa")}</label>
      <select id="lg-team-filter" value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ ...inputStyle(), marginBottom: S.md, maxWidth: 420 }}>
        <option value="">{t("Todas as equipas")}</option>
        {TEAMS.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
      </select>

      <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.lg }} aria-label={t("Resumo de estados")}>
        {Object.entries(counts).map(([st, n]) => <Chip key={st}>{t(STATE_LABEL[st])}: {n}</Chip>)}
      </div>

      {groups.length === 0 && <div style={{ color: C.text2, fontSize: T.body }}>{t("Sem jogos para este filtro.")}</div>}
      {groups.map(({ competition, rounds }) => (
        <div key={competition.id} style={{ marginBottom: S.xxl }}>
          {(scope === "all" || groups.length > 1) && <h2 style={{ fontSize: T.h, margin: `0 0 ${S.md}px`, color: C.text1 }}>{t(competition.sponsor ? competitionTitle(competition) : competition.short)}</h2>}
          {rounds.map(({ round, name, matches }) => (
            <section key={round} style={{ marginBottom: S.xl }}>
              <SectionLabel>{name ? t(name) : tf(LG.round, { n: round })}</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", columnGap: S.md }}>
                {matches.map((m) => (
                  <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={(id) => open({ kind: "match", id })} highlightTeamId={followId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}
