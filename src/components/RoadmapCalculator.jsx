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

const FIELDS = [
  { key: "groups", label: "Grupos pagantes", max: 5000, step: 10, group: "Subscrições", hint: "Grupos no plano Pro. O SOM a 3–5 anos aponta para ~3 500." },
  { key: "price", label: "Preço médio por grupo / mês (€)", max: 25, step: 0.5, group: "Subscrições", hint: "Blended entre PT e BR. O plano Pro anunciado é €5–10." },
  { key: "players", label: "Jogadores por jogo", max: 30, step: 1, group: "Comissão sobre pagamentos" },
  { key: "fee", label: "Valor por jogador / jogo (€)", max: 20, step: 0.5, group: "Comissão sobre pagamentos" },
  { key: "games", label: "Jogos por mês (por grupo)", max: 12, step: 1, group: "Comissão sobre pagamentos" },
  { key: "adoption", label: "Pagamentos feitos dentro da app (%)", max: 100, step: 5, group: "Comissão sobre pagamentos", hint: "Nem todos os grupos passam a cobrança para a app. É a premissa mais optimista do modelo — trata-a com desconfiança." },
  { key: "take", label: "Comissão retida (%)", max: 5, step: 0.1, group: "Comissão sobre pagamentos", hint: "Líquido para a PITCH, já depois do processador. Referência: 1,5–3%." },
  { key: "fixedMonthly", label: "Custos fixos / mês (€)", max: 12000, step: 50, group: "Custos", hint: "Salários, contabilidade, ferramentas, infraestrutura base." },
  { key: "variablePerGroup", label: "Custo variável por grupo / mês (€)", max: 5, step: 0.05, group: "Custos", hint: "Servidor, notificações, suporte e taxas por grupo activo." },
];

const GROUPS_ORDER = ["Subscrições", "Comissão sobre pagamentos", "Custos"];

const nfmt = (n, dec = 0) =>
  new Intl.NumberFormat("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
const eur = (n, dec = 0) => `€${nfmt(n, dec)}`;
const eurShort = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `€${nfmt(n / 1e6, 1)}M`;
  if (a >= 1000) return `€${nfmt(n / 1000, 0)}k`;
  return `€${nfmt(n, 0)}`;
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

function Slider({ field, value, onChange }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 5 }}>
        <label htmlFor={`calc-${field.key}`} style={{ fontSize: 13, color: C.text1 }}>{field.label}</label>
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
      {field.hint && <div style={{ color: C.text3, fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{field.hint}</div>}
    </div>
  );
}

/** Break-even chart: revenue and cost as functions of group count, with the
 *  current scenario and the crossing point marked. Geometry is derived from
 *  the live numbers, so moving a slider moves the chart. */
function Chart({ params, be }) {
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
            <text x={L - 7} y={y(v) + 3.5} textAnchor="end" fill={C.text3} fontSize="9" fontFamily="ui-monospace, monospace">{eurShort(v)}</text>
          </g>
        );
      })}
      {[0, 1, 2, 3, 4].map((k) => {
        const g = (maxG * k) / 4;
        return <text key={k} x={x(g)} y={H - 11} textAnchor="middle" fill={C.text3} fontSize="9" fontFamily="ui-monospace, monospace">{nfmt(Math.round(g))}</text>;
      })}
      <text x={L + pw / 2} y={H - 1} textAnchor="middle" fill={C.text3} fontSize="9">grupos pagantes</text>

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
            {nfmt(be)} grp = equilíbrio
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
 *  Roadmap → Calculadora), and nothing here writes back. */
export default function RoadmapCalculator({ defaults }) {
  const initial = { ...CALC_DEFAULTS, ...(defaults || {}) };
  const [params, setParams] = useState(initial);
  const [preset, setPreset] = useState(null);

  const set = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setPreset(null); };
  const applyPreset = (name) => { setParams(PRESETS[name]); setPreset(name); };

  const m = runModel(params.groups, params);
  const be = breakEven(params);
  const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
  const subsShare = m.revenue > 0 ? (m.subs / m.revenue) * 100 : 50;

  const presetBtn = (name, label) => (
    <button
      key={name} onClick={() => applyPreset(name)}
      style={{
        background: preset === name ? C.accent : C.surface,
        color: preset === name ? C.bg : C.text2,
        border: `1px solid ${preset === name ? C.accent : C.border}`,
        borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >{label}</button>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 22 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <span style={{ color: C.text2, fontSize: 12, marginRight: 2 }}>Cenários:</span>
        {presetBtn("conservador", "Conservador")}
        {presetBtn("base", "Base")}
        {presetBtn("otimista", "Otimista")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(280px, 1.05fr)", gap: 26 }}>
        {/* inputs */}
        <div>
          {GROUPS_ORDER.map((groupName) => (
            <div key={groupName} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, fontWeight: 800, marginBottom: 11 }}>{groupName}</div>
              {FIELDS.filter((f) => f.group === groupName).map((f) => (
                <Slider key={f.key} field={f} value={params[f.key]} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          ))}
        </div>

        {/* outputs */}
        <div>
          <div style={{ background: C.bg, border: `1px solid ${C.accentBorder}`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
            <div style={{ ...boxLabel, letterSpacing: "0.14em" }}>Receita anual total</div>
            <div style={{ ...displayFont, fontSize: "clamp(28px,5vw,40px)", color: C.accent, lineHeight: 1.1, marginTop: 4 }}>{eur(m.revenue)}</div>
            <div style={{ color: C.text2, fontSize: 12, marginTop: 6 }}>
              MRR: {eur(m.revenue / 12)} · por grupo/ano: {params.groups > 0 ? eur(m.revenue / params.groups) : "—"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={boxStyle}><div style={boxLabel}>Custos anuais</div><div style={boxValue}>{eur(m.costs)}</div></div>
            <div style={boxStyle}><div style={boxLabel}>Resultado anual</div><div style={{ ...boxValue, color: m.profit >= 0 ? C.green : C.red }}>{m.profit >= 0 ? "+" : ""}{eur(m.profit)}</div></div>
            <div style={boxStyle}><div style={boxLabel}>Margem</div><div style={{ ...boxValue, color: margin >= 0 ? C.green : C.red }}>{m.revenue > 0 ? `${nfmt(margin)}%` : "—"}</div></div>
            <div style={boxStyle}>
              <div style={boxLabel}>Break-even</div>
              <div style={{ ...boxValue, color: be === null ? C.red : params.groups >= be ? C.green : C.orange }}>{be === null ? "∞" : `${nfmt(be)} grp`}</div>
            </div>
          </div>

          <div style={{ ...boxStyle, marginTop: 12 }}>
            <div style={boxLabel}>Composição da receita</div>
            <div style={{ display: "flex", height: 10, borderRadius: 20, overflow: "hidden", margin: "10px 0 12px", background: C.border }}>
              <div style={{ width: `${subsShare}%`, background: C.accent }} />
              <div style={{ width: `${100 - subsShare}%`, background: C.blue }} />
            </div>
            {[
              ["Subscrições", m.subs],
              ["Comissão sobre pagamentos", m.commission],
              ["Volume processado na app (anual)", m.volume],
            ].map(([label, value], i) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: i < 2 ? `1px dashed ${C.border}` : "none" }}>
                <span style={{ color: C.text2 }}>{label}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{eur(value)}</span>
              </div>
            ))}
          </div>

          <div style={{ ...boxStyle, marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Receita vs. custos por número de grupos</div>
            <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>A linha tracejada marca o cenário actual; o ponto marca o equilíbrio.</div>
            <Chart params={params} be={be} />
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: C.text2, marginTop: 8 }}>
              {[["Receita", C.accent], ["Custos", C.blue], ["Cenário actual", C.text2]].map(([label, color]) => (
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
