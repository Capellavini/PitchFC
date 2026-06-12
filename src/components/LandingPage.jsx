import {
  Zap, Wallet, CalendarCheck, Trophy, Flame, IdCard,
  MapPin, Beer, Gamepad2, Users, PartyPopper, Clapperboard, ArrowRight,
} from "lucide-react";
import { C, cardStyle, displayFont, BRAND, fieldBackdrop } from "../theme";
import FutCard from "./FutCard";
import BtnPrimary from "./BtnPrimary";

// Demo card shown in the hero — sells the FUT-card feature without assets.
const DEMO_PLAYER = {
  name: "O Teu Nome", nick: "Tu", age: 27, nationality: "🇵🇹 Portugal",
  club: "FC Porto", position: "Avançado", foot: "Direito",
  attrs: { rit: 86, rem: 84, pas: 75, dri: 82, def: 48, fis: 78 },
};

const APP_FEATURES = [
  { Icon: Zap,           title: "Jogos organizados",  text: "Confirmações num toque, grelha de vagas em direto e lembretes automáticos. O jogo de sábado trata-se sozinho." },
  { Icon: Wallet,        title: "Finanças do grupo",  text: "A mensalidade do campo dividida por todos. Vês quem já pagou e cobras os atrasados pelo WhatsApp." },
  { Icon: CalendarCheck, title: "Reserva de campo",   text: "O teu horário semanal fica garantido no clube — reservas e renovações diretamente na app." },
  { Icon: IdCard,        title: "O teu cartão",       text: "Estilo FUT: overall, atributos, posição e foto. O teu jogo, em cartão." },
  { Icon: Trophy,        title: "Ratings e stats",    text: "Golos, assistências, votação MVP e fiabilidade. A época toda fica registada." },
  { Icon: Flame,         title: "Social",             text: "Partilha highlights, vota no Golo da Semana e convive com jogadores de outros grupos." },
];

const VENUE_FEATURES = [
  { Icon: MapPin,       title: "2 campos + campo 1v1", text: "Dois campos de 5 e uma arena 1v1 para resolver discussões à parte." },
  { Icon: Beer,         title: "Bar & esplanada",      text: "A terceira parte do jogo: aquela bebida depois do apito final." },
  { Icon: Gamepad2,     title: "Lounge",               text: "Videojogos e matraquilhos para os que ficam à espera do próximo jogo." },
  { Icon: Users,        title: "Clube social",         text: "Um espaço para a comunidade: convívio entre grupos, ligas internas." },
  { Icon: PartyPopper,  title: "Eventos",              text: "Torneios, aniversários e eventos de empresa com o futebol ao centro." },
  { Icon: Clapperboard, title: "Transmissão dos jogos", text: "Os teus jogos gravados e transmitidos — revê o golaço as vezes que quiseres." },
];

const Section = ({ children, style }) => (
  <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", ...style }}>{children}</div>
);

const SectionTitle = ({ eyebrow, title, sub }) => (
  <div style={{ textAlign: "center", marginBottom: 36 }}>
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.accent, marginBottom: 8 }}>{eyebrow}</div>
    <div style={{ ...displayFont, fontSize: "clamp(26px, 4vw, 38px)", color: C.text1 }}>{title}</div>
    {sub && <div style={{ fontSize: 15, color: C.text2, marginTop: 8, maxWidth: 560, margin: "8px auto 0" }}>{sub}</div>}
  </div>
);

const FeatureCard = ({ Icon, title, text, iconColor = C.accent, iconBg = C.accentDim, iconBorder = C.accentBorder }) => (
  <div style={{ ...cardStyle, padding: 20 }}>
    <div style={{ width: 42, height: 42, borderRadius: 12, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
      <Icon size={19} color={iconColor} />
    </div>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{text}</div>
  </div>
);

/** Public marketing page — the entry point before login/signup. */
export default function LandingPage({ onEnter }) {
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <img src={BRAND.logo} alt="PITCH Club" style={{ height: 26 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onEnter} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: C.text1, cursor: "pointer" }}>
              Entrar
            </button>
            <BtnPrimary onClick={onEnter} style={{ padding: "8px 16px", fontSize: 13 }}>Criar conta</BtnPrimary>
          </div>
        </Section>
      </div>

      {/* HERO */}
      <div style={{ ...fieldBackdrop(0.5, 0.96), borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 40, padding: "72px 20px" }}>
          <div style={{ flex: "1 1 340px" }}>
            <div style={{ ...displayFont, fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.05, marginBottom: 16 }}>
              O teu jogo semanal,<br />
              <span style={{ color: C.accent }}>organizado.</span>
            </div>
            <div style={{ fontSize: 16, color: C.text2, lineHeight: 1.6, marginBottom: 28, maxWidth: 460 }}>
              O PITCH junta tudo o que o teu grupo precisa: confirmações, contas do campo,
              sorteio de equipas, stats e o teu cartão de jogador. E em breve, um clube para chamar casa.
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <BtnPrimary onClick={onEnter} style={{ padding: "14px 26px", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                Criar conta grátis <ArrowRight size={17} />
              </BtnPrimary>
              <button onClick={onEnter} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, color: C.text1, cursor: "pointer" }}>
                Já tenho conta
              </button>
            </div>
          </div>
          <div style={{ flex: "0 1 auto", margin: "0 auto", transform: "rotate(3deg)" }}>
            <FutCard player={DEMO_PLAYER} width={250} />
          </div>
        </Section>
      </div>

      {/* APP */}
      <Section style={{ padding: "72px 20px" }}>
        <SectionTitle
          eyebrow="A APP"
          title="Tudo o que o grupo precisa, numa app"
          sub="Do «quem joga sábado?» ao golo da semana — sem stress para o organizador, sem desculpas para os atrasados."
        />
        <div style={grid}>
          {APP_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
        </div>
      </Section>

      {/* VENUE */}
      <div style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ padding: "72px 20px" }}>
          <SectionTitle
            eyebrow="EM BREVE · MATOSINHOS / PORTO"
            title="O Clube"
            sub="Mais do que campos alugados: um espaço pensado para quem vive o futebol — antes, durante e depois do jogo."
          />
          <div style={grid}>
            {VENUE_FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} iconColor={C.blue} iconBg={C.blueDim} iconBorder={C.blueBorder} />
            ))}
          </div>
        </Section>
      </div>

      {/* FINAL CTA */}
      <div style={{ ...fieldBackdrop(0.6, 0.92) }}>
        <Section style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ ...displayFont, fontSize: "clamp(28px, 4.5vw, 42px)", marginBottom: 10 }}>
            Pronto para o próximo jogo?
          </div>
          <div style={{ fontSize: 15, color: C.text2, marginBottom: 28 }}>
            Cria a tua conta, monta o teu cartão e entra em campo.
          </div>
          <BtnPrimary onClick={onEnter} style={{ padding: "15px 32px", fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Criar conta na app <ArrowRight size={18} />
          </BtnPrimary>
        </Section>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 20px" }}>
          <img src={BRAND.logo} alt="PITCH Club" style={{ height: 20, opacity: 0.7 }} />
          <div style={{ fontSize: 12, color: C.text3 }}>
            PITCH Club · Matosinhos — Porto · versão beta
          </div>
        </Section>
      </div>
    </div>
  );
}
