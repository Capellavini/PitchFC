import { Ban, CheckCircle2, GitCompareArrows, Hourglass, Layers } from "lucide-react";
import { C, R, S, T, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { rivalsError, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { kickoffLabel } from "../lib/challengeLabels";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";
import ResultHelpCard from "./ResultHelpCard";

const STATUS = {
  proposed: { Icon: Hourglass, color: C.orange, label: MC.revProposed },
  confirmed: { Icon: CheckCircle2, color: C.green, label: MC.revConfirmed },
  disputed: { Icon: GitCompareArrows, color: C.red, label: MC.revDisputed },
  superseded: { Icon: Layers, color: C.text2, label: MC.revSuperseded },
  withdrawn: { Icon: Ban, color: C.text2, label: MC.revWithdrawn },
};
const KIND = { report: MC.kindReport, counter: MC.kindCounter, correction: MC.kindCorrection };

/** Every revision of one match's result, oldest first: who proposed what,
 *  what happened to it (text + icon, never colour alone) — and, when it's
 *  stuck (4 proposals) or has waited > 7 days, "Precisas de ajuda? Fala
 *  connosco". `rv` = resultView(), `sides` = { mine, opp } team objects. */
export default function ResultDisputeView({ teams, match, rv, sides, showHelp = true }) {
  const { data, error } = useRivalsRead(() => teams.getMatchResults(match.id), [match.id, teams.revision]);
  const nameOf = (teamId) => (sides.mine?.id === teamId ? sides.mine?.name : sides.opp?.name) || "";
  // Scores are stored home/away; show them from MY side, like everywhere else on the card.
  const mineIsHome = match.homeTeamId === sides.mine?.id;

  return (
    <div>
      <SectionLabel>{t(MC.historyTitle)}</SectionLabel>
      {error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red }}>{rivalsError(error)}</div>}
      {data && !data.items.length && <div style={{ fontSize: T.meta + 1, color: C.text2 }}>{t(MC.noHistory)}</div>}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.sm }}>
        {(data?.items || []).map((r) => {
          const s = STATUS[r.status] || STATUS.proposed;
          const Icon = s.Icon;
          const mine = mineIsHome ? r.homeScore : r.awayScore;
          const theirs = mineIsHome ? r.awayScore : r.homeScore;
          return (
            <li key={r.revision} style={{ border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.sm}px ${S.md}px`, background: r.status === "proposed" ? C.accentDim : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm }}>
                <span style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{tf(MC.revN, { n: r.revision })}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.meta, fontWeight: 700, color: s.color }}>
                  <Icon size={14} aria-hidden /> {t(s.label)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: S.md, marginTop: S.xs }}>
                <span style={{ ...displayFont, fontSize: T.h + 4, color: C.text1, fontVariantNumeric: "tabular-nums" }}>{mine}–{theirs}</span>
                <span style={{ fontSize: T.meta + 1, color: C.text1, minWidth: 0, overflowWrap: "anywhere" }}>{t(KIND[r.kind] || MC.kindReport)} · {nameOf(r.reportedByTeamId)}</span>
              </div>
              {r.note && <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: 2 }}>“{r.note}”</div>}
              {r.createdAt && <div style={{ fontSize: T.min + 0.5, color: C.text2, marginTop: 2 }}>{kickoffLabel(r.createdAt, match.timezone)}</div>}
            </li>
          );
        })}
      </ol>
      {showHelp && rv.needsHelp && (
        <ResultHelpCard count={rv.revisionsCount} stuck={rv.stuck} stale={rv.needsHelp && !rv.stuck} team={sides.mine?.name} opp={sides.opp?.name} when={kickoffLabel(match.kickoffAt, match.timezone)} />
      )}
    </div>
  );
}
