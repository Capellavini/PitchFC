import { useState } from "react";
import { Check, Clock, HelpCircle, ListChecks, Users, X } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, tf } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import { personLabel, rsvpOpen } from "../lib/rivalsResults";
import { useRivalsRead } from "../hooks/useRivalsRead";
import SectionLabel from "./SectionLabel";
import TeamMatchRsvp from "./TeamMatchRsvp";
import AvailabilityList from "./AvailabilityList";
import LineupPicker from "./LineupPicker";
import Chip from "./Chip";
import BtnGhost from "./BtnGhost";

/**
 * Convocatória of ONE match, on the match screen. Everyone in the team:
 * answer Vou · Não vou · Talvez (until kickoff), see the counts, see who's
 * playing. Leaders also see who hasn't answered (+ a WhatsApp nudge) and
 * pick who plays. The opponent's answers are never shown (server: own team
 * only). Props: teams (useTeams), ch, view (challengeView), m, onNotice.
 */
export default function MatchCallUp({ teams, ch, view, m, onNotice }) {
  const [answers, setAnswers] = useState(false);
  const [picking, setPicking] = useState(false);
  const lineup = useRivalsRead(() => teams.getMatchLineup(m.id), [m.id, teams.revision]);
  if (!["scheduled", "played"].includes(m.matchStatus)) return null;

  const before = rsvpOpen(m);
  const c = m.availabilityCounts || { yes: 0, no: 0, maybe: 0, pending: 0 };
  const playing = (lineup.data?.items || []).filter((x) => x.teamId === ch.myTeamId);
  const chips = [
    ["green", Check, MC.countYes, c.yes], ["orange", HelpCircle, MC.countMaybe, c.maybe],
    ["red", X, MC.countNo, c.no], ["neutral", Clock, MC.countPending, c.pending],
  ].filter(([, , , n]) => n > 0);

  return (
    <>
      <SectionLabel>{t(RC.callUp)}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        {before ? (
          <TeamMatchRsvp bare value={m.myAvailability} onRsvp={(status) => teams.setMatchAvailability(m.id, status)} />
        ) : (
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{t(MC.callUpClosed)}</div>
        )}

        {chips.length > 0 && (
          <div role="list" style={{ display: "flex", flexWrap: "wrap", gap: S.xs + 2, marginTop: S.md }}>
            {chips.map(([variant, Icon, label, n]) => (
              <span role="listitem" key={label}><Chip variant={variant} Icon={Icon}>{tf(label, { n })}</Chip></span>
            ))}
          </div>
        )}

        <div style={{ marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.xs + 2, fontSize: T.body, fontWeight: 800, color: C.text1 }}>
            <Users size={16} color={C.text2} aria-hidden /> {t(MC.lineupTitle)}{playing.length > 0 && <span style={{ color: C.text2, fontWeight: 600 }}> · {tf(MC.lineupN, { n: playing.length })}</span>}
          </div>
          <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginTop: S.xs, overflowWrap: "anywhere" }}>
            {playing.length ? playing.map(personLabel).join(", ") : t(MC.lineupNone)}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
          <BtnGhost onClick={() => setAnswers((a) => !a)} aria-expanded={answers} style={{ flex: "1 1 150px" }}>
            <ListChecks size={16} aria-hidden /> {answers ? t(MC.hideAnswers) : t(MC.showAnswers)}
          </BtnGhost>
          {view.leader && (
            <BtnGhost tone="accent" onClick={() => setPicking(true)} style={{ flex: "1 1 150px" }}>
              <Users size={16} aria-hidden /> {playing.length ? t(MC.lineupEdit) : t(MC.lineupPick)}
            </BtnGhost>
          )}
        </div>
        {answers && (
          <div style={{ marginTop: S.md }}>
            <AvailabilityList teams={teams} match={m} team={view.myTeam} opponent={view.opponent} leader={view.leader && before} />
          </div>
        )}
      </div>
      {picking && <LineupPicker teams={teams} match={m} teamId={ch.myTeamId} onClose={() => setPicking(false)} onSaved={onNotice} />}
    </>
  );
}
