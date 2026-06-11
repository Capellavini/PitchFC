import { useState } from "react";
import { Pencil, CreditCard } from "lucide-react";
import { C, cardStyle } from "../theme";
import { TOTAL_GAMES, POSITIONS, FEET } from "../data";
import { ini } from "../lib/helpers";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

export default function PerfilTab({ group, viewPlayerId, updateProfile, backToMe, resetDemo }) {
  const me = group.find((p) => p.isMe);
  const player = group.find((p) => p.id === viewPlayerId) ?? me;
  const isOwn = player.isMe;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(player);

  const attendance = Math.round((player.gamesPlayed / TOTAL_GAMES) * 100);

  const field = (label, key, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }}
      />
    </div>
  );

  const chips = (label, key, options) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <button key={opt} onClick={() => setForm({ ...form, [key]: opt })} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (editing) {
    return (
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 900, padding: "20px 0 16px" }}>Editar Perfil</div>
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          {field("Nome completo", "name")}
          {field("Alcunha (como aparece no jogo)", "nick")}
          {field("Email", "email", "email")}
          {field("Telemóvel", "phone", "tel")}
          {chips("Posição", "position", POSITIONS)}
          {chips("Pé dominante", "foot", FEET)}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <BtnPrimary onClick={() => { updateProfile(form); setEditing(false); }} style={{ flex: 1 }}>Guardar</BtnPrimary>
          <button onClick={() => { setForm(player); setEditing(false); }} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{isOwn ? "O Meu Perfil" : "Perfil"}</div>
        {isOwn ? (
          <button onClick={() => { setForm(player); setEditing(true); }} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Pencil size={13} /> Editar
          </button>
        ) : (
          <button onClick={backToMe} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, color: C.text2, cursor: "pointer" }}>
            Ver o meu
          </button>
        )}
      </div>

      {/* Identity card */}
      <div style={{ ...cardStyle, textAlign: "center", padding: "24px 20px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -12, top: -14, fontSize: 120, fontWeight: 900, color: C.accent, opacity: 0.035, lineHeight: 1, userSelect: "none" }}>
          {player.goals}
        </div>
        <div style={{ width: 76, height: 76, borderRadius: 24, background: C.accentDim, border: `2px solid ${C.accentBorder}`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: C.accent }}>
          {ini(player.name)}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{player.name}</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>@{player.nick.toLowerCase()}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ background: C.accentDim, color: C.accent, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{player.position}</span>
          <span style={{ background: C.blueDim, color: C.blue, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Pé {player.foot}</span>
        </div>
      </div>

      {/* Contact (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>CONTACTO</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.text2 }}>Email</span>
              <span>{player.email || <span style={{ color: C.text3 }}>não definido</span>}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.text2 }}>Telemóvel</span>
              <span>{player.phone || <span style={{ color: C.text3 }}>não definido</span>}</span>
            </div>
          </div>
        </div>
      )}

      {/* Season stats */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <SectionLabel>TEMPORADA</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Jogos",        value: player.gamesPlayed },
            { label: "Golos",        value: player.goals       },
            { label: "Assistências", value: player.assists     },
            { label: "MVPs",         value: player.mvps        },
            { label: "Presença",     value: `${attendance}%`   },
            { label: "G+A / jogo",   value: player.gamesPlayed ? ((player.goals + player.assists) / player.gamesPlayed).toFixed(1) : "0" },
          ].map((s) => (
            <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>PAGAMENTO</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.blueDim, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={18} color={C.blue} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>MB Way</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{player.phone}</div>
            </div>
            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Ativo ✓</span>
          </div>
        </div>
      )}

      {isOwn && (
        <button onClick={resetDemo} style={{ width: "100%", background: "none", border: `1px dashed ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, color: C.text3, cursor: "pointer", marginBottom: 24 }}>
          Repor dados de demonstração
        </button>
      )}
    </div>
  );
}
