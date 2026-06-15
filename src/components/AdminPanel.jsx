import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, RefreshCw, Copy, Check, Users, Calendar,
  ShieldCheck, Trash2, Save, UserMinus, Crown,
} from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { WEEKDAYS_PT, fmtEUR } from "../lib/helpers";

const STATUS_COLOR = { open: C.orange, full: C.green, live: C.accent, played: C.text3, cancelled: C.red };
const ATT_COLOR = { confirmed: C.green, pending: C.orange, declined: C.red };

/**
 * Owner-only cross-group control panel. List → group detail. Reads across
 * groups (permissive RLS) and can edit/delete groups and manage players.
 * `actions` = { updateGroup, deleteGroup, updatePlayer, deletePlayer }.
 */
export default function AdminPanel({ fetchAdminData, actions = {}, onBack }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [copied, setCopied] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);     // group settings edit form
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);       // { ok, text }

  const load = async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetchAdminData();
      setState({ loading: false, error: data.error, data });
    } catch (err) {
      setState({ loading: false, error: err.message || "Falha ao carregar", data: null });
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const copy = async (token) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}?join=${token}`);
      setCopied(token); setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const { loading, error, data } = state;
  const groups = data?.groups ?? [];
  const players = data?.players ?? [];
  const games = data?.games ?? [];
  const attendances = data?.attendances ?? [];

  const membersOf = (gid) => players.filter((p) => p.group_id === gid);
  const gamesOf = (gid) => games.filter((g) => g.group_id === gid);
  const currentGameOf = (gid) => {
    const gg = gamesOf(gid);
    return gg.find((g) => ["open", "full", "live"].includes(g.status)) ?? gg[0] ?? null;
  };
  const confirmedFor = (gameId) => attendances.filter((a) => a.game_id === gameId && a.status === "confirmed").length;
  const attOf = (gameId, playerId) => attendances.find((a) => a.game_id === gameId && a.player_id === playerId);

  // Run a mutation, surface errors, then reload the snapshot.
  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    const res = await fn();
    setBusy(false);
    if (res?.error) { setMsg({ ok: false, text: res.error }); return false; }
    setMsg({ ok: true, text: okText });
    await load();
    return true;
  };

  const openGroup = (g) => {
    setSelectedId(g.id);
    setForm({
      name: g.name ?? "", venue: g.venue ?? "", weekday: g.weekday ?? 6,
      game_time: g.game_time ?? "20:00", monthlyPrice: (g.monthly_price_cents ?? 0) / 100,
      max_players: g.max_players ?? 10,
    });
    setMsg(null);
  };
  const closeGroup = () => { setSelectedId(null); setForm(null); setMsg(null); };

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  // ── DETAIL VIEW ────────────────────────────────────────
  if (selected && form) {
    const members = membersOf(selected.id);
    const game = currentGameOf(selected.id);
    const saveSettings = () => run(
      () => actions.updateGroup(selected.id, {
        name: form.name, venue: form.venue, weekday: form.weekday, game_time: form.game_time,
        monthly_price_cents: Math.round(form.monthlyPrice * 100), max_players: Number(form.max_players),
      }), "Definições guardadas");
    const deleteGroup = () => {
      if (!window.confirm(`Apagar o grupo "${selected.name}" e todos os seus jogadores/jogos? Esta ação é irreversível.`)) return;
      run(() => actions.deleteGroup(selected.id), "Grupo apagado").then((ok) => { if (ok) closeGroup(); });
    };

    const inp = (label, key, type = "text", extra = {}) => (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>{label}</div>
        <input type={type} value={form[key]} {...extra}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, color: C.text1, outline: "none", colorScheme: "dark" }} />
      </div>
    );

    return (
      <div style={{ padding: "0 16px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 10px" }}>
          <button onClick={closeGroup} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", padding: 4, display: "flex" }}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ ...displayFont, fontSize: 20, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
        </div>

        {msg && <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, marginBottom: 10 }}>{msg.text}</div>}

        {/* Group snapshot */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, color: C.text2 }}>
              <Users size={12} /> {members.length} jogadores
            </span>
            {game && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, color: C.text2 }}>
                <Calendar size={12} /> <span style={{ color: STATUS_COLOR[game.status] ?? C.text2, fontWeight: 700 }}>{game.status}</span> · {confirmedFor(game.id)}/{game.spots}
              </span>
            )}
          </div>
        </div>

        {/* Editable settings */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Definições do grupo</div>
          {inp("Nome", "name")}
          {inp("Campo / recinto", "venue")}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>Dia da semana</div>
            <select value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
              {WEEKDAYS_PT.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {inp("Hora", "game_time", "time")}
            {inp("€/mês", "monthlyPrice", "number", { min: 0 })}
            {inp("Vagas", "max_players", "number", { min: 2, max: 22 })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={saveSettings} disabled={busy} style={{ flex: 1, background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
              <Save size={15} /> Guardar
            </button>
            <button onClick={deleteGroup} disabled={busy} style={{ background: C.redDim ?? "transparent", color: C.red, border: `1px solid ${C.red}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={15} /> Apagar
            </button>
          </div>
        </div>

        {/* Player management */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Jogadores ({members.length})</div>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>Promove a organizador/auxiliar, remove do grupo ou apaga.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map((p) => {
              const att = game ? attOf(game.id, p.id) : null;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nick}
                      {p.is_organizer && <span style={{ fontSize: 8, color: C.blue, fontWeight: 700, marginLeft: 5 }}>ORG</span>}
                      {p.is_assistant && !p.is_organizer && <span style={{ fontSize: 8, color: C.green, fontWeight: 700, marginLeft: 5 }}>AUX</span>}
                      {!p.user_id && <span style={{ fontSize: 8, color: C.text3, fontWeight: 700, marginLeft: 5 }}>AVULSO</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.text3 }}>
                      {p.position || "—"}{att && <> · <span style={{ color: ATT_COLOR[att.status] ?? C.text3 }}>{att.status}</span></>}
                    </div>
                  </div>
                  <button title={p.is_organizer ? "Remover organizador" : "Tornar organizador"} disabled={busy}
                    onClick={() => run(() => actions.updatePlayer(p.id, { is_organizer: !p.is_organizer }), "Atualizado")}
                    style={{ width: 30, height: 30, borderRadius: 8, background: p.is_organizer ? C.blueDim : C.surface, border: `1px solid ${p.is_organizer ? C.blueBorder : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Crown size={14} color={p.is_organizer ? C.blue : C.text3} />
                  </button>
                  <button title={p.is_assistant ? "Remover auxiliar" : "Tornar auxiliar"} disabled={busy}
                    onClick={() => run(() => actions.updatePlayer(p.id, { is_assistant: !p.is_assistant }), "Atualizado")}
                    style={{ width: 30, height: 30, borderRadius: 8, background: p.is_assistant ? C.greenDim : C.surface, border: `1px solid ${p.is_assistant ? C.greenBorder : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ShieldCheck size={14} color={p.is_assistant ? C.green : C.text3} />
                  </button>
                  <button title="Remover do grupo" disabled={busy}
                    onClick={() => { if (window.confirm(`Remover ${p.nick} do grupo?`)) run(() => actions.updatePlayer(p.id, { group_id: null }), "Removido do grupo"); }}
                    style={{ width: 30, height: 30, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <UserMinus size={14} color={C.orange} />
                  </button>
                  <button title="Apagar jogador" disabled={busy}
                    onClick={() => { if (window.confirm(`Apagar ${p.nick} definitivamente?`)) run(() => actions.deletePlayer(p.id), "Jogador apagado"); }}
                    style={{ width: 30, height: 30, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Trash2 size={14} color={C.red} />
                  </button>
                </div>
              );
            })}
            {members.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Sem jogadores.</div>}
          </div>
        </div>

        {/* Games */}
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Jogos ({gamesOf(selected.id).length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gamesOf(selected.id).map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ color: STATUS_COLOR[g.status] ?? C.text2, fontWeight: 700, width: 70 }}>{g.status}</span>
                <span style={{ color: C.text2, flex: 1 }}>{g.scheduled_at ? new Date(g.scheduled_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                <span style={{ color: C.text3 }}>{confirmedFor(g.id)}/{g.spots}</span>
              </div>
            ))}
            {gamesOf(selected.id).length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>Sem jogos.</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────
  return (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 8px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", padding: 4, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ ...displayFont, fontSize: 22, flex: 1 }}>Admin · Grupos</div>
        <button onClick={load} title="Atualizar" style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "7px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Grupos", value: groups.length },
            { label: "Jogadores", value: players.length },
            { label: "Jogos", value: games.length },
          ].map((s) => (
            <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ ...displayFont, fontSize: 24 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: C.text2, padding: "20px 0", textAlign: "center" }}>A carregar grupos…</div>}
      {error && <div style={{ fontSize: 13, color: C.red, padding: "12px 0" }}>Erro: {error}</div>}
      {!loading && !error && groups.length === 0 && (
        <div style={{ fontSize: 13, color: C.text2, padding: "20px 0", textAlign: "center" }}>Ainda não há grupos criados.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g) => {
          const members = membersOf(g.id);
          const organizer = members.find((p) => p.is_organizer);
          const lastGame = currentGameOf(g.id);
          return (
            <div key={g.id} style={{ ...cardStyle }}>
              <button onClick={() => openGroup(g)} style={{ background: "none", border: "none", padding: 0, width: "100%", textAlign: "left", color: C.text1, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <div style={{ ...displayFont, fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                  <ChevronRight size={16} color={C.text3} style={{ flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 12, color: C.text2, marginBottom: 12, lineHeight: 1.7 }}>
                  {g.venue || "sem campo"} · {WEEKDAYS_PT[g.weekday] ?? "—"} {g.game_time} · {fmtEUR((g.monthly_price_cents || 0) / 100)}/mês ÷ {g.max_players}
                  <br />
                  Organizador: <span style={{ color: C.text1, fontWeight: 600 }}>{organizer ? organizer.nick : "—"}</span>
                  {organizer?.email && <span style={{ color: C.text3 }}> ({organizer.email})</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, color: C.text2 }}>
                    <Users size={12} /> {members.length} jogadores
                  </span>
                  {lastGame && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, color: C.text2 }}>
                      <Calendar size={12} /> <span style={{ color: STATUS_COLOR[lastGame.status] ?? C.text2, fontWeight: 700 }}>{lastGame.status}</span> · {confirmedFor(lastGame.id)}/{lastGame.spots}
                    </span>
                  )}
                </div>
              </button>

              {g.invite_token && (
                <button onClick={() => copy(g.invite_token)} style={{ width: "100%", background: C.card, color: copied === g.invite_token ? C.green : C.text2, border: `1px solid ${copied === g.invite_token ? C.greenBorder : C.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {copied === g.invite_token ? <><Check size={13} /> Link copiado</> : <><Copy size={13} /> Copiar link de convite</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
