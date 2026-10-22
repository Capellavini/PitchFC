import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { C, S, T, TOUCH, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/**
 * Ficha da equipa (set_league_lineup): who is on the team sheet — starters
 * AND bench. Everyone on it appears in the official stats at homologation,
 * which is what futsal's rolling substitutions need (no per-sub events).
 * Operator only (mesa / árbitro / gestão); suspended players can't be ticked.
 */
export default function LeagueCloudTeamSheet({ team, squad, sheet, suspendedIds = [], profile, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [ids, setIds] = useState(sheet || []);
  const [busy, setBusy] = useState(false);
  const blocked = new Set(suspendedIds);
  const current = sheet || [];
  const toggle = (id) => setIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const save = async () => {
    setBusy(true);
    const r = await onSave(ids);
    setBusy(false);
    if (r?.ok) setEditing(false);
  };
  return (
    <div style={{ ...cardStyle, marginBottom: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><ClipboardList size={16} aria-hidden /> {t(LM.teamSheet)} · {team?.name || "—"}</div>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.sm }}>
        {sheet === null ? t("Ficha visível para a equipa e para a mesa.")
          : current.length ? tf(t("{n} atletas na ficha ({k} em campo + suplentes)."), { n: current.length, k: profile.onField })
            : t("Ficha ainda por preencher.")}
        {profile.rollingSubs ? ` ${t("Substituições livres: quem está na ficha conta como utilizado.")}` : ""}
      </div>
      {!editing && current.length > 0 && (
        <div style={{ fontSize: T.meta, color: C.text1, lineHeight: 1.6, marginBottom: canEdit ? S.sm : 0 }}>
          {current.map((id) => squad.find((p) => p.id === id)).filter(Boolean).map((p) => `${p.number != null ? `${p.number} · ` : ""}${p.name}`).join(", ")}
        </div>
      )}
      {editing && (
        <div role="group" aria-label={t(LM.teamSheet)} style={{ display: "grid", gap: 2, marginBottom: S.sm }}>
          {squad.map((p) => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, fontSize: T.body, cursor: blocked.has(p.id) ? "not-allowed" : "pointer", color: blocked.has(p.id) ? C.text2 : C.text1 }}>
              <input type="checkbox" disabled={blocked.has(p.id)} checked={ids.includes(p.id)} onChange={() => toggle(p.id)} style={{ width: 20, height: 20, accentColor: C.accent }} />
              <span style={{ flex: 1 }}>{p.number != null ? `${p.number} · ` : ""}{p.name}</span>
              {blocked.has(p.id) && <span style={{ fontSize: T.meta, color: C.red, fontWeight: 700 }}>{t("Suspenso")}</span>}
            </label>
          ))}
          <div style={{ fontSize: T.meta, color: ids.length < profile.onField ? C.orange : C.text2 }}>
            {tf(t("{n} selecionados · mínimo para começar: {k}"), { n: ids.length, k: profile.onField })}
          </div>
        </div>
      )}
      {canEdit && (editing ? (
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          <BtnPrimary disabled={busy} onClick={save} style={{ flex: "1 1 160px" }}>{t(LM.saveTeamSheet)}</BtnPrimary>
          <BtnGhost onClick={() => { setEditing(false); setIds(current); }} style={{ flex: "1 1 120px" }}>{t("Cancelar")}</BtnGhost>
        </div>
      ) : <BtnGhost block onClick={() => { setIds(current.length ? current : squad.filter((p) => !blocked.has(p.id)).map((p) => p.id)); setEditing(true); }}>{t(LM.editTeamSheet)}</BtnGhost>)}
    </div>
  );
}
