import { useCallback, useEffect, useState } from "react";
import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError, roleLabel, statusLabel } from "../../lib/leagueCloudCopy";
import { isLeagueManagerRole, leagueUrl } from "../../lib/leagueCloud";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueCloudShell from "./LeagueCloudShell";
import LeagueLinkRow from "./LeagueLinkRow";
import LeagueStaffPanel from "./LeagueStaffPanel";

/** /league/<slug> — the real league page (league_page RPC; null = not found
 *  or private without ?k=). Fans follow; owner/manager get "Gerir liga". */
export default function LeagueCloudPage({ leagues, slug, viewKey, contextOptions=[] }) {
  const [lg, setLg] = useState(undefined);
  const [err, setErr] = useState(null);
  const { fetchLeague, revision } = leagues;
  const load = useCallback(async () => {
    const r = await fetchLeague(slug, viewKey);
    if (r.error) { setErr(leagueCloudError(r.error)); setLg(null); } else setLg(r.data);
  }, [fetchLeague, slug, viewKey]);
  useEffect(() => { load(); }, [load, revision]);

  if (lg === undefined) return <LeagueCloudShell title="…" />;
  if (!lg) return <LeagueCloudShell title={t(LC.notFound)} error={err} />;

  const following = leagues.isFollowing("league", lg.id);
  const toggleFollow = async () => {
    const r = await leagues.follow("league", lg.id, !following);
    if (r.error) setErr(leagueCloudError(r.error));
  };
  const manager = isLeagueManagerRole(lg.myRoles);
  const keyQ = viewKey ? { key: viewKey } : {};

  return (
    <LeagueCloudShell contextOptions={contextOptions} title={lg.name} subtitle={[lg.city, lg.country].filter(Boolean).join(" · ")} error={err}
      right={leagues.signedIn ? <BtnGhost compact tone={following ? "neutral" : "accent"} onClick={toggleFollow}>{t(following ? LC.unfollow : LC.follow)}</BtnGhost> : null}>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {lg.status === "draft" ? <Chip variant="orange">{t(LC.draftLeague)}</Chip> : null}
        {lg.visibility === "private" ? <Chip>{t(LC.privateLeague)}</Chip> : null}
        {lg.myRoles.map((r) => <Chip key={r} variant="lime">{roleLabel(r)}</Chip>)}
      </div>
      {lg.description ? <div style={{ fontSize: T.body, color: C.text1, marginBottom: S.lg, lineHeight: 1.5 }}>{lg.description}</div> : null}

      <SectionLabel>{t(LC.competitions)}</SectionLabel>
      {lg.competitions.length ? lg.competitions.map((c) => (
        <LeagueLinkRow key={c.id} href={leagueUrl(lg.slug, { competitionSlug: c.slug, ...keyQ })} title={c.name}
          meta={[statusLabel(c.status), c.season, c.category, c.format].filter(Boolean).join(" · ")} />
      )) : <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LC.noCompetitions)}</div>}

      {lg.responsaveis.length ? (
        <div style={{ marginTop: S.lg }}>
          <SectionLabel>{t(LC.responsaveis)}</SectionLabel>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{lg.responsaveis.map((r) => `${r.name} (${roleLabel(r.role)})`).join(" · ")}</div>
        </div>
      ) : null}

      {manager ? (
        <LeagueStaffPanel leagues={leagues} league={lg} onChanged={load}
          onCompetitionCreated={(cs) => { window.location.href = leagueUrl(lg.slug, { competitionSlug: cs }); }} />
      ) : null}
    </LeagueCloudShell>
  );
}
