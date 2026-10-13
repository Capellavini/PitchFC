import { Users, Search, Shield, ChevronRight } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import BtnPrimary from "./BtnPrimary";

/**
 * Shown on the Jogar / Matchday tabs when a logged-in player hasn't joined
 * a group yet. Non-blocking: keeps them in the app (profile, Home,
 * Competir all work) instead of forcing the invite-code wall. A player
 * who's in a PITCH Rivals team (`onOpenTeams`) also gets a link to where
 * their team's games live.
 */
export default function NoGroupState({ onJoinGroup, onOpenTeams }) {
  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      {onOpenTeams && (
        <button type="button" onClick={onOpenTeams}
          style={{ ...cardStyle, width: "100%", marginTop: S.xl, display: "flex", alignItems: "center", gap: S.md, minHeight: 56, cursor: "pointer", textAlign: "left", color: C.text1, borderLeft: `3px solid ${C.accent}` }}>
          <span style={{ width: 40, height: 40, borderRadius: R.control, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={20} color={C.accent} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700 }}>{t(RC.teamGamesInCompetir)}</span>
          <ChevronRight size={18} color={C.text2} />
        </button>
      )}
      <div style={{ ...cardStyle, textAlign: "center", padding: "32px 22px", marginTop: onOpenTeams ? S.md : S.xl }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Users size={26} color={C.accent} />
        </div>
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 8 }}>{t("Ainda sem grupo")}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 20 }}>
          {t("Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e acompanhar a atividade na Home.")}
        </div>
        <BtnPrimary onClick={onJoinGroup} style={{ width: "100%", fontSize: 14, padding: 13 }}>
          {t("Entrar num grupo")}
        </BtnPrimary>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, fontSize: 12, color: C.text2 }}>
          <Search size={13} /> {t("Procurar grupo perto de ti — em breve")}
        </div>
      </div>
    </div>
  );
}
