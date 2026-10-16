import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { C, R, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { LC } from "../../lib/leagueCloudCopy";
import { openWhatsApp } from "../../lib/whatsapp";
import BtnGhost from "../BtnGhost";

/** A generated link (collaborator invite / registration link): shown, copyable, sendable by WhatsApp. */
export default function LeagueShareLink({ url, message }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <div style={{ marginTop: S.sm }}>
      <div style={{ fontSize: T.meta, color: C.text1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control,
        padding: `${S.sm}px ${S.md}px`, wordBreak: "break-all" }}>{url}</div>
      <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
        <BtnGhost onClick={copy}><Copy size={16} />{t(copied ? LC.copied : LC.copy)}</BtnGhost>
        <BtnGhost onClick={() => openWhatsApp(`${message ? `${message}\n` : ""}${url}`)} style={{ color: C.whatsapp, borderColor: C.whatsapp }}>
          <MessageCircle size={16} />{t(LC.share)}
        </BtnGhost>
      </div>
    </div>
  );
}
