import { useCallback, useEffect, useState } from "react";
import { C, S, T, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError } from "../../lib/leagueCloudCopy";
import { tf } from "../../lib/leagueCopy";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import SectionLabel from "../SectionLabel";

const REG_VARIANT = { homologated: "green", submitted: "orange", rejected: "red", withdrawn: "neutral", draft: "neutral" };

/** Inscrições (competition managers): every registration with its squad
 *  versions; approve / reject the open (submitted) version. Approving
 *  freezes the snapshot — later roster changes never touch it. */
export default function LeagueRegistrationsReview({ leagues, competitionId, onDecided }) {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const { fetchRegistrations } = leagues;
  const load = useCallback(async () => {
    const r = await fetchRegistrations(competitionId);
    if (r.error) setErr(leagueCloudError(r.error)); else setData(r.data);
  }, [fetchRegistrations, competitionId]);
  useEffect(() => { load(); }, [load]);

  const decide = async (reg, version, decision) => {
    setBusy(true); setErr(null);
    const r = await leagues.decideSquad(reg.id, version, decision, notes[reg.id] || null);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error)); else { await load(); onDecided?.(); }
  };

  return (
    <section style={{ marginTop: S.lg }}>
      <SectionLabel>{t(LC.registrations)}</SectionLabel>
      {err ? <div role="alert" style={{ fontSize: T.meta, color: C.red, marginBottom: S.sm }}>{err}</div> : null}
      {data && !data.items.length ? <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LC.noRegistrations)}</div> : null}
      {(data?.items || []).map((reg) => {
        const open = reg.versions.find((v) => v.status === "submitted");
        const shown = open || reg.versions.find((v) => v.version === reg.homologatedVersion) || reg.versions[0];
        return (
          <div key={reg.id} style={{ ...cardStyle, padding: S.md, marginBottom: S.sm }}>
            <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
              <span style={{ flex: 1, fontSize: T.body, fontWeight: 800 }}>{reg.teamName}</span>
              <Chip variant={REG_VARIANT[reg.status] || "neutral"}>{t(LC[`reg_${reg.status}`] || reg.status)}</Chip>
            </div>
            {shown ? (
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.xs, lineHeight: 1.6 }}>
                {tf(LC.squadV, { v: shown.version })} · {t(LC[`ver_${shown.status}`] || shown.status)}
                <br />{shown.players.map((p) => `${p.shirtNumber != null ? `${p.shirtNumber} · ` : ""}${p.name}`).join(", ")}
              </div>
            ) : null}
            {open && data.isManager ? (
              <>
                <input placeholder={t(LC.rejectNote)} value={notes[reg.id] || ""} maxLength={500}
                  onChange={(e) => setNotes({ ...notes, [reg.id]: e.target.value })} style={{ ...inputStyle(), marginTop: S.sm }} />
                <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
                  <BtnPrimary disabled={busy} onClick={() => decide(reg, open.version, "approve")}>{t(LC.approve)}</BtnPrimary>
                  <BtnGhost tone="danger" disabled={busy} onClick={() => decide(reg, open.version, "reject")}>{t(LC.reject)}</BtnGhost>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
