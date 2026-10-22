import { useState } from "react";
import { C, S, T, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LM } from "../../lib/leagueMatchCopy";
import Sheet from "../Sheet";
import BtnPrimary from "../BtnPrimary";

const pad = (n) => String(n).padStart(2, "0");
/** ISO → value for <input type="datetime-local"> in the device's time zone. */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Gestor: set / change kickoff + venue (schedule_match). Unscheduled,
 *  scheduled and postponed matches; same match id when rescheduled. */
export default function LeagueCloudScheduleSheet({ match, onSave, onClose }) {
  const [when, setWhen] = useState(() => toLocalInput(match.kickoff));
  const [venue, setVenue] = useState(match.venue || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    if (!when) { setError(t("Indica a data e a hora.")); return; }
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) { setError(t("Data inválida.")); return; }
    setBusy(true);
    const r = await onSave(d.toISOString(), venue.trim() ? { name: venue.trim() } : {});
    setBusy(false);
    if (r?.ok) onClose(); else if (r?.message) setError(r.message);
  };
  const label = { display: "block", fontSize: T.meta, color: C.text2, fontWeight: 700, margin: `${S.md}px 0 ${S.xs}px` };
  return (
    <Sheet title={t(match.kickoff ? LM.reschedule : LM.schedule)} onClose={onClose}
      footer={<BtnPrimary block disabled={busy} onClick={submit}>{t(LM.schedule)}</BtnPrimary>}>
      <label htmlFor="lgc-when" style={label}>{t("Data e hora (hora local)")}</label>
      <input id="lgc-when" type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); setError(null); }} style={inputStyle()} />
      <label htmlFor="lgc-venue" style={label}>{t(LM.venue)}</label>
      <input id="lgc-venue" value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} placeholder={t("Ex.: Pavilhão Municipal")} style={inputStyle()} />
      {error && <div role="alert" style={{ color: C.red, fontSize: T.meta, marginTop: S.sm }}>{error}</div>}
    </Sheet>
  );
}
