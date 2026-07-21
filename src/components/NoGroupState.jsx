import { Users, Search } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";

/**
 * Shown on the Jogo/Grupo tabs when a logged-in player hasn't joined a
 * group yet. Keeps them in the app (profile, social, clube all work)
 * instead of forcing the invite-code wall.
 */
export default function NoGroupState({ onJoinGroup }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ ...cardStyle, textAlign: "center", padding: "32px 22px", marginTop: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Users size={26} color={C.accent} />
        </div>
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 8 }}>{t("Ainda sem grupo")}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 20 }}>
          {t("Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e ver o Clube e o Social.")}
        </div>
        <BtnPrimary onClick={onJoinGroup} style={{ width: "100%", fontSize: 14, padding: 13 }}>
          {t("Entrar num grupo")}
        </BtnPrimary>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, fontSize: 12, color: C.text3 }}>
          <Search size={13} /> {t("Procurar grupo perto de ti — em breve")}
        </div>
      </div>
    </div>
  );
}
