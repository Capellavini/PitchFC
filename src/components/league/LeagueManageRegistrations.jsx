import { useState } from "react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf, POSITION_LABEL } from "../../lib/leagueCopy";
import { COMPETITIONS, TEAMS, PLAYERS, captainOf } from "../../lib/leagueDemo";
import { addTeam, addPlayers, setTeamCompetitions, setCaptain, removePlayer, removeTeam } from "../../lib/leagueSetup";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import TeamCrest from "../TeamCrest";
import LeagueField from "./LeagueField";

/** Inscrições: the league's teams and athletes. A team is the same identity
 *  from season to season; its squad is pasted one athlete per line. */
export default function LeagueManageRegistrations({ ctx }) {
  const { act } = ctx;
  return (
    <div>
      <NewTeam ctx={ctx} />
      {TEAMS.length === 0 && <div style={{ ...cardStyle, color: C.text2, fontSize: T.body }}>{t("Ainda não há equipas. Cria a primeira em «Nova equipa».")}</div>}
      {TEAMS.length > 0 && (
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
          {tf(t("{n} equipas e {p} atletas. A equipa é a mesma identidade de época para época — só o plantel inscrito é por época."), { n: TEAMS.length, p: PLAYERS.length })}
        </div>
      )}
      {TEAMS.map((tm) => <TeamCard key={tm.id} tm={tm} act={act} />)}
    </div>
  );
}

function NewTeam({ ctx }) {
  const { act } = ctx;
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [comps, setComps] = useState(() => (COMPETITIONS.length === 1 ? [COMPETITIONS[0].id] : []));
  const [open, setOpen] = useState(TEAMS.length === 0); // stays open while several teams are added
  const toggle = (id) => setComps((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const submit = (e) => {
    e.preventDefault();
    const r = act.setup((s) => addTeam(s, { name, venue, competitionIds: comps }), t("Equipa criada."));
    if (r?.ok) { setName(""); setVenue(""); }
  };
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} style={{ ...cardStyle, marginBottom: S.xl, padding: `0 ${S.md}px` }}>
      <summary style={{ minHeight: 52, display: "flex", alignItems: "center", cursor: "pointer", fontWeight: 800 }}>{t("Nova equipa")}</summary>
      <form onSubmit={submit} style={{ display: "grid", gap: S.md, paddingBottom: S.md, maxWidth: 640 }}>
        <LeagueField label={t("Nome da equipa")}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={inputStyle()} autoComplete="off" required /></LeagueField>
        <LeagueField label={t("Campo (opcional)")} hint={t("Usado como local dos jogos em casa.")}><input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} style={inputStyle()} autoComplete="off" /></LeagueField>
        {COMPETITIONS.length > 0 && <CompetitionPicker value={comps} onToggle={toggle} />}
        {COMPETITIONS.length === 0 && <div style={{ fontSize: T.meta, color: C.orange }}>{t("Cria primeiro uma competição para poderes inscrever a equipa nela.")}</div>}
        <div><BtnPrimary type="submit" disabled={name.trim().length < 2}>{t("Criar equipa")}</BtnPrimary></div>
      </form>
    </details>
  );
}

function CompetitionPicker({ value, onToggle }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <legend style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.xs }}>{t("Joga em")}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
        {COMPETITIONS.map((c) => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(c.id)}
              style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: 999, cursor: "pointer", fontSize: T.meta, fontWeight: 700, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : "transparent", color: on ? C.bg : C.text1 }}>
              {c.short || c.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function TeamCard({ tm, act }) {
  const squad = PLAYERS.filter((p) => p.teamId === tm.id);
  const mine = COMPETITIONS.filter((c) => (c.teamIds || []).includes(tm.id)).map((c) => c.id);
  const [text, setText] = useState("");
  const captainId = captainOf(tm.id);
  const toggleComp = (id) => act.setup((s) => setTeamCompetitions(s, tm.id, mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]));
  const add = () => { const r = act.setup((s) => addPlayers(s, tm.id, text), t("Atletas adicionados.")); if (r?.ok) setText(""); };
  return (
    <details style={{ ...cardStyle, marginBottom: S.sm, padding: `0 ${S.md}px` }}>
      <summary style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.button + 4, cursor: "pointer", listStyle: "none" }}>
        <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={26} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{tm.name}</span>
          <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>
            {squad.length ? tf(t("{n} atletas"), { n: squad.length }) + (captainId ? ` · ${t("capitão")} ${PLAYERS.find((p) => p.id === captainId)?.name}` : "") : t("Sem atletas ainda")}
            {tm.venue ? ` · ${tm.venue}` : ""}
          </span>
        </span>
        <Chip variant={mine.length ? "green" : "orange"}>{mine.length ? t("Inscrita") : t("Sem competição")}</Chip>
      </summary>
      <div style={{ display: "grid", gap: S.md, paddingBottom: S.md }}>
        <CompetitionPicker value={mine} onToggle={toggleComp} />
        {squad.length > 0 && (
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: T.meta }}>
            {squad.map((p) => (
              <li key={p.id} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 40, borderTop: `1px solid ${C.border}` }}>
                <span style={{ width: 28, color: C.text2, fontWeight: 800 }}>{p.number ?? "–"}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text1 }}>{p.name} · {t(POSITION_LABEL[p.position])}</span>
                {p.id === captainId ? <Chip variant="lime">{t("Capitão")}</Chip> : <button type="button" onClick={() => act.setup((s) => setCaptain(s, tm.id, p.id))} style={linkBtn}>{t("Tornar capitão")}</button>}
                <button type="button" aria-label={`${t("Remover")} ${p.name}`} onClick={() => act.setup((s) => removePlayer(s, p.id))} style={linkBtn}>×</button>
              </li>
            ))}
          </ol>
        )}
        <LeagueField label={t("Adicionar atletas")} hint={t("Um por linha: «10 Rui Silva», «10;Rui Silva;DEF» ou só o nome. Posições: GR, DEF, MED, AVA. Também podes colar do Excel.")}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit" }} placeholder={"1 Rui Silva GR\n9 Tiago Pinto AVA"} />
        </LeagueField>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          <BtnPrimary onClick={add} disabled={!text.trim()}>{t("Adicionar")}</BtnPrimary>
          <BtnGhost onClick={() => act.setup((s) => removeTeam(s, tm.id), t("Equipa removida."))}>{t("Remover equipa")}</BtnGhost>
        </div>
      </div>
    </details>
  );
}

const linkBtn = { minHeight: 40, minWidth: 40, padding: "0 8px", background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: T.meta, fontWeight: 700 };
