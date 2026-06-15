import { useState } from "react";
import { Pencil, CreditCard, Camera, Settings, LogOut, Star, MessageCircle, ShieldCheck } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { TOTAL_GAMES, POSITIONS, FEET, NATIONALITIES, CLUBS } from "../data";
import { ATTR_LABELS, fileToDataUrl, encodePayload, averageAttrs, computeOverall } from "../lib/helpers";
import { openWhatsApp, rateRequestMessage } from "../lib/whatsapp";
import FutCard from "./FutCard";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const ATTR_NAMES = { rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };

export default function PerfilTab({ group, viewPlayerId, updateProfile, backToMe, resetDemo, isOrganizer, onEditGroup, logout, peerRatings = [], addPeerRating, isAdmin, onOpenAdmin }) {
  const me = group.find((p) => p.isMe);
  const player = group.find((p) => p.id === viewPlayerId) ?? me;
  const isOwn = player.isMe;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(player);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeStatus, setCodeStatus] = useState(null); // 'ok' | 'error'

  // Edit mode works on the self-assessment, not the blended card attrs.
  const startEditing = () => { setForm({ ...player, attrs: player.selfAttrs ?? player.attrs }); setEditing(true); };

  const requestRating = () => {
    const payload = encodePayload({
      name: player.name, nick: player.nick, position: player.position,
      club: player.club, nationality: player.nationality, foot: player.foot, age: player.age,
    });
    openWhatsApp(rateRequestMessage(player.nick, `${window.location.origin}?rate=${encodeURIComponent(payload)}`));
  };

  const submitCode = () => {
    const ok = addPeerRating(codeDraft);
    setCodeStatus(ok ? "ok" : "error");
    if (ok) setCodeDraft("");
  };

  const attendance = Math.round((player.gamesPlayed / TOTAL_GAMES) * 100);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const photo = await fileToDataUrl(file);
    setForm((f) => ({ ...f, photo }));
  };

  const field = (label, key, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }}
      />
    </div>
  );

  const selectField = (label, key, options) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <select value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
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
        <div style={{ ...displayFont, fontSize: 22, padding: "20px 0 16px" }}>Editar Perfil</div>

        <label style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Camera size={19} color={C.accent} />
          </div>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{form.photo ? "Trocar fotografia" : "Adicionar fotografia"}</div>
          {form.photo && <img src={form.photo} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />}
          <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
        </label>

        <div style={{ ...cardStyle, marginBottom: 14 }}>
          {field("Nome completo", "name")}
          {field("Alcunha (nome no cartão)", "nick")}
          {field("Email", "email", "email")}
          {field("Telemóvel (MB Way)", "phone", "tel")}
          {field("Idade", "age", "number")}
          {selectField("Nacionalidade", "nationality", NATIONALITIES)}
          {selectField("Clube do coração", "club", CLUBS)}
          {chips("Posição", "position", POSITIONS)}
          {chips("Pé dominante", "foot", FEET)}
        </div>

        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>ATRIBUTOS</SectionLabel>
          {Object.keys(ATTR_LABELS).map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ width: 52, fontSize: 12, color: C.text2 }}>{ATTR_NAMES[k]}</span>
              <input type="range" min="40" max="99" value={form.attrs?.[k] ?? 60}
                onChange={(e) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [k]: Number(e.target.value) } }))}
                style={{ flex: 1, accentColor: C.accent }} />
              <span style={{ ...displayFont, width: 28, fontSize: 16, color: C.accent, textAlign: "right" }}>{form.attrs?.[k] ?? 60}</span>
            </div>
          ))}
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
        <div style={{ ...displayFont, fontSize: 22 }}>{isOwn ? "O Meu Cartão" : "Perfil"}</div>
        {isOwn ? (
          <button onClick={startEditing} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Pencil size={13} /> Editar
          </button>
        ) : (
          <button onClick={backToMe} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 14px", fontSize: 12, color: C.text2, cursor: "pointer" }}>
            Ver o meu
          </button>
        )}
      </div>

      {/* FUT card — the hero of the profile */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <FutCard player={player} width={280} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: C.text2, marginBottom: 16 }}>
        {player.name} · @{player.nick.toLowerCase()}
      </div>

      {/* Peer rating (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>AVALIAÇÃO DOS AMIGOS</SectionLabel>
          {peerRatings.length > 0 ? (() => {
            const friendsAvg = averageAttrs(peerRatings.map((r) => r.a));
            const friendsOvr = computeOverall(player.position, friendsAvg);
            const selfOvr = computeOverall(player.position, player.selfAttrs ?? player.attrs);
            const names = peerRatings.map((r) => r.from).filter((n) => n && n !== "Anónimo");
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  {[{ label: "Amigos", value: friendsOvr, color: C.gold }, { label: "Auto", value: selfOvr, color: C.text2 }, { label: "Cartão", value: computeOverall(player.position, player.attrs), color: C.accent }].map((s) => (
                    <div key={s.label} style={{ flex: 1, background: C.surface, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ ...displayFont, fontSize: 20, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.text2 }}>
                  {peerRatings.length} {peerRatings.length === 1 ? "avaliação recebida" : "avaliações recebidas"}
                  {names.length > 0 && ` — ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`}.
                  O cartão mostra a média entre a tua auto-avaliação e a dos amigos.
                </div>
              </div>
            );
          })() : (
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 14 }}>
              Ainda ninguém te avaliou — o cartão mostra só a tua auto-avaliação. Pede aos teus amigos para dizerem como jogas de verdade 👀
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={requestRating} style={{ flex: 1.4, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MessageCircle size={14} /> Pedir avaliação
            </button>
            <button onClick={() => { setCodeOpen(!codeOpen); setCodeStatus(null); }} style={{ flex: 1, background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Star size={14} /> Inserir código
            </button>
          </div>

          {codeOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={codeDraft} onChange={(e) => { setCodeDraft(e.target.value); setCodeStatus(null); }} placeholder="Cola aqui o código recebido…"
                  style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 12, color: C.text1, outline: "none", fontFamily: "monospace" }} />
                <button onClick={submitCode} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Adicionar
                </button>
              </div>
              {codeStatus === "ok" && <div style={{ fontSize: 11, color: C.green, marginTop: 6 }}>Avaliação adicionada — o teu cartão já reflete a opinião ✓</div>}
              {codeStatus === "error" && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>Código inválido — confirma que copiaste tudo.</div>}
            </div>
          )}
        </div>
      )}

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
              <div style={{ ...displayFont, fontSize: 22, lineHeight: 1.1 }}>{s.value}</div>
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

      {/* Organizer: group settings */}
      {isOwn && isOrganizer && (
        <button onClick={onEditGroup} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer", textAlign: "left", color: C.text1 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.blueDim, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Settings size={18} color={C.blue} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Definições do grupo</div>
            <div style={{ fontSize: 11, color: C.text2 }}>Campo, horário, mensalidade e vagas</div>
          </div>
        </button>
      )}

      {/* Owner-only: cross-group admin overview */}
      {isOwn && isAdmin && (
        <button onClick={onOpenAdmin} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer", textAlign: "left", color: C.text1, border: `1px solid ${C.accentBorder}` }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={18} color={C.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Painel de administrador</div>
            <div style={{ fontSize: 11, color: C.text2 }}>Ver todos os grupos, jogadores e jogos</div>
          </div>
        </button>
      )}

      {isOwn && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button onClick={logout} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <LogOut size={13} /> Sair
          </button>
          <button onClick={resetDemo} style={{ flex: 1, background: "none", border: `1px dashed ${C.border}`, borderRadius: 12, padding: 11, fontSize: 12, color: C.text3, cursor: "pointer" }}>
            Repor demo
          </button>
        </div>
      )}
    </div>
  );
}
