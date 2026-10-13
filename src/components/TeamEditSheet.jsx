import { useState } from "react";
import { Archive } from "lucide-react";
import { C, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError } from "../lib/rivalsCopy";
import { MARKETS, can, validateTeamFields } from "../lib/rivals";
import Sheet from "./Sheet";
import TeamForm from "./TeamForm";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/** Edit a Team (leaders). Rename, directory visibility and archive are
 *  captain-only (the server enforces the same rules — this just doesn't
 *  offer what would be refused). Only changed fields are sent. */
export default function TeamEditSheet({ teams, team, myRole, onClose, onSaved, onArchived }) {
  const initial = {
    name: team.name || "", city: team.city || "", region: team.region || "", country: team.country || "PT",
    format: team.format, color: team.color, secondaryColor: team.secondaryColor, logoUrl: team.logoUrl || null,
    homeVenue: team.homeVenue || "",
  };
  const [f, setF] = useState(initial);
  const [listed, setListed] = useState(team.listed !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isCaptain = can(myRole, "rename");

  const submit = async () => {
    const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => (v ?? "") !== (initial[k] ?? "")));
    if (!isCaptain) delete changed.name;
    if (changed.country) Object.assign(changed, { currency: MARKETS[changed.country].currency, timezone: MARKETS[changed.country].timezone });
    if (isCaptain && listed !== (team.listed !== false)) changed.listed = listed;
    if (!Object.keys(changed).length) { onClose(); return; }
    const bad = validateTeamFields(changed);
    if (bad) { setError(rivalsError(bad)); return; }
    setBusy(true); setError(null);
    const r = await teams.updateTeam(team.id, changed);
    setBusy(false);
    if (r.error) setError(rivalsError(r.error)); else onSaved?.();
  };

  const archive = async () => {
    setBusy(true); setError(null);
    const r = await teams.archiveTeam(team.id);
    setBusy(false);
    if (r.error) setError(rivalsError(r.error)); else onArchived?.();
  };

  return (
    <Sheet title={t(RC.editTeam)} onClose={onClose} footer={
      <>
        {error && <div role="alert" style={{ color: C.red, fontSize: T.meta + 0.5, marginBottom: S.sm + 2 }}>{error}</div>}
        <BtnPrimary block onClick={submit} disabled={busy}>{busy ? t(RC.saving) : t(RC.save)}</BtnPrimary>
      </>
    }>
      <TeamForm value={f} onChange={setF} uploadBadge={teams.uploadBadge} nameLocked={!isCaptain} />

      {isCaptain && (
        <label style={{ display: "flex", alignItems: "flex-start", gap: S.md, minHeight: TOUCH.min, margin: `${S.md}px 0`, cursor: "pointer" }}>
          <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)}
            style={{ width: 22, height: 22, marginTop: 2, accentColor: C.accent, flexShrink: 0 }} />
          <span>
            <span style={{ display: "block", fontSize: T.body, fontWeight: 700, color: C.text1 }}>{t(RC.listedLabel)}</span>
            <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t(RC.listedHint)}</span>
          </span>
        </label>
      )}

      {can(myRole, "archive") && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel style={{ color: C.red }}>{t(RC.dangerZone)}</SectionLabel>
          {confirmArchive ? (
            <div role="alert" style={{ fontSize: T.meta + 1, color: C.text1, lineHeight: 1.5 }}>
              {t(RC.archiveConfirm)}
              <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
                <BtnGhost tone="danger" onClick={archive} disabled={busy} style={{ flex: 1 }}>{t(RC.confirm)}</BtnGhost>
                <BtnGhost onClick={() => setConfirmArchive(false)} style={{ flex: 1 }}>{t(RC.cancel)}</BtnGhost>
              </div>
            </div>
          ) : (
            <BtnGhost block tone="danger" onClick={() => setConfirmArchive(true)}><Archive size={16} /> {t(RC.archiveTeam)}</BtnGhost>
          )}
        </div>
      )}
    </Sheet>
  );
}
