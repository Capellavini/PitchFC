import { useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { COMPETITIONS, TEAMS, teamById, competitionTitle } from "../../lib/leagueDemo";
import { generateFixtures, addMatch } from "../../lib/leagueSetup";
import BtnPrimary from "../BtnPrimary";
import LeagueField from "./LeagueField";

/** Calendar tools of the Gestor: generate a whole league calendar, or add a
 *  single match (cup tie, final, friendly). */
export default function LeagueFixturesForm({ ctx }) {
  const { state } = ctx;
  const ready = COMPETITIONS.filter((c) => c.kind !== "cup" && (c.teamIds || []).length >= 2 && !state.matches.some((m) => m.competitionId === c.id));
  return (
    <div style={{ marginBottom: S.xl }}>
      {ready.map((c) => <Generate key={c.id} ctx={ctx} competition={c} />)}
      {COMPETITIONS.length > 0 && TEAMS.length >= 2 && <OneMatch ctx={ctx} />}
      {COMPETITIONS.length === 0 && <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>{t("Cria uma competição e inscreve as equipas para montar o calendário.")}</div>}
    </div>
  );
}

function Generate({ ctx, competition }) {
  const { act } = ctx;
  const [startDate, setStartDate] = useState("");
  const [times, setTimes] = useState("15:00");
  const [every, setEvery] = useState("7");
  const n = competition.teamIds.length;
  const legs = competition.legs || 1;
  const rounds = (n % 2 ? n : n - 1) * legs;
  return (
    <form onSubmit={(e) => { e.preventDefault(); act.setup((s) => generateFixtures(s, { competitionId: competition.id, startDate, times: times.split(/[ ,;]+/).filter(Boolean), everyDays: Number(every) || 7 }), t("Calendário gerado.")); }}
      style={{ ...cardStyle, display: "grid", gap: S.md, marginBottom: S.md, maxWidth: 640 }}>
      <div>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t("Gerar calendário")} · {t(competitionTitle(competition))}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{n} {t("equipas")} · {legs} {legs === 1 ? t("volta") : t("voltas")} · {rounds} {t("jornadas")}{n % 2 ? ` · ${t("uma equipa folga em cada jornada")}` : ""}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: S.md }}>
        <LeagueField label={t("Primeira jornada")}><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle()} required /></LeagueField>
        <LeagueField label={t("Horas dos jogos")} hint={t("Separadas por vírgula: 15:00, 18:00")}><input value={times} onChange={(e) => setTimes(e.target.value)} style={inputStyle()} /></LeagueField>
        <LeagueField label={t("Dias entre jornadas")}><input type="number" min="1" max="30" value={every} onChange={(e) => setEvery(e.target.value)} style={inputStyle()} /></LeagueField>
      </div>
      <div><BtnPrimary type="submit" disabled={!startDate}>{t("Gerar jornadas")}</BtnPrimary></div>
    </form>
  );
}

function OneMatch({ ctx }) {
  const { act } = ctx;
  const [competitionId, setCompetitionId] = useState(COMPETITIONS[0]?.id || "");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("15:00");
  const [round, setRound] = useState("1");
  const [roundName, setRoundName] = useState("");
  const [venue, setVenue] = useState("");
  const comp = COMPETITIONS.find((c) => c.id === competitionId);
  const pool = comp?.kind !== "cup" && (comp?.teamIds || []).length ? comp.teamIds.map((id) => teamById[id]).filter(Boolean) : TEAMS;
  const submit = (e) => {
    e.preventDefault();
    const r = act.setup((s) => addMatch(s, { competitionId, homeId, awayId, date, time, venue, round, roundName }), t("Jogo adicionado."));
    if (r?.ok) { setHomeId(""); setAwayId(""); }
  };
  return (
    <details style={{ ...cardStyle, padding: `0 ${S.md}px` }}>
      <summary style={{ minHeight: 52, display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 800 }}>{t("Adicionar jogo")}</summary>
      <form onSubmit={submit} style={{ display: "grid", gap: S.md, paddingBottom: S.md, maxWidth: 640 }}>
        <LeagueField label={t("Competição")}>
          <select value={competitionId} onChange={(e) => { setCompetitionId(e.target.value); setHomeId(""); setAwayId(""); }} style={inputStyle()}>
            {COMPETITIONS.map((c) => <option key={c.id} value={c.id}>{competitionTitle(c)}</option>)}
          </select>
        </LeagueField>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: S.md }}>
          <LeagueField label={t("Equipa da casa")}>
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} style={inputStyle()} required><option value="">{t("Escolher")}</option>{pool.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </LeagueField>
          <LeagueField label={t("Equipa visitante")}>
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} style={inputStyle()} required><option value="">{t("Escolher")}</option>{pool.filter((x) => x.id !== homeId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </LeagueField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: S.md }}>
          <LeagueField label={t("Data")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle()} required /></LeagueField>
          <LeagueField label={t("Hora")}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle()} required /></LeagueField>
          <LeagueField label={t("N.º da jornada/fase")}><input type="number" min="1" max="60" value={round} onChange={(e) => setRound(e.target.value)} style={inputStyle()} /></LeagueField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: S.md }}>
          <LeagueField label={t("Nome da fase (opcional)")} hint={t("Ex.: Meias-finais, Final.")}><input value={roundName} onChange={(e) => setRoundName(e.target.value)} maxLength={40} style={inputStyle()} /></LeagueField>
          <LeagueField label={t("Local (opcional)")}><input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} style={inputStyle()} /></LeagueField>
        </div>
        <div><BtnPrimary type="submit" disabled={!homeId || !awayId || !date}>{t("Adicionar jogo")}</BtnPrimary></div>
      </form>
    </details>
  );
}
