import { useState } from "react";
import { ChevronLeft, Copy, Check, Crown, ShieldCheck, UserMinus, Trash2, Save } from "lucide-react";
import { C, cardStyle, displayFont } from "../../theme";
import { WEEKDAYS_PT, fmtEUR } from "../../lib/helpers";

const STATUS_COLOR = { open: C.orange, full: C.green, live: C.accent, played: C.text3, cancelled: C.red };

const Th = ({ children, align }) => (
  <th style={{ textAlign: align || "left", fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: "0.04em", padding: "0 12px 10px", textTransform: "uppercase" }}>{children}</th>
);
const Td = ({ children, align }) => (
  <td style={{ textAlign: align || "left", fontSize: 13, padding: "12px", borderTop: `1px solid ${C.border}` }}>{children}</td>
);

/** Cross-group management, desktop table instead of the mobile card list.
 *  Same underlying mutations as the in-app AdminPanel (adminUpdateGroup /
 *  adminDeleteGroup / adminUpdatePlayer / adminDeletePlayer). */
export default function AdminGroupsTab({ cloud, snapshot, refetchGroups }) {
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const { loading, error, groups, players, games, attendances } = snapshot;

  const membersOf = (gid) => players.filter((p) => p.group_id === gid);
  const gamesOf = (gid) => games.filter((g) => g.group_id === gid);
  const currentGameOf = (gid) => { const gg = gamesOf(gid); return gg.find((g) => ["open", "full", "live"].includes(g.status)) ?? gg[0] ?? null; };
  const confirmedFor = (gameId) => attendances.filter((a) => a.game_id === gameId && a.status === "confirmed").length;

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    const res = await fn();
    setBusy(false);
    if (res?.error) { setMsg({ ok: false, text: res.error }); return false; }
    setMsg({ ok: true, text: okText });
    await refetchGroups();
    return true;
  };

  const copy = async (token) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}?join=${token}`); setCopied(token); setTimeout(() => setCopied(null), 2000); } catch { /* ignore */ }
  };

  const openGroup = (g) => {
    setSelectedId(g.id);
    setForm({ name: g.name ?? "", venue: g.venue ?? "", weekday: g.weekday ?? 6, game_time: g.game_time ?? "20:00", monthlyPrice: (g.monthly_price_cents ?? 0) / 100, max_players: g.max_players ?? 10 });
    setMsg(null);
  };

  if (loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.red }}>Erro: {error}</div>;

  const selected = groups.find((g) => g.id === selectedId) ?? null;

  // ── DETAIL ───────────────────────────────────────────────
  if (selected && form) {
    const members = membersOf(selected.id);
    const game = currentGameOf(selected.id);
    const inp = (label, key, type = "text", extra = {}) => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
        <input type={type} value={form[key]} {...extra}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, color: C.text1, outline: "none" }} />
      </div>
    );
    return (
      <div>
        <button onClick={() => setSelectedId(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18 }}>
          <ChevronLeft size={16} /> Grupos
        </button>
        {msg && <div style={{ fontSize: 12, color: msg.ok ? C.green : C.red, marginBottom: 14 }}>{msg.text}</div>}

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ ...cardStyle, width: 300, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Definições</div>
            {inp("Nome", "name")}
            {inp("Campo / recinto", "venue")}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>Dia da semana</div>
              <select value={form.weekday} onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
                style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
                {WEEKDAYS_PT.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            {inp("Hora", "game_time", "time")}
            {inp("€/mês", "monthlyPrice", "number", { min: 0 })}
            {inp("Vagas", "max_players", "number", { min: 2, max: 35 })}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button disabled={busy} onClick={() => run(() => cloud.adminUpdateGroup(selected.id, {
                name: form.name, venue: form.venue, weekday: form.weekday, game_time: form.game_time,
                monthly_price_cents: Math.round(form.monthlyPrice * 100), max_players: Number(form.max_players),
              }), "Definições guardadas")} style={{ flex: 1, background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
                <Save size={14} /> Guardar
              </button>
              <button disabled={busy} onClick={() => {
                if (!window.confirm(`Apagar o grupo "${selected.name}" e todos os seus jogadores/jogos? Irreversível.`)) return;
                run(() => cloud.adminDeleteGroup(selected.id), "Grupo apagado").then((ok) => { if (ok) setSelectedId(null); });
              }} style={{ background: "transparent", color: C.red, border: `1px solid ${C.red}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
            {selected.invite_token && (
              <button onClick={() => copy(selected.invite_token)} style={{ width: "100%", marginTop: 10, background: C.card, color: copied === selected.invite_token ? C.green : C.text2, border: `1px solid ${copied === selected.invite_token ? C.greenBorder : C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {copied === selected.invite_token ? <><Check size={13} /> Link copiado</> : <><Copy size={13} /> Copiar link de convite</>}
              </button>
            )}
          </div>

          <div style={{ ...cardStyle, flex: 1, minWidth: 420 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Jogadores ({members.length})</div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 14 }}>
              {game ? <>Próximo jogo: <span style={{ color: STATUS_COLOR[game.status] ?? C.text2, fontWeight: 700 }}>{game.status}</span> · {confirmedFor(game.id)}/{game.spots} confirmados</> : "Sem jogos."}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Jogador</Th><Th>Papel</Th><Th align="right">Ações</Th></tr></thead>
              <tbody>
                {members.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div style={{ fontWeight: 600 }}>{p.nick}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>{p.email || "sem email"}</div>
                    </Td>
                    <Td>
                      {p.is_organizer && <span style={{ fontSize: 10, color: C.blue, fontWeight: 700 }}>ORGANIZADOR</span>}
                      {p.is_assistant && !p.is_organizer && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>AUXILIAR</span>}
                      {!p.is_organizer && !p.is_assistant && <span style={{ fontSize: 10, color: C.text3 }}>{p.user_id ? "jogador" : "avulso"}</span>}
                    </Td>
                    <Td align="right">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button title={p.is_organizer ? "Remover organizador" : "Tornar organizador"} disabled={busy}
                          onClick={() => run(() => cloud.adminUpdatePlayer(p.id, { is_organizer: !p.is_organizer }), "Atualizado")}
                          style={{ width: 28, height: 28, borderRadius: 8, background: p.is_organizer ? C.blueDim : C.surface, border: `1px solid ${p.is_organizer ? C.blueBorder : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Crown size={13} color={p.is_organizer ? C.blue : C.text3} />
                        </button>
                        <button title={p.is_assistant ? "Remover auxiliar" : "Tornar auxiliar"} disabled={busy}
                          onClick={() => run(() => cloud.adminUpdatePlayer(p.id, { is_assistant: !p.is_assistant }), "Atualizado")}
                          style={{ width: 28, height: 28, borderRadius: 8, background: p.is_assistant ? C.greenDim : C.surface, border: `1px solid ${p.is_assistant ? C.greenBorder : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ShieldCheck size={13} color={p.is_assistant ? C.green : C.text3} />
                        </button>
                        <button title="Remover do grupo" disabled={busy}
                          onClick={() => { if (window.confirm(`Remover ${p.nick} do grupo?`)) run(() => cloud.adminUpdatePlayer(p.id, { group_id: null }), "Removido do grupo"); }}
                          style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <UserMinus size={13} color={C.orange} />
                        </button>
                        <button title="Apagar jogador" disabled={busy}
                          onClick={() => { if (window.confirm(`Apagar ${p.nick} definitivamente?`)) run(() => cloud.adminDeletePlayer(p.id), "Jogador apagado"); }}
                          style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Trash2 size={13} color={C.red} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {members.length === 0 && <tr><Td>Sem jogadores.</Td><Td /><Td /></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────────
  return (
    <div style={cardStyle}>
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, color: C.text3, padding: "20px 0", textAlign: "center" }}>Ainda não há grupos criados.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Grupo</Th><Th>Organizador</Th><Th align="right">Jogadores</Th><Th>Próximo jogo</Th><Th align="right">Confirmados</Th><Th align="right">Convite</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const members = membersOf(g.id);
              const organizer = members.find((p) => p.is_organizer);
              const game = currentGameOf(g.id);
              return (
                <tr key={g.id} onClick={() => openGroup(g)} style={{ cursor: "pointer" }}>
                  <Td>
                    <div style={{ ...displayFont, fontSize: 14 }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{g.venue || "sem campo"} · {WEEKDAYS_PT[g.weekday] ?? "—"} {g.game_time} · {fmtEUR((g.monthly_price_cents || 0) / 100)}/mês</div>
                  </Td>
                  <Td>
                    {organizer ? <>{organizer.nick}<div style={{ fontSize: 11, color: C.text3 }}>{organizer.email}</div></> : <span style={{ color: C.text3 }}>—</span>}
                  </Td>
                  <Td align="right">{members.length}</Td>
                  <Td>{game ? <span style={{ color: STATUS_COLOR[game.status] ?? C.text2, fontWeight: 700 }}>{game.status}</span> : <span style={{ color: C.text3 }}>—</span>}</Td>
                  <Td align="right">{game ? `${confirmedFor(game.id)}/${game.spots}` : "—"}</Td>
                  <Td align="right">
                    {g.invite_token && (
                      <button onClick={(e) => { e.stopPropagation(); copy(g.invite_token); }} style={{ background: C.card, color: copied === g.invite_token ? C.green : C.text2, border: `1px solid ${copied === g.invite_token ? C.greenBorder : C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {copied === g.invite_token ? <Check size={12} /> : <Copy size={12} />} {copied === g.invite_token ? "Copiado" : "Copiar"}
                      </button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
