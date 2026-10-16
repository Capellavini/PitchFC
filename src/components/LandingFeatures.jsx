import { Radio, IdCard, Trophy, Crown, Video } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";
import FutCard from "./FutCard";
import LandingSection from "./LandingSection";

// Invented legend player to sell the FUT-card feature (OVR >= 86 = LENDA).
const DEMO_PLAYER = {
  name: "Leo", nick: "Leo", age: 26, nationality: "🇵🇹 Portugal",
  club: "FC Porto", position: "Avançado", foot: "Esquerdo",
  photo: "/brand/demo-player.jpg",
  attrs: { rit: 92, rem: 93, pas: 85, dri: 91, def: 55, fis: 84 },
};

const ITEMS = [
  { Icon: Radio, title: "Matchday ao vivo", text: "Golos, assistências e defesas registados jogo a jogo, com a classificação da noite." },
  { Icon: IdCard, title: "Cartão de jogador", text: "Posição, atributos e overall avaliados pela malta. O teu PITCH ID." },
  { Icon: Trophy, title: "Rankings e MVP", text: "Rankings da época, MVP votado e pódio da semana." },
  { Icon: Crown, title: "Fantasy do grupo", text: "Monta o teu plantel com a malta do grupo e soma pontos com o que acontece em campo." },
  { Icon: Video, title: "Pitch VAR", text: "Filma com o telemóvel e guarda o lance de cada golo. Opcional, ligado pelo organizador." },
];

/** "Mais do que marcar jogos" — FUT card + the five retention features. */
export default function LandingFeatures() {
  return (
    <LandingSection title={t("Mais do que marcar jogos.")} sub={t("Do cartão ao Fantasy, há sempre um motivo para voltar depois do apito final.")}>
      <div className="lp-feat">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ transform: "rotate(-3deg)" }}>
            <FutCard player={DEMO_PLAYER} width={220} />
          </div>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: S.sm }}>
          {ITEMS.map(({ Icon, title, text }) => (
            <li key={title} style={{ display: "flex", gap: S.md, alignItems: "flex-start", padding: `${S.md}px 0`, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ width: 36, height: 36, borderRadius: R.control, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={C.accent} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{t(title)}</div>
                <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.55 }}>{t(text)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LandingSection>
  );
}
