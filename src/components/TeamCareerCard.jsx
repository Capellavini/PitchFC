import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { playerMilestones } from "../lib/rivals";
import { milestoneLabel } from "../lib/rivalsShareCopy";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";
import StatTile from "./StatTile";
import Chip from "./Chip";

/** My numbers in my teams (Perfil): games, W-D-L, goals, assists per team —
 *  from CONFIRMED team matches where I was in "quem joga". Renders nothing
 *  when the server can't answer; says so plainly before the first match.
 *  Props: teams (useTeams). */
export default function TeamCareerCard({ teams }) {
  const { data } = useRivalsRead(() => teams.getMyTeamCareer(), [teams.revision]);
  if (!data) return null;
  const rows = data.items;
  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(MC.careerTitle)}</SectionLabel>
      <div style={{ ...cardStyle }}>
        {rows.map((r, i) => (
          <div key={r.teamId} style={{ paddingTop: i ? S.md : 0, marginTop: i ? S.md : 0, borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: S.sm, alignItems: "baseline" }}>
              <span style={{ fontSize: T.cardTitle - 1, fontWeight: 800, color: C.text1, minWidth: 0, overflowWrap: "anywhere" }}>{r.name}</span>
              <span style={{ fontSize: T.meta, color: C.text2, flexShrink: 0 }}>{tf(MC.careerPlayed, { n: r.appearances })}</span>
            </div>
            {r.appearances > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: S.xs, marginTop: S.sm }}>
                <StatTile value={r.wins} label={t(RC.winShort)} color={C.green} />
                <StatTile value={r.draws} label={t(RC.drawShort)} color={C.orange} />
                <StatTile value={r.losses} label={t(RC.lossShort)} color={C.red} />
                <StatTile value={r.goals} label={t(MC.goalsShort)} />
                <StatTile value={r.assists} label={t(MC.assistsShort)} />
              </div>
            )}
            {r.appearances > 0 && playerMilestones(r).length > 0 && (
              <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.sm }}>
                {playerMilestones(r).map((m) => <span key={m.id} role="listitem"><Chip variant="green">{milestoneLabel(m)}</Chip></span>)}
              </div>
            )}
            {r.appearances === 0 && <div style={{ fontSize: T.meta + 1, color: C.text2, marginTop: S.xs }}>{t(MC.careerEmpty)}</div>}
          </div>
        ))}
        {!rows.length && <div style={{ fontSize: T.meta + 1, color: C.text2 }}>{t(MC.careerEmpty)}</div>}
      </div>
    </div>
  );
}
