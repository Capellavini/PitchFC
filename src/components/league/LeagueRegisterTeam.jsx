import { useEffect, useState } from "react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError } from "../../lib/leagueCloudCopy";
import { tf } from "../../lib/leagueCopy";
import { DEFAULT_RULES } from "../../lib/leagueCloud";
import BtnPrimary from "../BtnPrimary";
import Chip from "../Chip";

/** ?inscricao=<token>: a captain/vice registers their EXISTING PITCH team
 *  (never re-created per season) and submits the squad snapshot that the
 *  organization then homologates. */
export default function LeagueRegisterTeam({ leagues, rivals, token }) {
  const [p, setP] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [reg, setReg] = useState(null);
  const [members, setMembers] = useState([]);
  const [pick, setPick] = useState({}); // playerId → { shirt }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);
  const leaderTeams = (rivals.myTeams || []).filter((tm) => tm.role === "captain" || tm.role === "vice");
  const { previewRegistrationLink } = leagues;
  const { fetchTeam } = rivals;

  useEffect(() => {
    let alive = true;
    previewRegistrationLink(token).then((r) => { if (alive) { if (r.error) setErr(leagueCloudError(r.error)); else setP(r.data); } });
    return () => { alive = false; };
  }, [previewRegistrationLink, token]);

  useEffect(() => {
    if (!reg) return undefined;
    let alive = true;
    fetchTeam(reg.teamId).then((r) => { if (alive && r.data) setMembers(r.data.members || []); });
    return () => { alive = false; };
  }, [fetchTeam, reg]);

  const register = async () => {
    setBusy(true); setErr(null);
    const r = await leagues.registerTeam(token, teamId);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error)); else setReg({ id: r.data.registrationId, teamId });
  };
  const rules = DEFAULT_RULES.squad;
  const chosen = Object.keys(pick);
  const submit = async () => {
    setBusy(true); setErr(null);
    const players = members.filter((m) => pick[m.playerId]).map((m) => ({
      playerId: m.playerId, name: m.nick || m.name, shirtNumber: pick[m.playerId].shirt ? Number(pick[m.playerId].shirt) : null, captain: m.role === "captain",
    }));
    const r = await leagues.submitSquad(reg.id, reg.teamId, players);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error)); else setDone(true);
  };

  return (
    <section style={{ ...cardStyle, padding: S.lg, marginBottom: S.lg, borderColor: C.accentBorder }}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t(LC.registerTitle)}</div>
      {p && p.status !== "valid" ? <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t(LC.linkInvalid)}</div> : null}
      {p && p.status === "valid" ? (
        <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0 ${S.md}px` }}>
          {tf(LC.registerIn, { comp: p.competition?.name || "—", league: p.league?.name || "—" })}
        </div>
      ) : null}
      {p && p.status === "valid" && !reg ? (
        leaderTeams.length ? (
          <>
            <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t(LC.pickTeam)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginBottom: S.md }}>
              {leaderTeams.map((tm) => (
                <Chip key={tm.id} variant={teamId === tm.id ? "lime" : "neutral"} onClick={() => setTeamId(tm.id)}>{tm.name}</Chip>
              ))}
            </div>
            <BtnPrimary block disabled={busy || !teamId} onClick={register}>{t(LC.register)}</BtnPrimary>
          </>
        ) : <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LC.noLeaderTeam)}</div>
      ) : null}
      {reg && !done ? (
        <>
          <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.md}px 0 ${S.sm}px` }}>{tf(LC.squadPick, { min: 1, max: rules.max })}</div>
          {members.map((m) => {
            const on = Boolean(pick[m.playerId]);
            return (
              <div key={m.playerId} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min }}>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: S.sm, cursor: "pointer", minHeight: TOUCH.min }}>
                  <input type="checkbox" checked={on} onChange={() => setPick((x) => {
                    const n = { ...x };
                    if (n[m.playerId]) delete n[m.playerId]; else n[m.playerId] = { shirt: "" };
                    return n;
                  })} />
                  <span style={{ fontSize: T.body }}>{m.nick || m.name}</span>
                </label>
                {on ? (
                  <input aria-label={t(LC.shirt)} placeholder={t(LC.shirt)} inputMode="numeric" value={pick[m.playerId].shirt}
                    onChange={(e) => setPick((x) => ({ ...x, [m.playerId]: { shirt: e.target.value.replace(/\D/g, "").slice(0, 2) } }))}
                    style={{ ...inputStyle(), width: 64 }} />
                ) : null}
              </div>
            );
          })}
          <BtnPrimary block disabled={busy || !chosen.length} onClick={submit} style={{ marginTop: S.md }}>{t(LC.submitSquad)}</BtnPrimary>
        </>
      ) : null}
      {done ? <div role="status" style={{ fontSize: T.body, color: C.green, marginTop: S.md }}>{t(LC.squadSent)}</div> : null}
      {err ? <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{err}</div> : null}
    </section>
  );
}
