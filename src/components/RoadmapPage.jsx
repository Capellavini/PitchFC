import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { C, BRAND, displayFont } from "../theme";
import RoadmapCalculator from "./RoadmapCalculator";
import { t } from "../lib/roadmapI18n";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

// Chart-specific palette — validated for a dark surface (lightness band,
// CVD separation) separately from the app's UI accent colors, which are
// tuned to pop as small UI elements, not as large chart fills. Same hue
// families as C.accent/blue/orange/green/AVATAR_PALETTE's violet, just
// re-stepped for use as chart marks.
const CHART = {
  cat1: "#6E9C13", cat2: "#3B7FE0", cat3: "#C77220", cat4: "#8B6FE0", cat5: "#2BAE7A",
  ord1: "#C8FF00", ord2: "#6E9C13", ord3: "#3F5217",
};

/** Fixed UI chrome (nav, section headings, table headers, static labels) is
 *  bilingual inline, since it's component copy, not admin-editable content.
 *  Everything that comes from the roadmap_content document instead goes
 *  through `t(value, lang)`. */
const UI = {
  nav: [
    ["resumo", { pt: "Resumo", en: "Summary" }], ["empresa", { pt: "Empresa", en: "Company" }],
    ["hoje", { pt: "O que já existe", en: "What exists" }], ["roadmap", { pt: "Roadmap", en: "Roadmap" }],
    ["precario", { pt: "Preçário", en: "Pricing" }], ["mercado", { pt: "Mercado", en: "Market" }],
    ["concorrencia", { pt: "Concorrência", en: "Competition" }], ["modelo", { pt: "Modelo de negócio", en: "Business model" }],
    ["custos", { pt: "Financeiro", en: "Financials" }], ["marketing", { pt: "Marketing", en: "Marketing" }],
    ["parcerias", { pt: "Parcerias", en: "Partnerships" }], ["marcas", { pt: "Brand deals", en: "Brand deals" }],
    ["gestao", { pt: "Gestão", en: "Management" }], ["riscos", { pt: "Riscos", en: "Risks" }],
    ["anexo", { pt: "Próximos passos", en: "Next steps" }],
  ],
  edit: { pt: "Editar em /admin", en: "Edit in /admin" },
  signOut: { pt: "Sair", en: "Sign out" },
  eyebrowRoot: { pt: "PITCH · PLANO DE JOGO", en: "PITCH · GAME PLAN" },
  s01: { n: "01 — Sumário executivo", title: { pt: "01 — Sumário executivo", en: "01 — Executive summary" }, sub: { pt: "O que é, para quem, e porquê agora", en: "What it is, for whom, and why now" } },
  s02: { title: { pt: "02 — Descrição da empresa", en: "02 — Company description" }, sub: { pt: "Missão, operação e custos de arranque", en: "Mission, operations and startup costs" } },
  mission: { pt: "Missão", en: "Mission" },
  startupCosts: { pt: "Despesas de arranque — 12 meses", en: "Startup expenses — 12 months" },
  colItem: { pt: "Rubrica", en: "Item" }, colKind: { pt: "Natureza", en: "Type" }, colY1: { pt: "Ano 1", en: "Year 1" }, total: { pt: "Total", en: "Total" },
  s03: { title: { pt: "03 — Ponto de partida", en: "03 — Starting point" }, sub: { pt: "O que já existe", en: "What already exists" }, note: { pt: "Inventário do que está em produção hoje.", en: "Inventory of what is live today." } },
  live: { pt: "EM PRODUÇÃO", en: "LIVE" }, todo: { pt: "POR ATIVAR", en: "TO ACTIVATE" },
  s04: { title: { pt: "04 — Roteiro de produto", en: "04 — Product roadmap" }, sub: { pt: "Roadmap", en: "Roadmap" } },
  s05: { title: { pt: "05 — Produto e serviços", en: "05 — Products & services" }, sub: { pt: "Preçário", en: "Pricing" }, note: { pt: "O que é grátis, o que é pago, e o que a empresa compra.", en: "What's free, what's paid, and what companies buy." } },
  s06: { title: { pt: "06 — Dimensão de mercado", en: "06 — Market size" }, sub: { pt: "TAM · SAM · SOM — Portugal + Brasil", en: "TAM · SAM · SOM — Portugal + Brazil" } },
  s07: { title: { pt: "07 — Avaliação competitiva", en: "07 — Competitive assessment" }, sub: { pt: "Quem mais resolve isto", en: "Who else solves this" }, note: { pt: "O concorrente real não é uma app — é o status quo gratuito.", en: "The real competitor isn't an app — it's the free status quo." } },
  colCategory: { pt: "Categoria", en: "Category" }, colSolves: { pt: "O que resolve", en: "What it solves" }, colFails: { pt: "Onde falha para o nosso cliente", en: "Where it fails our customer" },
  advantage: { pt: "Vantagem defensável", en: "Defensible advantage" },
  s08: { title: { pt: "08 — Modelo de negócio", en: "08 — Business model" }, sub: { pt: "Vias de receita", en: "Revenue streams" } },
  s09: { title: { pt: "09 — Plano financeiro", en: "09 — Financial plan" }, sub: { pt: "Cenário-base, e um modelo que podes mexer", en: "Base case, and a model you can adjust" } },
  revCosts: { pt: "Receita vs. custos em caixa (€)", en: "Revenue vs. costs (€)" },
  noFinRows: { pt: "Sem linhas financeiras ainda — adiciona em /admin.", en: "No financial rows yet — add them in /admin." },
  legendRev: { pt: "Receita", en: "Revenue" }, legendCosts: { pt: "Custos", en: "Costs" },
  colYear: { pt: "Ano", en: "Year" }, colGroups: { pt: "Grupos", en: "Groups" }, colRevenue: { pt: "Receita", en: "Revenue" }, colCostsT: { pt: "Custos", en: "Costs" }, colSources: { pt: "Fontes", en: "Sources" },
  testAssumptions: { pt: "Testa as tuas próprias premissas", en: "Test your own assumptions" },
  testNote: { pt: "Mexe nos valores e tudo recalcula, incluindo o ponto de equilíbrio.", en: "Adjust the values and everything recalculates, including break-even." },
  defaultCalcNote: { pt: "Modelo de estado estável: assume o número de grupos constante ao longo de doze meses e não modela crescimento, churn nem sazonalidade. Serve para testar ordem de grandeza e sensibilidade ao preço — não substitui uma projecção mensal de tesouraria.", en: "Steady-state model: assumes a constant group count over twelve months and does not model growth, churn or seasonality. It is for testing order of magnitude and price sensitivity — it does not replace a monthly cash-flow projection." },
  s10: { title: { pt: "10 — Marketing", en: "10 — Marketing" }, sub: { pt: "Como crescer", en: "How to grow" } },
  s11: { title: { pt: "11 — Parcerias", en: "11 — Partnerships" }, sub: { pt: "Quem torna o roteiro mais barato de executar", en: "Who makes the roadmap cheaper to execute" } },
  s12: { title: { pt: "12 — Brand deals", en: "12 — Brand deals" }, sub: { pt: "Onde uma marca pode aparecer sem estragar a experiência", en: "Where a brand can appear without hurting the experience" } },
  s13: { title: { pt: "13 — Plano de gestão", en: "13 — Management plan" }, sub: { pt: "Quem faz o quê, e por que ordem se contrata", en: "Who does what, and in what order we hire" } },
  today: { pt: "Hoje", en: "Today" },
  hiringPlan: { pt: "Aconselhamento externo", en: "External advisors" },
  colWhen: { pt: "Quando", en: "When" }, colRole: { pt: "Função", en: "Role" }, colTrigger: { pt: "Gatilho", en: "Trigger" }, colAnnualCost: { pt: "Custo anual", en: "Annual cost" },
  s14: { title: { pt: "14 — Riscos & mitigação", en: "14 — Risks & mitigation" }, sub: { pt: "O que pode correr mal, e o que já aponta na direção certa", en: "What can go wrong, and what already points the right way" } },
  mitigation: { pt: "Mitigação:", en: "Mitigation:" },
  s15: { title: { pt: "15 — Próximos passos", en: "15 — Next steps" }, sub: { pt: "O que falta para este plano ficar defensável", en: "What this plan still needs to be defensible" }, note: { pt: "Por ordem: o que muda a conversa com um investidor ou parceiro.", en: "In order: what changes the conversation with an investor or partner." } },
};

const fmtK = (n) => (Math.abs(n) >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`);
const niceMax = (v) => {
  if (v <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
};

const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.accent };
const secH = (n, title, sub) => (
  <div style={{ marginBottom: 26 }}>
    <div style={eyebrow}>{n}</div>
    <div style={{ ...displayFont, fontSize: 26, marginTop: 8 }}>{title}</div>
    {sub && <div style={{ fontSize: 14, color: C.text2, marginTop: 8, maxWidth: 680, lineHeight: 1.6 }}>{sub}</div>}
  </div>
);
const pillTag = (label, kind) => {
  const colors = { done: [C.greenDim ?? "rgba(0,208,138,0.1)", C.green], beta: [C.orangeDim ?? "rgba(255,159,10,0.1)", C.orange], live: ["rgba(0,208,138,0.1)", C.green], next: ["rgba(255,159,10,0.1)", C.orange], later: ["rgba(138,148,168,0.12)", C.text2] };
  const [bg, fg] = colors[kind] || [C.card, C.text2];
  return <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 9, background: bg, color: fg }}>{label}</span>;
};
/** Assumption / caveat block. Orange rail = "this number is an estimate",
 *  used consistently everywhere a figure is not primary research. */
const noteBox = (text, bg = C.card) => (
  <div style={{ marginTop: 16, padding: "12px 14px", background: bg, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{text}</div>
);

const langBtnStyle = (active) => ({
  background: active ? C.accent : "none", color: active ? C.bg : C.text2,
  border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 7, padding: "4px 10px",
  fontSize: 11.5, fontWeight: 800, cursor: "pointer",
});

/** Standalone page at /roadmap — own auth gate (copies AdminDashboardPage's
 *  demo/loading/login/not-admin states, since this is a separate top-level
 *  route someone can land on directly). Renders the roadmap_content JSON
 *  document (edited from /admin → Roadmap) as a read-only page; the two
 *  charts compute their geometry from the loaded numbers instead of using
 *  hand-coded coordinates, so editing a number in /admin moves the chart.
 *  Every document field is bilingual (`{ pt, en }`); the PT/EN toggle in the
 *  header switches `lang`, read via `t()` everywhere below. */
export default function RoadmapPage({ cloud, localMode }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, doc: null });
  const [lang, setLang] = useState(() => {
    try { const sv = localStorage.getItem("pitch_roadmap_lang"); return sv === "en" || sv === "pt" ? sv : "pt"; } catch { return "pt"; }
  });
  const changeLang = (l) => { setLang(l); try { localStorage.setItem("pitch_roadmap_lang", l); } catch { /* ignore */ } };

  const canLoad = Boolean(cloud.user) && cloud.isAdmin;

  useEffect(() => {
    if (!canLoad) return;
    (async () => {
      setState((s) => ({ ...s, loading: true }));
      const res = await cloud.fetchRoadmapContent();
      setState({ loading: false, error: res.error ?? null, doc: res.data ?? null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const page = (children) => <div style={{ minHeight: "100vh", background: C.bg, color: C.text1, fontFamily: FONT }}>{children}</div>;
  const centeredMessage = (title, body, action) => page(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 26, marginBottom: 24 }} />
        <div style={{ ...displayFont, fontSize: 20, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{body}</div>
        {action}
      </div>
    </div>
  );

  if (localMode) return centeredMessage("Roadmap", "A app está em modo demonstração (sem chaves Supabase configuradas). Esta página precisa de ligação à cloud.");
  if (cloud.status === "loading") return centeredMessage("A ligar…", "A verificar sessão.");
  if (!cloud.user) {
    const submit = async (e) => {
      e.preventDefault();
      setAuthBusy(true); setAuthError(null);
      const res = await cloud.signIn(form.email.trim(), form.password);
      setAuthBusy(false);
      if (res?.error) setAuthError(res.error);
    };
    return page(
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 340 }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 26, marginBottom: 24, display: "block", marginLeft: "auto", marginRight: "auto" }} />
          <div style={{ ...displayFont, fontSize: 20, textAlign: "center", marginBottom: 4 }}>Roadmap</div>
          <div style={{ fontSize: 12, color: C.text2, textAlign: "center", marginBottom: 24 }}>Inicia sessão com a tua conta de administrador.</div>
          <div style={{ marginBottom: 12 }}>
            <input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="password" required placeholder="Palavra-passe" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
          {authError && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{authError}</div>}
          <button type="submit" disabled={authBusy} style={{ width: "100%", background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 800, cursor: authBusy ? "default" : "pointer", opacity: authBusy ? 0.6 : 1 }}>
            {authBusy ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }
  if (!cloud.isAdmin) {
    return centeredMessage("Sem acesso", `Sessão iniciada como ${cloud.user.email}, que não é uma conta de administrador.`,
      <button onClick={cloud.signOut} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", fontSize: 13, color: C.text2, cursor: "pointer" }}>Sair</button>);
  }
  if (state.loading) return centeredMessage("Roadmap", "A carregar conteúdo…");
  const doc = state.doc;
  if (!doc) {
    return centeredMessage("Ainda sem conteúdo", "Preenche o roadmap em /admin → separador Roadmap para esta página deixar de estar vazia.",
      <a href="/admin" style={{ display: "inline-block", background: C.accent, color: C.bg, borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Abrir /admin</a>);
  }

  const tt = (v) => t(v, lang);
  const tamMax = Math.max(1, doc.tam?.tam?.value || 0);
  const rows = doc.financials?.rows || [];
  const finMax = niceMax(Math.max(1, ...rows.flatMap((r) => [r.revenue || 0, r.costs || 0])));
  const left = 60, right = 700, top = 30, bottom = 231;
  const xFor = (i) => (rows.length > 1 ? left + 40 + ((right - left - 40) * i) / (rows.length - 1) : (left + right) / 2);
  const yFor = (v) => bottom - (v / finMax) * (bottom - top);
  const revPts = rows.map((r, i) => `${xFor(i)},${yFor(r.revenue || 0)}`).join(" ");
  const costPts = rows.map((r, i) => `${xFor(i)},${yFor(r.costs || 0)}`).join(" ");
  const areaPath = rows.length ? `M ${xFor(0)} ${bottom} L ${revPts.split(" ").join(" L ")} L ${xFor(rows.length - 1)} ${bottom} Z` : "";

  // Optional sections are hidden when the document has nothing for them, so
  // the nav must hide with them — otherwise it offers links that jump nowhere.
  const filled = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  const present = {
    resumo: filled(doc.execSummary),
    empresa: filled(doc.company?.mission) || filled(doc.company?.operations) || filled(doc.company?.startupCosts),
    precario: filled(doc.pricing),
    concorrencia: filled(doc.competitors) || filled(doc.advantages),
    gestao: filled(doc.management?.now) || filled(doc.management?.hires) || filled(doc.management?.advisors),
    anexo: filled(doc.nextSteps) || filled(doc.appendixNote),
  };
  const nav = UI.nav.filter(([id]) => present[id] !== false);

  return page(
    <div>
      {/* header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 22 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => changeLang("pt")} style={langBtnStyle(lang === "pt")}>PT</button>
            <button onClick={() => changeLang("en")} style={langBtnStyle(lang === "en")}>EN</button>
          </div>
          <a href="/admin" style={{ fontSize: 12.5, color: C.text2, textDecoration: "none" }}>{tt(UI.edit)}</a>
          <button onClick={cloud.signOut} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.text2, fontSize: 12.5, cursor: "pointer" }}><LogOut size={13} /> {tt(UI.signOut)}</button>
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: "56px 32px 40px", borderBottom: `1px solid ${C.border}`, background: `radial-gradient(ellipse 900px 420px at 50% -15%, ${C.accentDim}, transparent 60%)` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={eyebrow}>{tt(UI.eyebrowRoot)}</div>
          <div style={{ ...displayFont, fontSize: "clamp(36px,6vw,64px)", marginTop: 12, color: C.text1 }}>PITCH<span style={{ color: C.accent }}>.</span></div>
          <div style={{ fontSize: 17, color: C.text2, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>{tt(doc.hero?.tagline)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginTop: 32 }}>
            {(doc.hero?.stats || []).map((s, i) => (
              <div key={i} style={{ background: C.surface, padding: "16px 16px" }}>
                <div style={{ ...displayFont, fontSize: 24 }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: C.text2, marginTop: 4 }}>{tt(s.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,15,24,0.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", gap: 4, padding: "0 32px" }}>
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: C.text2, textDecoration: "none", padding: "13px 12px", whiteSpace: "nowrap" }}>{tt(label)}</a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 32px 100px" }}>

        {/* resumo executivo */}
        {(doc.execSummary || []).length > 0 && (
          <section id="resumo" style={{ paddingTop: 56 }}>
            {secH(UI.s01.n, tt(UI.s01.title), tt(UI.s01.sub))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {doc.execSummary.map((s, i) => (
                <div key={i} style={card}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{tt(s.title)}</div>
                  <div style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>{tt(s.desc)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* empresa */}
        {(doc.company?.mission || (doc.company?.operations || []).length > 0 || (doc.company?.startupCosts || []).length > 0) && (
          <section id="empresa" style={{ paddingTop: 56 }}>
            {secH("02", tt(UI.s02.title), tt(UI.s02.sub))}
            {doc.company?.mission && (
              <div style={{ ...card, background: C.surface, marginBottom: 12 }}>
                <div style={{ ...eyebrow, color: C.text3 }}>{tt(UI.mission)}</div>
                <div style={{ fontSize: 15, color: C.text1, marginTop: 8, lineHeight: 1.6, maxWidth: 680 }}>{tt(doc.company.mission)}</div>
              </div>
            )}
            {(doc.company?.operations || []).length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {doc.company.operations.map((o, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tt(o.title)}</div>
                    <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{tt(o.desc)}</div>
                  </div>
                ))}
              </div>
            )}
            {(doc.company?.startupCosts || []).length > 0 && (
              <div style={{ ...card, overflowX: "auto" }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>{tt(UI.startupCosts)}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 420 }}>
                  <thead>
                    <tr>
                      {[tt(UI.colItem), tt(UI.colKind), tt(UI.colY1)].map((h) => (
                        <th key={h} style={{ textAlign: h === tt(UI.colY1) ? "right" : "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.text3, fontWeight: 700, padding: "0 10px 10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.company.startupCosts.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{tt(r.item)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{tt(r.kind)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, monospace", color: C.text2 }}>€{(r.amount || 0).toLocaleString("pt-PT")}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{ padding: 10, borderTop: `1px solid ${C.border}`, fontWeight: 800 }}>{tt(UI.total)}</td>
                      <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 800, color: C.accent }}>
                        €{doc.company.startupCosts.reduce((a, r) => a + (r.amount || 0), 0).toLocaleString("pt-PT")}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {doc.company?.costsNote && noteBox(tt(doc.company.costsNote), C.surface)}
              </div>
            )}
          </section>
        )}

        {/* hoje */}
        <section id="hoje" style={{ paddingTop: 56 }}>
          {secH(UI.s03.title.pt.slice(0, 2), tt(UI.s03.title), tt(UI.s03.note))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(doc.today || []).map((f, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tt(f.title)}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{tt(f.desc)}</div>
                <div style={{ marginTop: 8 }}>{pillTag(f.status === "done" ? tt(UI.live) : tt(UI.todo), f.status)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* roadmap */}
        <section id="roadmap" style={{ paddingTop: 56 }}>
          {secH("04", tt(UI.s04.title), tt(UI.s04.sub))}
          <div>
            {(doc.phases || []).map((p, i, arr) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 18, paddingBottom: i === arr.length - 1 ? 0 : 32 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ ...displayFont, fontSize: 24, color: i === 0 ? C.accent : C.text3 }}>{p.num}</div>
                  {i !== arr.length - 1 && <div style={{ flex: 1, width: 1, background: C.border, marginTop: 8 }} />}
                </div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{tt(p.title)}</div>
                    <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 700 }}>{tt(p.when)}</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: C.text2, margin: "7px 0 10px", maxWidth: 620, lineHeight: 1.55 }}>{tt(p.desc)}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(p.tags || []).map((tag, ti) => <span key={ti} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.text2 }}>{tt(tag)}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* preçário */}
        {(doc.pricing || []).length > 0 && (
          <section id="precario" style={{ paddingTop: 56 }}>
            {secH("05", tt(UI.s05.title), tt(UI.s05.note))}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {doc.pricing.map((p, i) => (
                <div key={i} style={{ ...card, border: `1px solid ${p.highlight ? C.accentBorder : C.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{tt(p.name)}</div>
                  <div style={{ ...displayFont, fontSize: 22, color: p.highlight ? C.accent : C.text1, marginTop: 6 }}>{tt(p.price)}</div>
                  <div style={{ fontSize: 12.5, color: C.text2, marginTop: 6, lineHeight: 1.55 }}>{tt(p.desc)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* mercado */}
        <section id="mercado" style={{ paddingTop: 56 }}>
          {secH("06", tt(UI.s06.title), tt(UI.s06.sub))}
          <div style={{ ...card, background: C.surface }}>
            {["tam", "sam", "som"].map((k, i) => {
              const v = doc.tam?.[k] || { value: 0, label: {} };
              const widthPct = k === "tam" ? 100 : Math.max(1.2, (v.value / tamMax) * 100);
              const color = [CHART.ord1, CHART.ord2, CHART.ord3][i];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                  <div style={{ width: 110, flexShrink: 0, fontSize: 12.5, color: C.text2, textAlign: "right", textTransform: "uppercase", fontWeight: 700 }}>{k}</div>
                  <div style={{ flex: 1, height: 26, background: C.card, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${widthPct}%`, height: "100%", background: color, display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: widthPct > 22 ? C.bg : C.text1, padding: "0 10px", whiteSpace: "nowrap", marginLeft: widthPct > 22 ? 0 : "100%" }}>
                        {v.value?.toLocaleString("pt-PT")} · {tt(v.label)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {doc.tam?.assumptions && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.card, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{tt(doc.tam.assumptions)}</div>
            )}
          </div>
        </section>

        {/* concorrência */}
        {((doc.competitors || []).length > 0 || (doc.advantages || []).length > 0) && (
          <section id="concorrencia" style={{ paddingTop: 56 }}>
            {secH("07", tt(UI.s07.title), tt(UI.s07.note))}
            {(doc.competitors || []).length > 0 && (
              <div style={{ ...card, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 620 }}>
                  <thead>
                    <tr>
                      {[tt(UI.colCategory), tt(UI.colSolves), tt(UI.colFails)].map((h) => (
                        <th key={h} style={{ textAlign: "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.text3, fontWeight: 700, padding: "0 10px 10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.competitors.map((c, i) => (
                      <tr key={i}>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, verticalAlign: "top", width: 190 }}>
                          <div style={{ fontWeight: 700 }}>{tt(c.category)}</div>
                          {c.examples && <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{tt(c.examples)}</div>}
                        </td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, verticalAlign: "top" }}>{tt(c.solves)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, verticalAlign: "top" }}>{tt(c.fails)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(doc.advantages || []).length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, margin: "22px 0 10px" }}>{tt(UI.advantage)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {doc.advantages.map((a, i) => (
                    <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{tt(a.title)}</div>
                      <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{tt(a.desc)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* modelo */}
        <section id="modelo" style={{ paddingTop: 56 }}>
          {secH("08", tt(UI.s08.title), tt(UI.s08.sub))}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(doc.revenueStreams || []).map((s, i) => (
              <div key={i} style={{ ...card, display: "flex", gap: 14 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, marginTop: 5, flexShrink: 0, background: [CHART.cat1, CHART.cat2, CHART.cat3, CHART.cat4, CHART.cat5][i % 5] }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{tt(s.title)}</div>
                  <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.55 }}>{tt(s.desc)}</div>
                  <div style={{ marginTop: 7 }}>{pillTag(tt(s.statusLabel), s.statusKind)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* custos */}
        <section id="custos" style={{ paddingTop: 56 }}>
          {secH("09", tt(UI.s09.title), tt(UI.s09.sub))}
          <div style={{ ...card, background: C.surface }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{tt(UI.revCosts)}</div>
            {rows.length > 0 ? (
              <svg viewBox="0 0 720 300" style={{ width: "100%", height: "auto", marginTop: 16, overflow: "visible" }}>
                <g stroke={C.border} strokeWidth="1">
                  <line x1={left} y1={top} x2={right} y2={top} />
                  <line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} />
                  <line x1={left} y1={bottom} x2={right} y2={bottom} />
                </g>
                <g fontSize="10.5" fill={C.text3} fontFamily="ui-monospace, monospace">
                  <text x={left - 8} y={top + 4} textAnchor="end">{fmtK(finMax)}</text>
                  <text x={left - 8} y={(top + bottom) / 2 + 4} textAnchor="end">{fmtK(finMax / 2)}</text>
                  <text x={left - 8} y={bottom + 4} textAnchor="end">€0</text>
                </g>
                <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={C.text3} strokeWidth="1.5" />
                {areaPath && <path d={areaPath} fill={CHART.cat1} opacity="0.16" />}
                <polyline points={revPts} fill="none" stroke={CHART.cat1} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={costPts} fill="none" stroke={CHART.cat2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {rows.map((r, i) => (
                  <g key={i}>
                    <circle cx={xFor(i)} cy={yFor(r.revenue || 0)} r="4.5" fill={CHART.cat1}><title>{tt(r.year)} · {tt(UI.legendRev)} ≈ {fmtK(r.revenue || 0)}</title></circle>
                    <circle cx={xFor(i)} cy={yFor(r.costs || 0)} r="4.5" fill={CHART.cat2}><title>{tt(r.year)} · {tt(UI.legendCosts)} ≈ {fmtK(r.costs || 0)}</title></circle>
                    <text x={xFor(i)} y={256} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text2}>{tt(r.year)}</text>
                  </g>
                ))}
              </svg>
            ) : <div style={{ fontSize: 13, color: C.text3, marginTop: 16 }}>{tt(UI.noFinRows)}</div>}
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART.cat1 }} />{tt(UI.legendRev)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART.cat2 }} />{tt(UI.legendCosts)}</div>
            </div>
          </div>
          <div style={{ height: 14 }} />
          <div style={{ ...card, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 480 }}>
              <thead>
                <tr>
                  {[tt(UI.colYear), tt(UI.colGroups), tt(UI.colRevenue), tt(UI.colCostsT), tt(UI.colSources)].map((h) => (
                    <th key={h} style={{ textAlign: h === tt(UI.colRevenue) || h === tt(UI.colCostsT) ? "right" : "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.text3, fontWeight: 700, padding: "0 10px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, fontWeight: 600 }}>{tt(r.year)}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{tt(r.groups)}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>€{(r.revenue || 0).toLocaleString("pt-PT")}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>€{(r.costs || 0).toLocaleString("pt-PT")}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{tt(r.sources)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {doc.financials?.assumptions && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.surface, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{tt(doc.financials.assumptions)}</div>
            )}
          </div>

          {/* Interactive model — lets a partner or investor replace our
              assumptions with theirs instead of arguing with a static table. */}
          <div style={{ height: 28 }} />
          <div style={{ ...displayFont, fontSize: 19 }}>{tt(UI.testAssumptions)}</div>
          <div style={{ fontSize: 13.5, color: C.text2, margin: "6px 0 14px", maxWidth: 680, lineHeight: 1.6 }}>
            {tt(UI.testNote)}
          </div>
          <RoadmapCalculator defaults={doc.calculator} lang={lang} />
          {noteBox(doc.calculatorNote ? tt(doc.calculatorNote) : tt(UI.defaultCalcNote), C.surface)}
        </section>

        {/* marketing */}
        <section id="marketing" style={{ paddingTop: 56 }}>
          {secH("10", tt(UI.s10.title), tt(UI.s10.sub))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(doc.marketing || []).map((m, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{tt(m.title)}</div>
                <div style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>{tt(m.desc)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* parcerias */}
        <section id="parcerias" style={{ paddingTop: 56 }}>
          {secH("11", tt(UI.s11.title), tt(UI.s11.sub))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(doc.partnerships || []).map((p, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text3 }}>{tt(p.category)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{tt(p.name)}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 5, lineHeight: 1.5 }}>{tt(p.why)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* marcas */}
        <section id="marcas" style={{ paddingTop: 56 }}>
          {secH("12", tt(UI.s12.title), tt(UI.s12.sub))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(doc.brandDeals || []).map((b, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tt(b.title)}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{tt(b.desc)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* gestão */}
        {((doc.management?.hires || []).length > 0 || doc.management?.now || doc.management?.advisors) && (
          <section id="gestao" style={{ paddingTop: 56 }}>
            {secH("13", tt(UI.s13.title), tt(UI.s13.sub))}
            {doc.management?.now && (
              <div style={{ ...card, background: C.surface, marginBottom: 12 }}>
                <div style={{ ...eyebrow, color: C.text3 }}>{tt(UI.today)}</div>
                <div style={{ fontSize: 13.5, color: C.text2, marginTop: 8, lineHeight: 1.6, maxWidth: 680 }}>{tt(doc.management.now)}</div>
              </div>
            )}
            {(doc.management?.hires || []).length > 0 && (
              <div style={{ ...card, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
                  <thead>
                    <tr>
                      {[tt(UI.colWhen), tt(UI.colRole), tt(UI.colTrigger), tt(UI.colAnnualCost)].map((h) => (
                        <th key={h} style={{ textAlign: h === tt(UI.colAnnualCost) ? "right" : "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.text3, fontWeight: 700, padding: "0 10px 10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {doc.management.hires.map((h, i) => (
                      <tr key={i}>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: "nowrap" }}>{tt(h.when)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>{tt(h.role)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{tt(h.trigger)}</td>
                        <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, textAlign: "right", fontFamily: "ui-monospace, monospace", color: C.text2 }}>€{(h.cost || 0).toLocaleString("pt-PT")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {doc.management?.advisors && (
              <div style={{ ...card, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{tt(UI.hiringPlan)}</div>
                <div style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>{tt(doc.management.advisors)}</div>
              </div>
            )}
          </section>
        )}

        {/* riscos */}
        <section id="riscos" style={{ paddingTop: 56 }}>
          {secH("14", tt(UI.s14.title), tt(UI.s14.sub))}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            {(doc.risks || []).map((r, i) => (
              <div key={i} style={{ background: C.card, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{tt(r.risk)}</div>
                <div style={{ fontSize: 13, color: C.text2 }}><b style={{ color: C.green }}>{tt(UI.mitigation)}</b> {tt(r.mitigation)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* anexo — o que falta para o plano ficar defensável */}
        {((doc.nextSteps || []).length > 0 || doc.appendixNote) && (
          <section id="anexo" style={{ paddingTop: 56, paddingBottom: 40 }}>
            {secH("15", tt(UI.s15.title), tt(UI.s15.note))}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(doc.nextSteps || []).map((s, i) => (
                <div key={i} style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ ...displayFont, fontSize: 20, color: C.accent, minWidth: 26 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{tt(s.title)}</div>
                    <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.55 }}>{tt(s.desc)}</div>
                  </div>
                </div>
              ))}
            </div>
            {doc.appendixNote && noteBox(tt(doc.appendixNote), C.surface)}
          </section>
        )}

      </div>
    </div>
  );
}
