import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { teamById } from "../../lib/leagueDemo";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** Quick result: just the two scores. The match ends as PROVISIONAL, with the
 *  goals recorded but no scorers; the Gestor (or the Adjunto, from a súmula)
 *  can add authors, cards and the call-up afterwards. Nothing is homologated. */
export default function LeagueResultForm({ match, act, onClose }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const ok = /^\d{1,2}$/.test(home) && /^\d{1,2}$/.test(away);
  const field = { ...inputStyle(), width: 72, textAlign: "center", fontSize: T.h, fontWeight: 800 };
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const r = act.recordResult(match.id, { home: Number(home), away: Number(away) });
    if (r.ok) onClose();
  };
  return (
    <form onSubmit={submit} style={{ marginTop: S.md, display: "grid", gap: S.md }} aria-label={t("Lançar resultado")}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: T.meta, color: C.text2, fontWeight: 700 }}>
          {teamById[match.homeId]?.name}
          <input autoFocus inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value.replace(/\D/g, "").slice(0, 2))} style={field} aria-label={`${t("Golos")} ${teamById[match.homeId]?.name}`} />
        </label>
        <span aria-hidden style={{ fontSize: T.h, fontWeight: 800, color: C.text2, marginTop: S.lg }}>–</span>
        <label style={{ display: "grid", gap: 4, fontSize: T.meta, color: C.text2, fontWeight: 700 }}>
          {teamById[match.awayId]?.name}
          <input inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value.replace(/\D/g, "").slice(0, 2))} style={field} aria-label={`${t("Golos")} ${teamById[match.awayId]?.name}`} />
        </label>
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Fica provisório e sem marcadores. Podes juntar golos e cartões depois, ou subir a súmula para o Adjunto ler.")}</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        <BtnPrimary type="submit" disabled={!ok}>{t("Lançar resultado")}</BtnPrimary>
        <BtnGhost onClick={onClose}>{t("Cancelar")}</BtnGhost>
      </div>
    </form>
  );
}
