import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC } from "../lib/rivalsCopy";
import { openWhatsApp } from "../lib/whatsapp";
import BtnGhost from "./BtnGhost";

/** Share a ?desafio= link: WhatsApp (wa.me, brand green — WhatsApp actions
 *  always use #25D366) + copy. No message is ever sent automatically. */
export default function ChallengeShareActions({ url, message }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* blocked */ }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md, fontFamily: "monospace", fontSize: T.meta, color: C.text1, overflowWrap: "anywhere" }}>{url}</div>
      <button type="button" onClick={() => openWhatsApp(message)} style={{
        minHeight: TOUCH.button, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm,
        background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, fontSize: T.body, fontWeight: 800, cursor: "pointer",
      }}>
        <MessageCircle size={18} aria-hidden /> {t(CC.notifyWhatsApp)}
      </button>
      <BtnGhost block onClick={copy}>
        {copied ? <Check size={16} color={C.green} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span aria-live="polite">{copied ? t(RC.copied) : t(RC.copyLink)}</span>
      </BtnGhost>
    </div>
  );
}
