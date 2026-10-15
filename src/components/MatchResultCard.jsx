import { useState } from "react";
import { AlertCircle, Ban, CheckCircle2, Clock, GitCompareArrows, History, Hourglass, Pencil } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC, rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { resultView } from "../lib/rivalsResults";
import { kickoffLabel } from "../lib/challengeLabels";
import SectionLabel from "./SectionLabel";
import MatchScore from "./MatchScore";
import ResultSheet from "./ResultSheet";
import ResultDisputeView from "./ResultDisputeView";
import ResultHelpCard from "./ResultHelpCard";
import ReasonConfirm from "./ReasonConfirm";
import Chip from "./Chip";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const OUTCOME = { W: [RC.win, "green"], D: [RC.draw, "orange"], L: [RC.loss, "red"] };

/**
 * The shared result of ONE match, from my side. The official score is
 * written only when the OTHER team confirms (the sentence under the score
 * says so in every pending state). States — each one text + icon:
 *   before · ready · reported · disputed · confirmed · correction · not_played
 * Leaders get the action for the state (log / confirm-or-contest / withdraw /
 * correct / "não se realizou"); plain members only read.
 * Props: teams (useTeams), ch, view (challengeView), m (match), onNotice(text).
 */
export default function MatchResultCard({ teams, ch, view, m, onNotice }) {
  const rv = resultView(m, { myTeamId: ch.myTeamId, leader: view.leader });
  const my = view.myTeam;
  const opp = view.opponent;
  const oppName = opp?.name || "";
  const [sheet, setSheet] = useState(null); // report | respond | correct | withdraw
  const [history, setHistory] = useState(false);
  const [confirmNP, setConfirmNP] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (rv.phase === "cancelled") return null;

  const scoreText = (s) => `${s.mine}–${s.theirs}`;
  const markNotPlayed = async (reason) => {
    setBusy(true); setError(null);
    const r = await teams.markMatchNotPlayed(m.id, reason);
    setBusy(false); setConfirmNP(false);
    if (r.error) setError(rivalsError(r.error)); else onNotice?.(t(MC.notPlayedDone));
  };

  // One line: icon + sentence (colour is a bonus, the words carry the state).
  const line = {
    before: [Clock, C.text2, t(MC.resultBefore)],
    ready: rv.canReport ? [AlertCircle, C.orange, tf(MC.resultReady, { team: oppName })] : [Hourglass, C.text2, t(MC.resultReadyMember)],
    reported: rv.byMe ? [Hourglass, C.orange, tf(MC.stateReportedMine, { team: oppName })] : [AlertCircle, C.orange, tf(MC.stateReportedTheirs, { team: oppName })],
    disputed: rv.byMe ? [Hourglass, C.orange, tf(MC.stateDisputedMine, { team: oppName })] : [GitCompareArrows, C.orange, tf(MC.stateDisputedTheirs, { team: oppName })],
    confirmed: [CheckCircle2, C.green, t(MC.stateConfirmed)],
    correction: rv.byMe ? [Hourglass, C.orange, tf(MC.stateCorrectionMine, { team: oppName })] : [AlertCircle, C.orange, tf(MC.stateCorrectionTheirs, { team: oppName })],
    not_played: [Ban, C.text2, t(MC.notPlayedState)],
  }[rv.phase];
  const [LineIcon, lineColor, lineText] = line;

  const showOfficial = rv.phase === "confirmed" || rv.phase === "correction";
  const shownScore = showOfficial ? rv.official : rv.open;
  const provisional = !showOfficial && Boolean(rv.open);
  const [outLabel, outTone] = rv.official ? OUTCOME[rv.official.outcome] : [];

  return (
    <>
      <SectionLabel>{t(CC.result)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg, borderLeft: rv.canRespond || rv.canReport ? `3px solid ${C.accent}` : cardStyle.border }}>
        {shownScore && (
          <div style={{ marginBottom: S.md }}>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", justifyContent: "center", marginBottom: S.md }}>
              <Chip variant={showOfficial ? "green" : rv.phase === "disputed" ? "red" : "orange"} Icon={showOfficial ? CheckCircle2 : rv.phase === "disputed" ? GitCompareArrows : Hourglass}>
                {showOfficial ? t(MC.badgeOfficial) : rv.phase === "disputed" ? t(MC.badgeDisputed) : t(MC.badgeProvisional)}
              </Chip>
              {showOfficial && outLabel && <Chip variant={outTone}>{t(outLabel)}</Chip>}
            </div>
            <MatchScore left={my} right={opp} leftScore={shownScore.mine} rightScore={shownScore.theirs} provisional={provisional} big />
          </div>
        )}

        <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "flex-start", gap: S.sm, fontSize: T.body, fontWeight: 700, color: lineColor, lineHeight: 1.4 }}>
          <LineIcon size={18} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} /> <span style={{ minWidth: 0 }}>{lineText}</span>
        </div>

        {provisional && <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>{t(MC.provisionalNote)}</div>}
        {rv.phase === "correction" && rv.open && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
            {tf(MC.proposedNote, { score: scoreText(rv.open) })} — {tf(MC.correctionNote, { score: scoreText(rv.official), team: oppName })}
          </div>
        )}
        {rv.open?.note && <div style={{ fontSize: T.body, color: C.text1, marginTop: S.sm }}>“{rv.open.note}”</div>}
        {rv.phase === "not_played" && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
            {m.notPlayedReason ? `${tf(CC.reasonLine, { reason: m.notPlayedReason })} · ` : ""}{t(MC.notPlayedBody)}
          </div>
        )}

        {!view.leader && rv.open && !rv.byMe && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.sm }}>
            {tf(MC.memberSeesProposal, { team: oppName, score: scoreText(rv.open) })}
          </div>
        )}

        <div aria-live="polite">
          {error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red, marginTop: S.sm }}>{error}</div>}
        </div>

        {/* The ONE action for my role in this state */}
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.md }}>
          {rv.canReport && <BtnPrimary block onClick={() => setSheet("report")}>{t(MC.reportAction)}</BtnPrimary>}
          {rv.canRespond && <BtnPrimary block onClick={() => setSheet("respond")}>{t(MC.respondAction)}</BtnPrimary>}
          {rv.canWithdraw && <BtnGhost block onClick={() => setSheet("withdraw")}>{t(MC.withdrawAction)}</BtnGhost>}
          {rv.canCorrect && <BtnGhost block onClick={() => setSheet("correct")}><Pencil size={16} aria-hidden /> {t(MC.correctAction)}</BtnGhost>}
          {rv.canMarkNotPlayed && !confirmNP && <BtnGhost block onClick={() => setConfirmNP(true)} disabled={busy}>{t(MC.notPlayedAction)}</BtnGhost>}
        </div>
        {confirmNP && <ReasonConfirm text={t(MC.notPlayedConfirm)} confirmLabel={t(MC.notPlayedConfirmLabel)} busy={busy} onCancel={() => setConfirmNP(false)} onConfirm={markNotPlayed} />}

        {rv.needsHelp && (
          <ResultHelpCard count={rv.revisionsCount} stuck={rv.stuck} stale={!rv.stuck} team={my?.name} opp={oppName} when={kickoffLabel(m.kickoffAt, m.timezone)} />
        )}

        {rv.revisionsCount > 0 && (
          <button type="button" aria-expanded={history} onClick={() => setHistory((h) => !h)}
            style={{ marginTop: S.md, minHeight: 44, width: "100%", background: "none", border: "none", color: C.text2, fontSize: T.meta + 1, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
            <History size={14} aria-hidden /> {history ? t(MC.historyHide) : t(MC.historyShow)}
          </button>
        )}
        {history && (
          <div style={{ marginTop: S.sm, paddingTop: S.md, borderTop: `1px solid ${C.border}`, borderRadius: R.control }}>
            <ResultDisputeView teams={teams} match={m} rv={rv} sides={{ mine: my, opp }} showHelp={false} />
          </div>
        )}
      </div>

      {/* If the state moves under an open sheet (the other team answered meanwhile) it simply goes away. */}
      {sheet && (sheet === "report" ? rv.canReport : sheet === "correct" ? rv.canCorrect : Boolean(rv.open)) && (
        <ResultSheet teams={teams} ch={ch} view={view} m={m} rv={rv} mode={sheet} onClose={() => setSheet(null)} onDone={onNotice} />
      )}
    </>
  );
}
