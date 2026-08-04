import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { C, cardStyle } from "../../theme";

const inputStyle = { width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.text1, outline: "none", fontFamily: "inherit" };
const labelStyle = { fontSize: 11, color: C.text3, marginBottom: 4, fontWeight: 700 };

const EMPTY_DOC = {
  hero: { tagline: "", stats: [{ value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }, { value: "", label: "" }] },
  today: [], phases: [],
  tam: { tam: { value: 0, label: "" }, sam: { value: 0, label: "" }, som: { value: 0, label: "" }, assumptions: "" },
  revenueStreams: [], financials: { rows: [], assumptions: "" },
  marketing: [], partnerships: [], brandDeals: [], risks: [],
};

function Field({ f, value, onChange }) {
  if (f.type === "textarea") {
    return <textarea rows={f.rows || 2} value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />;
  }
  if (f.type === "tags") {
    return <input value={(value || []).join(", ")} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="separado por vírgulas" style={inputStyle} />;
  }
  if (f.type === "select") {
    return (
      <select value={value || f.options[0].value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (f.type === "number") {
    return <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)} style={inputStyle} />;
  }
  return <input value={value || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
}

/** Generic repeater used for every array-shaped section of the roadmap
 *  document (today/phases/revenueStreams/partnerships/brandDeals/risks/
 *  marketing/financials.rows) — one config, reused 8x, instead of 8
 *  bespoke editors. */
function ListEditor({ title, items, fields, onChange }) {
  const update = (i, key, val) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, f.type === "tags" ? [] : f.type === "number" ? 0 : ""]))]);

  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
        <button onClick={add} style={{ display: "flex", alignItems: "center", gap: 5, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, position: "relative" }}>
            <button onClick={() => remove(i)} title="Remover" style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}>
              <Trash2 size={14} />
            </button>
            <div style={{ display: "grid", gridTemplateColumns: fields.length > 2 ? "1fr 1fr" : "1fr", gap: 10, paddingRight: 24 }}>
              {fields.map((f) => (
                <div key={f.key} style={f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                  <div style={labelStyle}>{f.label}</div>
                  <Field f={f} value={item[f.key]} onChange={(v) => update(i, f.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Sem itens ainda.</div>}
      </div>
    </div>
  );
}

/** Editor for the whole /roadmap document (one JSONB row, roadmap_content).
 *  Loads once via cloud.fetchRoadmapContent, edits a local copy, a single
 *  "Guardar" writes the whole document back — same convention as
 *  OnboardingOrganizer (local form state + one submit), since this is
 *  infrequent single-editor content, not a live form. */
export default function AdminRoadmapTab({ cloud, roadmap, refetchRoadmap }) {
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (roadmap?.data) setDoc({ ...EMPTY_DOC, ...roadmap.data });
  }, [roadmap?.data]);

  const set = (key, val) => setDoc((d) => ({ ...d, [key]: val }));

  const save = async () => {
    setBusy(true); setMsg(null);
    const res = await cloud.saveRoadmapContent(doc);
    setBusy(false);
    if (res?.error) { setMsg({ ok: false, text: res.error }); return; }
    setMsg({ ok: true, text: "Guardado — já está em /roadmap." });
    refetchRoadmap();
  };

  if (roadmap?.loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, position: "sticky", top: 0, background: C.bg, paddingBottom: 8, zIndex: 5 }}>
        <button onClick={save} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 7, background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          <Save size={14} /> {busy ? "A guardar…" : "Guardar tudo"}
        </button>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
        <a href="/roadmap" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: C.text2 }}>Ver /roadmap →</a>
      </div>

      {/* Hero */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Hero</div>
        <div style={labelStyle}>Tagline</div>
        <textarea rows={2} value={doc.hero.tagline} onChange={(e) => set("hero", { ...doc.hero, tagline: e.target.value })} style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {doc.hero.stats.map((s, i) => (
            <div key={i}>
              <div style={labelStyle}>Estatística {i + 1}</div>
              <input value={s.value} onChange={(e) => { const stats = [...doc.hero.stats]; stats[i] = { ...stats[i], value: e.target.value }; set("hero", { ...doc.hero, stats }); }} placeholder="valor" style={{ ...inputStyle, marginBottom: 6 }} />
              <input value={s.label} onChange={(e) => { const stats = [...doc.hero.stats]; stats[i] = { ...stats[i], label: e.target.value }; set("hero", { ...doc.hero, stats }); }} placeholder="legenda" style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      <ListEditor title="O que já existe" items={doc.today} onChange={(v) => set("today", v)}
        fields={[
          { key: "title", label: "Título" },
          { key: "status", label: "Estado", type: "select", options: [{ value: "done", label: "Em produção" }, { value: "beta", label: "Código pronto / por fazer" }] },
          { key: "desc", label: "Descrição", type: "textarea" },
        ]} />

      <ListEditor title="Fases do roadmap" items={doc.phases} onChange={(v) => set("phases", v)}
        fields={[
          { key: "num", label: "Número", type: "number" },
          { key: "when", label: "Prazo" },
          { key: "title", label: "Título" },
          { key: "desc", label: "Descrição", type: "textarea" },
          { key: "tags", label: "Etiquetas", type: "tags" },
        ]} />

      {/* TAM */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Mercado (TAM · SAM · SOM)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {["tam", "sam", "som"].map((k) => (
            <div key={k}>
              <div style={labelStyle}>{k.toUpperCase()} — valor</div>
              <input type="number" value={doc.tam[k].value} onChange={(e) => set("tam", { ...doc.tam, [k]: { ...doc.tam[k], value: Number(e.target.value) || 0 } })} style={{ ...inputStyle, marginBottom: 6 }} />
              <input value={doc.tam[k].label} onChange={(e) => set("tam", { ...doc.tam, [k]: { ...doc.tam[k], label: e.target.value } })} placeholder="legenda" style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={labelStyle}>Premissas / metodologia</div>
        <textarea rows={4} value={doc.tam.assumptions} onChange={(e) => set("tam", { ...doc.tam, assumptions: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="Vias de receita" items={doc.revenueStreams} onChange={(v) => set("revenueStreams", v)}
        fields={[
          { key: "title", label: "Título" },
          { key: "statusLabel", label: "Etiqueta (ex.: Fase 1)" },
          { key: "statusKind", label: "Tipo", type: "select", options: [{ value: "live", label: "Sinal real hoje" }, { value: "next", label: "Próxima fase" }, { value: "later", label: "Mais tarde" }] },
          { key: "desc", label: "Descrição", type: "textarea" },
        ]} />

      {/* Financials */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Custos vs. receita — linhas anuais</div>
        <ListEditorInline rows={doc.financials.rows} onChange={(rows) => set("financials", { ...doc.financials, rows })} />
        <div style={{ ...labelStyle, marginTop: 14 }}>Premissas</div>
        <textarea rows={3} value={doc.financials.assumptions} onChange={(e) => set("financials", { ...doc.financials, assumptions: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="Marketing" items={doc.marketing} onChange={(v) => set("marketing", v)}
        fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]} />

      <ListEditor title="Parcerias" items={doc.partnerships} onChange={(v) => set("partnerships", v)}
        fields={[{ key: "category", label: "Categoria" }, { key: "name", label: "Nome" }, { key: "why", label: "Porquê", type: "textarea" }]} />

      <ListEditor title="Brand deals" items={doc.brandDeals} onChange={(v) => set("brandDeals", v)}
        fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]} />

      <ListEditor title="Riscos & mitigação" items={doc.risks} onChange={(v) => set("risks", v)}
        fields={[{ key: "risk", label: "Risco", type: "textarea" }, { key: "mitigation", label: "Mitigação", type: "textarea" }]} />
    </div>
  );
}

/** Financial rows need numeric revenue/costs (feed the chart on /roadmap),
 *  so it's its own small repeater rather than reusing ListEditor's
 *  generic add() (which would default revenue/costs to "" not 0). */
function ListEditorInline({ rows, onChange }) {
  const update = (i, key, val) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { year: `Ano ${rows.length + 1}`, groups: "", revenue: 0, costs: 0, sources: "" }]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, position: "relative" }}>
          <button onClick={() => remove(i)} title="Remover" style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}>
            <Trash2 size={14} />
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, paddingRight: 24, marginBottom: 10 }}>
            <div><div style={labelStyle}>Ano</div><input value={r.year} onChange={(e) => update(i, "year", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Grupos (texto)</div><input value={r.groups} onChange={(e) => update(i, "groups", e.target.value)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Receita (€)</div><input type="number" value={r.revenue} onChange={(e) => update(i, "revenue", Number(e.target.value) || 0)} style={inputStyle} /></div>
            <div><div style={labelStyle}>Custos (€)</div><input type="number" value={r.costs} onChange={(e) => update(i, "costs", Number(e.target.value) || 0)} style={inputStyle} /></div>
          </div>
          <div style={labelStyle}>Principais fontes</div>
          <input value={r.sources} onChange={(e) => update(i, "sources", e.target.value)} style={inputStyle} />
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <Plus size={13} /> Adicionar ano
      </button>
    </div>
  );
}
