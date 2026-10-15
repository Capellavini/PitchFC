import { useEffect, useState } from "react";
import { Check, Clock, HelpCircle, X } from "lucide-react";
import { C, R, S, T, TOUCH, AVATAR_PALETTE } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { MAX_LINEUP, personLabel } from "../lib/rivalsResults";
import { useRivalsRead } from "../hooks/useRivalsRead";
import Sheet from "./Sheet";
import Avatar from "./Avatar";
import Chip from "./Chip";
import BtnPrimary from "./BtnPrimary";

const STATUS = {
  yes: { variant: "green", Icon: Check, label: MC.statusYes },
  maybe: { variant: "orange", Icon: HelpCircle, label: MC.statusMaybe },
  no: { variant: "red", Icon: X, label: MC.statusNo },
  pending: { variant: "neutral", Icon: Clock, label: MC.statusPending },
};
const ORDER = { yes: 0, maybe: 1, pending: 2, no: 3 };

/**
 * "Quem joga" for ONE match (leaders only). Prefilled from the call-up —
 * everyone who answered "Vou" — unless a list was already saved, then that
 * one. Tap a player to toggle (role="checkbox"); up to 22. Saves with
 * teams.setMatchLineup. Props: teams, match (id, format), teamId (mine),
 * onClose, onSaved.
 */
export default function LineupPicker({ teams, match, teamId, onClose, onSaved }) {
  const avail = useRivalsRead(() => teams.getMatchAvailability(match.id), [match.id]);
  const lineup = useRivalsRead(() => teams.getMatchLineup(match.id), [match.id]);
  const [selected, setSelected] = useState(null); // Set of playerIds, null until loaded
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selected || !avail.data || !lineup.data) return;
    const saved = lineup.data.items.filter((x) => x.teamId === teamId).map((x) => x.playerId);
    setSelected(new Set(saved.length ? saved : avail.data.items.filter((x) => x.status === "yes").map((x) => x.playerId)));
  }, [avail.data, lineup.data, selected, teamId]);

  const loadError = avail.error || lineup.error;
  const saved = (lineup.data?.items || []).some((x) => x.teamId === teamId);
  const rows = [...(avail.data?.items || [])].sort((a, b) => (ORDER[a.status || "pending"] - ORDER[b.status || "pending"]) || personLabel(a).localeCompare(personLabel(b), "pt"));

  const toggle = (id) => {
    setError(null);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX_LINEUP) { setError(tf(MC.lineupMax, { n: MAX_LINEUP })); return cur; }
      else next.add(id);
      return next;
    });
  };
  const save = async () => {
    setBusy(true); setError(null);
    const r = await teams.setMatchLineup(match.id, [...selected]);
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); return; }
    onSaved?.(t(MC.lineupSaved));
    onClose();
  };

  return (
    <Sheet title={t(MC.lineupTitle)} onClose={onClose}
      footer={<BtnPrimary block onClick={save} disabled={busy || !selected}>{busy ? t(RC.saving) : `${t(MC.lineupSave)}${selected ? ` · ${selected.size}` : ""}`}</BtnPrimary>}>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {saved ? tf(MC.lineupFormat, { format: match.format || "", max: MAX_LINEUP }) : t(MC.lineupHint)}
      </div>
      {loadError && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red, marginBottom: S.md }}>{rivalsError(loadError)}</div>}
      {!loadError && !selected && <div aria-busy="true" style={{ fontSize: T.body, color: C.text2 }}>{t(MC.loadingAnswers)}</div>}
      <div role="group" aria-label={t(MC.lineupTitle)} style={{ display: "flex", flexDirection: "column", gap: S.xs }}>
        {selected && rows.map((r, i) => {
          const on = selected.has(r.playerId);
          const s = STATUS[r.status || "pending"];
          return (
            <button key={r.playerId} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(r.playerId)}
              style={{
                display: "flex", alignItems: "center", gap: S.md, minHeight: 56, padding: `${S.sm}px ${S.md}px`, textAlign: "left", fontFamily: "inherit",
                background: on ? C.accentDim : "transparent", border: `1px solid ${on ? C.accentBorder : C.border}`, borderRadius: R.control, cursor: "pointer", color: C.text1,
              }}>
              <span aria-hidden style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: on ? C.accent : "transparent", border: `2px solid ${on ? C.accent : C.text3}`, color: C.bg,
              }}>{on && <Check size={16} strokeWidth={3} />}</span>
              <Avatar name={r.name || r.nick || "?"} photo={r.photoUrl} color={AVATAR_PALETTE[i % AVATAR_PALETTE.length]} size={36} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: T.cardTitle - 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personLabel(r)}</span>
                {r.position && <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{t(r.position)}</span>}
              </span>
              <Chip variant={s.variant} Icon={s.Icon}>{t(s.label)}</Chip>
            </button>
          );
        })}
        {selected && !rows.length && <div style={{ fontSize: T.body, color: C.text2 }}>{t(MC.lineupEmptySquad)}</div>}
      </div>
      <div aria-live="polite" style={{ minHeight: TOUCH.min / 2, fontSize: T.meta + 1, color: error ? C.red : C.text2, marginTop: S.sm }}>
        {error || (selected ? tf(MC.lineupSelected, { n: selected.size }) : "")}
      </div>
    </Sheet>
  );
}
