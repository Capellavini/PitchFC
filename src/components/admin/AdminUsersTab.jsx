import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { C, cardStyle } from "../../theme";

const Th = ({ children, align }) => (
  <th style={{ textAlign: align || "left", fontSize: 11, fontWeight: 700, color: C.text3, letterSpacing: "0.04em", padding: "0 12px 10px", textTransform: "uppercase" }}>{children}</th>
);
const Td = ({ children, align }) => (
  <td style={{ textAlign: align || "left", fontSize: 13, padding: "12px", borderTop: `1px solid ${C.border}`, verticalAlign: "middle" }}>{children}</td>
);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** "User base" — every registered player card across every group, plus
 *  /league landing-page leads. Search, delete, and reassign a player to
 *  a different group (or none) from one place. */
export default function AdminUsersTab({ cloud, snapshot, leads, refetchGroups, refetchLeads }) {
  const [sub, setSub] = useState("players"); // 'players' | 'leads'
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);

  const { loading, error, groups, players } = snapshot;
  const groupName = (gid) => groups.find((g) => g.id === gid)?.name;

  const q = query.trim().toLowerCase();
  const filteredPlayers = !q ? players : players.filter((p) =>
    [p.nick, p.name, p.email, groupName(p.group_id)].some((v) => (v || "").toLowerCase().includes(q)));
  const filteredLeads = !q ? (leads.rows ?? []) : (leads.rows ?? []).filter((l) =>
    [l.name, l.email, l.whatsapp, l.city, l.role].some((v) => (v || "").toLowerCase().includes(q)));

  const changeGroup = async (playerId, groupId) => {
    setBusyId(playerId);
    await cloud.adminUpdatePlayer(playerId, { group_id: groupId || null, is_organizer: false, is_assistant: false });
    await refetchGroups();
    setBusyId(null);
  };
  const deletePlayer = async (p) => {
    if (!window.confirm(`Apagar ${p.nick} definitivamente? Remove a ficha, presenças e stats.`)) return;
    setBusyId(p.id);
    await cloud.adminDeletePlayer(p.id);
    await refetchGroups();
    setBusyId(null);
  };
  const deleteLead = async (l) => {
    if (!window.confirm(`Apagar o lead de ${l.name || l.email || "sem nome"}?`)) return;
    setBusyId(l.id);
    await cloud.adminDeleteLead(l.id);
    await refetchLeads();
    setBusyId(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["players", `Utilizadores (${players.length})`], ["leads", `Leads (${leads.rows?.length ?? 0})`]].map(([id, label]) => {
          const active = sub === id;
          return (
            <button key={id} onClick={() => setSub(id)} style={{ background: active ? C.accentDim : C.card, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", width: 240 }}>
          <Search size={14} color={C.text3} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar por nome, email, grupo…"
            style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px 9px 32px", fontSize: 12, color: C.text1, outline: "none" }} />
        </div>
      </div>

      {sub === "players" ? (
        loading ? <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>
        : error ? <div style={{ fontSize: 13, color: C.red }}>Erro: {error}</div>
        : (
          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Jogador</Th><Th>Contacto</Th><Th>Grupo</Th><Th align="right">Ações</Th></tr></thead>
              <tbody>
                {filteredPlayers.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <div style={{ fontWeight: 600 }}>{p.nick}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>{p.name}{p.is_organizer && <span style={{ color: C.blue, fontWeight: 700 }}> · ORG</span>}{p.is_assistant && !p.is_organizer && <span style={{ color: C.green, fontWeight: 700 }}> · AUX</span>}{!p.user_id && <span style={{ color: C.text3 }}> · convidado</span>}{p.player_type === "avulso" && <span style={{ color: C.orange, fontWeight: 700 }}> · avulso</span>}</div>
                    </Td>
                    <Td>
                      <div>{p.email || <span style={{ color: C.text3 }}>—</span>}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>{p.phone || "—"}</div>
                    </Td>
                    <Td>
                      <select value={p.group_id ?? ""} disabled={busyId === p.id} onChange={(e) => changeGroup(p.id, e.target.value)}
                        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 8px", fontSize: 12, color: C.text1, outline: "none", maxWidth: 180 }}>
                        <option value="">Sem grupo</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </Td>
                    <Td align="right">
                      <button title="Apagar" disabled={busyId === p.id} onClick={() => deletePlayer(p)}
                        style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={13} color={C.red} />
                      </button>
                    </Td>
                  </tr>
                ))}
                {filteredPlayers.length === 0 && <tr><Td>Nenhum utilizador encontrado.</Td><Td /><Td /><Td /></tr>}
              </tbody>
            </table>
          </div>
        )
      ) : (
        leads.loading ? <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>
        : leads.error ? <div style={{ fontSize: 13, color: C.red }}>Erro: {leads.error}</div>
        : (
          <div style={cardStyle}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Nome</Th><Th>Contacto</Th><Th>Perfil</Th><Th>Cidade</Th><Th>Data</Th><Th align="right">Ações</Th></tr></thead>
              <tbody>
                {filteredLeads.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.name || <span style={{ color: C.text3 }}>—</span>}</Td>
                    <Td>
                      <div>{l.email || <span style={{ color: C.text3 }}>—</span>}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>{l.whatsapp || "—"}</div>
                    </Td>
                    <Td>{l.role || <span style={{ color: C.text3 }}>—</span>}</Td>
                    <Td>{l.city || <span style={{ color: C.text3 }}>—</span>}</Td>
                    <Td>{fmtDate(l.created_at)}</Td>
                    <Td align="right">
                      <button title="Apagar" disabled={busyId === l.id} onClick={() => deleteLead(l)}
                        style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={13} color={C.red} />
                      </button>
                    </Td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && <tr><Td>Nenhum lead encontrado.</Td><Td /><Td /><Td /><Td /><Td /></tr>}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
