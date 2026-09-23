import { useState } from "react";
import {
  Zap, Wallet, CalendarCheck, Trophy, IdCard, ArrowRight, Bot, BarChart3, Crown,
} from "lucide-react";
import { C, cardStyle, displayFont, BRAND, fieldBackdrop } from "../theme";
import { t } from "../lib/i18n";
import FutCard from "./FutCard";
import BtnPrimary from "./BtnPrimary";

// Demo card shown in the hero — invented legend player to sell the
// FUT-card feature (overall >= 86 triggers the "LENDA" tier).
const DEMO_PLAYER = {
  name: "Leo", nick: "Leo", age: 26, nationality: "🇵🇹 Portugal",
  club: "FC Porto", position: "Avançado", foot: "Esquerdo",
  photo: "/brand/demo-player.jpg",
  attrs: { rit: 92, rem: 93, pas: 85, dri: 91, def: 55, fis: 84 },
};

const Section = ({ children, style }) => (
  <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 20px", ...style }}>{children}</div>
);

// ── Mini product mockups — illustrative, built from the app's own design
// tokens (never raster screenshots), so they can't drift out of sync with
// a palette change and stay true to what the UI actually looks like. Copy
// inside them is left in PT-PT on purpose, like a real screenshot would be.
const MOCK_W = 296;

function SlotGridMock() {
  const players = [
    { ini: "CS", color: C.accent }, { ini: "JF", color: C.blue }, { ini: "MS", color: C.orange },
    { ini: "RO", color: C.green }, { ini: "DC", color: "#A78BFA" }, { ini: "AL", color: C.orange },
    { ini: "PN", color: C.green }, { ini: "TM", color: C.blue },
  ];
  return (
    <div style={{ ...cardStyle, width: MOCK_W, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ ...displayFont, fontSize: 30 }}>8<span style={{ fontSize: 15, color: C.text2, fontWeight: 600, fontStyle: "normal" }}>/10</span></div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.orange }}>2 vagas em aberto</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
        {players.map((p, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 9, border: `2px solid ${p.color}`, background: `${p.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: p.color }}>
            {p.ini}
          </div>
        ))}
        {[0, 1].map((i) => (
          <div key={`e${i}`} style={{ aspectRatio: "1", borderRadius: 9, border: `2px dashed ${C.border}`, background: C.surface }} />
        ))}
      </div>
    </div>
  );
}

function ChatMock() {
  const bubble = { alignSelf: "flex-start", maxWidth: "90%", background: "#202C33", color: "#E9EDEF", borderRadius: "4px 12px 12px 12px", padding: "9px 12px", fontSize: 12.5, lineHeight: 1.5 };
  return (
    <div style={{ width: MOCK_W, borderRadius: 16, border: `1px solid ${C.border}`, background: "#0B141A", padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: C.bg }}>P</div>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#E9EDEF" }}>Pitch AI</span>
      </div>
      <div style={bubble}>🔥 Já são 8/10 — faltam 2. Ainda dá tempo:<br />pitch.app/j/fc-amigos</div>
      <div style={bubble}>🔓 Abriu vaga! 9/10 pro próximo jogo às 20:00 — falta 1.</div>
      <div style={{ alignSelf: "flex-end", maxWidth: "70%", background: C.whatsapp, color: "#04140D", borderRadius: "12px 4px 12px 12px", padding: "9px 12px", fontSize: 12.5, fontWeight: 700 }}>
        @Pitch confirmo!
      </div>
    </div>
  );
}

function PaymentsMock() {
  const players = [
    { ini: "CS", color: C.accent, paid: true }, { ini: "JF", color: C.blue, paid: true },
    { ini: "MS", color: C.orange, paid: false }, { ini: "RO", color: C.green, paid: true },
    { ini: "DC", color: "#A78BFA", paid: false }, { ini: "AL", color: C.orange, paid: true },
  ];
  return (
    <div style={{ ...cardStyle, width: MOCK_W, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: C.text3, marginBottom: 6 }}>PAGAMENTOS</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 16 }}>
        <div style={{ ...displayFont, fontSize: 26 }}>€48</div>
        <div style={{ fontSize: 13, color: C.text2 }}>/ €64 · €8 por jogador</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {players.map((p, i) => (
          <div key={i} style={{ position: "relative", width: 38, height: 38, borderRadius: 19, border: `2px solid ${p.color}`, background: `${p.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, color: p.color }}>
            {p.ini}
            <div style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: 8, background: p.paid ? C.green : C.orange, border: `2px solid ${C.card}` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchdayMock() {
  return (
    <div style={{ ...cardStyle, width: MOCK_W, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 800, color: C.text3, marginBottom: 12 }}>
        <span>COLETES · OVR 74</span><span>SEM COLETE · OVR 78</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
        <span style={{ ...displayFont, fontSize: 34, color: C.accent }}>2</span>
        <span style={{ fontSize: 14, color: C.text3 }}>—</span>
        <span style={{ ...displayFont, fontSize: 34, color: C.blue }}>1</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <div style={{ fontSize: 12, color: C.text2 }}>⚽ <b style={{ color: C.text1 }}>Carlão</b> (assist. Tiago)</div>
        <div style={{ fontSize: 12, color: C.text2 }}>🧤 <b style={{ color: C.text1 }}>Ruizão</b> defesa espetacular</div>
      </div>
    </div>
  );
}

function StatsMock() {
  const rows = [
    { ini: "JF", color: C.blue, name: "Joãozão", pts: 62, pct: 100 },
    { ini: "CS", color: C.accent, name: "Carlão", pts: 47, pct: 76 },
    { ini: "AL", color: C.orange, name: "Liminha", pts: 44, pct: 71 },
  ];
  return (
    <div style={{ ...cardStyle, width: MOCK_W, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: C.text3, marginBottom: 14 }}>RANKING · IMPACTO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r, i) => (
          <div key={r.ini}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: C.text3, width: 10 }}>{i + 1}</span>
              <div style={{ width: 25, height: 25, borderRadius: 13, border: `2px solid ${r.color}`, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, color: r.color }}>{r.ini}</div>
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{r.name}</span>
              <span style={{ ...displayFont, fontSize: 16 }}>{r.pts}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.surface }}>
              <div style={{ height: 4, borderRadius: 2, width: `${r.pct}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FantasyMock() {
  const squad = [{ ini: "JF", cap: true }, { ini: "CS", cap: false }, { ini: "AL", cap: false }];
  return (
    <div style={{ width: MOCK_W, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, background: `linear-gradient(180deg, ${C.grass} 0%, ${C.grass} 72%, ${C.card} 72%, ${C.card} 100%)` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>PITCH MANAGER</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.gold }}>$142.5M</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
        {squad.map((p) => (
          <div key={p.ini} style={{ position: "relative", width: 38, height: 38, borderRadius: 19, background: "rgba(255,255,255,0.14)", border: `2px solid ${p.cap ? C.gold : "#fff"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
            {p.ini}
            {p.cap && <Crown size={12} color={C.gold} style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)" }} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, fontWeight: 700 }}>
        <span>Capitão · pontos x2</span><span>$24.0M</span>
      </div>
    </div>
  );
}

function CardMock() {
  return <FutCard player={DEMO_PLAYER} width={230} />;
}

const FEATURES = [
  {
    n: "01", Icon: Zap, Mock: SlotGridMock,
    h1: "Confirma o jogo,", h2: "não o caos.",
    text: "Grelha de vagas em tempo real: todos veem quem já está dentro, quem falta e quantas vagas sobram — sem precisar de percorrer o histórico do grupo pra saber se o jogo vai sair.",
  },
  {
    n: "02", Icon: Bot, Mock: ChatMock,
    h1: "Um assistente", h2: "dentro do teu grupo.",
    text: "O Pitch AI vive no teu WhatsApp e fala a língua do grupo: avisa quando abre vaga, lembra quem ainda não confirmou e faz o resumo do jogo no dia seguinte — sem ninguém precisar de escrever nada.",
  },
  {
    n: "03", Icon: Wallet, Mock: PaymentsMock,
    h1: "Sabes sempre", h2: "quem já pagou.",
    text: "A mensalidade do campo dividida por todos, visível num toque. Chega de perguntar «faltam quantos?» no grupo — o organizador vê tudo numa só tela, e cobra os atrasados direto pelo WhatsApp.",
  },
  {
    n: "04", Icon: CalendarCheck, Mock: MatchdayMock,
    h1: "Sorteio justo,", h2: "jogo registado ao vivo.",
    text: "As equipas saem equilibradas por posição e overall, sem discussão sobre quem ficou com o time mais fraco. Cada golo e assistência entram na hora — com cronómetro e até por comando de voz — pra ninguém decorar nada até ao fim do jogo.",
  },
  {
    n: "05", Icon: BarChart3, Mock: StatsMock,
    h1: "A época inteira,", h2: "num ranking só.",
    text: "Golos, assistências, vitórias, MVPs e defesas viram um ranking de Impacto — quem está mais completo na época, num número só. E tem ranking à parte pros guarda-redes, porque clean sheet também vale ponto.",
  },
  {
    n: "06", Icon: Trophy, Mock: FantasyMock,
    h1: "A tua liga fantasy,", h2: "dentro do próprio grupo.",
    text: "Monta o plantel com um orçamento, escolhe o capitão (pontos em dobro) e troca jogadores com os teus amigos. O preço de cada jogador sobe e desce com o desempenho real dele em campo — a competição acontece por cima do próprio jogo da semana.",
  },
  {
    n: "07", Icon: IdCard, Mock: CardMock,
    h1: "O teu jogo,", h2: "em forma de cartão.",
    text: "Estilo FUT: overall calculado a partir dos teus atributos, posição e foto — com tiers de ouro, prata, bronze, ou LENDA se passares de 86. É a forma de mostrar quem é quem no grupo, sem ninguém discutir quem é o melhor jogador.",
  },
];

const HOW_IT_WORKS = {
  organizer: [
    { n: "1", title: "Cria a conta e o grupo", text: "Nome do grupo, campo, dia da semana e hora, e como divides a mensalidade." },
    { n: "2", title: "Convida a malta pelo WhatsApp", text: "Um link só — todos entram sem instalar nada a mais nem decorar palavra-passe." },
    { n: "3", title: "O jogo organiza-se sozinho", text: "Confirmações, sorteio de equipas, pagamentos e stats — toda semana, sem esforço." },
  ],
  player: [
    { n: "1", title: "Recebe o link do teu grupo", text: "O organizador manda pelo WhatsApp — é só abrir." },
    { n: "2", title: "Cria o teu cartão", text: "Foto, posição e atributos — o teu FUT card em menos de um minuto." },
    { n: "3", title: "Confirma e entra em jogo", text: "Um toque pra dizer que vais. Prontos, apareces na grelha." },
  ],
};

function HowItWorksSection({ onEnter }) {
  const [role, setRole] = useState("organizer");
  const steps = HOW_IT_WORKS[role];
  const tabStyle = (active) => ({
    padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 800,
    background: active ? C.accent : "transparent",
    color: active ? C.bg : C.text2,
  });
  return (
    <Section style={{ padding: "64px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: C.accent, marginBottom: 8 }}>{t("COMO FUNCIONA")}</div>
        <div style={{ ...displayFont, fontSize: "clamp(24px, 3.6vw, 34px)", color: C.text1 }}>{t("Do zero ao primeiro jogo")}</div>
        <div style={{ display: "inline-flex", gap: 4, marginTop: 22, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4 }}>
          <button onClick={() => setRole("organizer")} style={tabStyle(role === "organizer")}>{t("Sou Organizador")}</button>
          <button onClick={() => setRole("player")} style={tabStyle(role === "player")}>{t("Sou Jogador")}</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
        {steps.map((s) => (
          <div key={s.n} style={{ ...cardStyle, flex: "1 1 250px", maxWidth: 320, padding: 22 }}>
            <div style={{ ...displayFont, fontSize: 26, color: C.accent, marginBottom: 10 }}>{s.n}</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{t(s.title)}</div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{t(s.text)}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <BtnPrimary onClick={onEnter} style={{ padding: "13px 26px", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {t("Criar conta grátis")} <ArrowRight size={16} />
        </BtnPrimary>
      </div>
    </Section>
  );
}

const FeatureSection = ({ n, Icon, h1, h2, text, Mock, reverse }) => (
  <Section style={{ padding: "52px 20px" }}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 44, flexDirection: reverse ? "row-reverse" : "row" }}>
      <div style={{ flex: "1 1 360px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={16} color={C.accent} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: C.text3 }}>{n}</span>
        </div>
        <div style={{ ...displayFont, fontSize: "clamp(24px, 3.4vw, 32px)", lineHeight: 1.15, marginBottom: 14 }}>
          {t(h1)}<br /><span style={{ color: C.accent }}>{t(h2)}</span>
        </div>
        <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.7, maxWidth: 440 }}>{t(text)}</div>
      </div>
      <div style={{ flex: "1 1 300px", display: "flex", justifyContent: "center" }}>
        <Mock />
      </div>
    </div>
  </Section>
);

/** Public marketing page — the entry point before login/signup. */
export default function LandingPage({ onEnter, lang, onLang }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <img src={BRAND.logo} alt="PITCH App" style={{ height: 26 }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {onLang && (
              <select value={lang} onChange={(e) => onLang(e.target.value)}
                style={{ background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 8px", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer", colorScheme: "dark" }}>
                <option value="pt">🇵🇹 PT</option>
                <option value="pt-br">🇧🇷 PT-BR</option>
                <option value="en">🇬🇧 EN</option>
                <option value="it">🇮🇹 IT</option>
              </select>
            )}
            <button onClick={onEnter} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: C.text1, cursor: "pointer" }}>
              {t("Entrar")}
            </button>
            <BtnPrimary onClick={onEnter} style={{ padding: "8px 16px", fontSize: 13 }}>{t("Criar conta")}</BtnPrimary>
          </div>
        </Section>
      </div>

      {/* HERO */}
      <div style={{ ...fieldBackdrop(0.5, 0.96), borderBottom: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 40, padding: "72px 20px" }}>
          <div style={{ flex: "1 1 340px" }}>
            <div style={{ ...displayFont, fontSize: "clamp(34px, 5.5vw, 54px)", lineHeight: 1.05, marginBottom: 16 }}>
              {t("O teu jogo da semana,")}<br />
              <span style={{ color: C.accent }}>{t("sem o caos do grupo.")}</span>
            </div>
            <div style={{ fontSize: 16, color: C.text2, lineHeight: 1.6, marginBottom: 28, maxWidth: 460 }}>
              {t("Confirmações, dinheiro, equipas e stats — tudo num só sítio. Pra ninguém perguntar «então, jogamos ou não?» outra vez.")}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <BtnPrimary onClick={onEnter} style={{ padding: "14px 26px", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                {t("Criar conta grátis")} <ArrowRight size={17} />
              </BtnPrimary>
              <button onClick={onEnter} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 26px", fontSize: 15, fontWeight: 700, color: C.text1, cursor: "pointer" }}>
                {t("Já tenho conta")}
              </button>
            </div>
          </div>
          <div style={{ flex: "0 1 auto", margin: "0 auto", transform: "rotate(3deg)" }}>
            <FutCard player={DEMO_PLAYER} width={250} />
          </div>
        </Section>
      </div>

      <HowItWorksSection onEnter={onEnter} />

      {/* FEATURES — one full section per feature, alternating sides */}
      <div style={{ padding: "24px 0" }}>
        {FEATURES.map((f, i) => (
          <FeatureSection key={f.n} {...f} reverse={i % 2 === 1} />
        ))}
      </div>

      {/* FINAL CTA */}
      <div style={{ ...fieldBackdrop(0.6, 0.92) }}>
        <Section style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ ...displayFont, fontSize: "clamp(28px, 4.5vw, 42px)", marginBottom: 10 }}>
            {t("Pronto para o próximo jogo?")}
          </div>
          <div style={{ fontSize: 15, color: C.text2, marginBottom: 28 }}>
            {t("Cria a tua conta, monta o teu cartão e entra em campo.")}
          </div>
          <BtnPrimary onClick={onEnter} style={{ padding: "15px 32px", fontSize: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t("Criar conta na app")} <ArrowRight size={18} />
          </BtnPrimary>
        </Section>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <Section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 20px" }}>
          <img src={BRAND.logo} alt="PITCH App" style={{ height: 20, opacity: 0.7 }} />
          <div style={{ fontSize: 12, color: C.text3 }}>
            {t("PITCH Club · Matosinhos — Porto · versão beta")}
          </div>
        </Section>
      </div>
    </div>
  );
}
