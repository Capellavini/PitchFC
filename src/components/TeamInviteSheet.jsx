import { useEffect, useState } from "react";
import { Copy, Check, MessageCircle, RefreshCw, Link2Off } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError, tf } from "../lib/rivalsCopy";
import { inviteDaysLeft } from "../lib/rivals";
import { openWhatsApp } from "../lib/whatsapp";
import Sheet from "./Sheet";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

/** The team's roster invite (leaders): one live link that expires in 14
 *  days. Copy / WhatsApp / new link (old one stops working) / disable.
 *  Joining through it always gives role "player" (server rule). */
export default function TeamInviteSheet({ teams, team, onClose }) {
  const [inv, setInv] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const fetchLink = async (rotate = false) => {
    setBusy(true); setError(null); setRevoked(false);
    const r = await teams.getInvite(team.id, { rotate });
    setBusy(false);
    if (r.error) setError(rivalsError(r.error)); else setInv(r.data);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLink(false); }, [team.id]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(inv.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const revoke = async () => {
    setBusy(true); setError(null);
    const r = await teams.revokeInvite(team.id);
    setBusy(false);
    if (r.error) setError(rivalsError(r.error)); else { setInv(null); setRevoked(true); }
  };

  const days = inv ? inviteDaysLeft(inv) : 0;
  return (
    <Sheet title={t(RC.inviteTitle)} onClose={onClose}>
      <p style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, margin: `0 0 ${S.md}px` }}>{t(RC.inviteBody)}</p>

      {revoked ? (
        <div role="status" style={{ fontSize: T.body, color: C.text1, marginBottom: S.md }}>{t(RC.linkRevoked)}</div>
      ) : (
        <div aria-live="polite" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.md}px`, marginBottom: S.sm, fontFamily: "monospace", fontSize: T.meta, color: C.text1, overflowWrap: "anywhere", minHeight: TOUCH.min, boxSizing: "border-box" }}>
          {busy && !inv ? t(RC.loadingLink) : inv?.url}
        </div>
      )}
      {inv && (
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>
          {days <= 1 ? t(RC.expiresTomorrow) : tf(RC.expiresIn, { n: days })}
          {inv.uses > 0 ? ` · ${tf(RC.usesLine, { n: inv.uses })}` : ""}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}

      {inv && (
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <BtnPrimary block onClick={() => openWhatsApp(tf(RC.inviteMessage, { team: team.name, url: inv.url }))}>
            <MessageCircle size={18} /> {t(RC.sendWhatsApp)}
          </BtnPrimary>
          <BtnGhost block onClick={copy}>{copied ? <Check size={16} color={C.green} /> : <Copy size={16} />} {copied ? t(RC.copied) : t(RC.copyLink)}</BtnGhost>
          <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0` }}>{t(RC.shareGroupHint)}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: S.sm, marginTop: S.lg, flexWrap: "wrap" }}>
        <BtnGhost onClick={() => fetchLink(true)} disabled={busy} style={{ flex: "1 1 140px" }} title={t(RC.newLinkHint)}>
          <RefreshCw size={16} /> {t(RC.newLink)}
        </BtnGhost>
        {inv && (
          <BtnGhost tone="danger" onClick={revoke} disabled={busy} style={{ flex: "1 1 140px" }}>
            <Link2Off size={16} /> {t(RC.revokeLink)}
          </BtnGhost>
        )}
      </div>
      <div style={{ fontSize: T.min, color: C.text2, marginTop: S.sm }}>{t(RC.newLinkHint)}</div>
    </Sheet>
  );
}
