import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { C, cardStyle, displayFont } from "../../theme";

const PLAN_LABEL = { free: "Free", club: "Club", club_ai: "Club + AI" };
const SOURCE_LABEL = { trial: "Teste 14d", founder: "Fundador", founder_forever: "Fundador ∞", manual: "Manual", stripe: "Stripe" };
const PLAN_COLOR = () => ({ free: C.text2, club: C.green, club_ai: C.accent });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Lisbon" }) : "para sempre");
// <input type="date"> value → end of that day in Lisbon (23:59), as ISO.
const endOfDayLisbon = (ymd) => {
  if (!ymd) return null;
  const guess = new Date(`${ymd}T23:59:00Z`);
  const lisbon = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (lisbon - utc)).toISOString();
};

/** "Planos": every group's effective plan (admin_group_plans) and a small
 *  editor to set/extend it (admin_set_group_plan, source "manual").
 *  No billing — this is the only way a plan changes besides the 14-day
 *  trial trigger and the launch backfill. */
export default function AdminPlansTab({ cloud }) {
  const [state, setState] = useState({ loading: true, error: null, rows: [] });
  const [editing, setEditing] = useState(null); // { groupId, plan, until, note }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    const r = await cloud.fetchGroupPlans();
    setState({ loading: false, error: r.error ?? null, rows: r.rows ?? [] });
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await cloud.setGroupPlan(editing.groupId, editing.plan, editing.plan === "free" ? null : endOfDayLisbon(editing.until), editing.note || null);
    setBusy(false);
    if (r.error) { setMsg({ error: true, text: r.error }); return; }
    setMsg({ error: false, text: "Plano atualizado." });
    setEditing(null);
    load();
  };

  if (state.loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;
  if (state.error) return <div style={{ fontSize: 13, color: C.red }}>Erro: {state.error} (a migração dos planos já foi aplicada?)</div>;

  const counts = state.rows.reduce((a, r) => ({ ...a, [r.effective_plan]: (a[r.effective_plan] || 0) + 1 }), {});
  const colors = PLAN_COLOR();
  const input = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: C.text1 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {["club_ai", "club", "free"].map((p) => (
          <div key={p} style={{ ...cardStyle, padding: "12px 16px", minWidth: 120 }}>
            <div style={{ ...displayFont, fontSize: 26, color: colors[p] }}>{counts[p] || 0}</div>
            <div style={{ fontSize: 12, color: C.text2 }}>{PLAN_LABEL[p]}</div>
          </div>
        ))}
        <button onClick={load} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text2, fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.error ? C.red : C.green }}>{msg.text}</div>}

      <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: C.text3, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {["Grupo", "Jogadores", "Plano efetivo", "Origem", "Até", ""].map((h) => <th key={h} style={{ padding: "10px 14px", fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state.rows.map((r) => {
              const open = editing?.groupId === r.group_id;
              return (
                <tr key={r.group_id} style={{ borderTop: `1px solid ${C.border}`, verticalAlign: "top" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{r.group_id}</div>
                    {r.note && <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>{r.note}</div>}
                  </td>
                  <td style={{ padding: "10px 14px", color: r.effective_plan === "free" && r.players > 20 ? C.orange : C.text1 }}>{r.players}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 800, color: colors[r.effective_plan] }}>
                    {PLAN_LABEL[r.effective_plan]}
                    {r.plan && r.plan !== r.effective_plan && <div style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>({PLAN_LABEL[r.plan]} expirado)</div>}
                  </td>
                  <td style={{ padding: "10px 14px", color: C.text2 }}>{r.source ? SOURCE_LABEL[r.source] ?? r.source : "—"}{r.status && r.status !== "active" ? ` · ${r.status}` : ""}</td>
                  <td style={{ padding: "10px 14px", color: C.text2 }}>
                    {r.plan ? fmtDate(r.ends_at) : "—"}
                    {r.days_left != null && <div style={{ fontSize: 11, color: r.days_left <= 3 ? C.orange : C.text3 }}>{r.days_left} dias</div>}
                  </td>
                  <td style={{ padding: "10px 14px", minWidth: open ? 320 : 0 }}>
                    {open ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <select value={editing.plan} onChange={(e) => setEditing((x) => ({ ...x, plan: e.target.value }))} style={input}>
                            {Object.keys(PLAN_LABEL).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
                          </select>
                          <input type="date" value={editing.until} disabled={editing.plan === "free"} title="Vazio = para sempre"
                            onChange={(e) => setEditing((x) => ({ ...x, until: e.target.value }))} style={input} />
                        </div>
                        <input placeholder="Nota (opcional)" value={editing.note} onChange={(e) => setEditing((x) => ({ ...x, note: e.target.value }))} style={input} />
                        <div style={{ fontSize: 11, color: C.text3 }}>Data vazia = para sempre. Termina às 23:59 (Lisboa) desse dia.</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={save} disabled={busy} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 800, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "A guardar…" : "Guardar"}</button>
                          <button onClick={() => setEditing(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.text2, cursor: "pointer" }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setMsg(null); setEditing({ groupId: r.group_id, plan: r.effective_plan === "free" ? "club" : r.effective_plan, until: r.ends_at ? r.ends_at.slice(0, 10) : "", note: "" }); }}
                        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.text1, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Definir / estender
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
