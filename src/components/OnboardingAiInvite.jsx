import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { OA } from "../lib/onboardingAiCopy";
import { openWhatsApp } from "../lib/whatsapp";
import BtnPrimary from "./BtnPrimary";
import KeepyUppyLoader from "./KeepyUppyLoader";

/** Last step of the guided onboarding: the group + first game exist —
 *  copy the invite link, share the ready-made message on WhatsApp, or go
 *  to the game. Nothing is ever sent automatically. */
export default function OnboardingAiInvite({ link, message, onGoToGame }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = link; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: `${S.xl}px ${S.lg}px ${S.xxl}px`, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: S.sm }}><KeepyUppyLoader size={84} /></div>
      <div style={{ ...displayFont, fontSize: T.title, textAlign: "center" }}>{t(OA.inviteTitle)}</div>
      <div style={{ fontSize: T.body, color: C.text2, textAlign: "center", margin: `${S.xs}px 0 ${S.xl}px` }}>{t(OA.inviteSub)}</div>

      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{t(OA.inviteLink)}</div>
        <div style={{ display: "flex", gap: S.sm, alignItems: "center", marginBottom: S.lg }}>
          <div style={{ flex: 1, minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px`, minHeight: TOUCH.min, display: "flex", alignItems: "center", fontSize: T.meta, color: C.text1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{link}</span>
          </div>
          <button type="button" onClick={copy}
            style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, flexShrink: 0, borderRadius: R.control, border: `1px solid ${copied ? C.greenBorder : C.border}`, background: copied ? C.greenDim : C.surface, color: copied ? C.green : C.text1, fontWeight: 700, fontSize: T.meta, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: S.xs, fontFamily: "inherit" }}>
            {!copied && <Copy size={15} />}{copied ? t(OA.copied) : t(OA.copy)}
          </button>
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{t(OA.message)}</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md, fontSize: T.meta, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginBottom: S.md }}>{message}</div>
        <button type="button" onClick={() => openWhatsApp(message)}
          style={{ width: "100%", minHeight: TOUCH.button, borderRadius: R.control, border: "none", background: C.whatsapp, color: C.waInk, fontWeight: 800, fontSize: T.body, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm, fontFamily: "inherit" }}>
          <MessageCircle size={18} />{t(OA.shareWa)}
        </button>
      </div>

      <BtnPrimary block onClick={onGoToGame}>{t(OA.goToGame)}</BtnPrimary>
    </div>
  );
}
