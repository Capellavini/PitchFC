import { useState } from "react";
import { ChevronRight, Users, BookOpen, Gavel, SlidersHorizontal, FlaskConical, Star, Gamepad2 } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG } from "../../lib/leagueCopy";
import { TEAMS, playerById, teamById, PHASE2_DECISIONS } from "../../lib/leagueDemo";
import BackHeader from "../BackHeader";
import BtnGhost from "../BtnGhost";
import TeamCrest from "../TeamCrest";
import SectionLabel from "../SectionLabel";
import LeagueRegulation from "./LeagueRegulation";
import LeagueDiscipline from "./LeagueDiscipline";

/** Mais: equipas, acompanhando, regulamento, disciplina, preferências e
 *  "Repor exemplos". */
export default function LeagueMore({ ctx }) {
  const { state, derived, act, open } = ctx;
  const [sub, setSub] = useState(null);
  const row = (Icon, label, onClick, sub2) => (
    <button type="button" onClick={onClick} style={{ width: "100%", minHeight: TOUCH.button + 4, display: "flex", alignItems: "center", gap: S.md, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, color: C.text1, cursor: "pointer", padding: `0 ${S.md}px`, marginBottom: S.sm, textAlign: "left" }}>
      <Icon size={18} color={C.accent} aria-hidden />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{label}</span>
        {sub2 && <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{sub2}</span>}
      </span>
      <ChevronRight size={18} color={C.text2} aria-hidden />
    </button>
  );
  const prefs = state.prefs;

  if (sub === "regulamento") return <div><BackHeader title={t("Regulamento")} onBack={() => setSub(null)} /><LeagueRegulation /></div>;
  if (sub === "disciplina") return <div><BackHeader title={t("Disciplina")} onBack={() => setSub(null)} /><LeagueDiscipline discipline={derived.discipline} onPlayer={(id) => open({ kind: "player", id })} /></div>;
  if (sub === "prefs") {
    return (
      <div>
        <BackHeader title={t("Preferências")} onBack={() => setSub(null)} />
        <label htmlFor="lg-support" style={{ display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, marginBottom: S.xs }}>{t("A tua equipa do coração")}</label>
        <select id="lg-support" value={prefs.supportTeamId || ""} onChange={(e) => act.setPrefs({ supportTeamId: e.target.value, followTeamIds: [...new Set([...(prefs.followTeamIds || []), e.target.value])] })} style={{ ...inputStyle(), marginBottom: S.lg }}>
          {TEAMS.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
        </select>
        {[["notifyResults", "Avisar resultados das equipas que sigo"], ["notifyCalendar", "Avisar alterações de calendário"]].map(([k, label]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.min, fontSize: T.body, cursor: "pointer" }}>
            <input type="checkbox" checked={Boolean(prefs[k])} onChange={(e) => act.setPrefs({ [k]: e.target.checked })} style={{ width: 22, height: 22, accentColor: C.accent }} />
            {t(label)}
          </label>
        ))}
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md, lineHeight: 1.5 }}>{t("Preferências guardadas só neste browser. Notificações reais chegam na Fase 3.")}</div>
      </div>
    );
  }

  const followedTeams = (prefs.followTeamIds || []).map((id) => teamById[id]).filter(Boolean);
  const followedPlayers = (prefs.followPlayerIds || []).map((id) => playerById[id]).filter(Boolean);

  return (
    <div>
      <SectionLabel>{t("Acompanhando")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.xl, display: "flex", flexWrap: "wrap", gap: S.xs }}>
        {followedTeams.length + followedPlayers.length === 0 && <span style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda não segues nenhuma equipa ou atleta.")}</span>}
        {followedTeams.map((tm) => (
          <button key={tm.id} type="button" onClick={() => open({ kind: "team", id: tm.id })} style={{ minHeight: TOUCH.min, display: "inline-flex", alignItems: "center", gap: S.xs, padding: `0 ${S.md}px`, borderRadius: R.pill, border: `1px solid ${tm.id === prefs.supportTeamId ? C.accentBorder : C.border}`, background: "transparent", color: C.text1, cursor: "pointer", fontSize: T.meta, fontWeight: 700 }}>
            <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={18} /> {tm.name}
          </button>
        ))}
        {followedPlayers.map((p) => (
          <button key={p.id} type="button" onClick={() => open({ kind: "player", id: p.id })} style={{ minHeight: TOUCH.min, display: "inline-flex", alignItems: "center", gap: S.xs, padding: `0 ${S.md}px`, borderRadius: R.pill, border: `1px solid ${C.border}`, background: "transparent", color: C.text1, cursor: "pointer", fontSize: T.meta, fontWeight: 700 }}>
            <Star size={14} color={C.gold} aria-hidden /> {p.name}
          </button>
        ))}
      </div>

      <SectionLabel>{t(LG.teams)}</SectionLabel>
      {TEAMS.map((tm) => <div key={tm.id}>{row(() => <TeamCrest initials={tm.short.slice(0, 2)} color={tm.color} size={22} />, tm.name, () => open({ kind: "team", id: tm.id }), tm.venue)}</div>)}

      <SectionLabel style={{ marginTop: S.xl }}>{t("Liga")}</SectionLabel>
      {row(BookOpen, t("Regulamento"), () => setSub("regulamento"), t("Demonstração · só leitura"))}
      {row(Gavel, t("Disciplina"), () => setSub("disciplina"), t("Cartões e suspensões (regras demo)"))}
      {row(SlidersHorizontal, t("Preferências"), () => setSub("prefs"), t("Equipa do coração e avisos"))}
      {row(Users, t("Atletas"), () => open({ kind: "players" }), t("Cartões, OVR e comparação"))}
      {(ctx.role === "captain" || ctx.role === "athlete") && row(Gamepad2, t("Fantasy"), () => ctx.goTab("fantasy"), t("Monta a tua equipa de adepto"))}

      <div style={{ ...cardStyle, marginTop: S.xl, borderStyle: "dashed", borderColor: `${C.orange}88` }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><FlaskConical size={16} color={C.orange} aria-hidden /> {t(LG.demoMode)}</div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>{t(LG.demoData)} {t("Nada é enviado para servidores.")}</div>
        <details style={{ marginBottom: S.md }}>
          <summary style={{ minHeight: TOUCH.min, display: "flex", alignItems: "center", cursor: "pointer", fontSize: T.body, fontWeight: 700 }}>{t("Decisões já tomadas para a Fase 2")}</summary>
          <ul style={{ margin: 0, paddingLeft: S.lg, fontSize: T.meta, color: C.text2, lineHeight: 1.7 }}>
            {PHASE2_DECISIONS.map((d) => <li key={d}>{t(d)}</li>)}
          </ul>
        </details>
        <BtnGhost block onClick={act.reset}>{t(LG.reset)}</BtnGhost>
      </div>
    </div>
  );
}
