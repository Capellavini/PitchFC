import { useCallback, useEffect, useState } from "react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError } from "../../lib/leagueCloudCopy";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import SectionLabel from "../SectionLabel";

/** App admin only: pending pilot requests with the requester's contact → approve / reject. */
export default function LeagueAdminRequests({ leagues }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const { listAccessRequests, isAdmin, revision } = leagues;
  const load = useCallback(async () => {
    if (!isAdmin) return;
    const r = await listAccessRequests("pending");
    if (r.error) setErr(leagueCloudError(r.error)); else setItems(r.data);
  }, [listAccessRequests, isAdmin]);
  useEffect(() => { load(); }, [load, revision]);
  if (!isAdmin) return null;

  const decide = async (id, decision) => {
    setErr(null);
    const r = await leagues.reviewRequest(id, decision);
    if (r.error) setErr(leagueCloudError(r.error)); else load();
  };
  return (
    <section style={{ marginBottom: S.lg }}>
      <SectionLabel>{t(LC.adminTitle)}</SectionLabel>
      {err ? <div role="alert" style={{ fontSize: T.meta, color: C.red }}>{err}</div> : null}
      {items && !items.length ? <div style={{ fontSize: T.meta, color: C.text2 }}>{t(LC.adminEmpty)}</div> : null}
      {(items || []).map((r) => (
        <div key={r.id} style={{ ...cardStyle, padding: S.md, marginBottom: S.sm }}>
          <div style={{ fontSize: T.body, fontWeight: 800 }}>{r.orgName}</div>
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
            {[r.city, r.country, r.expectedTeams ? `${r.expectedTeams} eq.` : null].filter(Boolean).join(" · ")}
            <br />{[r.requesterName, r.requesterEmail, r.requesterPhone].filter(Boolean).join(" · ")}
            {r.context ? <><br />{r.context}</> : null}
          </div>
          <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
            <BtnPrimary onClick={() => decide(r.id, "approve")}>{t(LC.approve)}</BtnPrimary>
            <BtnGhost tone="danger" onClick={() => decide(r.id, "reject")}>{t(LC.reject)}</BtnGhost>
          </div>
        </div>
      ))}
    </section>
  );
}
