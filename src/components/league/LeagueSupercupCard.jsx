import { useState } from "react";
import { Trophy } from "lucide-react";
import { C, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { supercupProposal } from "../../lib/leagueSupercup";
import BtnPrimary from "./visual/BtnPrimary";

/** The Supertaça: last season's league champion against the cup winner, proposed from the archive. The Gestor picks the day. */
export default function LeagueSupercupCard({ ctx }) {
  const { state, act } = ctx;
  const p = supercupProposal(state);
  const [when, setWhen] = useState({ date: "", time: "20:00" });
  if (!p) return null;
  const name = (id) => state.data.teams.find((x) => x.id === id)?.name || "—";
  const field = { minHeight: 44, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.text1, padding: `0 ${S.md}px`, fontSize: T.body, boxSizing: "border-box" };
  return (
    <section style={{ ...cardStyle, marginBottom: S.xl, display: "grid", gap: S.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
        <Trophy size={18} color={C.accent} aria-hidden />
        <h2 style={{ margin: 0, fontSize: T.cardTitle }}>{t("Supertaça")}</h2>
      </div>
      <div style={{ fontSize: T.body, fontWeight: 800 }}>{name(p.homeId)} – {name(p.awayId)}</div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
        {p.runnerUp ? tf(t("O campeão da liga também ganhou a taça em {s}: joga com o segundo classificado."), { s: p.seasonLabel }) : tf(t("O campeão da liga contra o vencedor da taça de {s}."), { s: p.seasonLabel })}
      </div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        <input type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} aria-label={t("Dia")} style={field} />
        <input type="time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} aria-label={t("Hora")} style={field} />
      </div>
      <div><BtnPrimary disabled={!when.date} onClick={() => act.createSupercup(when.date, when.time)}>{t("Criar a Supertaça")}</BtnPrimary></div>
    </section>
  );
}
