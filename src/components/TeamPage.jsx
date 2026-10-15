import { useEffect, useState } from "react";
import { Share2, Swords, UserPlus, Settings, LogOut, MapPin } from "lucide-react";
import { C, S, T, TOUCH, displayFont } from "../theme";
import { t, getLang } from "../lib/i18n";
import { CC, RC, rivalsError, tf } from "../lib/rivalsCopy";
import { can, nextTeamMatch, sinceLabel, teamShareUrl } from "../lib/rivals";
import { openWhatsApp } from "../lib/whatsapp";
import TeamBadge from "./TeamBadge";
import TeamRecordStrip from "./TeamRecordStrip";
import TeamTopPlayers from "./TeamTopPlayers";
import TeamNextMatchCard from "./TeamNextMatchCard";
import TeamMatchRsvp from "./TeamMatchRsvp";
import TeamLatestResults from "./TeamLatestResults";
import TeamRoster from "./TeamRoster";
import TeamInviteSheet from "./TeamInviteSheet";
import TeamEditSheet from "./TeamEditSheet";
import MemberActionsSheet from "./MemberActionsSheet";
import PitchAiTeamCta from "./PitchAiTeamCta";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";

const LOCALE = { pt: "pt-PT", "pt-br": "pt-BR", en: "en-GB" };

/**
 * One of MY teams (plan §4 roles):
 *  - member: header, record (W-D-L — "ainda sem jogos" until PR6), squad,
 *    share, leave.
 *  - captain/vice: + invite players, edit, roster management.
 *  - captain only: rename, vice, armband, hide from directory, archive.
 * PR7: the team's next match with the call-up (every member), the real
 * record / form / streak, top scorers and the latest confirmed results.
 * EXTENSION POINT: pending challenges (PR5)
 * go between the header and the record; `onChallenge` arms "Desafiar".
 */
export default function TeamPage({ teams, teamId, onLeft, onChallenge, onOpenMatch, inviteSignal = 0 }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // invite | edit | member
  // Bumped by the hub right after creating a team / from Home's "Convidar".
  useEffect(() => { if (inviteSignal) setSheet("invite"); }, [inviteSignal]);
  const [member, setMember] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    teams.fetchTeam(teamId).then((r) => {
      if (!live) return;
      if (r.error) setError(rivalsError(r.error)); else { setDetail(r.data); setError(null); }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, teams.revision]);

  if (error && !detail) return <div role="alert" style={{ fontSize: T.body, color: C.red, padding: `${S.lg}px 0` }}>{error}</div>;
  if (!detail) return <div aria-busy="true" style={{ fontSize: T.body, color: C.text2, padding: `${S.lg}px 0` }}>{t(RC.loading)}</div>;

  const { team, members, myRole, record, topScorers, topAssisters } = detail;
  const me = members.find((m) => m.playerId === teams.myPlayerId);
  const n = members.length;
  const meta = [team.city, team.format, n === 1 ? t(RC.playersOne) : tf(RC.playersN, { n })].filter(Boolean).join(" · ");
  const shareUrl = teamShareUrl(team.slug, window.location.origin);
  // Next agreed match of THIS team: the call-up lives right here for every member.
  const mineTeam = teams.myTeams.find((x) => x.id === team.id);
  const next = mineTeam ? nextTeamMatch(teams.matches, [mineTeam]) : null;

  const leave = async () => {
    setBusy(true);
    const r = await teams.leaveTeam(team.id);
    setBusy(false);
    if (r.error) { setError(rivalsError(r.error)); setConfirmLeave(false); } else onLeft?.(team.id);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: S.md + 2, marginBottom: S.lg }}>
        <TeamBadge team={team} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ ...displayFont, fontSize: T.h + 2, lineHeight: 1.1, color: C.text1, margin: 0, overflowWrap: "anywhere" }}>{team.name}</h2>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {team.city && <MapPin size={12} aria-hidden />}{meta}
          </div>
          {myRole && (
            <div style={{ marginTop: S.xs + 2 }}>
              <Chip variant={myRole === "player" ? "neutral" : "lime"}>
                {t(myRole === "captain" ? RC.roleCaptain : myRole === "vice" ? RC.roleVice : RC.rolePlayer)}
                {me?.joinedAt ? ` · ${tf(RC.since, { date: sinceLabel(me.joinedAt, LOCALE[getLang()] || "pt-PT") })}` : ""}
              </Chip>
            </div>
          )}
        </div>
      </div>

      {/* Primary actions — ONE lime CTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginBottom: S.lg }}>
        {can(myRole, "invite") ? (
          <BtnPrimary block onClick={() => setSheet("invite")}><UserPlus size={18} /> {t(RC.invitePlayers)}</BtnPrimary>
        ) : (
          <BtnGhost block onClick={() => openWhatsApp(tf(RC.shareTeamMessage, { url: shareUrl }))}><Share2 size={16} /> {t(RC.shareTeam)}</BtnGhost>
        )}
        {can(myRole, "challenge") && (
          <BtnGhost block onClick={onChallenge} disabled={!onChallenge}>
            <Swords size={16} /> {t(RC.challenge)}{!onChallenge && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 600 }}>· {t(RC.soon)}</span>}
          </BtnGhost>
        )}
      </div>

      {/* Pitch AI (decision 2026-10-13 b): leaders of a squad still under 5. */}
      {can(myRole, "invite") && n < 5 && <PitchAiTeamCta team={team} />}

      {next && (
        <TeamNextMatchCard match={next}>
          <TeamMatchRsvp key={next.id} value={next.myRsvp} onRsvp={(status) => teams.setMatchAvailability(next.id, status)} />
          {onOpenMatch && next.challengeId && <BtnGhost block onClick={() => onOpenMatch(next.challengeId)} style={{ marginTop: S.md }}>{t(CC.openMatch)}</BtnGhost>}
        </TeamNextMatchCard>
      )}

      <TeamRecordStrip record={record} />
      <TeamTopPlayers scorers={topScorers} assisters={topAssisters} />
      <TeamLatestResults matches={teams.matches} teamId={team.id} onOpenMatch={onOpenMatch} />

      <SectionLabel right={can(myRole, "invite") ? (
        <button type="button" onClick={() => openWhatsApp(tf(RC.shareTeamMessage, { url: shareUrl }))} aria-label={t(RC.shareTeam)}
          style={{ minWidth: TOUCH.min, minHeight: TOUCH.min, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Share2 size={16} />
        </button>
      ) : null}>{`${t(RC.squad)} · ${n}`}</SectionLabel>
      <TeamRoster members={members} myRole={myRole} myId={teams.myPlayerId}
        onMemberAction={(m) => { setMember(m); setSheet("member"); }} />

      {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}

      {/* Secondary: edit (leaders) · leave (everyone) */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.xl }}>
        {can(myRole, "edit") && (
          <BtnGhost onClick={() => setSheet("edit")} style={{ flex: "1 1 140px" }}><Settings size={16} /> {t(RC.edit)}</BtnGhost>
        )}
        {myRole && !confirmLeave && (
          <BtnGhost tone="danger" onClick={() => setConfirmLeave(true)} style={{ flex: "1 1 140px" }}><LogOut size={16} /> {t(RC.leaveTeam)}</BtnGhost>
        )}
      </div>
      {confirmLeave && (
        <div role="alert" style={{ marginTop: -S.md, marginBottom: S.xl }}>
          <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, marginBottom: S.md }}>
            {n === 1 ? t(RC.leaveLastConfirm) : tf(RC.leaveConfirm, { team: team.name })}
          </div>
          <div style={{ display: "flex", gap: S.sm }}>
            <BtnGhost tone="danger" onClick={leave} disabled={busy} style={{ flex: 1 }}>{t(RC.confirm)}</BtnGhost>
            <BtnGhost onClick={() => setConfirmLeave(false)} style={{ flex: 1 }}>{t(RC.cancel)}</BtnGhost>
          </div>
        </div>
      )}

      {sheet === "invite" && <TeamInviteSheet teams={teams} team={team} showPitchAi={n < 5} onClose={() => setSheet(null)} />}
      {sheet === "edit" && (
        <TeamEditSheet teams={teams} team={team} myRole={myRole} onClose={() => setSheet(null)}
          onSaved={() => setSheet(null)} onArchived={() => { setSheet(null); onLeft?.(team.id); }} />
      )}
      {sheet === "member" && member && (
        <MemberActionsSheet teams={teams} teamId={team.id} member={member} myRole={myRole}
          onClose={() => { setSheet(null); setMember(null); }} onDone={() => { setSheet(null); setMember(null); }} />
      )}
    </div>
  );
}
