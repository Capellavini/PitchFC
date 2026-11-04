import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Sparkles, X } from "lucide-react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { leagueTiers, proposeMovements, normalizeMovements, movementsQuestion } from "../../lib/leagueMovements";
import SectionLabel from "../SectionLabel";
import BtnGhost from "../BtnGhost";

/** Promotion and relegation, proposed from the final tables. The Gestor homologates the list: untick a move, add one by hand
 *  (always with the reason), and optionally ask the Adjunto whether the regulation says the same. `onChange(list, error)`
 *  hands the confirmed list to "Fechar época". Only shown when the league has more than one division. */
export default function LeagueSeasonMovements({ state, onChange, onAsk }) {
  const tiers = leagueTiers(state);
  const [down, setDown] = useState(2);
  const [off, setOff] = useState(() => new Set());
  const [extras, setExtras] = useState([]);
  const [draft, setDraft] = useState({ teamId: "", to: "", note: "" });
  const proposal = useMemo(() => proposeMovements(state, { down }), [state, down]);
  const name = (id) => state.data.teams.find((x) => x.id === id)?.name || "—";
  const tierName = (id) => tiers.find((c) => c.id === id)?.name || "—";
  const list = useMemo(() => [
    ...proposal.moves.filter((m) => !off.has(m.teamId)),
    ...extras.map((x) => ({ teamId: x.teamId, from: x.from, to: x.to, decidedBy: "manual", note: x.note, name: name(x.teamId), kind: tiers.findIndex((c) => c.id === x.to) < tiers.findIndex((c) => c.id === x.from) ? "promoted" : "relegated" })),
  ], [proposal, off, extras]); // eslint-disable-line react-hooks/exhaustive-deps
  const problem = useMemo(() => { try { normalizeMovements(state, list); return null; } catch (e) { return e.code || "invalid"; } }, [state, list]);
  const key = JSON.stringify(list.map((m) => [m.teamId, m.from, m.to, m.decidedBy, m.note || ""]));
  useEffect(() => { onChange(list, problem); }, [key, problem]); // eslint-disable-line react-hooks/exhaustive-deps
  if (tiers.length < 2) return null;

  const teamsOfTiers = tiers.flatMap((c) => (c.teamIds || []).map((id) => ({ id, from: c.id })));
  const addManual = () => {
    const from = teamsOfTiers.find((x) => x.id === draft.teamId)?.from;
    if (!from || !draft.to || draft.to === from || draft.note.trim().length < 5) return;
    setExtras((x) => [...x.filter((y) => y.teamId !== draft.teamId), { teamId: draft.teamId, from, to: draft.to, note: draft.note.trim() }]);
    setOff((s) => new Set(s).add(draft.teamId)); // a hand-made move replaces the proposed one for that team
    setDraft({ teamId: "", to: "", note: "" });
  };
  const row = (m, i, manual) => (
    <div key={`${m.teamId}-${i}`} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44 }}>
      {manual ? (
        <button type="button" aria-label={t("Tirar")} onClick={() => setExtras((x) => x.filter((y) => y.teamId !== m.teamId))} style={{ all: "unset", cursor: "pointer", width: 28, display: "grid", placeItems: "center" }}><X size={16} aria-hidden /></button>
      ) : (
        <input type="checkbox" aria-label={name(m.teamId)} checked={!off.has(m.teamId)} onChange={(e) => setOff((s) => { const n = new Set(s); if (e.target.checked) n.delete(m.teamId); else n.add(m.teamId); return n; })} style={{ width: 20, height: 20, accentColor: C.accent }} />
      )}
      {m.kind === "promoted" ? <ArrowUp size={16} color={C.green} aria-hidden /> : <ArrowDown size={16} color={C.red} aria-hidden />}
      <span style={{ flex: 1, minWidth: 0, fontSize: T.body, overflowWrap: "anywhere" }}>
        <strong>{m.name || name(m.teamId)}</strong> <span style={{ color: C.text2 }}>· {tierName(m.from)} → {tierName(m.to)}{manual ? ` · ${m.note}` : ""}</span>
      </span>
    </div>
  );

  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t("Subidas e descidas")}</SectionLabel>
      <div style={{ ...cardStyle, display: "grid", gap: S.sm }}>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Proposta a partir das classificações finais: os últimos de cada divisão descem e os primeiros da seguinte sobem. Tu homologas: tira quem não deve mudar e junta casos especiais com o motivo.")}</div>
        <label style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, color: C.text2 }}>
          {t("Quantas equipas sobem e descem")}
          <input inputMode="numeric" value={down} onChange={(e) => setDown(Math.max(0, Math.min(6, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))} style={{ ...inputStyle(), width: 64, textAlign: "center" }} aria-label={t("Quantas equipas sobem e descem")} />
        </label>
        {proposal.moves.length === 0 && extras.length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Sem movimentos propostos.")}</div>}
        {proposal.moves.map((m, i) => row(m, i, false))}
        {extras.map((x, i) => row({ ...x, name: name(x.teamId), kind: tiers.findIndex((c) => c.id === x.to) < tiers.findIndex((c) => c.id === x.from) ? "promoted" : "relegated" }, i, true))}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.sm, display: "grid", gap: S.xs }}>
          <div style={{ fontSize: T.meta, fontWeight: 800 }}>{t("Juntar um caso especial")}</div>
          <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap" }}>
            <select value={draft.teamId} onChange={(e) => setDraft((d) => ({ ...d, teamId: e.target.value, to: "" }))} aria-label={t("Equipa")} style={{ ...inputStyle(), flex: "1 1 150px" }}>
              <option value="">{t("Equipa")}</option>
              {teamsOfTiers.map((x) => <option key={x.id} value={x.id}>{name(x.id)}</option>)}
            </select>
            <select value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-label={t("Passa para")} style={{ ...inputStyle(), flex: "1 1 150px" }}>
              <option value="">{t("Passa para")}</option>
              {tiers.filter((c) => c.id !== teamsOfTiers.find((x) => x.id === draft.teamId)?.from).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value.slice(0, 300) }))} placeholder={t("Motivo (fica no arquivo)")} aria-label={t("Motivo")} style={inputStyle()} />
          <div><BtnGhost onClick={addManual} disabled={!draft.teamId || !draft.to || draft.note.trim().length < 5}>{t("Juntar")}</BtnGhost></div>
        </div>
        {problem && <div role="alert" style={{ color: C.orange, fontSize: T.meta }}>{tf(t("A lista tem um problema: {c}."), { c: problem })}</div>}
        {onAsk && list.length > 0 && <div><BtnGhost tone="accent" onClick={() => onAsk(movementsQuestion(state, list))}><Sparkles size={14} aria-hidden /> {t("Verificar com o regulamento (Adjunto)")}</BtnGhost></div>}
      </div>
    </div>
  );
}
