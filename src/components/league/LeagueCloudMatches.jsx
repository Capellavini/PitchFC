import { useState } from "react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { getLang, t } from "../../lib/i18n";
import { STATE_LABEL, tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import BtnPrimary from "../BtnPrimary";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueMatchRow from "./LeagueMatchRow";

/** Jogos (cloud): the calendar by jornada, reusing the demo's
 *  LeagueMatchRow. Manager with no fixtures yet: "Gerar calendário"
 *  (round robin of the homologated teams; the server validates it). */
export default function LeagueCloudMatches({ leagues, competition, dir, matches, isManager, ui, supportedTeamId, onOpen, onChanged }) {
  const [teamId, setTeamId] = useState("");
  const [double, setDouble] = useState(false);
  const [busy, setBusy] = useState(false);
  const lang = getLang();
  const list = matches.filter((m) => !teamId || m.homeId === teamId || m.awayId === teamId);
  const rounds = [...new Set(list.map((m) => m.round))].sort((a, b) => a - b);
  const counts = matches.reduce((o, m) => ({ ...o, [m.state]: (o[m.state] || 0) + 1 }), {});
  const followId = supportedTeamId || leagues.leaderTeams.find((x) => dir.teamById[x.id])?.id || null;

  const generate = async () => {
    setBusy(true);
    const r = await leagues.generateFixtures(competition.id, dir.teams.map((x) => x.id), double);
    setBusy(false);
    if (r.error) ui.fail(r.error);
    else { ui.ok(tf(t("Calendário gerado: {n} jogos. Agenda cada jogo para o abrir à operação."), { n: r.data.matches })); onChanged(); }
  };

  if (!matches.length) {
    return (
      <div style={{ ...cardStyle, marginTop: S.md }}>
        <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.xs }}>{t(LM.noFixtures)}</div>
        {isManager ? (
          <>
            <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
              {t(LM.generateHint)} {tf(t("{n} equipas homologadas."), { n: dir.teams.length })}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, fontSize: T.body, cursor: "pointer", marginBottom: S.sm }}>
              <input type="checkbox" checked={double} onChange={(e) => setDouble(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent }} />
              {t(LM.doubleLegged)}
            </label>
            <BtnPrimary block disabled={busy || dir.teams.length < 2} onClick={generate}>{t(LM.generate)}</BtnPrimary>
          </>
        ) : <div style={{ fontSize: T.meta, color: C.text2 }}>{t("A organização ainda não publicou o calendário.")}</div>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: S.md }}>
      <label htmlFor="lgc-team-filter" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t(LM.filterTeam)}</label>
      <select id="lgc-team-filter" value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ ...inputStyle(), marginBottom: S.md }}>
        <option value="">{t(LM.allTeams)}</option>
        {dir.teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.lg }} aria-label={t("Resumo de estados")}>
        {Object.entries(counts).map(([st, n]) => <Chip key={st}>{t(STATE_LABEL[st] || st)}: {n}</Chip>)}
      </div>
      {rounds.map((r) => (
        <section key={r} style={{ marginBottom: S.xl }}>
          <SectionLabel>{tf(LM.round, { n: r })}</SectionLabel>
          {list.filter((m) => m.round === r).map((m) => (
            <LeagueMatchRow key={m.id} match={m} dir={dir} score={{ home: m.homeScore, away: m.awayScore }} lang={lang} onOpen={onOpen} highlightTeamId={followId} />
          ))}
        </section>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("O resultado só aparece no calendário depois de homologado. Abre o jogo para ver o resultado provisório.")}</div>
    </div>
  );
}
