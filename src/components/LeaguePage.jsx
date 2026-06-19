import { useEffect, useRef, useState } from "react";
import { C, displayFont, BRAND, fieldBackdrop } from "../theme";
import { supabase, supabaseEnabled } from "../lib/supabase";

/**
 * PITCH League — MVP marketing/lead-capture page (route: /league).
 * League-first, commercial, dark sport-tech. Captures demand into the
 * `leads` table via the submit_lead() RPC. Separate from the app shell.
 */

const MAXW = 1120;
const wrap = { maxWidth: MAXW, margin: "0 auto", padding: "0 20px" };
const eyebrow = { fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.accent };
const h2 = { ...displayFont, fontSize: "clamp(26px, 4.5vw, 42px)", lineHeight: 1.05, margin: "10px 0 14px" };
const lead = { fontSize: "clamp(15px, 2vw, 18px)", color: C.text2, lineHeight: 1.6, maxWidth: 720 };

const CSS = `
.lg-root *{box-sizing:border-box}
.lg-root{scroll-behavior:smooth}
.lg-btn{transition:transform .15s ease, filter .15s ease; cursor:pointer; border:none; font-weight:800;}
.lg-btn:hover{transform:translateY(-2px); filter:brightness(1.05)}
.lg-card{transition:transform .18s ease, border-color .18s ease}
.lg-card:hover{transform:translateY(-3px); border-color:rgba(200,255,0,0.35)}
.lg-link{color:${C.text2};text-decoration:none;transition:color .15s}
.lg-link:hover{color:${C.text1}}
.lg-sec{padding:clamp(52px,8vw,100px) 0}
@keyframes lgpulse{0%,100%{opacity:1}50%{opacity:.35}}
.lg-live{animation:lgpulse 1.6s ease-in-out infinite}
@media(max-width:760px){.lg-hide-sm{display:none!important}}
`;

const Section = ({ id, children, style }) => (
  <section id={id} className="lg-sec" style={style}><div style={wrap}>{children}</div></section>
);

function Btn({ children, onClick, variant = "primary", style, className = "" }) {
  const v = {
    primary: { background: C.accent, color: C.bg },
    gold: { background: C.gold, color: C.bg },
    ghost: { background: "transparent", color: C.text1, border: `1px solid ${C.border}` },
  }[variant];
  return (
    <button className={`lg-btn ${className}`} onClick={onClick} style={{ borderRadius: 12, padding: "13px 22px", fontSize: 15, ...v, ...style }}>
      {children}
    </button>
  );
}

const STATS = [
  ["1ª época", "Inscrições abertas"],
  ["Porto & Matosinhos", "Campos parceiros"],
  ["F5 · F7 · Futsal", "Vários formatos"],
  ["App incluído", "Tudo no PITCH OS"],
];

const STEPS = [
  ["Inscreve a tua equipa", "Em 2 minutos. Sem plantel completo? Entras na lista e ajudamos a fechar a equipa."],
  ["Entras numa divisão", "Distribuímos por nível para os jogos serem equilibrados e competitivos."],
  ["Jogas rodadas semanais", "Calendário fixo, campo marcado, tudo organizado no app."],
  ["Sobes até à final", "Classificação, artilharia e MVP ao vivo — e final com premiação."],
];

const FORMATS = [
  ["Futebol 5", "Rápido e técnico. 5+suplentes."],
  ["Futebol 7", "O clássico do amador. 7 contra 7."],
  ["Futsal", "Indoor, ritmo alto, muito golo."],
  ["Masters +35", "Para quem joga há anos e não larga a bola."],
  ["Liga Social", "Competir pelo convívio e pelos golos."],
  ["Liga Competitiva", "Para equipas que querem ganhar a sério."],
];

const INCLUDED = [
  "Tabela e classificação", "Rodadas semanais", "Divisões por nível",
  "Ranking e artilharia", "MVP por jogo", "Perfis de jogador e equipa",
  "App para gerir tudo", "Fotos e vídeos", "Final com premiação",
];

const STANDINGS = [
  ["1", "Leões da Foz", "15"], ["2", "Os Galácticos", "13"],
  ["3", "FC Amigos", "11"], ["4", "Várzea United", "9"],
];

const FOUNDER = [
  { tag: "Light", color: C.text2, name: "Founder Light", desc: "Interesse / lista de espera.", perks: ["Prioridade de inscrição", "Acesso antecipado ao app", "Nome no mural fundador"] },
  { tag: "Pro", color: C.accent, name: "Founder Pro", desc: "Inscrição antecipada com desconto.", perks: ["Vaga garantida na 1ª época", "Desconto de fundador", "Perfil de equipa", "Convite para o lançamento"] },
  { tag: "Elite", color: C.gold, name: "Founder Elite", desc: "Premium para equipas e empresas.", perks: ["Tudo do Pro", "Conteúdo (fotos/vídeos)", "Horário prioritário futuro", "Naming / ativação de marca"] },
];

const FAQS = [
  ["Onde se joga?", "Em campos parceiros no Porto e Matosinhos. A liga é organizada pela PITCH e acompanhada pelo app."],
  ["Preciso de equipa completa?", "Não. Inscreves a equipa, entras como jogador avulso para completar plantéis, ou ficas na lista de espera."],
  ["Quando começa?", "A primeira época arranca com as equipas fundadoras. Inscreve já para garantires vaga e condições de fundador."],
  ["Quanto custa?", "A inscrição por equipa é definida por época. As equipas fundadoras têm desconto — entra na lista e enviamos os valores."],
];

const ROLES = ["Capitão / organizador", "Jogador", "Empresa", "Patrocinador", "Dono de campo / parceiro"];
const MODALITIES = ["Futebol 5", "Futebol 7", "Futsal", "Masters +35", "Corporate"];
const INTERESTS = ["Inscrever equipa", "Entrar como jogador", "Ser Founder Team", "Liga corporativa", "Patrocinar", "Parceria com campo"];

function LeadForm({ prefill }) {
  const empty = { name: "", whatsapp: "", email: "", city: "", role: "", has_team: "", team_name: "", players_count: "", modality: "", best_day: "", best_time: "", message: "" };
  const [f, setF] = useState(empty);
  const [interest, setInterest] = useState([]);
  const [status, setStatus] = useState(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!prefill) return;
    if (prefill.role) setF((s) => ({ ...s, role: prefill.role }));
    if (prefill.interest) setInterest((cur) => Array.from(new Set([...cur, prefill.interest])));
  }, [prefill]);

  const toggleInterest = (i) => setInterest((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  const submit = async () => {
    if (!f.name.trim() || !(f.whatsapp.trim() || f.email.trim())) { setStatus("error"); return; }
    setStatus("busy");
    const has_team = f.has_team === "Sim" ? "true" : f.has_team === "Não" ? "false" : "";
    const payload = { ...f, has_team, interest, source: "league" };
    if (!supabaseEnabled) { setStatus("ok"); return; }
    const { error } = await supabase.rpc("submit_lead", { payload });
    setStatus(error ? "error" : "ok");
    if (!error) { setF(empty); setInterest([]); }
  };

  const inp = (label, k, type = "text", extra = {}) => (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 12, color: C.text2 }}>{label}</span>
      <input type={type} value={f[k]} onChange={(e) => set(k, e.target.value)} {...extra}
        style={{ width: "100%", marginTop: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: C.text1, outline: "none" }} />
    </label>
  );
  const sel = (label, k, opts) => (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 12, color: C.text2 }}>{label}</span>
      <select value={f[k]} onChange={(e) => set(k, e.target.value)}
        style={{ width: "100%", marginTop: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 10px", fontSize: 14, color: f[k] ? C.text1 : C.text2, outline: "none" }}>
        <option value="">—</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  if (status === "ok") {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.greenBorder}`, borderRadius: 18, padding: 40, textAlign: "center" }}>
        <div style={{ ...displayFont, fontSize: 26, color: C.green, marginBottom: 8 }}>Inscrição recebida! ⚽</div>
        <div style={{ color: C.text2, fontSize: 15 }}>Entramos em contacto em breve com os próximos passos da PITCH League.</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "clamp(20px,4vw,34px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {inp("Nome*", "name")}
        {inp("WhatsApp", "whatsapp", "tel", { placeholder: "+351 9…" })}
        {inp("Email", "email", "email")}
        {inp("Cidade / região", "city")}
        {sel("Eu sou", "role", ROLES)}
        {sel("Tenho equipa?", "has_team", ["Sim", "Não"])}
        {inp("Nome da equipa", "team_name")}
        {inp("Quantos jogadores?", "players_count", "number", { min: 0 })}
        {sel("Modalidade preferida", "modality", MODALITIES)}
        {inp("Melhor dia", "best_day")}
        {inp("Melhor horário", "best_time", "time", { style: { colorScheme: "dark" } })}
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 8 }}>Interesse (escolhe um ou mais)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INTERESTS.map((i) => {
            const on = interest.includes(i);
            return (
              <button key={i} type="button" className="lg-btn" onClick={() => toggleInterest(i)}
                style={{ borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 700, background: on ? C.accentDim : C.surface, color: on ? C.accent : C.text2, border: `1px solid ${on ? C.accentBorder : C.border}` }}>
                {i}
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "block", marginTop: 16 }}>
        <span style={{ fontSize: 12, color: C.text2 }}>Mensagem (opcional)</span>
        <textarea value={f.message} onChange={(e) => set("message", e.target.value)} rows={3}
          style={{ width: "100%", marginTop: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: C.text1, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      </label>

      {status === "error" && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>Preenche o nome e pelo menos WhatsApp ou email.</div>}

      <Btn onClick={submit} style={{ width: "100%", marginTop: 18, padding: 16, fontSize: 16, opacity: status === "busy" ? 0.6 : 1 }}>
        {status === "busy" ? "A enviar…" : "Inscrever / entrar na lista"}
      </Btn>
      <div style={{ textAlign: "center", fontSize: 11, color: C.text3, marginTop: 10 }}>Vagas limitadas na primeira época · sem spam.</div>
    </div>
  );
}

export default function LeaguePage({ onEnterApp }) {
  const [prefill, setPrefill] = useState(null);
  const formRef = useRef(null);

  const goForm = (role, interest) => {
    setPrefill({ role, interest, _t: Date.now() });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 };

  return (
    <div className="lg-root" style={{ background: C.bg, color: C.text1, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif", minHeight: "100vh" }}>
      <style>{CSS}</style>

      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(10,15,24,0.82)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 16, height: 64 }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 22 }} />
          <div className="lg-hide-sm" style={{ display: "flex", gap: 22, marginLeft: 18 }}>
            <a className="lg-link" href="#como" style={{ fontSize: 14 }}>Como funciona</a>
            <a className="lg-link" href="#formatos" style={{ fontSize: 14 }}>Formatos</a>
            <a className="lg-link" href="#founder" style={{ fontSize: 14 }}>Founder Teams</a>
            <a className="lg-link" href="#empresas" style={{ fontSize: 14 }}>Empresas</a>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={onEnterApp} className="lg-hide-sm" style={{ padding: "9px 14px", fontSize: 13 }}>Entrar no app</Btn>
            <Btn onClick={() => goForm("Capitão / organizador", "Inscrever equipa")} style={{ padding: "9px 16px", fontSize: 13 }}>Inscrever equipa</Btn>
          </div>
        </div>
      </nav>

      {/* HERO — league first */}
      <header style={{ ...fieldBackdrop(0.55, 0.97), borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...wrap, padding: "clamp(48px,9vw,104px) 20px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 380px", minWidth: 300 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 30, padding: "6px 12px", marginBottom: 16 }}>
              <span className="lg-live" style={{ width: 8, height: 8, borderRadius: 4, background: C.accent }} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.accent }}>INSCRIÇÕES ABERTAS · 1ª ÉPOCA</span>
            </div>
            <h1 style={{ ...displayFont, fontSize: "clamp(36px, 6.6vw, 66px)", lineHeight: 1.0, margin: "0 0 16px" }}>
              A liga de futebol<br />amador do Porto.
            </h1>
            <p style={{ ...lead, marginBottom: 26 }}>
              Tabela, rodadas semanais, ranking, artilharia, MVP e final com prémios — em campos do Porto e Matosinhos.
              <b style={{ color: C.text1 }}> Inscreve a tua equipa</b> na primeira PITCH League.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <Btn onClick={() => goForm("Capitão / organizador", "Inscrever equipa")} style={{ padding: "15px 26px", fontSize: 16 }}>Inscrever a minha equipa</Btn>
              <Btn variant="ghost" onClick={() => goForm("Jogador", "Entrar como jogador")}>Sou jogador — quero entrar</Btn>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Futebol 5", "Futebol 7", "Futsal", "Masters +35", "Corporate"].map((m) => (
                <span key={m} style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "6px 12px" }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Standings mock — league feel */}
          <div style={{ flex: "1 1 320px", minWidth: 280, display: "grid", gap: 12 }}>
            <div className="lg-card" style={{ ...card }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: C.text2, letterSpacing: "0.1em", fontWeight: 800 }}>CLASSIFICAÇÃO</span>
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Divisão 1</span>
              </div>
              {STANDINGS.map(([pos, name, pts], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ ...displayFont, fontSize: 15, width: 20, color: i === 0 ? C.gold : C.text2 }}>{pos}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: i === 0 ? 800 : 500 }}>{name}</span>
                  <span style={{ ...displayFont, fontSize: 16, color: C.accent }}>{pts}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="lg-card" style={{ ...card }}>
                <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>ARTILHEIRO</div>
                <div style={{ ...displayFont, fontSize: 28, color: C.accent }}>21</div>
                <div style={{ fontSize: 12, color: C.text2 }}>Joãozão</div>
              </div>
              <div className="lg-card" style={{ ...card }}>
                <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>MVP</div>
                <div style={{ ...displayFont, fontSize: 28, color: C.gold }}>★</div>
                <div style={{ fontSize: 12, color: C.text2 }}>Carlão</div>
              </div>
            </div>
          </div>
        </div>

        {/* stat band */}
        <div style={{ borderTop: `1px solid ${C.border}`, background: "rgba(10,15,24,0.5)" }}>
          <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1, padding: 0 }}>
            {STATS.map(([big, small]) => (
              <div key={big} style={{ padding: "18px 16px", textAlign: "center" }}>
                <div style={{ ...displayFont, fontSize: 18, color: C.text1 }}>{big}</div>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{small}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* COMO FUNCIONA */}
      <Section id="como">
        <div style={eyebrow}>Como funciona</div>
        <h2 style={h2}>Da inscrição à final, em 4 passos.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginTop: 26 }}>
          {STEPS.map(([t, d], i) => (
            <div key={t} className="lg-card" style={card}>
              <div style={{ ...displayFont, fontSize: 30, color: C.accent, marginBottom: 8 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Btn onClick={() => goForm("Capitão / organizador", "Inscrever equipa")}>Inscrever a minha equipa</Btn>
        </div>
      </Section>

      {/* FORMATOS */}
      <Section id="formatos" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>Competições</div>
        <h2 style={h2}>Escolhe o teu formato.</h2>
        <p style={lead}>Divisões por nível para jogos equilibrados — do convívio à competição a sério.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 26 }}>
          {FORMATS.map(([t, d]) => (
            <div key={t} className="lg-card" style={card}>
              <div style={{ ...displayFont, fontSize: 19, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* INCLUÍDO NA LIGA */}
      <Section>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <div style={eyebrow}>O que está incluído</div>
            <h2 style={h2}>Uma liga a sério — não um grupo de WhatsApp.</h2>
            <p style={lead}>Cada equipa tem tabela, ranking e estatísticas. Cada jogador tem perfil, golos e história. Tudo organizado e registado.</p>
            <div style={{ marginTop: 22 }}>
              <Btn variant="gold" onClick={() => goForm("Capitão / organizador", "Inscrever equipa")}>Inscrever equipa</Btn>
            </div>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 280, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
            {INCLUDED.map((x) => (
              <div key={x} style={{ ...card, padding: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                <span style={{ fontSize: 13.5 }}>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* FOUNDER TEAMS */}
      <Section id="founder" style={{ ...fieldBackdrop(0.86, 0.97), borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>Founder Teams · vagas limitadas</div>
        <h2 style={h2}>Sê uma equipa fundadora.</h2>
        <p style={lead}>As primeiras equipas têm vaga garantida, desconto de fundador e prioridade no app e nos benefícios futuros do clube.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 26 }}>
          {FOUNDER.map((p) => (
            <div key={p.name} className="lg-card" style={{ ...card, borderColor: p.color === C.text2 ? C.border : `${p.color}55` }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: p.color }}>{p.tag.toUpperCase()}</div>
              <div style={{ ...displayFont, fontSize: 20, margin: "6px 0 6px" }}>{p.name}</div>
              <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>{p.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {p.perks.map((x) => (
                  <div key={x} style={{ fontSize: 13.5, color: C.text1, display: "flex", gap: 8 }}><span style={{ color: C.green }}>✓</span>{x}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Btn onClick={() => goForm("Capitão / organizador", "Ser Founder Team")}>Quero ser Founder Team</Btn>
        </div>
      </Section>

      {/* APP — supporting band */}
      <Section>
        <div style={{ ...card, padding: "clamp(22px,4vw,34px)", display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
          <div style={{ flex: "1 1 320px", minWidth: 280 }}>
            <div style={eyebrow}>PITCH OS · incluído</div>
            <h2 style={{ ...h2, fontSize: "clamp(22px,3.5vw,32px)" }}>E o app trata da operação.</h2>
            <p style={{ ...lead, fontSize: 15 }}>Presença, pagamentos, sorteio de equipas, resultados, golos, MVP e ranking — para o capitão deixar de cobrar toda a gente no WhatsApp.</p>
            <div style={{ marginTop: 18 }}><Btn variant="ghost" onClick={onEnterApp}>Ver o app →</Btn></div>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 260, display: "grid", gap: 10 }}>
            <div style={{ background: C.surface, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>PRÓXIMO JOGO</div>
              <div style={{ ...displayFont, fontSize: 18, margin: "2px 0 8px" }}>Quinta, 20:00</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.green, background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 20, padding: "3px 9px", fontWeight: 700 }}>8/10 confirmados</span>
                <span style={{ fontSize: 11, color: C.orange, background: C.orangeDim, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 9px", fontWeight: 700 }}>3 por pagar</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* CORPORATE */}
      <Section id="empresas" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>Corporate League</div>
        <h2 style={h2}>Futebol para empresas, sem trabalho para o RH.</h2>
        <p style={lead}>Ligas e torneios corporativos com tabela, ranking, final, premiação e experiência social — chave-na-mão.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "24px 0" }}>
          {["Torneios internos", "Liga entre empresas", "Team building", "Fotos e vídeos", "Happy hour", "Ranking por empresa", "Premiação", "Naming / patrocínio"].map((x) => (
            <div key={x} style={{ ...card, padding: 14, fontSize: 14 }}>{x}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="gold" onClick={() => goForm("Empresa", "Liga corporativa")}>Quero uma liga corporativa</Btn>
          <Btn variant="ghost" onClick={() => goForm("Patrocinador", "Patrocinar")}>Quero patrocinar</Btn>
        </div>
      </Section>

      {/* LEAD FORM */}
      <Section id="lead">
        <div ref={formRef} />
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={eyebrow}>Inscrições abertas</div>
          <h2 style={{ ...h2, margin: "10px auto 0" }}>Garante o lugar da tua equipa.</h2>
          <p style={{ ...lead, margin: "12px auto 0", marginLeft: "auto", marginRight: "auto" }}>Equipas, jogadores, empresas e parceiros — diz-nos quem és e entramos em contacto.</p>
        </div>
        <LeadForm prefill={prefill} />
      </Section>

      {/* FAQ */}
      <Section style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={eyebrow}>FAQ</div>
        <h2 style={h2}>Perguntas frequentes</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 22 }}>
          {FAQS.map(([q, a]) => (
            <div key={q} style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{q}</div>
              <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.55 }}>{a}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "44px 0" }}>
        <div style={{ ...wrap, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
          <div style={{ maxWidth: 320 }}>
            <img src={BRAND.logo} alt="PITCH" style={{ height: 22, marginBottom: 10 }} />
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>A liga de futebol amador do Porto. Porto / Matosinhos.</div>
          </div>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, letterSpacing: "0.1em" }}>LIGA</div>
              <a className="lg-link" href="#como" style={{ fontSize: 14 }}>Como funciona</a>
              <a className="lg-link" href="#formatos" style={{ fontSize: 14 }}>Formatos</a>
              <a className="lg-link" href="#founder" style={{ fontSize: 14 }}>Founder Teams</a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, letterSpacing: "0.1em" }}>CONTACTO</div>
              <a className="lg-link" href="https://instagram.com" target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>Instagram</a>
              <a className="lg-link" href="https://wa.me/" target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>WhatsApp</a>
              <a className="lg-link" href="mailto:capella.vinicius@gmail.com" style={{ fontSize: 14 }}>Email</a>
            </div>
          </div>
        </div>
        <div style={{ ...wrap, marginTop: 28, fontSize: 12, color: C.text3 }}>© {new Date().getFullYear()} PITCH · A liga de futebol amador do Porto.</div>
      </footer>
    </div>
  );
}
