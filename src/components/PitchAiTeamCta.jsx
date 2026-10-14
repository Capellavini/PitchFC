import { MessageCircle } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t, getLang } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import { captainHelpUrl } from "../lib/core/captainPhrase";
import { trackEvent } from "../lib/analytics";

/**
 * "🤖 O Pitch AI ajuda-te a montar a equipa" (decision 2026-10-13 b).
 * Opens WhatsApp with the PITCH bot and a prefilled captain message in
 * the app language; the bot recognises it (same core/captainPhrase.js)
 * and replies with the invite link + a short onboarding guide. The bot
 * never writes first — this link is the only way the chat starts.
 * Shown to captain/vice while the squad has < 5 players. `compact` = the
 * one-line version used inside the invite sheet.
 */
export default function PitchAiTeamCta({ team, compact = false }) {
  if (!team?.name) return null;
  const href = captainHelpUrl(team.name, getLang());
  const onClick = () => trackEvent("rivals_pitch_ai_clicked", { where: compact ? "invite_sheet" : "team_page" });
  const link = {
    minHeight: TOUCH.button, display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm,
    borderRadius: R.control, fontSize: T.body + 1, fontWeight: 800, textDecoration: "none",
  };
  if (compact) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
        style={{ ...link, background: "transparent", color: C.text1, border: `1px solid ${C.border}`, padding: `0 ${S.md}px` }}>
        {t(RC.pitchAiCta)}
      </a>
    );
  }
  return (
    <div style={{ ...cardStyle, marginBottom: S.lg, borderLeft: `3px solid ${C.whatsapp}` }}>
      <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>{t(RC.pitchAiCta)}</div>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>{t(RC.pitchAiBody)}</div>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
        style={{ ...link, background: C.whatsapp, color: C.bg, border: "none" }}>
        <MessageCircle size={18} aria-hidden /> {t(RC.pitchAiOpen)}
      </a>
    </div>
  );
}
