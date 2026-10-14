import { C, S, T } from "../theme";
import { t } from "../lib/i18n";
import { CC, tf } from "../lib/rivalsCopy";
import { previousTerms } from "../lib/rivalsChallenges";
import { kickoffLabel } from "../lib/challengeLabels";
import VersionDiff from "./VersionDiff";

const KIND = { proposal: CC.kindProposal, counter: CC.kindCounter, change: CC.kindChange };
const OUTCOME = {
  accepted: [CC.outcomeAccepted, "green"], declined: [CC.outcomeDeclined, "red"], countered: [CC.outcomeCountered, "text2"],
  cancelled: [CC.outcomeCancelled, "text2"], expired: [CC.outcomeExpired, "text2"],
};

/** The negotiation, newest first: every version (proposal / counter /
 *  change) with who sent it, what it changed vs the one it answers, and
 *  how it ended. History is immutable — nothing here is ever rewritten. */
export default function ChallengeTimeline({ ch, teams }) {
  const byId = { [ch.challenger?.id]: ch.challenger, [ch.challenged?.id]: ch.challenged };
  const versions = [...ch.versions].reverse();
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {versions.map((v, i) => {
        const [label, tone] = v.outcome ? OUTCOME[v.outcome] : [CC.outcomeOpen, "orange"];
        const prev = previousTerms(ch, v.version);
        return (
          <li key={v.version} style={{ position: "relative", paddingLeft: S.lg + 2, paddingBottom: i < versions.length - 1 ? S.lg : 0 }}>
            <span aria-hidden style={{ position: "absolute", left: 4, top: 6, width: 8, height: 8, borderRadius: 4, background: C[tone] || C.text2 }} />
            {i < versions.length - 1 && <span aria-hidden style={{ position: "absolute", left: 7, top: 16, bottom: 0, width: 2, background: C.border }} />}
            <div style={{ fontSize: T.meta + 1, fontWeight: 800, color: C.text1 }}>
              {tf(CC.versionN, { n: v.version })} · {tf(CC.byTeam, { kind: t(KIND[v.kind]), team: byId[v.proposedByTeamId]?.name || "—" })}
            </div>
            <div style={{ fontSize: T.meta, color: C[tone] || C.text2, fontWeight: 700, marginTop: 2 }}>
              {t(label)}{v.createdAt ? <span style={{ color: C.text2, fontWeight: 500 }}> · {kickoffLabel(v.createdAt, v.timezone)}</span> : null}
            </div>
            <div style={{ marginTop: S.sm }}>
              <VersionDiff prev={prev} next={v} teams={teams} emptyText={t(CC.noDiff)} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
