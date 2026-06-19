import { useEffect, useRef, useState } from "react";
import { C, displayFont, BRAND, fieldBackdrop } from "../theme";
import { supabase, supabaseEnabled } from "../lib/supabase";

/**
 * PITCH League — MVP marketing/lead-capture page (route: /league).
 * Full-width, responsive, dark sport-tech. Captures demand into the
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
.lg-sec{padding:clamp(56px,9vw,110px) 0}
@media(max-width:760px){.lg-hide-sm{display:none!important}}
`;

const Section = ({ id, children, style }) => (
  <section id={id} className="lg-sec" style={style}><div style={wrap}>{children}</div></section>
);

function Btn({ children, onClick, variant = "primary", style }) {
  const v = {
    primary: { background: C.accent, color: C.bg },
    gold: { background: C.gold, color: C.bg },
    ghost: { background: "transparent", color: C.text1, border: `1px solid ${C.border}` },
  }[variant];
  return (
    <button className="lg-btn" onClick={onClick} style={{ borderRadius: 12, padding: "13px 22px", fontSize: 15, ...v, ...style }}>
      {children}
    </button>
  );
}

const FEATURES = [
  ["Presença dos jogadores", "Confirma quem vem num toque — sem caçar resposta no WhatsApp."],
  ["Pagamentos", "Divide o custo e vê quem já pagou. O capitão deixa de cobrar à mão."],
  ["Times e elencos", "Cria o teu time, gere o plantel e sorteia equipas equilibradas."],
  ["Ligas e tabelas", "Rodadas, classificação e divisões por nível."],
  ["Rankings e artilharia", "Quem mais marca, assiste e vence — atualizado a cada jogo."],
  ["Gols, assistências e MVPs", "Cada jogo fica registado. A tua história fica guardada."],
  ["Perfil do jogador", "Cartão, stats, títulos e — em breve — vídeos."],
  ["Perfil do time", "Identidade, elenco, histórico e conquistas."],
];

const PROBLEMS = [
  "Confirmação no WhatsApp", "Pagamento manual", "Jogador que falta",
  "Capitão a cobrar todo mundo", "Times desequilibrados", "Sem ranking",
  "Sem estatísticas", "Sem histórico", "Sem vídeos", "Sem comunidade",
];

const MODS = ["Futebol 5", "Futebol 7", "Masters +35", "Corporate League", "Liga Social", "Liga Competitiva"];

const FOUNDER = [
  { tag: "Light", color: C.text2, name: "Founder Team Light", desc: "Lista de espera e interesse.", perks: ["Prioridade de inscrição", "Acesso antecipado ao app", "Nome no mural fundador"] },
  { tag: "Pro", color: C.accent, name: "Founder Team Pro", desc: "Inscrição antecipada com benefícios.", perks: ["Entrada na 1ª PITCH League", "Perfil do time", "Ranking inaugural", "Convite para o lançamento"] },
  { tag: "Elite", color: C.gold, name: "Founder Team Elite", desc: "Pacote premium para times e empresas.", perks: ["Tudo do Pro", "Horário prioritário futuro", "Conteúdo (fotos/vídeos)", "Descontos em ligas futuras"] },
];

const FAQS = [
  ["Onde acontecem os jogos?", "Começamos em campos parceiros em Porto / Matosinhos, com a liga organizada pela PITCH e acompanhada pelo app."],
  ["Preciso ter um time completo?", "Não. Podes inscrever o teu time, entrar como jogador avulso para completar elencos, ou juntar-te à lista de espera."],
  ["Quanto custa?", "Os valores da primeira liga e dos pacotes Founder são definidos por época. Entra na lista e damos-te prioridade e condições de fundador."],
  ["Já tenho a pelada organizada. Para quê o PITCH?", "Para deixares de gerir tudo no WhatsApp: presença, pagamentos, sorteio, ranking e estatísticas — e ainda competir numa liga a sério."],
];

const ROLES = ["Capitão / organizador", "Jogador", "Empresa", "Patrocinador", "Dono de campo / parceiro"];
const MODALITIES = ["Futebol 5", "Futebol 7", "Futsal", "Masters +35", "Corporate"];
const INTERESTS = ["Participar de liga", "Ser Founder Team", "Testar o app", "Liga corporativa", "Patrocinar", "Parceria com campo"];

function LeadForm({ prefill }) {
  const empty = { name: "", whatsapp: "", email: "", city: "", role: "", has_team: "", team_name: "", players_count: "", modality: "", best_day: "", best_time: "", message: "" };
  const [f, setF] = useState(empty);
  const [interest, setInterest] = useState([]);
  const [status, setStatus] = useState(null); // null | 'busy' | 'ok' | 'error'
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
        <div style={{ ...displayFont, fontSize: 26, color: C.green, marginBottom: 8 }}>Estás na lista! ⚽</div>
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
        {sel("Tenho time?", "has_team", ["Sim", "Não"])}
        {inp("Nome do time", "team_name")}
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
        {status === "busy" ? "A enviar…" : "Entrar na lista"}
      </Btn>
      <div style={{ textAlign: "center", fontSize: 11, color: C.text3, marginTop: 10 }}>Sem spam. Só novidades da PITCH League.</div>
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
            <a className="lg-link" href="#liga" style={{ fontSize: 14 }}>Liga</a>
            <a className="lg-link" href="#app" style={{ fontSize: 14 }}>App</a>
            <a className="lg-link" href="#founder" style={{ fontSize: 14 }}>Founder Teams</a>
            <a className="lg-link" href="#empresas" style={{ fontSize: 14 }}>Empresas</a>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Btn variant="ghost" onClick={onEnterApp} style={{ padding: "9px 14px", fontSize: 13 }} className="lg-hide-sm">Entrar no app</Btn>
            <Btn onClick={() => goForm("Capitão / organizador", "Participar de liga")} style={{ padding: "9px 16px", fontSize: 13 }}>Inscrever meu time</Btn>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header style={{ ...fieldBackdrop(0.55, 0.97), borderBottom: `1px solid ${C.border}` }}>
        <div style={{ ...wrap, padding: "clamp(56px,10vw,120px) 20px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 300 }}>
            <div style={eyebrow}>PITCH League</div>
            <h1 style={{ ...displayFont, fontSize: "clamp(38px, 7vw, 70px)", lineHeight: 1.0, margin: "12px 0 16px" }}>
              O futebol amador<br />levado a sério.
            </h1>
            <p style={{ ...lead, marginBottom: 28 }}>
              Ligas, rankings, pagamentos, estatísticas e comunidade para times que jogam toda semana.
              Organize o seu time, entre numa liga e registe a sua história.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Btn onClick={() => goForm("Capitão / organizador", "Participar de liga")}>Inscrever meu time</Btn>
              <Btn variant="ghost" onClick={() => goForm("Jogador", "Participar de liga")}>Entrar como jogador</Btn>
              <Btn variant="ghost" onClick={() => goForm("Empresa", "Liga corporativa")}>Quero liga corporativa</Btn>
            </div>
          </div>

          {/* App mock stack */}
          <div style={{ flex: "1 1 320px", minWidth: 280, display: "grid", gap: 12 }}>
            <div className="lg-card" style={{ ...card }}>
              <div style={{ fontSize: 11, color: C.text2, letterSpacing: "0.1em", fontWeight: 700 }}>PRÓXIMO JOGO</div>
              <div style={{ ...displayFont, fontSize: 22, margin: "4px 0 8px" }}>Quinta, 20:00</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.green, background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>8/10 confirmados</span>
                <span style={{ fontSize: 12, color: C.orange, background: C.orangeDim, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>3 pagamentos pendentes</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="lg-card" style={{ ...card }}>
                <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>ARTILHARIA</div>
                <div style={{ ...displayFont, fontSize: 30, color: C.accent }}>21</div>
                <div style={{ fontSize: 12, color: C.text2 }}>Joãozão · golos</div>
              </div>
              <div className="lg-card" style={{ ...card }}>
                <div style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>MVPs</div>
                <div style={{ ...displayFont, fontSize: 30, color: C.gold }}>5</div>
                <div style={{ fontSize: 12, color: C.text2 }}>na época</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* PROBLEM */}
      <Section style={{ borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>O problema</div>
        <h2 style={h2}>Organizar futebol ainda é uma bagunça.</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          {PROBLEMS.map((p) => (
            <span key={p} style={{ fontSize: 14, color: C.text2, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <span style={{ color: C.red, marginRight: 8 }}>✕</span>{p}
            </span>
          ))}
        </div>
      </Section>

      {/* SOLUTION */}
      <Section>
        <div style={eyebrow}>A solução</div>
        <h2 style={h2}>O PITCH organiza tudo.</h2>
        <p style={lead}>Do jogo ao ranking. Da pelada à liga. Tudo num só lugar.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 26 }}>
          {FEATURES.map(([t, d]) => (
            <div key={t} className="lg-card" style={card}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: C.accent }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* LEAGUE */}
      <Section id="liga" style={{ ...fieldBackdrop(0.86, 0.97), borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>PITCH League</div>
        <h2 style={h2}>Entre na primeira PITCH League.</h2>
        <p style={lead}>
          Uma liga de futebol amador para times que querem competir numa experiência mais organizada,
          moderna e social: tabela, rodadas semanais, divisões por nível, ranking, artilharia, MVP, perfis e final com premiação.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "22px 0 26px" }}>
          {MODS.map((m) => (
            <span key={m} style={{ fontSize: 14, fontWeight: 700, color: C.text1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 30, padding: "9px 16px" }}>{m}</span>
          ))}
        </div>
        <Btn variant="gold" onClick={() => goForm("Capitão / organizador", "Participar de liga")}>Inscrever meu time</Btn>
      </Section>

      {/* APP / OS */}
      <Section id="app">
        <div style={eyebrow}>PITCH OS</div>
        <h2 style={h2}>O app para organizar a sua pelada e a sua liga.</h2>
        <p style={lead}>O sistema que conecta capitães, jogadores, times e ligas.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginTop: 26 }}>
          {[
            ["Próximo jogo", "Confirmados, pendentes e pagamentos num relance."],
            ["Ranking", "Artilharia · MVPs · vitórias · assistências."],
            ["Perfil do jogador", "Jogos, golos, assistências, títulos e vídeos."],
            ["Gestão do capitão", "Chamar jogadores, cobrar pendentes e sortear times."],
          ].map(([t, d]) => (
            <div key={t} className="lg-card" style={card}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 800, letterSpacing: "0.08em" }}>{t.toUpperCase()}</div>
              <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5, marginTop: 8 }}>{d}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24 }}>
          <Btn variant="ghost" onClick={onEnterApp}>Testar o app →</Btn>
        </div>
      </Section>

      {/* FOUNDER TEAMS */}
      <Section id="founder" style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>Founder Teams</div>
        <h2 style={h2}>Seja um time fundador.</h2>
        <p style={lead}>Os primeiros times do PITCH terão prioridade na liga, no app e nos futuros benefícios do clube.</p>
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

      {/* CORPORATE */}
      <Section id="empresas">
        <div style={eyebrow}>Corporate League</div>
        <h2 style={h2}>Futebol para empresas, sem trabalho para o RH.</h2>
        <p style={lead}>Organizamos ligas e torneios corporativos com tabela, ranking, final, premiação e experiência social.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "24px 0" }}>
          {["Torneios internos", "Liga entre empresas", "Team building", "Fotos e vídeos", "Happy hour", "Ranking por empresa", "Premiação", "Naming / patrocínio"].map((x) => (
            <div key={x} style={{ ...card, padding: 14, fontSize: 14, color: C.text1 }}>{x}</div>
          ))}
        </div>
        <Btn variant="gold" onClick={() => goForm("Empresa", "Liga corporativa")}>Quero uma liga corporativa</Btn>
      </Section>

      {/* SPONSORS */}
      <Section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={eyebrow}>Marcas & Parceiros</div>
        <h2 style={h2}>A sua marca dentro da comunidade do futebol amador.</h2>
        <p style={lead}>Patrocine rankings, ligas, artilharia, MVP, finais, conteúdo e eventos — e ative junto de jogadores e times locais.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "22px 0 24px" }}>
          {["Naming da liga", "Sponsor da artilharia", "Sponsor do MVP", "Sponsor do ranking", "Sponsor da final", "Cupões para jogadores", "Presença no app"].map((x) => (
            <span key={x} style={{ fontSize: 13.5, color: C.text2, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "8px 14px" }}>{x}</span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={() => goForm("Patrocinador", "Patrocinar")}>Quero patrocinar</Btn>
          <Btn variant="ghost" onClick={() => goForm("Dono de campo / parceiro", "Parceria com campo")}>Sou dono de campo</Btn>
        </div>
      </Section>

      {/* LEAD FORM */}
      <Section id="lead">
        <div ref={formRef} />
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={eyebrow}>Entra na lista</div>
          <h2 style={{ ...h2, margin: "10px auto 0" }}>Garante o teu lugar na PITCH League.</h2>
          <p style={{ ...lead, margin: "12px auto 0" }}>Times, jogadores, empresas e parceiros — diz-nos quem és e entramos em contacto.</p>
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
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>O futebol amador levado a sério. Porto / Matosinhos.</div>
          </div>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, letterSpacing: "0.1em" }}>PRODUTO</div>
              <a className="lg-link" href="#liga" style={{ fontSize: 14 }}>PITCH League</a>
              <a className="lg-link" href="#app" style={{ fontSize: 14 }}>PITCH OS</a>
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
        <div style={{ ...wrap, marginTop: 28, fontSize: 12, color: C.text3 }}>© {new Date().getFullYear()} PITCH · O futebol amador levado a sério.</div>
      </footer>
    </div>
  );
}
