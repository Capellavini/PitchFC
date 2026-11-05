import { useState } from "react";
import { X } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import { PLAYERS, teamById } from "../../lib/leagueDemo";
import BtnPrimary from "./visual/BtnPrimary";
import BtnGhost from "./visual/BtnGhost";

const two = (v) => /^[0-9]{1,2}$/.test(v);

/** Quick result: just the two scores. The match ends as PROVISIONAL, with the
 *  goals recorded but no scorers; the Gestor (or the Adjunto, from a súmula)
 *  can add authors, cards and the call-up afterwards. Nothing is homologated.
 *  In a knockout tie that ends level the shoot-out is part of the result: every
 *  kick, in order: who took it and whether it went in, was saved by the keeper (and which one) or missed. */
export default function LeagueResultForm({ match, act, onClose, cup = false }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kicks, setKicks] = useState([]);
  const scoreOk = two(home) && two(away);
  const level = scoreOk && cup && Number(home) === Number(away);
  const made = (teamId) => kicks.filter((k) => k.teamId === teamId && k.outcome === "scored").length;
  const tally = { home: made(match.homeId), away: made(match.awayId) };
  const kicksOk = kicks.length > 0 && tally.home !== tally.away;
  // With kicks entered they must produce a winner; with none, the Gestor can still lay it later.
  const ok = scoreOk && (!level || kicks.length === 0 || kicksOk);
  const field = { ...inputStyle(), width: 72, textAlign: "center", fontSize: T.h, fontWeight: 800 };
  const nameOf = (id) => teamById[id]?.name;
  const squad = (teamId) => PLAYERS.filter((p) => p.teamId === teamId);
  const addKick = (teamId) => setKicks((ks) => [...ks, { key: `k${Date.now()}-${ks.length}`, teamId, playerId: "", outcome: "scored", keeperId: "" }]);
  const otherSide = (teamId) => (teamId === match.homeId ? match.awayId : match.homeId);
  // goalkeepers of the defending side first: they are the ones who save
  const keepers = (teamId) => [...squad(teamId)].sort((a, b) => Number(/^(GR|Guarda)/i.test(b.position || "")) - Number(/^(GR|Guarda)/i.test(a.position || "")));
  const patchKick = (key, patch) => setKicks((ks) => ks.map((k) => (k.key === key ? { ...k, ...patch } : k)));
  const submit = (e) => {
    e.preventDefault();
    if (!ok) return;
    const shootout = level && kicks.length ? { kicks: kicks.map((k) => ({ teamId: k.teamId, playerId: k.playerId || null, scored: k.outcome === "scored", ...(k.outcome === "saved" ? { saved: true, keeperId: k.keeperId || null } : {}) })) } : null;
    const r = act.recordResult(match.id, { home: Number(home), away: Number(away) }, shootout);
    if (r.ok) onClose();
  };
  const small = { minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, border: `1px solid ${C.border}`, background: "transparent", color: C.text1, fontWeight: 700, fontSize: T.meta, cursor: "pointer" };
  return (
    <form onSubmit={submit} style={{ marginTop: S.md, display: "grid", gap: S.md }} aria-label={t("Lançar resultado")}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: T.meta, color: C.text2, fontWeight: 700 }}>
          {nameOf(match.homeId)}
          <input autoFocus inputMode="numeric" value={home} onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={field} aria-label={`${t("Golos")} ${nameOf(match.homeId)}`} />
        </label>
        <span aria-hidden style={{ fontSize: T.h, fontWeight: 800, color: C.text2, marginTop: S.lg }}>–</span>
        <label style={{ display: "grid", gap: 4, fontSize: T.meta, color: C.text2, fontWeight: 700 }}>
          {nameOf(match.awayId)}
          <input inputMode="numeric" value={away} onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} style={field} aria-label={`${t("Golos")} ${nameOf(match.awayId)}`} />
        </label>
      </div>

      {level && (
        <fieldset style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: S.md, margin: 0, display: "grid", gap: S.sm }}>
          <legend style={{ fontSize: T.meta, color: C.text2, fontWeight: 700, padding: `0 ${S.xs}px` }}>{t("Desempate por penáltis")}</legend>
          <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap" }}>
            {[match.homeId, match.awayId].map((id) => (
              <button key={id} type="button" onClick={() => addKick(id)} style={small}>{`+ ${t("Cobrança")} · ${teamById[id]?.short || nameOf(id)}`}</button>
            ))}
          </div>
          {kicks.length > 0 && (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: S.xs }}>
              {kicks.map((k, i) => (
                <li key={k.key} style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
                  <span style={{ width: 22, fontWeight: 800, color: C.text2, fontSize: T.meta }}>{i + 1}.</span>
                  <span style={{ fontWeight: 800, fontSize: T.meta, minWidth: 44 }}>{teamById[k.teamId]?.short || nameOf(k.teamId)}</span>
                  <select value={k.playerId} onChange={(e) => patchKick(k.key, { playerId: e.target.value })} aria-label={t("Quem bateu")} style={{ ...inputStyle(), flex: "1 1 140px", minWidth: 0 }}>
                    <option value="">{t("Por identificar")}</option>
                    {squad(k.teamId).map((p) => <option key={p.id} value={p.id}>{p.number != null ? `${p.number} · ${p.name}` : p.name}</option>)}
                  </select>
                  <select value={k.outcome} onChange={(e) => patchKick(k.key, { outcome: e.target.value, keeperId: "" })} aria-label={t("Resultado da cobrança")}
                    style={{ ...inputStyle(), flex: "0 0 auto", width: 130, fontWeight: 800, color: k.outcome === "scored" ? C.green : k.outcome === "saved" ? C.orange : C.red }}>
                    <option value="scored">{t("Marcou")}</option>
                    <option value="saved">{t("Defendeu o guarda-redes")}</option>
                    <option value="missed">{t("Falhou")}</option>
                  </select>
                  {k.outcome === "saved" && (
                    <select value={k.keeperId} onChange={(e) => patchKick(k.key, { keeperId: e.target.value })} aria-label={t("Guarda-redes que defendeu")} style={{ ...inputStyle(), flex: "1 1 140px", minWidth: 0 }}>
                      <option value="">{t("Guarda-redes por identificar")}</option>
                      {keepers(otherSide(k.teamId)).map((p) => <option key={p.id} value={p.id}>{p.number != null ? `${p.number} · ${p.name}` : p.name}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setKicks((ks) => ks.filter((x) => x.key !== k.key))} aria-label={t("Tirar")} style={{ ...small, padding: `0 ${S.sm}px` }}><X size={14} aria-hidden /></button>
                </li>
              ))}
            </ol>
          )}
          <div style={{ fontSize: T.meta, color: kicks.length && !kicksOk ? C.orange : C.text2, fontWeight: kicks.length ? 800 : 400 }}>
            {kicks.length
              ? (kicksOk ? `${t("Penáltis")}: ${tally.home}–${tally.away}` : t("Os penáltis marcados não podem ficar empatados."))
              : t("Só para eliminatórias empatadas. Podes deixar em branco e juntar as cobranças depois.")}
          </div>
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
