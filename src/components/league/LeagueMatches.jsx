import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf, STATE_LABEL } from "../../lib/leagueCopy";
import { TEAMS } from "../../lib/leagueDemo";
import SectionLabel from "../SectionLabel";
import Chip from "../Chip";
import LeagueMatchRow from "./LeagueMatchRow";

/** Jogos: calendar by round with state chips, filter by team. Opening a
 *  match goes to its match page (where the Matchday lives). */
export default function LeagueMatches({ ctx }) {
  const { state, derived, lang, open, acc } = ctx;
  const [teamId, setTeamId] = useState("");
  const list = state.matches.filter((m) => !teamId || m.homeId === teamId || m.awayId === teamId);
  const rounds = [...new Set(list.map((m) => m.round))].sort((a, b) => a - b);
  const counts = state.matches.reduce((o, m) => ({ ...o, [m.state]: (o[m.state] || 0) + 1 }), {});
  const followId = acc.teamId || state.prefs.supportTeamId;

  return (
    <div>
      <label htmlFor="lg-team-filter" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("Filtrar por equipa")}</label>
      <select id="lg-team-filter" value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ ...inputStyle(), marginBottom: S.md }}>
        <option value="">{t("Todas as equipas")}</option>
        {TEAMS.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
      </select>

      <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.lg }} aria-label={t("Resumo de estados")}>
        {Object.entries(counts).map(([st, n]) => <Chip key={st}>{t(STATE_LABEL[st])}: {n}</Chip>)}
      </div>

      {rounds.length === 0 && <div style={{ color: C.text2, fontSize: T.body }}>{t("Sem jogos para este filtro.")}</div>}
      {rounds.map((r) => (
        <section key={r} style={{ marginBottom: S.xl }}>
          <SectionLabel>{tf(LG.round, { n: r })}</SectionLabel>
          {list.filter((m) => m.round === r).map((m) => (
            <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={(id) => open({ kind: "match", id })} highlightTeamId={followId} />
          ))}
        </section>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Jornadas 4 e 5 ainda não publicadas (demonstração com 3 jornadas).")}</div>
    </div>
  );
}
