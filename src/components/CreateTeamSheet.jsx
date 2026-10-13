import { useState } from "react";
import { C, S, T, TEAM_COLORS } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError } from "../lib/rivalsCopy";
import { DEFAULT_FORMAT, MARKETS, validateTeamFields } from "../lib/rivals";
import Sheet from "./Sheet";
import TeamForm from "./TeamForm";
import BtnPrimary from "./BtnPrimary";

/** Create a Team. The creator becomes captain server-side (create_team);
 *  NOBODY else is added — the squad joins through the invite link (the
 *  hub opens TeamInviteSheet right after). A double tap returns the same
 *  team (server idempotency). `market` = MARKETS.PT|BR default. */
export default function CreateTeamSheet({ teams, market = MARKETS.PT, defaults = {}, onClose, onCreated }) {
  const [f, setF] = useState({
    name: "", city: defaults.city || "", region: defaults.region || "", country: market.country,
    format: DEFAULT_FORMAT, color: TEAM_COLORS[0], secondaryColor: TEAM_COLORS[2], logoUrl: null, homeVenue: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    const fields = { ...f, name: f.name.trim(), currency: MARKETS[f.country].currency, timezone: MARKETS[f.country].timezone };
    const bad = validateTeamFields(fields);
    if (bad) { setError(rivalsError(bad)); return; }
    setBusy(true); setError(null);
    const r = await teams.createTeam(fields);
    setBusy(false);
    if (r.error) setError(rivalsError(r.error));
    else onCreated?.(r.data.teamId, r.data);
  };

  return (
    <Sheet title={t(RC.createTeam)} onClose={onClose} footer={
      <>
        {error && <div role="alert" style={{ color: C.red, fontSize: T.meta + 0.5, marginBottom: S.sm + 2 }}>{error}</div>}
        <BtnPrimary block onClick={submit} disabled={busy}>{busy ? t(RC.creating) : t(RC.createTeam)}</BtnPrimary>
      </>
    }>
      <TeamForm value={f} onChange={setF} uploadBadge={teams.uploadBadge} autoFocusName />
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t(RC.createHint)}</div>
    </Sheet>
  );
}
