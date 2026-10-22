import { CheckCircle2, Circle } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById, playerById, TEAMS, PLAYERS, currentRound } from "../../lib/leagueDemo";
import { fanVoteOpen } from "../../lib/core/league";
import SectionLabel from "../SectionLabel";
import StatTile from "../StatTile";

/** Visão geral & pendências: a checklist of what needs the Gestor now. */
export default function LeagueManageOverview({ ctx, onSection, openMatch }) {
  const { state, derived } = ctx;
  const ms = state.matches;
  const name = (m) => `${teamById[m.homeId].short}–${teamById[m.awayId].short}`;
  const round = currentRound(ms);
  const todo = [
    ...ms.filter((m) => m.state === "in_review").map((m) => ({ key: `r${m.id}`, text: tf(t("Decidir contestação · {m}"), { m: name(m) }), sub: m.contest?.reason, go: () => openMatch(m.id) })),
    ...ms.filter((m) => m.state === "ended_provisional").map((m) => ({ key: `h${m.id}`, text: tf(t("Homologar resultado · {m}"), { m: name(m) }), sub: t("Resultado provisório fora da classificação oficial"), go: () => openMatch(m.id) })),
    ...ms.filter((m) => m.state === "live").map((m) => ({ key: `l${m.id}`, text: tf(t("Jogo a decorrer · {m}"), { m: name(m) }), go: () => openMatch(m.id) })),
    ...ms.filter((m) => fanVoteOpen(m) && m.state === "homologated").map((m) => ({ key: `v${m.id}`, text: tf(t("Fechar votação dos adeptos · {m}"), { m: name(m) }), go: () => openMatch(m.id) })),
    ...ms.filter((m) => ["ended_provisional", "in_review", "homologated"].includes(m.state) && !m.officialMvp).map((m) => ({ key: `mvp${m.id}`, text: tf(t("Escolher craque oficial · {m}"), { m: name(m) }), go: () => openMatch(m.id) })),
    ...ms.filter((m) => m.round === round && m.state === "scheduled").flatMap((m) => [m.homeId, m.awayId].filter((tid) => !(m.lineups?.[tid] || []).length).map((tid) => ({ key: `c${m.id}${tid}`, text: tf(t("Convocatória em falta · {team} ({m})"), { team: teamById[tid].name, m: name(m) }), sub: t("Cabe ao capitão — podes lembrar a equipa"), go: () => openMatch(m.id) }))),
    ...Object.values(derived.discipline).filter((d) => d.pending > 0).map((d) => ({ key: `s${d.playerId}`, text: tf(t("Suspensão por cumprir · {p}"), { p: playerById[d.playerId].name }), sub: teamById[d.teamId].name, go: () => onSection("discipline") })),
  ];
  const played = ms.filter((m) => m.state === "homologated").length;
  return (
    <div>
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.xl }}>
        <StatTile value={TEAMS.length} label={t("Equipas")} />
        <StatTile value={PLAYERS.length} label={t("Atletas")} />
        <StatTile value={played} label={t("Homologados")} color={C.green} />
        <StatTile value={todo.length} label={t("Pendências")} color={todo.length ? C.orange : C.green} />
      </div>
      <SectionLabel>{t("Pendências")}</SectionLabel>
      {todo.length === 0 && <div style={{ ...cardStyle, display: "flex", gap: S.sm, color: C.text2 }}><CheckCircle2 size={18} color={C.green} aria-hidden /> {t("Tudo em dia.")}</div>}
      {todo.map((x) => (
        <button key={x.key} type="button" onClick={x.go} style={{ width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "flex-start", gap: S.md, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, color: C.text1, cursor: "pointer", padding: S.md, marginBottom: S.sm, textAlign: "left" }}>
          <Circle size={18} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: T.body, fontWeight: 700 }}>{x.text}</span>
            {x.sub && <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2 }}>{x.sub}</span>}
          </span>
        </button>
      ))}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginTop: S.lg }}>{t("Colaboradores, atribuição de jogos à mesa/arbitragem, comunicados e financeiro administrativo chegam nas fases seguintes.")}</div>
    </div>
  );
}
