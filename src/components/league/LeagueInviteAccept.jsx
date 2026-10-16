import { useEffect, useState } from "react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LC, leagueCloudError, roleLabel } from "../../lib/leagueCloudCopy";
import { tf } from "../../lib/leagueCopy";
import BtnPrimary from "../BtnPrimary";

/** ?convite=<token>: the invite says destination + role BEFORE accepting (never grants owner). */
export default function LeagueInviteAccept({ leagues, token, onAccepted }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const { previewInvite } = leagues;
  useEffect(() => {
    let alive = true;
    previewInvite(token).then((r) => { if (alive) { if (r.error) setErr(leagueCloudError(r.error)); else setP(r.data); } });
    return () => { alive = false; };
  }, [previewInvite, token]);
  const accept = async () => {
    setBusy(true); setErr(null);
    const r = await leagues.acceptInvite(token);
    setBusy(false);
    if (r.error) setErr(leagueCloudError(r.error)); else onAccepted?.(r.data.slug || p?.league?.slug);
  };
  return (
    <section style={{ ...cardStyle, padding: S.lg, marginBottom: S.lg, borderColor: C.accentBorder }}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t(LC.inviteTitle)}</div>
      {p && p.status === "valid" ? (
        <>
          <div style={{ fontSize: T.body, color: C.text1, margin: `${S.sm}px 0 ${S.md}px` }}>
            {tf(LC.inviteAs, { league: p.league?.name || "—", role: roleLabel(p.role) })}
          </div>
          <BtnPrimary block disabled={busy || !leagues.signedIn} onClick={accept}>{t(LC.accept)}</BtnPrimary>
        </>
      ) : p ? <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t(LC.inviteInvalid)}</div> : null}
      {err ? <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{err}</div> : null}
    </section>
  );
}
