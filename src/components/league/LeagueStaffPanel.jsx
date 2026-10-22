import { useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError, roleLabel } from "../../lib/leagueCloudCopy";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";
import LeagueShareLink from "./LeagueShareLink";
import { FORMAT_PRESETS } from "../../lib/leagueFormat";

/** "Gerir liga" on /league/<slug> (owner/manager): visibility + activation
 *  (owner only), collaborator invites (owner → manager; managers → scorer /
 *  referee) and a new competition with the default regulation as v1 draft. */
export default function LeagueStaffPanel({ leagues, league, onChanged, onCompetitionCreated }) {
  const isOwner = league.myRoles.includes("owner");
  const [role, setRole] = useState(isOwner ? "manager" : "scorer");
  const [invite, setInvite] = useState(null);
  const [c, setC] = useState({ name: "", season: "2026/27", category: "Sénior", youth: false, preset: "futsal", squadMax: "14" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async (fn) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (r?.error) setErr(leagueCloudError(r.error));
    return r;
  };
  const setVisibility = (visibility) => run(async () => {
    const r = await leagues.updateLeague(league.id, { visibility });
    if (!r.error && league.status === "draft" && visibility === "public") await leagues.setLeagueStatus(league.id, "active");
    if (!r.error) onChanged?.();
    return r;
  });
  const makeInvite = () => run(async () => {
    const r = await leagues.inviteCollaborator(league.id, role);
    if (!r.error) setInvite(r.data);
    return r;
  });
  const createComp = () => run(async () => {
    const max = Math.max(1, Math.min(60, Number(c.squadMax) || 25));
    const p = FORMAT_PRESETS.find((x) => x.id === c.preset) || FORMAT_PRESETS[0];
    const r = await leagues.createCompetition(league.id, { ...c, format: p.format, modality: p.modality, matchDurationMin: p.durationMin }, { squad: { min: 1, max } });
    if (!r.error) onCompetitionCreated?.(r.data.slug);
    return r;
  });
  const roles = isOwner ? ["manager", "scorer", "referee"] : ["scorer", "referee"];
  const label = (txt) => <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{t(txt)}</span>;

  return (
    <section style={{ ...cardStyle, padding: S.lg, marginTop: S.lg }}>
      <SectionLabel>{t(LC.manage)}</SectionLabel>
      {isOwner ? (
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
          {league.visibility !== "public"
            ? <BtnGhost tone="accent" disabled={busy} onClick={() => setVisibility("public")}>{t(LC.makePublic)}</BtnGhost>
            : <BtnGhost disabled={busy} onClick={() => setVisibility("private")}>{t(LC.makePrivate)}</BtnGhost>}
        </div>
      ) : null}

      <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.sm }}>{t(LC.inviteCollab)}</div>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
        {roles.map((r) => <Chip key={r} variant={role === r ? "lime" : "neutral"} onClick={() => { setRole(r); setInvite(null); }}>{roleLabel(r)}</Chip>)}
      </div>
      <BtnGhost disabled={busy} onClick={makeInvite}>{t(LC.createInvite)}</BtnGhost>
      {invite ? <LeagueShareLink url={invite.url} message={`${league.name} · ${roleLabel(invite.role)}`} /> : null}

      <div style={{ fontSize: T.body, fontWeight: 800, margin: `${S.xl}px 0 ${S.sm}px` }}>{t(LC.newCompetition)}</div>
      <label style={{ display: "block", marginBottom: S.sm }}>{label(LC.compName)}
        <input value={c.name} maxLength={60} onChange={(e) => setC({ ...c, name: e.target.value })} style={inputStyle()} /></label>
      <div style={{ display: "flex", gap: S.sm }}>
        <label style={{ flex: 1 }}>{label(LC.season)}<input value={c.season} maxLength={20} onChange={(e) => setC({ ...c, season: e.target.value })} style={inputStyle()} /></label>
        <label style={{ flex: 1 }}>{label(LC.category)}<input value={c.category} maxLength={30} onChange={(e) => setC({ ...c, category: e.target.value })} style={inputStyle()} /></label>
      </div>
      <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
        <label style={{ flex: 1 }}>{label(LC.format)}
          <select value={c.preset} onChange={(e) => setC({ ...c, preset: e.target.value })} style={inputStyle()}>
            {FORMAT_PRESETS.map((p) => <option key={p.id} value={p.id}>{t(p.label)} · {p.durationMin} min</option>)}
          </select></label>
        <label style={{ flex: 1 }}>{label(LC.squadMax)}
          <input value={c.squadMax} inputMode="numeric" onChange={(e) => setC({ ...c, squadMax: e.target.value.replace(/\D/g, "").slice(0, 2) })} style={inputStyle()} /></label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44, fontSize: T.meta, color: C.text2 }}>
        <input type="checkbox" checked={c.youth} onChange={(e) => setC({ ...c, youth: e.target.checked })} />{t(LC.youth)}
      </label>
      <BtnPrimary block disabled={busy || c.name.trim().length < 2} onClick={createComp}>{t(LC.create)}</BtnPrimary>
      {err ? <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{err}</div> : null}
    </section>
  );
}
