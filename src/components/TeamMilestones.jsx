import { Award, Flame, Target } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { hasPlayed, nextMilestone, teamMilestones } from "../lib/rivals";
import { SC, milestoneLabel, nextMilestoneText } from "../lib/rivalsShareCopy";
import SectionLabel from "./SectionLabel";
import Chip from "./Chip";

/**
 * The team's milestones, derived from the CONFIRMED record only (lib/rivals
 * teamMilestones): first win, 5/10/25 games, clean sheets, a thrashing…
 * Streak ones are marked "em curso" because they describe the current run.
 * Below: the closest cumulative milestone still to reach. Renders nothing
 * before the first confirmed result (the record strip already says so).
 * Props: record (normRecord).
 */
export default function TeamMilestones({ record }) {
  if (!hasPlayed(record)) return null;
  const achieved = teamMilestones(record);
  const next = nextMilestone(record);
  if (!achieved.length && !next) return null;
  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(SC.milestonesTitle)}</SectionLabel>
      <div style={{ ...cardStyle }}>
        {achieved.length > 0 && (
          <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
            {achieved.map((m) => (
              <span key={m.id} role="listitem">
                <Chip variant={m.live ? "orange" : "green"} Icon={m.live ? Flame : Award}>
                  {milestoneLabel(m)}{m.live ? ` · ${t(SC.milestonesLive)}` : ""}
                </Chip>
              </span>
            ))}
          </div>
        )}
        {next && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: S.sm, marginTop: achieved.length ? S.md : 0, fontSize: T.meta + 1, color: C.text1, lineHeight: 1.4, fontWeight: 600 }}>
            <Target size={16} color={C.accent} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{nextMilestoneText(next)}</span>
          </div>
        )}
        <div style={{ fontSize: T.min + 0.5, color: C.text2, marginTop: S.sm }}>{t(SC.milestonesNote)}</div>
      </div>
    </div>
  );
}
