import { useState } from "react";
import { UserRound, ChevronDown } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnGhost from "./BtnGhost";

/** Slim full-width row under the three fronts: the "player alone" path. */
export default function LandingSoloRow({ onCreateId }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <div style={{ ...cardStyle, marginTop: S.lg, padding: S.xl, display: "flex", flexWrap: "wrap", alignItems: "center", gap: S.lg }}>
      <span style={{ width: 44, height: 44, borderRadius: R.control, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <UserRound size={20} color={C.accent} />
      </span>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>{t("Só queres jogar?")}</div>
        <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.6 }}>
          {t("Pede o link ao organizador do teu grupo e entras direto no plantel. Ainda não tens grupo? Cria o teu PITCH ID e avisamos-te quando houver jogos abertos na tua zona.")}
        </div>
        {inviteOpen && (
          <div id="lp-invite-help" style={{ marginTop: S.md, fontSize: T.body, color: C.text1, lineHeight: 1.6, borderLeft: `3px solid ${C.whatsapp}`, paddingLeft: S.md }}>
            {t("Abre o link que te enviaram no WhatsApp — entras logo no grupo ou na equipa certa.")}
          </div>
        )}
      </div>
      <div className="lp-solo-actions" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: S.sm, flex: "0 1 auto" }}>
        <BtnGhost tone="accent" onClick={onCreateId}>{t("Criar o meu PITCH ID")}</BtnGhost>
        <button type="button" aria-expanded={inviteOpen} aria-controls="lp-invite-help" onClick={() => setInviteOpen((o) => !o)}
          style={{ minHeight: TOUCH.min, background: "none", border: "none", color: C.text2, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: `0 ${S.sm}px` }}>
          {t("Recebi um convite")}
          <ChevronDown size={15} style={{ transform: inviteOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
      </div>
    </div>
  );
}
