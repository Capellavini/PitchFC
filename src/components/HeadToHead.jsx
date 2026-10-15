import { Scale } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { kickoffLabel } from "../lib/challengeLabels";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";

/**
 * "Confronto #N" — the history between my team and this opponent, from
 * CONFIRMED results only (N = confirmed meetings + 1). `compact` = a single
 * line for the challenge screen. Renders nothing while loading or when the
 * server can't answer (it's context, never a blocker).
 * Props: teams (useTeams), teamId (mine), opponent ({ id, name }), compact.
 */
export default function HeadToHead({ teams, teamId, opponent, compact = false }) {
  const { data } = useRivalsRead(() => teams.getHeadToHead(teamId, opponent?.id), [teamId, opponent?.id, teams.revision], { enabled: Boolean(teamId && opponent?.id) });
  if (!data) return null;
  const line = data.played
    ? tf(MC.h2hLine, { w: data.wins, d: data.draws, l: data.losses, gf: data.goalsFor, ga: data.goalsAgainst })
    : t(MC.h2hFirst);

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs + 2, fontSize: T.meta + 1, color: C.text2, flexWrap: "wrap", textAlign: "center", marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
        <Scale size={14} aria-hidden />
        <b style={{ color: C.text1 }}>{tf(MC.h2hTitle, { n: data.confrontoN })}</b> · {line}
      </div>
    );
  }
  return (
    <>
      <SectionLabel>{t(MC.h2hLabel)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ ...displayFont, fontSize: T.h + 2, color: C.text1 }}>{tf(MC.h2hTitle, { n: data.confrontoN })}</div>
        <div style={{ fontSize: T.body, color: C.text1, marginTop: S.xs }}>{line}</div>
        {data.last && (
          <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.xs }}>
            {tf(MC.h2hLast, { score: data.last.score || "—", when: data.last.kickoffAt ? kickoffLabel(data.last.kickoffAt) : "—" })}
          </div>
        )}
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t(MC.h2hOnlyConfirmed)}</div>
      </div>
    </>
  );
}
