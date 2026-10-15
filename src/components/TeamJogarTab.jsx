import { useState } from "react";
import { CalendarX, Search, Shield, Users } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC } from "../lib/rivalsCopy";
import { challengeView } from "../lib/rivalsChallenges";
import PageHeader from "./PageHeader";
import TeamNextMatchCard from "./TeamNextMatchCard";
import TeamMatchRsvp from "./TeamMatchRsvp";
import MatchCallUp from "./MatchCallUp";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/**
 * Jogar in TEAM MODE (player with a team and no group — decision
 * 2026-10-13 c): the team's next agreed match + the convocatória. Every
 * member answers Vou · Não vou · Talvez (`onRsvp` = useTeams
 * .setMatchAvailability bound to the match); captain / vice also see who
 * answered, nudge who didn't and pick who plays (MatchCallUp). Without
 * the full challenge loaded it falls back to the plain RSVP.
 */
export default function TeamJogarTab({ teams, nextMatch, onRsvp, onOpenTeam, onOpenMatch, onFindRivals, onJoinGroup }) {
  const [notice, setNotice] = useState(null);
  const ch = nextMatch ? teams?.challenges?.find((c) => c.id === nextMatch.challengeId) : null;
  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      <PageHeader title={t(RC.playTitle)} subtitle={nextMatch?.team?.name} />
      {nextMatch ? (
        <>
          <TeamNextMatchCard match={nextMatch}>
            {!ch?.match && <TeamMatchRsvp key={nextMatch.id} value={nextMatch.myRsvp} onRsvp={onRsvp} />}
          </TeamNextMatchCard>
          {ch?.match && (
            <>
              <div aria-live="polite">{notice && <div role="status" style={{ fontSize: T.body, color: C.green, fontWeight: 700, marginBottom: S.md }}>{notice}</div>}</div>
              <MatchCallUp teams={teams} ch={ch} view={challengeView(ch)} m={ch.match} onNotice={setNotice} />
              {onOpenMatch && <BtnGhost block onClick={() => onOpenMatch(ch.id)} style={{ marginBottom: S.md }}>{t(CC.openMatch)}</BtnGhost>}
            </>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: "center", padding: "28px 20px", marginBottom: S.lg }}>
          <div style={{ width: 52, height: 52, borderRadius: R.card, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: `0 auto ${S.md}px` }}>
            <CalendarX size={24} color={C.accent} aria-hidden />
          </div>
          <div style={{ ...displayFont, fontSize: T.h, marginBottom: S.sm }}>{t(RC.noTeamGameTitle)}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6, marginBottom: S.lg }}>{t(RC.noTeamGameBody)}</div>
          <BtnPrimary block onClick={onFindRivals}><Search size={18} aria-hidden /> {t(RC.findRivals)}</BtnPrimary>
        </div>
      )}
      <BtnGhost block onClick={onOpenTeam} style={{ marginBottom: S.md }}><Shield size={16} aria-hidden /> {t(RC.openRivals)}</BtnGhost>
      {onJoinGroup && (
        <button type="button" onClick={onJoinGroup}
          style={{ width: "100%", minHeight: 44, background: "none", border: "none", color: C.text2, fontSize: T.meta + 1, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", marginBottom: S.xl }}>
          <Users size={14} aria-hidden /> {t(RC.alsoGroups)}
        </button>
      )}
    </div>
  );
}
