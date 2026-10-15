import { useState } from "react";
import { C, S, T, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { toHomeAway } from "../lib/rivalsResults";
import { kickoffLabel } from "../lib/challengeLabels";
import Sheet from "./Sheet";
import ScoreStepper from "./ScoreStepper";
import MatchScore from "./MatchScore";
import ResultHelpCard from "./ResultHelpCard";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * Every write on the shared result, in one dialog. Scores are typed from
 * MY team's side (mine · theirs) and converted to home/away on the way out.
 *  mode "report"   → enter a score (0–99) + optional note → report_match_result
 *  mode "respond"  → review the other team's score: Confirmar, or "Não é este
 *                    o resultado" → enter another (contest_match_result)
 *  mode "correct"  → propose a correction of the OFFICIAL score
 *  mode "withdraw" → retract my own pending proposal
 * Nothing here ever makes a score official on its own: it only becomes
 * official when the OTHER team confirms (the copy says so every time).
 * Props: teams (useTeams), ch, view (challengeView), m (match), rv
 * (resultView), mode, onClose, onDone(message).
 */
export default function ResultSheet({ teams, ch, view, m, rv, mode, onClose, onDone }) {
  const my = view.myTeam;
  const opp = view.opponent;
  const open = rv.open;
  const [step, setStep] = useState(mode === "respond" ? "review" : "edit");
  const seed = mode === "report" ? [0, 0] : mode === "correct" ? [rv.official?.mine ?? 0, rv.official?.theirs ?? 0] : [open?.mine ?? 0, open?.theirs ?? 0];
  const [mine, setMine] = useState(seed[0]);
  const [theirs, setTheirs] = useState(seed[1]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [stuck, setStuck] = useState(false); // the server said needs_help (a 4th proposal) → show "Fala connosco"
  const oppName = opp?.name || "";
  const scoreOf = (a, b) => `${a}–${b}`;

  const go = async (call, doneText) => {
    setBusy(true); setError(null);
    const r = await call();
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); setStuck(r.error === "needs_help"); return; }
    onDone?.(doneText);
    onClose();
  };
  const ha = () => toHomeAway(m, ch.myTeamId, mine, theirs);
  const cleanNote = note.trim() || null;

  let title;
  let body;
  let footer;

  if (mode === "withdraw") {
    title = t(MC.withdrawTitle);
    body = <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5 }}>{tf(MC.withdrawBody, { score: open ? scoreOf(open.mine, open.theirs) : "" })}</div>;
    footer = (
      <div style={{ display: "flex", gap: S.sm }}>
        <BtnGhost tone="danger" disabled={busy} style={{ flex: 1 }} onClick={() => go(() => teams.withdrawResultProposal(m.id, open.revision), t(MC.withdrawnToast))}>{t(MC.withdrawConfirm)}</BtnGhost>
        <BtnGhost disabled={busy} style={{ flex: 1 }} onClick={onClose}>{t(MC.keep)}</BtnGhost>
      </div>
    );
  } else if (mode === "respond" && step === "review" && open) {
    title = tf(MC.respondTitle, { team: oppName });
    body = (
      <>
        <MatchScore left={my} right={opp} leftScore={open.mine} rightScore={open.theirs} provisional big />
        {open.note && <div style={{ fontSize: T.body, color: C.text1, textAlign: "center", marginTop: S.md }}>“{open.note}”</div>}
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.md }}>
          {open.kind === "correction" ? tf(MC.correctionNote, { score: rv.official ? scoreOf(rv.official.mine, rv.official.theirs) : "", team: oppName }) : t(MC.respondHint)}
        </div>
        {!rv.canContest && <ResultHelpCard count={rv.revisionsCount} stuck={rv.stuck} stale={rv.needsHelp && !rv.stuck}team={my?.name} opp={oppName} when={kickoffLabel(m.kickoffAt, m.timezone)} />}
      </>
    );
    footer = (
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <BtnPrimary block disabled={busy} onClick={() => go(() => teams.confirmMatchResult(m.id, open.revision), t(MC.confirmedToast))}>{busy ? t(CC.sending) : t(MC.confirmAction)}</BtnPrimary>
        {rv.canContest && <BtnGhost block disabled={busy} onClick={() => { setStep("edit"); setError(null); }}>{t(MC.contestAction)}</BtnGhost>}
      </div>
    );
  } else {
    // Score entry: report | contest (respond → edit) | correct
    const contest = mode === "respond";
    const correct = mode === "correct";
    title = correct ? t(MC.correctTitle) : contest ? t(MC.contestTitle) : t(MC.reportTitle);
    const hint = correct ? tf(MC.correctHint, { score: rv.official ? scoreOf(rv.official.mine, rv.official.theirs) : "", team: oppName })
      : contest ? tf(MC.contestHint, { team: oppName }) : tf(MC.reportHint, { team: oppName });
    const submit = correct ? () => go(() => teams.proposeResultCorrection(m.id, ha().homeScore, ha().awayScore, cleanNote), tf(MC.correctedToast, { team: oppName }))
      : contest ? () => go(() => teams.contestMatchResult(m.id, open.revision, ha().homeScore, ha().awayScore, cleanNote), tf(MC.contestedToast, { team: oppName }))
        : () => go(() => teams.reportMatchResult(m.id, ha().homeScore, ha().awayScore, cleanNote), tf(MC.reportedToast, { team: oppName }));
    body = (
      <>
        <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.lg }}>{hint}</div>
        <div role="group" aria-label={t(MC.scoreGroup)} style={{ display: "flex", alignItems: "flex-start", gap: S.sm, marginBottom: S.lg }}>
          <ScoreStepper team={my} value={mine} onChange={setMine} />
          <div aria-hidden style={{ width: 1, alignSelf: "stretch", background: C.border }} />
          <ScoreStepper team={opp} value={theirs} onChange={setTheirs} />
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder={t(MC.resultNotePh)} aria-label={t(CC.note)} style={inputStyle()} />
      </>
    );
    footer = (
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        <BtnPrimary block disabled={busy} onClick={submit}>{busy ? t(CC.sending) : correct ? t(MC.submitCorrect) : contest ? t(MC.submitContest) : t(MC.submitReport)}</BtnPrimary>
        {contest && <BtnGhost block disabled={busy} onClick={() => { setStep("review"); setError(null); }}>{t(MC.backToProposal)}</BtnGhost>}
      </div>
    );
  }

  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      {body}
      <div aria-live="polite" style={{ marginTop: error ? S.md : 0 }}>
        {error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red, lineHeight: 1.5 }}>{error}</div>}
      </div>
      {stuck && <ResultHelpCard stuck count={rv.revisionsCount} team={my?.name} opp={oppName} when={kickoffLabel(m.kickoffAt, m.timezone)} />}
    </Sheet>
  );
}
