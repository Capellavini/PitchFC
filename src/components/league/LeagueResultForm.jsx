import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { teamById } from "../../lib/leagueDemo";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** Quick result: just the two scores. The match ends as PROVISIONAL, with the
 *  goals recorded but no scorers; the Gestor (or the Adjunto, from a súmula)
 *  can add authors, cards and the call-up afterwards. Nothing is homologated. */
export default function LeagueResultForm({ match, act, onClose, cup = false }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [penHome, setPenHome] = useState("");
  const [penAway, setPenAway] = useState("");
  const two = (v) => /^[0-9]{1,2}$/.test(v);
  const scoreOk = two(home) && two(away);
  // A drawn knockout tie needs a winner: the shoot-out is part of the result, not a later fix.
  const level = scoreOk && cup && Number(home) === Number(away);
  const penOk = two(penHome) && two(penAway) && Number(penHome) !== Number(penAway);
  const ok = scoreOk && (!level || penHome + penAway === "" || penOk);
  const field = { ...inputStyle(), width: 72, textAlign: "center", fontSize: T.h, fontWeight: 800 };
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const r = act.recordResult(match.id, { home: Number(home), away: Number(away) }, level && penOk ? { home: Number(penHome), away: Number(penAway) } : null);
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
      {level && (
        <fieldset style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: S.md, margin: 0, display: "grid", gap: S.sm }}>
          <legend style={{ fontSize: T.meta, color: C.text2, fontWeight: 700, padding: `0 ${S.xs}px` }}>{t("Desempate por penáltis")}</legend>
          <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
            <input inputMode="numeric" value={penHome} onChange={(e) => setPenHome(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ ...field, width: 64 }} aria-label={`${t("Penáltis marcados")} ${teamById[match.homeId]?.name}`} />
            <span aria-hidden style={{ fontSize: T.h, fontWeight: 800, color: C.text2 }}>–</span>
            <input inputMode="numeric" value={penAway} onChange={(e) => setPenAway(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={{ ...field, width: 64 }} aria-label={`${t("Penáltis marcados")} ${teamById[match.awayId]?.name}`} />
          </div>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{penHome + penAway !== "" && !penOk ? t("Os penáltis não podem acabar empatados.") : t("Só para eliminatórias empatadas. Deixa em branco se ainda não souberes.")}</div>
        </fieldset>
      )}
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Fica provisório e sem marcadores. Podes juntar golos e cartões depois, ou subir a súmula para o Adjunto ler.")}</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        <BtnPrimary type="submit" disabled={!ok}>{t("Lançar resultado")}</BtnPrimary>
        <BtnGhost onClick={onClose}>{t("Cancelar")}</BtnGhost>
      </div>
    </form>
  );
}
