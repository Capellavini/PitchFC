import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, roleLabel } from "../../lib/leagueCloudCopy";
import { leagueUrl } from "../../lib/leagueCloud";
import BtnPrimary from "../BtnPrimary";
import SectionLabel from "../SectionLabel";
import Chip from "../Chip";
import LeagueCloudShell from "./LeagueCloudShell";
import Row from "./LeagueLinkRow";
import LeaguePilotCard from "./LeaguePilotCard";
import LeagueAdminRequests from "./LeagueAdminRequests";
import LeagueInviteAccept from "./LeagueInviteAccept";
import LeagueRegisterTeam from "./LeagueRegisterTeam";

const go = (href) => { window.location.href = href; };

/** /league/minhas — the signed-in home of PITCH Ligas: invite / registration
 *  links, "Minhas ligas" (organization roles), "Acompanhando" (fan follows),
 *  the pilot request, and the admin review queue. */
export default function LeagueHub({ leagues, rivals, onSignIn }) {
  const q = new URLSearchParams(window.location.search);
  const invite = q.get("convite");
  const inscricao = q.get("inscricao");
  const { following, followNames } = leagues;

  if (!leagues.signedIn) {
    return (
      <LeagueCloudShell title={t(LC.hubTitle)} backHref="/league">
        <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md }}>{t(LC.signInFirst)}</div>
        <BtnPrimary block onClick={onSignIn}>{t(LC.signIn)}</BtnPrimary>
      </LeagueCloudShell>
    );
  }
  const followRows = following.follows.map((f) => {
    const n = followNames[`${f.entityType}:${f.entityId}`];
    if (!n) return null;
    const href = f.entityType === "league" ? leagueUrl(n.slug)
      : f.entityType === "competition" && n.slug ? leagueUrl(n.slug, { competitionSlug: n.competitionSlug })
        : f.entityType === "team" && n.teamSlug ? `/?team=${n.teamSlug}` : null;
    const supports = f.entityType === "team" && following.supporting.some((s) => s.teamId === f.entityId);
    return href ? <Row key={`${f.entityType}:${f.entityId}`} href={href} title={n.name} meta={t(f.entityType === "league" ? "Liga" : f.entityType === "competition" ? "Competição" : "Equipa")}
      right={supports ? <Chip variant="lime">{t(LC.supporting)}</Chip> : null} /> : null;
  }).filter(Boolean);

  return (
    <LeagueCloudShell title={t(LC.hubTitle)} backHref="/league">
      {invite ? <LeagueInviteAccept leagues={leagues} token={invite} onAccepted={(slug) => slug && go(leagueUrl(slug))} /> : null}
      {inscricao ? <LeagueRegisterTeam leagues={leagues} rivals={rivals} token={inscricao} /> : null}

      <SectionLabel>{t(LC.myLeagues)}</SectionLabel>
      {leagues.myLeagues.length ? leagues.myLeagues.map((l) => (
        <Row key={l.id} href={leagueUrl(l.slug)} title={l.name} meta={l.roles.map(roleLabel).join(" · ")} />
      )) : <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>{t(LC.noLeagues)}</div>}

      <SectionLabel style={{ marginTop: S.lg }}>{t(LC.following)}</SectionLabel>
      {followRows.length ? followRows : <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>{t(LC.noFollowing)}</div>}

      <div style={{ marginTop: S.xl }}>
        <LeaguePilotCard leagues={leagues} onCreated={(slug) => go(leagueUrl(slug))} />
        <LeagueAdminRequests leagues={leagues} />
      </div>
    </LeagueCloudShell>
  );
}
