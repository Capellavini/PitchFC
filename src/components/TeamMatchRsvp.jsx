import { useState } from "react";
import { Check, X, HelpCircle } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError } from "../lib/rivalsCopy";

const OPTIONS = [
  ["yes", RC.rsvpYes, Check, "green"],
  ["no", RC.rsvpNo, X, "red"],
  ["maybe", RC.rsvpMaybe, HelpCircle, "orange"],
];

/**
 * Team call-up (convocatória) for one match: Vou · Não vou · Talvez.
 * Interface for the results/RSVP PR: `onRsvp(status)` → Promise of
 * { data } | { error } (useTeams contract) and `value` = my saved answer.
 * Until that PR lands there is no `onRsvp`: tapping only explains it's
 * coming soon (nothing is stored, nothing pretends to be).
 */
export default function TeamMatchRsvp({ value = null, onRsvp }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [local, setLocal] = useState(value);
  const current = onRsvp ? (local ?? value) : null;

  const pick = async (status) => {
    if (!onRsvp) { setNote(t(RC.rsvpSoon)); return; }
    setBusy(status); setNote(null);
    const r = await onRsvp(status);
    setBusy(null);
    if (r?.error) setNote(rivalsError(r.error)); else { setLocal(status); setNote(t(RC.rsvpSaved)); }
  };

  return (
    <div style={{ marginTop: S.lg, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", color: C.text2 }}>{t(RC.callUp)}</div>
      <div id="team-rsvp-q" style={{ fontSize: T.body, fontWeight: 700, color: C.text1, margin: `${S.xs}px 0 ${S.sm}px` }}>{t(RC.callUpQ)}</div>
      <div role="radiogroup" aria-labelledby="team-rsvp-q" style={{ display: "flex", gap: S.sm }}>
        {OPTIONS.map(([id, label, Icon, tone]) => {
          const on = current === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} disabled={Boolean(busy)} onClick={() => pick(id)}
              style={{
                flex: 1, minHeight: TOUCH.button, borderRadius: R.control, cursor: "pointer", fontSize: T.body, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit",
                background: on ? C[`${tone}Dim`] ?? C.surface : C.surface, color: on ? C[tone] : C.text1,
                border: `1px solid ${on ? C[tone] : C.border}`, opacity: busy && busy !== id ? 0.6 : 1,
              }}>
              <Icon size={16} aria-hidden /> {t(label)}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" style={{ fontSize: T.meta, color: C.text2, marginTop: note ? S.sm : 0, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
