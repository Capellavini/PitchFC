import { useEffect, useState } from "react";
import { C, R, S, T, AVATAR_PALETTE } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { MAX_STAT, personLabel } from "../lib/rivalsResults";
import { useRivalsRead } from "../hooks/useRivalsRead";
import Sheet from "./Sheet";
import Avatar from "./Avatar";
import CounterStepper from "./CounterStepper";
import BtnPrimary from "./BtnPrimary";

/**
 * Post-game goals + assists per player (leaders, after kickoff). This is a
 * form filled in AFTER the match — not a live scorer — and it says so. The
 * rows are the players of "quem joga" (or the whole squad when no list was
 * saved). Saved with teams.setMatchPlayerStats; informational until the
 * result is confirmed. `teamScore` (my team's goals in the reported or
 * official result, or null) only drives a soft "doesn't add up" hint.
 * Props: teams, match (id), teamId (mine), teamScore, onClose, onSaved.
 */
export default function PlayerStatsSheet({ teams, match, teamId, teamScore = null, scoreText = "", onClose, onSaved }) {
  const avail = useRivalsRead(() => teams.getMatchAvailability(match.id), [match.id]);
  const lineup = useRivalsRead(() => teams.getMatchLineup(match.id), [match.id]);
  const stats = useRivalsRead(() => teams.getMatchPlayerStats(match.id), [match.id]);
  const [vals, setVals] = useState(null); // { [playerId]: { goals, assists } }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const squad = avail.data?.items || [];
  const listed = (lineup.data?.items || []).filter((x) => x.teamId === teamId).map((x) => x.playerId);
  const rows = listed.length ? squad.filter((p) => listed.includes(p.playerId)) : squad;
  const loadError = avail.error || lineup.error || stats.error;

  useEffect(() => {
    if (vals || !avail.data || !lineup.data || !stats.data) return;
    const mine = Object.fromEntries(stats.data.items.filter((x) => x.teamId === teamId).map((x) => [x.playerId, { goals: x.goals, assists: x.assists }]));
    setVals(Object.fromEntries(rows.map((p) => [p.playerId, mine[p.playerId] || { goals: 0, assists: 0 }])));
  }, [avail.data, lineup.data, stats.data, vals, teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id, key, n) => setVals((v) => ({ ...v, [id]: { ...v[id], [key]: n } }));
  const totalGoals = vals ? Object.values(vals).reduce((n, x) => n + x.goals, 0) : 0;
  const mismatch = vals && teamScore != null && totalGoals !== teamScore;

  const save = async () => {
    setBusy(true); setError(null);
    const r = await teams.setMatchPlayerStats(match.id, Object.entries(vals).map(([playerId, v]) => ({ playerId, goals: v.goals, assists: v.assists })));
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); return; }
    onSaved?.(t(MC.statsSaved));
    onClose();
  };

  return (
    <Sheet title={t(MC.statsSheetTitle)} onClose={onClose}
      footer={<BtnPrimary block onClick={save} disabled={busy || !vals}>{busy ? t(RC.saving) : t(MC.statsSave)}</BtnPrimary>}>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.xs }}>{t(MC.statsSheetHint)}</div>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>{t(MC.statsInfo)}</div>
      {loadError && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red, marginBottom: S.md }}>{rivalsError(loadError)}</div>}
      {!loadError && !vals && <div aria-busy="true" style={{ fontSize: T.body, color: C.text2 }}>{t(MC.loadingAnswers)}</div>}
      {vals && <div style={{ fontSize: T.min + 0.5, color: C.text2, marginBottom: S.sm }}>{listed.length ? t(MC.statsFromLineup) : t(MC.statsFromSquad)}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        {vals && rows.map((p, i) => {
          const name = personLabel(p);
          const v = vals[p.playerId] || { goals: 0, assists: 0 };
          return (
            <div key={p.playerId} style={{ border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md }}>
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
                <Avatar name={p.name || p.nick || "?"} photo={p.photoUrl} color={AVATAR_PALETTE[i % AVATAR_PALETTE.length]} size={32} />
                <span style={{ fontSize: T.body, fontWeight: 700, color: C.text1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                {p.position && <span style={{ fontSize: T.meta, color: C.text2, flexShrink: 0 }}>{t(p.position)}</span>}
              </div>
              <div style={{ display: "flex", gap: S.md }}>
                <CounterStepper label={t(MC.goalsLabel)} value={v.goals} max={MAX_STAT} onChange={(n) => set(p.playerId, "goals", n)}
                  lessLabel={tf(MC.statLess, { stat: t(MC.goalsLabel), nick: name })} moreLabel={tf(MC.statMore, { stat: t(MC.goalsLabel), nick: name })} />
                <CounterStepper label={t(MC.assistsLabel)} value={v.assists} max={MAX_STAT} onChange={(n) => set(p.playerId, "assists", n)}
                  lessLabel={tf(MC.statLess, { stat: t(MC.assistsLabel), nick: name })} moreLabel={tf(MC.statMore, { stat: t(MC.assistsLabel), nick: name })} />
              </div>
            </div>
          );
        })}
        {vals && !rows.length && <div style={{ fontSize: T.body, color: C.text2 }}>{t(MC.lineupEmptySquad)}</div>}
      </div>
      <div aria-live="polite" style={{ marginTop: S.md, fontSize: T.meta + 1, lineHeight: 1.5, color: error ? C.red : C.orange }}>
        {error || (mismatch ? tf(MC.statsMismatch, { n: totalGoals, score: scoreText || String(teamScore) }) : "")}
      </div>
    </Sheet>
  );
}
