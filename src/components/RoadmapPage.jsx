import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { C, BRAND, displayFont } from "../theme";

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

const NAV = [
  ["hoje", "O que já existe"], ["roadmap", "Roadmap"], ["mercado", "Mercado"],
  ["modelo", "Modelo de negócio"], ["custos", "Custos vs. receita"], ["marketing", "Marketing"],
  ["parcerias", "Parcerias"], ["marcas", "Brand deals"], ["riscos", "Riscos"],
];

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

/** Standalone page at /roadmap — own auth gate (copies AdminDashboardPage's
 *  demo/loading/login/not-admin states, since this is a separate top-level
 *  route someone can land on directly). Renders the roadmap_content JSON
 *  document (edited from /admin → Roadmap) as a read-only page; the two
 *  charts compute their geometry from the loaded numbers instead of using
 *  hand-coded coordinates, so editing a number in /admin moves the chart. */
export default function RoadmapPage({ cloud, localMode }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, doc: null });

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

  const tamMax = Math.max(1, doc.tam?.tam?.value || 0);
  const rows = doc.financials?.rows || [];
  const finMax = niceMax(Math.max(1, ...rows.flatMap((r) => [r.revenue || 0, r.costs || 0])));
  const left = 60, right = 700, top = 30, bottom = 231;
  const xFor = (i) => (rows.length > 1 ? left + 40 + ((right - left - 40) * i) / (rows.length - 1) : (left + right) / 2);
  const yFor = (v) => bottom - (v / finMax) * (bottom - top);
  const revPts = rows.map((r, i) => `${xFor(i)},${yFor(r.revenue || 0)}`).join(" ");
  const costPts = rows.map((r, i) => `${xFor(i)},${yFor(r.costs || 0)}`).join(" ");
  const areaPath = rows.length ? `M ${xFor(0)} ${bottom} L ${revPts.split(" ").join(" L ")} L ${xFor(rows.length - 1)} ${bottom} Z` : "";

  return page(
    <div>
      {/* header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 22 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/admin" style={{ fontSize: 12.5, color: C.text2, textDecoration: "none" }}>Editar em /admin</a>
          <button onClick={cloud.signOut} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.text2, fontSize: 12.5, cursor: "pointer" }}><LogOut size={13} /> Sair</button>
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: "56px 32px 40px", borderBottom: `1px solid ${C.border}`, background: `radial-gradient(ellipse 900px 420px at 50% -15%, ${C.accentDim}, transparent 60%)` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <div style={eyebrow}>PITCH · PLANO DE JOGO</div>
          <div style={{ ...displayFont, fontSize: "clamp(36px,6vw,64px)", marginTop: 12, color: C.text1 }}>PITCH<span style={{ color: C.accent }}>.</span></div>
          <div style={{ fontSize: 17, color: C.text2, marginTop: 14, maxWidth: 620, lineHeight: 1.6 }}>{doc.hero?.tagline}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginTop: 32 }}>
            {(doc.hero?.stats || []).map((s, i) => (
              <div key={i} style={{ background: C.surface, padding: "16px 16px" }}>
                <div style={{ ...displayFont, fontSize: 24 }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: C.text2, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(10,15,24,0.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", gap: 4, padding: "0 32px" }}>
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: C.text2, textDecoration: "none", padding: "13px 12px", whiteSpace: "nowrap" }}>{label}</a>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 32px 100px" }}>

        {/* hoje */}
        <section id="hoje" style={{ paddingTop: 56 }}>
          {secH("01 — Ponto de partida", "O que já existe", "Inventário do que está em produção hoje.")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(doc.today || []).map((f, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{f.desc}</div>
                <div style={{ marginTop: 8 }}>{pillTag(f.status === "done" ? "EM PRODUÇÃO" : "POR ATIVAR", f.status)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* roadmap */}
        <section id="roadmap" style={{ paddingTop: 56 }}>
          {secH("02 — Roteiro de produto", "Roadmap")}
          <div>
            {(doc.phases || []).map((p, i, arr) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 18, paddingBottom: i === arr.length - 1 ? 0 : 32 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ ...displayFont, fontSize: 24, color: i === 0 ? C.accent : C.text3 }}>{p.num}</div>
                  {i !== arr.length - 1 && <div style={{ flex: 1, width: 1, background: C.border, marginTop: 8 }} />}
                </div>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{p.title}</div>
                    <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 700 }}>{p.when}</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: C.text2, margin: "7px 0 10px", maxWidth: 620, lineHeight: 1.55 }}>{p.desc}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(p.tags || []).map((t, ti) => <span key={ti} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, color: C.text2 }}>{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* mercado */}
        <section id="mercado" style={{ paddingTop: 56 }}>
          {secH("03 — Dimensão de mercado", "TAM · SAM · SOM — Portugal + Brasil")}
          <div style={{ ...card, background: C.surface }}>
            {["tam", "sam", "som"].map((k, i) => {
              const v = doc.tam?.[k] || { value: 0, label: "" };
              const widthPct = k === "tam" ? 100 : Math.max(1.2, (v.value / tamMax) * 100);
              const color = [CHART.ord1, CHART.ord2, CHART.ord3][i];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
                  <div style={{ width: 110, flexShrink: 0, fontSize: 12.5, color: C.text2, textAlign: "right", textTransform: "uppercase", fontWeight: 700 }}>{k}</div>
                  <div style={{ flex: 1, height: 26, background: C.card, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ width: `${widthPct}%`, height: "100%", background: color, display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: widthPct > 22 ? C.bg : C.text1, padding: "0 10px", whiteSpace: "nowrap", marginLeft: widthPct > 22 ? 0 : "100%" }}>
                        {v.value?.toLocaleString("pt-PT")} · {v.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {doc.tam?.assumptions && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.card, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{doc.tam.assumptions}</div>
            )}
          </div>
        </section>

        {/* modelo */}
        <section id="modelo" style={{ paddingTop: 56 }}>
          {secH("04 — Modelo de negócio", "Vias de receita")}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(doc.revenueStreams || []).map((s, i) => (
              <div key={i} style={{ ...card, display: "flex", gap: 14 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, marginTop: 5, flexShrink: 0, background: [CHART.cat1, CHART.cat2, CHART.cat3, CHART.cat4, CHART.cat5][i % 5] }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.55 }}>{s.desc}</div>
                  <div style={{ marginTop: 7 }}>{pillTag(s.statusLabel, s.statusKind)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* custos */}
        <section id="custos" style={{ paddingTop: 56 }}>
          {secH("05 — Custos vs. receita potencial", "Cenário-base")}
          <div style={{ ...card, background: C.surface }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Receita vs. custos em caixa (€)</div>
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
                    <circle cx={xFor(i)} cy={yFor(r.revenue || 0)} r="4.5" fill={CHART.cat1}><title>{r.year} · Receita ≈ {fmtK(r.revenue || 0)}</title></circle>
                    <circle cx={xFor(i)} cy={yFor(r.costs || 0)} r="4.5" fill={CHART.cat2}><title>{r.year} · Custos ≈ {fmtK(r.costs || 0)}</title></circle>
                    <text x={xFor(i)} y={256} textAnchor="middle" fontSize="12" fontWeight="700" fill={C.text2}>{r.year}</text>
                  </g>
                ))}
              </svg>
            ) : <div style={{ fontSize: 13, color: C.text3, marginTop: 16 }}>Sem linhas financeiras ainda — adiciona em /admin.</div>}
            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART.cat1 }} />Receita</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text2 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: CHART.cat2 }} />Custos</div>
            </div>
          </div>
          <div style={{ height: 14 }} />
          <div style={{ ...card, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 480 }}>
              <thead>
                <tr>
                  {["Ano", "Grupos", "Receita", "Custos", "Fontes"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Receita" || h === "Custos" ? "right" : "left", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: C.text3, fontWeight: 700, padding: "0 10px 10px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, fontWeight: 600 }}>{r.year}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{r.groups}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>€{(r.revenue || 0).toLocaleString("pt-PT")}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>€{(r.costs || 0).toLocaleString("pt-PT")}</td>
                    <td style={{ padding: 10, borderTop: `1px solid ${C.border}`, color: C.text2 }}>{r.sources}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {doc.financials?.assumptions && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.surface, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{doc.financials.assumptions}</div>
            )}
          </div>
        </section>

        {/* marketing */}
        <section id="marketing" style={{ paddingTop: 56 }}>
          {secH("06 — Marketing", "Como crescer")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(doc.marketing || []).map((m, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 1.6 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* parcerias */}
        <section id="parcerias" style={{ paddingTop: 56 }}>
          {secH("07 — Parcerias", "Quem torna o roteiro mais barato de executar")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(doc.partnerships || []).map((p, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text3 }}>{p.category}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 5, lineHeight: 1.5 }}>{p.why}</div>
              </div>
            ))}
          </div>
        </section>

        {/* marcas */}
        <section id="marcas" style={{ paddingTop: 56 }}>
          {secH("08 — Brand deals", "Onde uma marca pode aparecer sem estragar a experiência")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {(doc.brandDeals || []).map((b, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{b.title}</div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>{b.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* riscos */}
        <section id="riscos" style={{ paddingTop: 56, paddingBottom: 40 }}>
          {secH("09 — Riscos & mitigação", "O que pode correr mal, e o que já aponta na direção certa")}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.border, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            {(doc.risks || []).map((r, i) => (
              <div key={i} style={{ background: C.card, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.risk}</div>
                <div style={{ fontSize: 13, color: C.text2 }}><b style={{ color: C.green }}>Mitigação:</b> {r.mitigation}</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
