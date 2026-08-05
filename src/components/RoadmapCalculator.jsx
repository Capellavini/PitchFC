import { useMemo, useState } from "react";
import { C, displayFont } from "../theme";

/** Defaults used when the roadmap document has no `calculator` block yet.
 *  Calibrated so the base scenario reproduces the financials table on the
 *  same page: 50 groups ≈ €5.5k, 500 ≈ €55k, 3000 ≈ €333k. */
export const CALC_DEFAULTS = {
  groups: 500, price: 7, players: 14, fee: 5, games: 4,
  adoption: 40, take: 2, fixedMonthly: 1800, variablePerGroup: 0.45,
};

const PRESETS = {
  conservador: { groups: 150, price: 5, players: 12, fee: 4, games: 4, adoption: 25, take: 1.5, fixedMonthly: 400, variablePerGroup: 0.6 },
  base: CALC_DEFAULTS,
  otimista: { groups: 3000, price: 8.5, players: 14, fee: 6, games: 5, adoption: 65, take: 2.5, fixedMonthly: 9000, variablePerGroup: 0.3 },
};

const PRESET_LABELS = {
  conservador: { pt: "Conservador", en: "Conservative" },
  base: { pt: "Base", en: "Base" },
  otimista: { pt: "Otimista", en: "Optimistic" },
};

/** Field copy is component chrome, not admin-editable content, so it's
 *  bilingual inline (same pattern as the standalone .htm this was ported
 *  from) rather than routed through the roadmap_content document. */
const FIELDS = [
  { key: "groups", max: 5000, step: 10, group: "subs", label: { pt: "Grupos pagantes", en: "Paying groups" }, hint: { pt: "Grupos no plano Pro. O SOM a 3–5 anos aponta para ~3 500.", en: "Groups on the Pro plan. The 3–5 year SOM points to ~3,500." } },
  { key: "price", max: 25, step: 0.5, group: "subs", label: { pt: "Preço médio por grupo / mês (€)", en: "Average price per group / month (€)" }, hint: { pt: "Blended entre PT e BR. O plano Pro anunciado é €5–10.", en: "Blended across PT and BR. The advertised Pro plan is €5–10." } },
  { key: "players", max: 30, step: 1, group: "fees", label: { pt: "Jogadores por jogo", en: "Players per game" } },
  { key: "fee", max: 20, step: 0.5, group: "fees", label: { pt: "Valor por jogador / jogo (€)", en: "Amount per player / game (€)" } },
  { key: "games", max: 12, step: 1, group: "fees", label: { pt: "Jogos por mês (por grupo)", en: "Games per month (per group)" } },
  { key: "adoption", max: 100, step: 5, group: "fees", label: { pt: "Pagamentos feitos dentro da app (%)", en: "Payments made inside the app (%)" }, hint: { pt: "Nem todos os grupos passam a cobrança para a app. É a premissa mais optimista do modelo — trata-a com desconfiança.", en: "Not every group moves collection into the app. This is the single most optimistic assumption in the model — treat it with suspicion." } },
  { key: "take", max: 5, step: 0.1, group: "fees", label: { pt: "Comissão retida (%)", en: "Fee retained (%)" }, hint: { pt: "Líquido para a PITCH, já depois do processador. Referência: 1,5–3%.", en: "Net to PITCH, after the processor's cut. Reference: 1.5–3%." } },
  { key: "fixedMonthly", max: 12000, step: 50, group: "costs", label: { pt: "Custos fixos / mês (€)", en: "Fixed costs / month (€)" }, hint: { pt: "Salários, contabilidade, ferramentas, infraestrutura base.", en: "Salaries, accounting, tooling, base infrastructure." } },
  { key: "variablePerGroup", max: 5, step: 0.05, group: "costs", label: { pt: "Custo variável por grupo / mês (€)", en: "Variable cost per group / month (€)" }, hint: { pt: "Servidor, notificações, suporte e taxas por grupo activo.", en: "Servers, notifications, support and per-active-group fees." } },
];

const GROUPS_ORDER = ["subs", "fees", "costs"];
const GROUP_LABELS = {
  subs: { pt: "Subscrições", en: "Subscriptions" },
  fees: { pt: "Comissão sobre pagamentos", en: "Payment fees" },
  costs: { pt: "Custos", en: "Costs" },
};

const STR = {
  scenarios: { pt: "Cenários:", en: "Scenarios:" },
  annualRevenue: { pt: "Receita anual total", en: "Total annual revenue" },
  perGroupYear: { pt: "por grupo/ano", en: "revenue per group/year" },
  annualCosts: { pt: "Custos anuais", en: "Annual costs" },
  annualResult: { pt: "Resultado anual", en: "Annual result" },
  margin: { pt: "Margem", en: "Margin" },
  breakEven: { pt: "Break-even", en: "Break-even" },
  revenueComposition: { pt: "Composição da receita", en: "Revenue composition" },
  subscriptions: { pt: "Subscrições", en: "Subscriptions" },
  paymentFees: { pt: "Comissão sobre pagamentos", en: "Payment fees" },
  volume: { pt: "Volume processado na app (anual)", en: "Volume processed in-app (annual)" },
  chartTitle: { pt: "Receita vs. custos por número de grupos", en: "Revenue vs. costs by number of groups" },
  chartCaption: { pt: "A linha tracejada marca o cenário actual; o ponto marca o equilíbrio.", en: "The dashed line marks the current scenario; the dot marks break-even." },
  legendRevenue: { pt: "Receita", en: "Revenue" },
  legendCosts: { pt: "Custos", en: "Costs" },
  legendCurrent: { pt: "Cenário actual", en: "Current scenario" },
  axisGroups: { pt: "grupos pagantes", en: "paying groups" },
  breakEvenTag: { pt: "grp = equilíbrio", en: "grp = break-even" },
};

const nfmt = (n, lang, dec = 0) =>
  new Intl.NumberFormat(lang === "en" ? "en-GB" : "pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
const eur = (n, lang, dec = 0) => `€${nfmt(n, lang, dec)}`;
const eurShort = (n, lang) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `€${nfmt(n / 1e6, lang, 1)}M`;
  if (a >= 1000) return `€${nfmt(n / 1000, lang, 0)}k`;
  return `€${nfmt(n, lang, 0)}`;
};

/** Steady-state annual model. Deliberately does NOT model growth, churn or
 *  seasonality — it exists to test order of magnitude and price sensitivity,
 *  not to replace a monthly cash-flow projection. */
export function runModel(groups, p) {
  const subs = groups * p.price * 12;
  const volumePerGroup = p.players * p.fee * p.games * 12 * (p.adoption / 100);
  const volume = groups * volumePerGroup;
  const commission = volume * (p.take / 100);
  const revenue = subs + commission;
  const costs = p.fixedMonthly * 12 + groups * p.variablePerGroup * 12;
  return { subs, volume, commission, revenue, costs, profit: revenue - costs };
}

/** Groups needed for annual contribution to cover annual fixed cost.
 *  null when each extra group loses money (contribution <= 0). */
function breakEven(p) {
  const contribution =
    p.price * 12 +
    p.players * p.fee * p.games * 12 * (p.adoption / 100) * (p.take / 100) -
    p.variablePerGroup * 12;
  if (contribution <= 0) return null;
  return Math.ceil((p.fixedMonthly * 12) / contribution);
}

const inputStyle = {
  width: 104, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "5px 9px", fontSize: 13.5, fontWeight: 700, color: C.accent,
  textAlign: "right", outline: "none", fontFamily: "ui-monospace, monospace",
};
const boxStyle = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 13 };
const boxLabel = { fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.text2, fontWeight: 800 };
const boxValue = { ...displayFont, fontSize: 19, marginTop: 3 };

function Slider({ field, lang, value, onChange }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
        <label htmlFor={`calc-${field.key}`} style={{ fontSize: 13, color: C.text1 }}>{field.label[lang]}</label>
        <input
          id={`calc-${field.key}`} type="number" min={0} step={field.step} value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)} style={inputStyle}
        />
      </div>
      <input
        type="range" min={0} max={field.max} step={field.step}
        value={Math.min(value, field.max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: C.accent }}
      />
      {field.hint && <div style={{ color: C.text3, fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{field.hint[lang]}</div>}
    </div>
  );
}

/** Break-even chart: revenue and cost as functions of group count, with the
 *  current scenario and the crossing point marked. Geometry is derived from
 *  the live numbers, so moving a slider moves the chart. */
function Chart({ params, be, lang }) {
  const W = 480, H = 220, L = 52, R = 12, T = 14, B = 30;
  const pw = W - L - R, ph = H - T - B;
  const maxG = Math.max(params.groups * 2, be ? be * 1.6 : 0, 100);

  const { revPath, costPath, maxY } = useMemo(() => {
    const steps = 60;
    let top = 0;
    const rev = [], cost = [];
    for (let i = 0; i <= steps; i++) {
      const g = (maxG * i) / steps;
      const m = runModel(g, params);
      rev.push([g, m.revenue]); cost.push([g, m.costs]);
      top = Math.max(top, m.revenue, m.costs);
    }
    return { revPath: rev, costPath: cost, maxY: top || 1 };
  }, [params, maxG]);

  const x = (g) => L + (g / maxG) * pw;
  const y = (v) => T + ph - (v / maxY) * ph;
  const toPath = (pts) => pts.map(([g, v], i) => `${i ? "L" : "M"}${x(g).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 4 }}>
      {[0, 1, 2, 3, 4].map((k) => {
        const v = (maxY * k) / 4;
        return (
          <g key={k}>
            <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke={C.border} strokeWidth="1" />
            <text x={L - 7} y={y(v) + 3.5} textAnchor="end" fill={C.text3} fontSize="9" fontFamily="ui-monospace, monospace">{eurShort(v, lang)}</text>
          </g>
        );
      })}
      {[0, 1, 2, 3, 4].map((k) => {
        const g = (maxG * k) / 4;
        return <text key={k} x={x(g)} y={H - 11} textAnchor="middle" fill={C.text3} fontSize="9" fontFamily="ui-monospace, monospace">{nfmt(Math.round(g), lang)}</text>;
      })}
      <text x={L + pw / 2} y={H - 1} textAnchor="middle" fill={C.text3} fontSize="9">{STR.axisGroups[lang]}</text>

      <path d={toPath(costPath)} fill="none" stroke={C.blue} strokeWidth="2" />
      <path d={toPath(revPath)} fill="none" stroke={C.accent} strokeWidth="2.2" />

      {be !== null && be <= maxG && (
        <>
          <circle cx={x(be)} cy={y(runModel(be, params).revenue)} r="4.5" fill={C.bg} stroke={C.orange} strokeWidth="2" />
          <text
            x={Math.min(x(be) + 8, W - R - 4)}
            y={Math.max(y(runModel(be, params).revenue) - 8, T + 9)}
            fill={C.orange} fontSize="9.5" fontFamily="ui-monospace, monospace"
            textAnchor={x(be) > W * 0.7 ? "end" : "start"}
          >
            {nfmt(be, lang)} {STR.breakEvenTag[lang]}
          </text>
        </>
      )}
      {params.groups > 0 && params.groups <= maxG && (
        <line x1={x(params.groups)} y1={T} x2={x(params.groups)} y2={T + ph} stroke={C.text2} strokeWidth="1" strokeDasharray="3 3" />
      )}
    </svg>
  );
}

/** Interactive scenario model on /roadmap. Read-only for the visitor: the
 *  starting values come from the roadmap document (editable in /admin →
 *  Roadmap → Calculadora), and nothing here writes back. `lang` follows the
 *  page-level PT/EN toggle; only UI chrome is bilingual here, not the
 *  numbers themselves. */
export default function RoadmapCalculator({ defaults, lang = "pt" }) {
  const initial = { ...CALC_DEFAULTS, ...(defaults || {}) };
  const [params, setParams] = useState(initial);
  const [preset, setPreset] = useState(null);

  const set = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setPreset(null); };
  const applyPreset = (name) => { setParams(PRESETS[name]); setPreset(name); };

  const m = runModel(params.groups, params);
  const be = breakEven(params);
  const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
  const subsShare = m.revenue > 0 ? (m.subs / m.revenue) * 100 : 50;

  const presetBtn = (name) => (
    <button
      key={name} onClick={() => applyPreset(name)}
      style={{
        background: preset === name ? C.accent : C.surface,
        color: preset === name ? C.bg : C.text2,
        border: `1px solid ${preset === name ? C.accent : C.border}`,
        borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >{PRESET_LABELS[name][lang]}</button>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <span style={{ color: C.text2, fontSize: 12, marginRight: 2 }}>{STR.scenarios[lang]}</span>
        {presetBtn("conservador")}
        {presetBtn("base")}
        {presetBtn("otimista")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(280px, 1.05fr)", gap: 26 }}>
        {/* inputs */}
        <div>
          {GROUPS_ORDER.map((groupKey) => (
            <div key={groupKey} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 11 }}>{GROUP_LABELS[groupKey][lang]}</div>
              {FIELDS.filter((f) => f.group === groupKey).map((f) => (
                <Slider key={f.key} field={f} lang={lang} value={params[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          ))}
        </div>

        {/* outputs */}
        <div>
          <div style={{ background: C.bg, border: `1px solid ${C.accentBorder}`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
            <div style={{ ...boxLabel, letterSpacing: "0.14em" }}>{STR.annualRevenue[lang]}</div>
            <div style={{ ...displayFont, fontSize: "clamp(28px,5vw,40px)", color: C.accent, lineHeight: 1.1, marginTop: 4 }}>{eur(m.revenue, lang)}</div>
            <div style={{ color: C.text2, fontSize: 12, marginTop: 6 }}>
              MRR: {eur(m.revenue / 12, lang)} · {STR.perGroupYear[lang]}: {params.groups > 0 ? eur(m.revenue / params.groups, lang) : "—"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={boxStyle}><div style={boxLabel}>{STR.annualCosts[lang]}</div><div style={boxValue}>{eur(m.costs, lang)}</div></div>
            <div style={boxStyle}><div style={boxLabel}>{STR.annualResult[lang]}</div><div style={{ ...boxValue, color: m.profit >= 0 ? C.green : C.red }}>{m.profit >= 0 ? "+" : ""}{eur(m.profit, lang)}</div></div>
            <div style={boxStyle}><div style={boxLabel}>{STR.margin[lang]}</div><div style={{ ...boxValue, color: margin >= 0 ? C.green : C.red }}>{m.revenue > 0 ? `${nfmt(margin, lang)}%` : "—"}</div></div>
            <div style={boxStyle}>
              <div style={boxLabel}>{STR.breakEven[lang]}</div>
              <div style={{ ...boxValue, color: be === null ? C.red : params.groups >= be ? C.green : C.orange }}>{be === null ? "∞" : `${nfmt(be, lang)} grp`}</div>
            </div>
          </div>

          <div style={{ ...boxStyle, marginTop: 12 }}>
            <div style={boxLabel}>{STR.revenueComposition[lang]}</div>
            <div style={{ display: "flex", height: 10, borderRadius: 20, overflow: "hidden", margin: "10px 0 12px", background: C.border }}>
              <div style={{ width: `${subsShare}%`, background: C.accent }} />
              <div style={{ width: `${100 - subsShare}%`, background: C.blue }} />
            </div>
            {[
              [STR.subscriptions[lang], m.subs],
              [STR.paymentFees[lang], m.commission],
              [STR.volume[lang], m.volume],
            ].map(([label, value], i) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: i < 2 ? `1px dashed ${C.border}` : "none" }}>
                <span style={{ color: C.text2 }}>{label}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{eur(value, lang)}</span>
              </div>
            ))}
          </div>

          <div style={{ ...boxStyle, marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{STR.chartTitle[lang]}</div>
            <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>{STR.chartCaption[lang]}</div>
            <Chart params={params} be={be} lang={lang} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.text2, marginTop: 8 }}>
              {[[STR.legendRevenue[lang], C.accent], [STR.legendCosts[lang], C.blue], [STR.legendCurrent[lang], C.text2]].map(([label, color]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
