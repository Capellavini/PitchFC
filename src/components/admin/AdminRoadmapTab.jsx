import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { C, cardStyle } from "../../theme";
import { CALC_DEFAULTS } from "../RoadmapCalculator";
import { emptyBi } from "../../lib/roadmapI18n";

const inputStyle = { width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.text1, outline: "none", fontFamily: "inherit" };
const labelStyle = { fontSize: 11, color: C.text3, marginBottom: 4, fontWeight: 700 };

/** Shape of the whole /roadmap document. Sections follow the SCORE startup
 *  business plan template. Every translatable string is `{ pt, en }` — the
 *  page has a PT/EN toggle, ported from a standalone bilingual .htm draft.
 *  Every key is optional on the rendering side, so a document saved before a
 *  section (or before bilingual support) existed still renders — but keep
 *  this object exhaustive so the editor always shows every section. */
const EMPTY_DOC = {
  hero: { tagline: emptyBi(), stats: [{ value: "", label: emptyBi() }, { value: "", label: emptyBi() }, { value: "", label: emptyBi() }, { value: "", label: emptyBi() }] },
  execSummary: [],
  company: { mission: emptyBi(), operations: [], startupCosts: [], costsNote: emptyBi() },
  today: [], phases: [], pricing: [],
  tam: { tam: { value: 0, label: emptyBi() }, sam: { value: 0, label: emptyBi() }, som: { value: 0, label: emptyBi() }, assumptions: emptyBi() },
  competitors: [], advantages: [],
  revenueStreams: [], financials: { rows: [], assumptions: emptyBi() },
  calculator: { ...CALC_DEFAULTS }, calculatorNote: emptyBi(),
  marketing: [], partnerships: [], brandDeals: [],
  management: { now: emptyBi(), hires: [], advisors: emptyBi() },
  risks: [], nextSteps: [], appendixNote: emptyBi(),
};

/** Starting values for the interactive model on /roadmap. Editing these
 *  changes what a visitor sees first, not what they can explore. */
const CALC_FIELDS = [
  { key: "groups", label: "Grupos pagantes" },
  { key: "price", label: "Preço médio / grupo / mês (€)" },
  { key: "players", label: "Jogadores por jogo" },
  { key: "fee", label: "Valor por jogador / jogo (€)" },
  { key: "games", label: "Jogos por mês" },
  { key: "adoption", label: "Pagamentos na app (%)" },
  { key: "take", label: "Comissão retida (%)" },
  { key: "fixedMonthly", label: "Custos fixos / mês (€)" },
  { key: "variablePerGroup", label: "Custo variável / grupo / mês (€)" },
];

/** Every text/textarea/tags field edits one language at a time, following
 *  the `lang` toggle at the top of the page — same value shape as the
 *  public /roadmap page reads with `t()`. Number/select fields aren't
 *  translated, so they ignore `lang` entirely. */
function Field({ f, value, lang, onChange }) {
  if (f.type === "textarea") {
    const v = value?.[lang] ?? "";
    return <textarea rows={f.rows || 2} value={v} onChange={(e) => onChange({ ...(value || emptyBi()), [lang]: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />;
  }
  if (f.type === "tags") {
    const list = value || [];
    const text = list.map((it) => it?.[lang] ?? "").join(", ");
    const onText = (raw) => {
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      onChange(parts.map((p, i) => ({ ...(list[i] || emptyBi()), [lang]: p })));
    };
    return <input value={text} onChange={(e) => onText(e.target.value)} placeholder="separado por vírgulas" style={inputStyle} />;
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
  const v = value?.[lang] ?? "";
  return <input value={v} onChange={(e) => onChange({ ...(value || emptyBi()), [lang]: e.target.value })} style={inputStyle} />;
}

/** Blank value for a new list item, matching how Field reads/writes it. */
const blankFor = (f) => (f.type === "tags" ? [] : f.type === "number" ? 0 : f.type === "select" ? (f.options?.[0]?.value ?? "") : emptyBi());

/** Generic repeater used for every array-shaped section of the roadmap
 *  document (today/phases/revenueStreams/partnerships/brandDeals/risks/
 *  marketing/financials.rows) — one config, reused 8x, instead of 8
 *  bespoke editors. */
function ListEditor({ title, items, fields, lang, onChange }) {
  const update = (i, key, val) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, blankFor(f)]))]);

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
                  <Field f={f} value={item[f.key]} lang={lang} onChange={(v) => update(i, f.key, v)} />
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

const langToggleStyle = (active) => ({
  background: active ? C.accent : "none", color: active ? C.bg : C.text2,
  border: `1px solid ${active ? C.accent : C.border}`, borderRadius: 8, padding: "6px 14px",
  fontSize: 12, fontWeight: 800, cursor: "pointer",
});

/** Editor for the whole /roadmap document (one JSONB row, roadmap_content).
 *  Loads once via cloud.fetchRoadmapContent, edits a local copy, a single
 *  "Guardar" writes the whole document back — same convention as
 *  OnboardingOrganizer (local form state + one submit), since this is
 *  infrequent single-editor content, not a live form. The PT/EN toggle
 *  controls which language every text field below reads and writes; it
 *  does not affect what gets saved (both languages are always in `doc`). */
export default function AdminRoadmapTab({ cloud, roadmap, refetchRoadmap }) {
  const [doc, setDoc] = useState(EMPTY_DOC);
  const [lang, setLang] = useState("pt");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Merge one level into the nested sections too, so a document saved before
  // a sub-key existed (e.g. company without `operations`) doesn't hand the
  // editor an undefined array to map over.
  useEffect(() => {
    if (!roadmap?.data) return;
    const d = roadmap.data;
    setDoc({
      ...EMPTY_DOC, ...d,
      hero: { ...EMPTY_DOC.hero, ...(d.hero || {}) },
      company: { ...EMPTY_DOC.company, ...(d.company || {}) },
      tam: { ...EMPTY_DOC.tam, ...(d.tam || {}) },
      financials: { ...EMPTY_DOC.financials, ...(d.financials || {}) },
      calculator: { ...EMPTY_DOC.calculator, ...(d.calculator || {}) },
      management: { ...EMPTY_DOC.management, ...(d.management || {}) },
    });
  }, [roadmap?.data]);

  const set = (key, val) => setDoc((d) => ({ ...d, [key]: val }));
  const setBi = (key, val) => setDoc((d) => ({ ...d, [key]: { ...(d[key] || emptyBi()), [lang]: val } }));

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
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setLang("pt")} style={langToggleStyle(lang === "pt")}>PT</button>
          <button onClick={() => setLang("en")} style={langToggleStyle(lang === "en")}>EN</button>
        </div>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? C.green : C.red }}>{msg.text}</span>}
        <a href="/roadmap" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, color: C.text2 }}>Ver /roadmap →</a>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 16, marginTop: -10 }}>
        A editar em <b style={{ color: C.text2 }}>{lang === "pt" ? "Português" : "Inglês"}</b> — cada campo de texto guarda as duas línguas; o botão PT/EN acima só muda qual delas vês aqui.
      </div>

      {/* Hero */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Hero</div>
        <div style={labelStyle}>Tagline</div>
        <textarea rows={2} value={doc.hero.tagline?.[lang] ?? ""} onChange={(e) => set("hero", { ...doc.hero, tagline: { ...doc.hero.tagline, [lang]: e.target.value } })} style={{ ...inputStyle, marginBottom: 12, resize: "vertical" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {doc.hero.stats.map((s, i) => (
            <div key={i}>
              <div style={labelStyle}>Estatística {i + 1}</div>
              <input value={s.value} onChange={(e) => { const stats = [...doc.hero.stats]; stats[i] = { ...stats[i], value: e.target.value }; set("hero", { ...doc.hero, stats }); }} placeholder="valor (não traduzido)" style={{ ...inputStyle, marginBottom: 6 }} />
              <input value={s.label?.[lang] ?? ""} onChange={(e) => { const stats = [...doc.hero.stats]; stats[i] = { ...stats[i], label: { ...stats[i].label, [lang]: e.target.value } }; set("hero", { ...doc.hero, stats }); }} placeholder="legenda" style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      <ListEditor title="Sumário executivo" items={doc.execSummary} lang={lang} onChange={(v) => set("execSummary", v)}
        fields={[{ key: "title", label: "Título (ex.: O problema)" }, { key: "desc", label: "Texto", type: "textarea" }]} />

      {/* Empresa */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Empresa</div>
        <div style={labelStyle}>Missão</div>
        <textarea rows={2} value={doc.company.mission?.[lang] ?? ""} onChange={(e) => set("company", { ...doc.company, mission: { ...doc.company.mission, [lang]: e.target.value } })} style={{ ...inputStyle, marginBottom: 14, resize: "vertical" }} />
        <div style={{ ...labelStyle, marginBottom: 8 }}>Forma legal e operação</div>
        <SubListEditor
          items={doc.company.operations}
          lang={lang}
          onChange={(operations) => set("company", { ...doc.company, operations })}
          addLabel="Adicionar ponto"
          blank={{ title: emptyBi(), desc: emptyBi() }}
          fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]}
        />
        <div style={{ ...labelStyle, margin: "16px 0 8px" }}>Despesas de arranque (ano 1)</div>
        <SubListEditor
          items={doc.company.startupCosts}
          lang={lang}
          onChange={(startupCosts) => set("company", { ...doc.company, startupCosts })}
          addLabel="Adicionar rubrica"
          blank={{ item: emptyBi(), kind: emptyBi(), amount: 0 }}
          columns="2fr 1fr 1fr"
          fields={[{ key: "item", label: "Rubrica" }, { key: "kind", label: "Natureza" }, { key: "amount", label: "Valor (€)", type: "number" }]}
        />
        <div style={{ ...labelStyle, marginTop: 14 }}>Nota sobre os custos</div>
        <textarea rows={2} value={doc.company.costsNote?.[lang] ?? ""} onChange={(e) => set("company", { ...doc.company, costsNote: { ...doc.company.costsNote, [lang]: e.target.value } })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="O que já existe" items={doc.today} lang={lang} onChange={(v) => set("today", v)}
        fields={[
          { key: "title", label: "Título" },
          { key: "status", label: "Estado", type: "select", options: [{ value: "done", label: "Em produção" }, { value: "beta", label: "Código pronto / por fazer" }] },
          { key: "desc", label: "Descrição", type: "textarea" },
        ]} />

      <ListEditor title="Fases do roadmap" items={doc.phases} lang={lang} onChange={(v) => set("phases", v)}
        fields={[
          { key: "num", label: "Número", type: "number" },
          { key: "when", label: "Prazo" },
          { key: "title", label: "Título" },
          { key: "desc", label: "Descrição", type: "textarea" },
          { key: "tags", label: "Etiquetas", type: "tags" },
        ]} />

      <ListEditor title="Preçário" items={doc.pricing} lang={lang} onChange={(v) => set("pricing", v)}
        fields={[
          { key: "name", label: "Plano" },
          { key: "price", label: "Preço (texto livre)" },
          { key: "highlight", label: "Destacar", type: "select", options: [{ value: "", label: "Não" }, { value: "1", label: "Sim" }] },
          { key: "desc", label: "O que inclui", type: "textarea" },
        ]} />

      {/* TAM */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Mercado (TAM · SAM · SOM)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {["tam", "sam", "som"].map((k) => (
            <div key={k}>
              <div style={labelStyle}>{k.toUpperCase()} — valor (não traduzido)</div>
              <input type="number" value={doc.tam[k].value} onChange={(e) => set("tam", { ...doc.tam, [k]: { ...doc.tam[k], value: Number(e.target.value) || 0 } })} style={{ ...inputStyle, marginBottom: 6 }} />
              <input value={doc.tam[k].label?.[lang] ?? ""} onChange={(e) => set("tam", { ...doc.tam, [k]: { ...doc.tam[k], label: { ...doc.tam[k].label, [lang]: e.target.value } } })} placeholder="legenda" style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={labelStyle}>Premissas / metodologia</div>
        <textarea rows={4} value={doc.tam.assumptions?.[lang] ?? ""} onChange={(e) => set("tam", { ...doc.tam, assumptions: { ...doc.tam.assumptions, [lang]: e.target.value } })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="Concorrência" items={doc.competitors} lang={lang} onChange={(v) => set("competitors", v)}
        fields={[
          { key: "category", label: "Categoria" },
          { key: "examples", label: "Exemplos" },
          { key: "solves", label: "O que resolve", type: "textarea" },
          { key: "fails", label: "Onde falha para o nosso cliente", type: "textarea" },
        ]} />

      <ListEditor title="Vantagem defensável" items={doc.advantages} lang={lang} onChange={(v) => set("advantages", v)}
        fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]} />

      <ListEditor title="Vias de receita" items={doc.revenueStreams} lang={lang} onChange={(v) => set("revenueStreams", v)}
        fields={[
          { key: "title", label: "Título" },
          { key: "statusLabel", label: "Etiqueta (ex.: Fase 1)" },
          { key: "statusKind", label: "Tipo", type: "select", options: [{ value: "live", label: "Sinal real hoje" }, { value: "next", label: "Próxima fase" }, { value: "later", label: "Mais tarde" }] },
          { key: "desc", label: "Descrição", type: "textarea" },
        ]} />

      {/* Financials */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Custos vs. receita — linhas anuais</div>
        <FinancialRowsEditor rows={doc.financials.rows} lang={lang} onChange={(rows) => set("financials", { ...doc.financials, rows })} />
        <div style={{ ...labelStyle, marginTop: 14 }}>Premissas</div>
        <textarea rows={3} value={doc.financials.assumptions?.[lang] ?? ""} onChange={(e) => set("financials", { ...doc.financials, assumptions: { ...doc.financials.assumptions, [lang]: e.target.value } })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      {/* Calculadora — valores iniciais do modelo interativo em /roadmap.
          Puramente numérico, por isso não segue o toggle PT/EN (os textos da
          calculadora são chrome do componente, não deste documento). */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Calculadora — valores por omissão</div>
        <div style={{ fontSize: 12, color: C.text2, margin: "4px 0 14px", lineHeight: 1.5 }}>
          O que o visitante vê antes de mexer em nada, nas duas línguas. Ele continua livre de alterar tudo — isto é só o ponto de partida.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {CALC_FIELDS.map((f) => (
            <div key={f.key}>
              <div style={labelStyle}>{f.label}</div>
              <input type="number" step="any" value={doc.calculator[f.key] ?? 0}
                onChange={(e) => set("calculator", { ...doc.calculator, [f.key]: Number(e.target.value) || 0 })}
                style={inputStyle} />
            </div>
          ))}
        </div>
        <div style={{ ...labelStyle, marginTop: 14 }}>Nota / limitações do modelo</div>
        <textarea rows={3} value={doc.calculatorNote?.[lang] ?? ""} onChange={(e) => setBi("calculatorNote", e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="Marketing" items={doc.marketing} lang={lang} onChange={(v) => set("marketing", v)}
        fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]} />

      <ListEditor title="Parcerias" items={doc.partnerships} lang={lang} onChange={(v) => set("partnerships", v)}
        fields={[{ key: "category", label: "Categoria" }, { key: "name", label: "Nome" }, { key: "why", label: "Porquê", type: "textarea" }]} />

      <ListEditor title="Brand deals" items={doc.brandDeals} lang={lang} onChange={(v) => set("brandDeals", v)}
        fields={[{ key: "title", label: "Título" }, { key: "desc", label: "Descrição", type: "textarea" }]} />

      {/* Gestão */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Plano de gestão</div>
        <div style={labelStyle}>Equipa hoje</div>
        <textarea rows={2} value={doc.management.now?.[lang] ?? ""} onChange={(e) => set("management", { ...doc.management, now: { ...doc.management.now, [lang]: e.target.value } })} style={{ ...inputStyle, marginBottom: 14, resize: "vertical" }} />
        <div style={{ ...labelStyle, marginBottom: 8 }}>Plano de contratação</div>
        <SubListEditor
          items={doc.management.hires}
          lang={lang}
          onChange={(hires) => set("management", { ...doc.management, hires })}
          addLabel="Adicionar contratação"
          blank={{ when: emptyBi(), role: emptyBi(), trigger: emptyBi(), cost: 0 }}
          columns="1fr 1fr"
          fields={[
            { key: "when", label: "Quando" },
            { key: "role", label: "Função" },
            { key: "cost", label: "Custo anual (€)", type: "number" },
            { key: "trigger", label: "Gatilho", type: "textarea" },
          ]}
        />
        <div style={{ ...labelStyle, marginTop: 14 }}>Aconselhamento externo</div>
        <textarea rows={2} value={doc.management.advisors?.[lang] ?? ""} onChange={(e) => set("management", { ...doc.management, advisors: { ...doc.management.advisors, [lang]: e.target.value } })} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <ListEditor title="Riscos & mitigação" items={doc.risks} lang={lang} onChange={(v) => set("risks", v)}
        fields={[{ key: "risk", label: "Risco", type: "textarea" }, { key: "mitigation", label: "Mitigação", type: "textarea" }]} />

      <ListEditor title="Próximos passos" items={doc.nextSteps} lang={lang} onChange={(v) => set("nextSteps", v)}
        fields={[{ key: "title", label: "Passo" }, { key: "desc", label: "Porquê / como", type: "textarea" }]} />

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Nota final / documentos a anexar</div>
        <textarea rows={3} value={doc.appendixNote?.[lang] ?? ""} onChange={(e) => setBi("appendixNote", e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
      </div>
    </div>
  );
}

/** Compact repeater for arrays nested inside another card (company.operations,
 *  company.startupCosts, management.hires). ListEditor renders its own card and
 *  header, which would nest cards two deep here. */
function SubListEditor({ items, fields, lang, onChange, blank, addLabel, columns = "1fr 1fr" }) {
  const update = (i, key, val) => onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, position: "relative" }}>
          <button onClick={() => remove(i)} title="Remover" style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}>
            <Trash2 size={14} />
          </button>
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 10, paddingRight: 24 }}>
            {fields.map((f) => (
              <div key={f.key} style={f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
                <div style={labelStyle}>{f.label}</div>
                <Field f={f} value={item[f.key]} lang={lang} onChange={(v) => update(i, f.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...blank }])} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}

/** Financial rows need numeric revenue/costs (feed the chart on /roadmap);
 *  year/groups/sources are bilingual text. Its own small repeater rather
 *  than reusing ListEditor's generic add(), which would default
 *  revenue/costs to a bilingual object instead of 0. */
function FinancialRowsEditor({ rows, lang, onChange }) {
  const update = (i, key, val) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { year: emptyBi(), groups: emptyBi(), revenue: 0, costs: 0, sources: emptyBi() }]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => {
        const biField = (key, placeholder) => (
          <input value={r[key]?.[lang] ?? ""} onChange={(e) => update(i, key, { ...r[key], [lang]: e.target.value })} placeholder={placeholder} style={inputStyle} />
        );
        return (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, position: "relative" }}>
            <button onClick={() => remove(i)} title="Remover" style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}>
              <Trash2 size={14} />
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, paddingRight: 24, marginBottom: 10 }}>
              <div><div style={labelStyle}>Ano</div>{biField("year")}</div>
              <div><div style={labelStyle}>Grupos (texto)</div>{biField("groups")}</div>
              <div><div style={labelStyle}>Receita (€)</div><input type="number" value={r.revenue} onChange={(e) => update(i, "revenue", Number(e.target.value) || 0)} style={inputStyle} /></div>
              <div><div style={labelStyle}>Custos (€)</div><input type="number" value={r.costs} onChange={(e) => update(i, "costs", Number(e.target.value) || 0)} style={inputStyle} /></div>
            </div>
            <div style={labelStyle}>Principais fontes</div>
            {biField("sources")}
          </div>
        );
      })}
      <button onClick={add} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <Plus size={13} /> Adicionar ano
      </button>
    </div>
  );
}
