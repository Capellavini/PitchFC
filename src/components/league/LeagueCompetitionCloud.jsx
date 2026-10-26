import { useCallback, useEffect, useMemo, useState } from "react";
import { C, S, T, TEAM_COLORS, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError, statusLabel } from "../../lib/leagueCloudCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { tf } from "../../lib/leagueCopy";
import { isLeagueManagerRole, leagueUrl } from "../../lib/leagueCloud";
import { buildDirectory, ensureTeams } from "../../lib/leagueMatches";
import { formatProfile, formatSummary } from "../../lib/leagueFormat";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import SegmentedControl from "../SegmentedControl";
import LeagueCloudShell from "./LeagueCloudShell";
import LeagueShareLink from "./LeagueShareLink";
import LeagueRegistrationsReview from "./LeagueRegistrationsReview";
import LeagueCloudMatches from "./LeagueCloudMatches";
import LeagueCloudMatchPage from "./LeagueCloudMatchPage";
import LeagueCloudTable from "./LeagueCloudTable";
import LeagueCloudDiscipline from "./LeagueCloudDiscipline";
import LeagueCloudPending from "./LeagueCloudPending";

const readParam = (k) => { try { return new URLSearchParams(window.location.search).get(k); } catch { return null; } };
const writeParams = (patch) => {
  try {
    const u = new URL(window.location.href);
    Object.entries(patch).forEach(([k, v]) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k)));
    window.history.pushState(null, "", u.pathname + u.search + u.hash);
  } catch { /* ignore */ }
};

/** /league/<slug>/<competition> — the real competition: Jogos (calendar +
 *  match page with the live ficha de jogo), Classificação (official vs
 *  provisional + rankings), Disciplina, Equipas (regulation, squads, fans'
 *  "Apoiar") and — staff only — Gestão (registrations, link, regulation,
 *  pending list). ?jogo=<id> opens a match; ?tab=<id> a tab. Every action
 *  is permission-aware in the UI; the RPCs re-check everything. */
export default function LeagueCompetitionCloud({ leagues, slug, competitionSlug, viewKey, contextOptions = [] }) {
  const [c, setC] = useState(undefined);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [leagueRoles, setLeagueRoles] = useState([]);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);
  const [tab, setTabState] = useState(() => readParam("tab") || (typeof window !== "undefined" && window.location.hash === "#inscricoes" ? "gestao" : "jogos"));
  const [matchId, setMatchIdState] = useState(() => readParam("jogo"));
  const [rev, setRev] = useState(0);
  const { fetchCompetition, fetchCompetitionTeams, fetchMatches, fetchMatchesStaff, fetchLeague } = leagues;

  const load = useCallback(async () => {
    const r = await fetchCompetition(slug, competitionSlug, viewKey);
    if (r.error) { setErr(leagueCloudError(r.error)); setC(null); return; }
    if (!r.data) { setC(null); return; }
    const [tq, lq] = await Promise.all([fetchCompetitionTeams(r.data.id, viewKey), fetchLeague(slug, viewKey)]);
    // league_id comes from competition_page; league_page only for my league roles.
    setC({ ...r.data, leagueId: r.data.leagueId ?? lq.data?.id ?? null });
    setTeams(tq.data || []);
    setLeagueRoles(lq.data?.myRoles || []);
    // Staff get seq + officials; everyone else the public calendar. A staff
    // read that isn't deployed yet falls back to the public one.
    let mq = r.data.isStaff ? await fetchMatchesStaff(r.data.id) : null;
    if (!mq || mq.error) mq = await fetchMatches(r.data.id, viewKey);
    setMatches(mq.data || []);
    setRev((n) => n + 1);
  }, [fetchCompetition, fetchCompetitionTeams, fetchMatches, fetchMatchesStaff, fetchLeague, slug, competitionSlug, viewKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onPop = () => { setMatchIdState(readParam("jogo")); setTabState(readParam("tab") || "jogos"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const dir = useMemo(() => ensureTeams(buildDirectory(teams, TEAM_COLORS), matches.flatMap((m) => [m.home, m.away])), [teams, matches]);
  const isManager = isLeagueManagerRole(leagueRoles);
  const ui = useMemo(() => ({
    ok: (msg) => { setErr(null); setNotice(msg); },
    fail: (code) => { setNotice(null); setErr(leagueCloudError(code)); },
    clear: () => { setErr(null); setNotice(null); },
  }), []);

  const back = leagueUrl(slug, viewKey ? { key: viewKey } : {});
  if (c === undefined) return <LeagueCloudShell title="…" backHref={back} />;
  if (!c) return <LeagueCloudShell title={t(LC.notFound)} backHref={back} error={err} />;

  const profile = formatProfile(c.format, c.modality, c.matchDurationMin);
  const setTab = (id) => { setTabState(id); writeParams({ tab: id === "jogos" ? null : id, jogo: null }); setMatchIdState(null); ui.clear(); };
  const openMatch = (id) => { setMatchIdState(id); writeParams({ jogo: id }); ui.clear(); try { window.scrollTo(0, 0); } catch { /* jsdom */ } };
  const closeMatch = () => { setMatchIdState(null); writeParams({ jogo: null }); ui.clear(); load(); };

  if (matchId) {
    return (
      <LeagueCloudShell contextOptions={contextOptions} title={c.name} backHref={back} error={err} notice={notice} subtitle={[c.league?.name, formatSummary(profile), c.category].filter(Boolean).join(" · ")}>
        <LeagueCloudMatchPage key={matchId} leagues={leagues} competition={c} dir={dir} profile={profile} matchId={matchId} viewKey={viewKey}
          isManager={isManager} ui={ui} onBack={closeMatch} onChanged={load} />
      </LeagueCloudShell>
    );
  }

  const run = async (fn) => {
    setBusy(true); ui.clear();
    const r = await fn();
    setBusy(false);
    if (r?.error) ui.fail(r.error); else await load();
    return r;
  };
  const rules = c.regulation.rules;
  const supported = leagues.supportedTeamOf(c.id);
  const following = leagues.isFollowing("competition", c.id);
  const tabs = [
    { id: "jogos", label: LM.tabMatches }, { id: "tabela", label: LM.tabTable }, { id: "disciplina", label: LM.tabDiscipline },
    { id: "equipas", label: LM.tabTeams }, c.isStaff && { id: "gestao", label: LM.tabManage },
  ].filter(Boolean).map((x) => ({ ...x, label: t(x.label) }));
  const current = tabs.some((x) => x.id === tab) ? tab : "jogos";

  return (
    <LeagueCloudShell title={c.name} backHref={back} error={err} notice={notice}
      subtitle={[c.league?.name, c.season, c.category, formatSummary(profile)].filter(Boolean).join(" · ")}
      right={leagues.signedIn && !c.isStaff ? <BtnGhost compact tone={following ? "neutral" : "accent"}
        onClick={() => run(() => leagues.follow("competition", c.id, !following))}>{t(following ? LC.unfollow : LC.follow)}</BtnGhost> : null}>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
        <Chip variant={c.status === "registration_open" ? "lime" : "neutral"}>{statusLabel(c.status)}</Chip>
        {profile.rollingSubs ? <Chip>{t("Substituições livres")}</Chip> : null}
      </div>
      <SegmentedControl options={tabs} value={current} onChange={setTab} />

      {current === "jogos" && (
        <LeagueCloudMatches leagues={leagues} competition={c} dir={dir} matches={matches} isManager={isManager} ui={ui}
          supportedTeamId={supported} onOpen={openMatch} onChanged={load} />
      )}
      {current === "tabela" && <LeagueCloudTable key={rev} leagues={leagues} competition={c} dir={dir} matches={matches} isManager={isManager} viewKey={viewKey} ui={ui} followId={supported} />}
      {current === "disciplina" && <LeagueCloudDiscipline key={rev} leagues={leagues} competition={c} dir={dir} isManager={isManager} viewKey={viewKey} ui={ui} />}

      {current === "equipas" && (
        <>
          <SectionLabel>{t(LC.regulation)}</SectionLabel>
          <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg, lineHeight: 1.5 }}>
            {rules ? tf(LC.regulationSummary, { v: c.regulation.version, w: rules.points?.win, d: rules.points?.draw, l: rules.points?.loss,
              min: rules.squad?.min, max: rules.squad?.max }) : c.draftVersion ? tf(LC.regulationDraft, { v: c.draftVersion }) : "—"}
            {rules ? <div>{tf(t("{fmt} · {n} em campo (GR incluído)"), { fmt: formatSummary(profile), n: profile.onField })}{profile.rollingSubs ? ` · ${t("substituições livres")}` : ""}</div> : null}
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
        </>
      )}

      {current === "gestao" && c.isStaff && (
        <>
          <LeagueCloudPending key={rev} leagues={leagues} competition={c} matches={matches} dir={dir} ui={ui} onOpen={openMatch} onChanged={load} />
          {isManager ? (
            <section style={{ ...cardStyle, padding: S.lg, marginTop: S.lg }}>
              <SectionLabel>{t(LC.manage)}</SectionLabel>
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                {c.draftVersion ? <BtnPrimary disabled={busy} onClick={() => { const reason = c.draftVersion > 1 ? (window.prompt(t("Motivo da nova versão do regulamento (obrigatório)")) || "").trim() : null; if (c.draftVersion > 1 && !reason) return; run(() => leagues.publishRegulation(c.id, c.draftVersion, reason)); }}>{t(LC.publish)}</BtnPrimary> : null}
                {["draft", "registration_closed"].includes(c.status) && c.regulation.version
                  ? <BtnGhost tone="accent" disabled={busy} onClick={() => run(() => leagues.setCompetitionStatus(c.id, "registration_open"))}>{t(LC.openRegs)}</BtnGhost> : null}
                {c.status === "registration_open"
                  ? <BtnGhost disabled={busy} onClick={() => run(() => leagues.setCompetitionStatus(c.id, "registration_closed"))}>{t(LC.closeRegs)}</BtnGhost> : null}
                {c.status === "registration_closed"
                  ? <BtnGhost disabled={busy} onClick={() => run(() => leagues.setCompetitionStatus(c.id, "in_progress"))}>{t("Iniciar competição")}</BtnGhost> : null}
              </div>
              {c.status === "registration_open" ? (
                <div style={{ marginTop: S.lg }}>
                  <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.sm }}>{t(LC.regLink)}</div>
                  <BtnGhost disabled={busy} onClick={async () => { const r = await leagues.createRegistrationLink(c.id); if (r.error) ui.fail(r.error); else setLink(r.data); }}>{t(LC.createLink)}</BtnGhost>
                  {link ? <LeagueShareLink url={link.url} message={`${c.league?.name || ""} · ${c.name}`} /> : null}
                </div>
              ) : null}
              <div id="inscricoes" style={{ scrollMarginTop: 20 }}>
                <LeagueRegistrationsReview leagues={leagues} competitionId={c.id} onDecided={load} />
              </div>
            </section>
          ) : null}
        </>
      )}

    </LeagueCloudShell>
  );
}
