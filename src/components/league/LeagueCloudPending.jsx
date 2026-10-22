import { useEffect, useState } from "react";
import { C, S, T, cardStyle } from "../../theme";
import { getLang, t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { pendingWork } from "../../lib/leagueMatches";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";

/** Gestão → "À espera da organização": fichas de jogo to validate
 *  (provisional / in review / abandoned), matches live now, open disputes,
 *  discipline cases to decide and matches still to schedule. Each row opens
 *  the match page, where the action lives. */
export default function LeagueCloudPending({ leagues, competition, matches, dir, ui, onOpen }) {
  const [disputes, setDisputes] = useState([]);
  const [pendingCases, setPendingCases] = useState(null);
  const lang = getLang();
  const work = pendingWork(matches);
  useEffect(() => {
    let alive = true;
    Promise.all([leagues.fetchDisputes(competition.id, "open"), leagues.fetchDiscipline(competition.id)]).then(([dq, sq]) => {
      if (!alive) return;
      setDisputes(dq.data?.items || []);
      setPendingCases(sq.data?.pendingCases ?? null);
    });
    return () => { alive = false; };
  }, [leagues, competition.id, ui]);
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const block = (label, list) => (list.length ? (
    <div style={{ marginBottom: S.md }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.xs }}>{t(label)} · {list.length}</div>
      {list.map((m) => <LeagueMatchRow key={m.id} match={m} dir={dir} score={{ home: m.homeScore, away: m.awayScore }} lang={lang} onOpen={onOpen} />)}
    </div>
  ) : null);
  const empty = !work.toHomologate.length && !work.live.length && !disputes.length && !pendingCases && !work.toSchedule.length;
  return (
    <section style={{ ...cardStyle, marginTop: S.md }}>
      <SectionLabel>{t(LM.pending)}</SectionLabel>
      {empty && <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LM.nothingPending)}</div>}
      {block(LM.toHomologate, work.toHomologate)}
      {block(LM.liveNow, work.live)}
      {disputes.length > 0 && (
        <div style={{ marginBottom: S.md }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.xs }}>{t(LM.disputes)} · {disputes.length}</div>
          {disputes.map((d) => byId[d.matchId] ? <LeagueMatchRow key={d.id} match={byId[d.matchId]} dir={dir} score={{ home: byId[d.matchId].homeScore, away: byId[d.matchId].awayScore }} lang={lang} onOpen={onOpen} /> : null)}
        </div>
      )}
      {pendingCases ? <div style={{ marginBottom: S.md }}><Chip variant="orange">{tf(t("{n} casos disciplinares por decidir — ver Disciplina"), { n: pendingCases })}</Chip></div> : null}
      {block(LM.toSchedule, work.toSchedule.slice(0, 6))}
      {work.toSchedule.length > 6 && <div style={{ fontSize: T.meta, color: C.text2 }}>{tf(t("+{n} jogos por agendar no calendário."), { n: work.toSchedule.length - 6 })}</div>}
    </section>
  );
}
