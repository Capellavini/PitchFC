import { useCallback, useEffect, useState } from "react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError, statusLabel } from "../../lib/leagueCloudCopy";
import { tf } from "../../lib/leagueCopy";
import { leagueUrl } from "../../lib/leagueCloud";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueCloudShell from "./LeagueCloudShell";
import LeagueShareLink from "./LeagueShareLink";
import LeagueRegistrationsReview from "./LeagueRegistrationsReview";
import LeagueCompetitionSchedule from './LeagueCompetitionSchedule';

/** /league/<slug>/<competition> — the real competition page: regulation,
 *  homologated teams (+ squads), fan "Apoiar" / follow; staff: publish the
 *  regulation, open/close registrations, registration link for captains,
 *  squad review. Fixtures, live súmula and standings are L4+ (seam note). */
export default function LeagueCompetitionCloud({ leagues, slug, competitionSlug, viewKey, contextOptions=[] }) {
  const [c, setC] = useState(undefined);
  const [teams, setTeams] = useState([]);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const { fetchCompetition, fetchCompetitionTeams } = leagues;

  const load = useCallback(async () => {
    const r = await fetchCompetition(slug, competitionSlug, viewKey);
    if (r.error) { setErr(leagueCloudError(r.error)); setC(null); return; }
    setC(r.data);
    if (r.data) {
      const tq = await fetchCompetitionTeams(r.data.id, viewKey);
      setTeams(tq.data || []);
    }
  }, [fetchCompetition, fetchCompetitionTeams, slug, competitionSlug, viewKey]);
  useEffect(() => { load(); }, [load]);

  const back = leagueUrl(slug, viewKey ? { key: viewKey } : {});
  if (c === undefined) return <LeagueCloudShell title="…" backHref={back} />;
  if (!c) return <LeagueCloudShell title={t(LC.notFound)} backHref={back} error={err} />;

  const run = async (fn) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (r?.error) setErr(leagueCloudError(r.error)); else await load();
    return r;
  };
  const rules = c.regulation.rules;
  const supported = leagues.supportedTeamOf(c.id);
  const following = leagues.isFollowing("competition", c.id);

  return (
    <LeagueCloudShell contextOptions={contextOptions} title={c.name} backHref={back} error={err}
      subtitle={[c.league?.name, c.season, c.category, c.format].filter(Boolean).join(" · ")}
      right={leagues.signedIn && !c.isStaff ? <BtnGhost compact tone={following ? "neutral" : "accent"}
        onClick={() => run(() => leagues.follow("competition", c.id, !following))}>{t(following ? LC.unfollow : LC.follow)}</BtnGhost> : null}>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        <Chip variant={c.status === "registration_open" ? "lime" : "neutral"}>{statusLabel(c.status)}</Chip>
      </div>

      <LeagueCompetitionSchedule leagues={leagues} competition={c} teams={teams} viewKey={viewKey}/>

      <SectionLabel>{t(LC.regulation)}</SectionLabel>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>
        {rules ? tf(LC.regulationSummary, { v: c.regulation.version, w: rules.points?.win, d: rules.points?.draw, l: rules.points?.loss,
          min: rules.squad?.min, max: rules.squad?.max }) : c.draftVersion ? tf(LC.regulationDraft, { v: c.draftVersion }) : "—"}
      </div>

      <SectionLabel>{t(LC.teams)}</SectionLabel>
      {teams.length ? teams.map((tm) => (
        <div key={tm.registrationId} style={{ ...cardStyle, padding: S.md, marginBottom: S.sm }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
            <span style={{ flex: 1, fontSize: T.body, fontWeight: 800 }}>{tm.team.name}</span>
            {leagues.signedIn && !c.isStaff ? (supported === tm.team.id
              ? <Chip variant="lime" onClick={() => run(() => leagues.setSupportedTeam(c.id, null))}>{t(LC.supported)}</Chip>
              : <Chip onClick={() => run(() => leagues.setSupportedTeam(c.id, tm.team.id))}>{t(LC.support)}</Chip>) : null}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs, lineHeight: 1.6 }}>
            {tm.squad.map((p) => `${p.shirtNumber != null ? `${p.shirtNumber} · ` : ""}${p.name}`).join(", ")}
          </div>
        </div>
      )) : <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LC.noTeams)}</div>}

      {c.isStaff ? (
        <section id="inscricoes" style={{ ...cardStyle, padding: S.lg, marginTop: S.lg,scrollMarginTop:20 }}>
          <SectionLabel>{t(LC.manage)}</SectionLabel>
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
            {c.draftVersion ? <BtnPrimary disabled={busy} onClick={() => { const reason = c.draftVersion > 1 ? (window.prompt(t("Motivo da nova versão do regulamento (obrigatório)")) || "").trim() : null; if (c.draftVersion > 1 && !reason) return; run(() => leagues.publishRegulation(c.id, c.draftVersion, reason)); }}>{t(LC.publish)}</BtnPrimary> : null}
            {["draft", "registration_closed"].includes(c.status) && c.regulation.version
              ? <BtnGhost tone="accent" disabled={busy} onClick={() => run(() => leagues.setCompetitionStatus(c.id, "registration_open"))}>{t(LC.openRegs)}</BtnGhost> : null}
            {c.status === "registration_open"
              ? <BtnGhost disabled={busy} onClick={() => run(() => leagues.setCompetitionStatus(c.id, "registration_closed"))}>{t(LC.closeRegs)}</BtnGhost> : null}
          </div>
          {c.status === "registration_open" ? (
            <div style={{ marginTop: S.lg }}>
              <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.sm }}>{t(LC.regLink)}</div>
              <BtnGhost disabled={busy} onClick={async () => { const r = await leagues.createRegistrationLink(c.id); if (r.error) setErr(leagueCloudError(r.error)); else setLink(r.data); }}>{t(LC.createLink)}</BtnGhost>
              {link ? <LeagueShareLink url={link.url} message={`${c.league?.name || ""} · ${c.name}`} /> : null}
            </div>
          ) : null}
          <LeagueRegistrationsReview leagues={leagues} competitionId={c.id} onDecided={load} />
        </section>
      ) : null}

    </LeagueCloudShell>
  );
}
