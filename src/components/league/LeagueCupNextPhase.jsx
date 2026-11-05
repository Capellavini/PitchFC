import { useState } from "react";
import { C, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById } from "../../lib/leagueDemo";
import { nextPhaseProposal, createNextPhase } from "../../lib/leagueSeason";
import SectionLabel from "./visual/SectionLabel";
import BtnPrimary from "./visual/BtnPrimary";

/** Once every tie of a cup phase is official, the next phase is proposed from the winners (tie 1's winner meets tie 2's…).
 *  The Gestor only picks the day and the time; each game can still be moved in the calendar. */
export default function LeagueCupNextPhase({ ctx, competition }) {
  const { state, act } = ctx;
  const [when, setWhen] = useState({ date: "", time: "20:00", gap: "90" });
  const next = nextPhaseProposal(state, competition);
  if (!next) return null;
  if (next.reason) return <div style={{ ...cardStyle, color: C.orange, fontSize: T.body, marginBottom: S.xl }}>{t("Há um número ímpar de vencedores: acrescenta os jogos da fase seguinte em Gerir → Calendário (por exemplo com um apuramento direto).")}</div>;
  const nm = (id) => teamById[id]?.name || "—";
  const field = { minHeight: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.text1, padding: `0 ${S.md}px`, fontSize: T.body, boxSizing: "border-box" };
  const create = () => act.setup((s) => createNextPhase(s, { competitionId: competition.id, date: when.date, time: when.time, gapMinutes: when.gap }),
    tf(t("{n} jogos criados: {p}."), { n: next.pairs.length, p: t(next.name) }));
  return (
    <section style={{ marginBottom: S.xl }}>
      <SectionLabel>{t(next.name)}</SectionLabel>
      <div style={{ ...cardStyle, borderColor: C.accentBorder, display: "grid", gap: S.sm }}>
        <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Proposta a partir dos vencedores. Escolhe o dia e a hora; depois podes mexer em cada jogo no calendário.")}</div>
        {next.pairs.map((p, i) => <div key={i} style={{ fontSize: T.body, fontWeight: 800 }}>{nm(p.homeId)} – {nm(p.awayId)}</div>)}
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          <input type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} aria-label={t("Dia")} style={field} />
          <input type="time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} aria-label={t("Hora")} style={field} />
          {next.pairs.length > 1 && <input inputMode="numeric" value={when.gap} onChange={(e) => setWhen((w) => ({ ...w, gap: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) }))} aria-label={t("Minutos entre jogos")} placeholder={t("Minutos entre jogos")} style={{ ...field, width: 150 }} />}
        </div>
        <div><BtnPrimary disabled={!when.date} onClick={create}>{tf(t("Criar {p}"), { p: t(next.name) })}</BtnPrimary></div>
      </div>
    </section>
  );
}
