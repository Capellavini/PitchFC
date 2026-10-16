import { History, FileText } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { EVENT_LABEL, STATE_LABEL, ROLE_LABEL } from "../../lib/leagueCopy";
import { playerById, teamById, fmtDateTime } from "../../lib/leagueDemo";
import { corrections, activeEvents } from "../../lib/core/league";
import SectionLabel from "../SectionLabel";

const describe = (e) => {
  if (!e) return "—";
  if (e.type === "void") return t("Lance anulado");
  const who = e.playerId ? playerById[e.playerId]?.name : t("autor por identificar");
  return `${t(EVENT_LABEL[e.type])} ${teamById[e.teamId]?.short || ""} · ${who}${e.assistId ? ` (${t("assist.")} ${playerById[e.assistId]?.name})` : ""}${e.minute != null ? ` · ${e.minute}'` : ""}`;
};

/** Súmula: the official record — final score, event counts, the
 *  correction history (who, when, why, before → after) and the state
 *  history (who moved the match where, with reasons). Nothing here is an
 *  editable total; it's all read off the append-only log. */
export default function LeagueSumula({ match, log, score, lang }) {
  const fixes = corrections(log);
  const active = activeEvents(log);
  const count = (type) => active.filter((e) => e.type === type).length;
  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.sm }}><FileText size={16} aria-hidden /> {t("Registo oficial do jogo")}</div>
        <div style={{ fontSize: T.body, lineHeight: 1.7, color: C.text1 }}>
          <div>{teamById[match.homeId].name} {score.home} – {score.away} {teamById[match.awayId].name}{score.shootout ? ` (${t("desempate")} ${score.shootout.home}–${score.shootout.away})` : ""}</div>
          <div style={{ color: C.text2, fontSize: T.meta }}>
            {t("Estado")}: {t(STATE_LABEL[match.state])} · {t("Golos")}: {count("goal") + count("own_goal")} ({count("own_goal")} {t("autogolos")}) · 🟨 {count("card_yellow")} · 🟥 {count("card_red")} · {t("Lances no registo")}: {log.length}
          </div>
          {match.homologatedBy && match.state === "homologated" && <div style={{ color: C.green, fontSize: T.meta }}>{t("Homologado por")} {match.homologatedBy.by} · {fmtDateTime(match.homologatedBy.at, lang)}</div>}
        </div>
      </div>

      <SectionLabel>{t("Histórico de correções")}</SectionLabel>
      {fixes.length === 0 && <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.lg }}>{t("Sem correções neste jogo.")}</div>}
      {fixes.map(({ event, replaced }) => (
        <div key={event.id} style={{ ...cardStyle, marginBottom: S.sm, borderLeft: `3px solid ${C.orange}` }}>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{fmtDateTime(event.recordedAt, lang)} · {event.recordedBy}</div>
          <div style={{ fontSize: T.body, margin: `${S.xs}px 0`, lineHeight: 1.5 }}>
            <span style={{ textDecoration: "line-through", color: C.text2 }}>{describe(replaced)}</span>
            <br />→ {describe(event)}
          </div>
          <div style={{ fontSize: T.meta, color: C.text1 }}><b>{t("Motivo")}:</b> {event.voidReason}</div>
        </div>
      ))}

      <SectionLabel style={{ marginTop: S.xl }}>{t("Histórico de estados")}</SectionLabel>
      {(match.history || []).length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Jogo ainda não iniciado.")}</div>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {(match.history || []).map((h, i) => (
          <li key={i} style={{ display: "flex", gap: S.sm, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.border}` }}>
            <History size={14} color={C.text2} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: T.body }}>{t(STATE_LABEL[h.from])} → <b>{t(STATE_LABEL[h.to])}</b></div>
              <div style={{ fontSize: T.meta, color: C.text2 }}>{h.by || "—"}{h.by && h.by.includes(t(ROLE_LABEL[h.role])) ? "" : ` (${t(ROLE_LABEL[h.role])})`}{h.at ? ` · ${fmtDateTime(h.at, lang)}` : ""}</div>
              {h.reason && <div style={{ fontSize: T.meta, color: C.text1, marginTop: 2 }}>{t("Motivo")}: {h.reason}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
