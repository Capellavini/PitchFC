/**
 * PITCH — Weekly Game Organizer (Complete Prototype)
 * ─────────────────────────────────────────────────────────
 * Core problem: 15 friends, 10 spots, every Saturday.
 * Replace the WhatsApp chaos: confirmations, payments,
 * stats, MVP voting, team draw, equipment.
 * ─────────────────────────────────────────────────────────
 * Tabs: Jogo · Stats · Grupo · Perfil
 *
 * This is a UI prototype with in-memory state.
 * See CLAUDE.md for the backend plan (Supabase).
 */

import { useState } from "react";
import {
  Zap, Users, Clock, MapPin, Check, X, MessageCircle,
  Trophy, User, Shuffle, ClipboardList, Star,
  CreditCard, ChevronRight, Pencil,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────
const C = {
  bg:           "#07070A",
  surface:      "#111114",
  card:         "#18181E",
  border:       "#22222C",
  accent:       "#C8FF00",
  accentDim:    "rgba(200,255,0,0.07)",
  accentBorder: "rgba(200,255,0,0.20)",
  text1:        "#FFFFFF",
  text2:        "#7C7C8A",
  text3:        "#35353F",
  green:        "#00D08A",
  greenDim:     "rgba(0,208,138,0.12)",
  red:          "#FF3B5C",
  redDim:       "rgba(255,59,92,0.12)",
  orange:       "#FF9F0A",
  orangeDim:    "rgba(255,159,10,0.12)",
  blue:         "#4895FF",
  blueDim:      "rgba(72,149,255,0.10)",
  whatsapp:     "#25D366",
};

const cardStyle = {
  background: C.card, borderRadius: 16,
  border: `1px solid ${C.border}`, padding: 16,
};

const AVATAR_PALETTE = [
  C.accent, C.blue, C.orange, C.green,
  "#A78BFA", "#FB923C", "#34D399", "#60A5FA",
];

// ─────────────────────────────────────────────────────────
// DATA MODEL (mirrors the Supabase schema in CLAUDE.md)
// ─────────────────────────────────────────────────────────
const INITIAL_GROUP = [
  { id: 1,  name: "Carlos Silva",     nick: "Carlão",     status: "confirmed", paid: true,  isMe: true,
    email: "carlos@email.com", phone: "+351 912 345 678", position: "Médio",    foot: "Direito",
    goals: 12, assists: 8,  mvps: 3, gamesPlayed: 13 },
  { id: 2,  name: "João Ferreira",    nick: "Joãozão",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 001", position: "Avançado", foot: "Direito",
    goals: 21, assists: 5,  mvps: 5, gamesPlayed: 15 },
  { id: 3,  name: "Miguel Santos",    nick: "Miguelinho", status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 002", position: "Defesa",   foot: "Esquerdo",
    goals: 3,  assists: 11, mvps: 2, gamesPlayed: 11 },
  { id: 4,  name: "Rui Oliveira",     nick: "Ruizão",     status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 003", position: "Guarda-redes", foot: "Direito",
    goals: 0,  assists: 2,  mvps: 4, gamesPlayed: 14 },
  { id: 5,  name: "Diogo Costa",      nick: "Diogo",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 004", position: "Médio",    foot: "Direito",
    goals: 9,  assists: 13, mvps: 1, gamesPlayed: 9 },
  { id: 6,  name: "André Lima",       nick: "Liminha",    status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 005", position: "Avançado", foot: "Esquerdo",
    goals: 17, assists: 4,  mvps: 2, gamesPlayed: 12 },
  { id: 7,  name: "Pedro Neves",      nick: "Pedão",      status: "confirmed", paid: false,
    email: "", phone: "+351 913 000 006", position: "Defesa",   foot: "Direito",
    goals: 2,  assists: 6,  mvps: 0, gamesPlayed: 10 },
  { id: 8,  name: "Tiago Moreira",    nick: "Tiago",      status: "confirmed", paid: true,
    email: "", phone: "+351 913 000 007", position: "Médio",    foot: "Ambos",
    goals: 8,  assists: 9,  mvps: 1, gamesPlayed: 15 },
  { id: 9,  name: "Bruno Alves",      nick: "Brunão",     status: "pending",
    email: "", phone: "+351 913 000 008", position: "Avançado", foot: "Direito",
    goals: 11, assists: 3,  mvps: 1, gamesPlayed: 8 },
  { id: 10, name: "Fábio Gomes",      nick: "Fábio",      status: "pending",
    email: "", phone: "+351 913 000 009", position: "Defesa",   foot: "Direito",
    goals: 1,  assists: 4,  mvps: 0, gamesPlayed: 7 },
  { id: 11, name: "Ricardo Santos",   nick: "Ricardão",   status: "pending",
    email: "", phone: "+351 913 000 010", position: "Médio",    foot: "Esquerdo",
    goals: 6,  assists: 7,  mvps: 1, gamesPlayed: 13 },
  { id: 12, name: "Hugo Costa",       nick: "Hugo",       status: "pending",
    email: "", phone: "+351 913 000 011", position: "Avançado", foot: "Direito",
    goals: 14, assists: 2,  mvps: 2, gamesPlayed: 11 },
  { id: 13, name: "Nuno Alves",       nick: "Nuno",       status: "pending",
    email: "", phone: "+351 913 000 012", position: "Guarda-redes", foot: "Direito",
    goals: 0,  assists: 1,  mvps: 1, gamesPlayed: 6 },
  { id: 14, name: "Filipe Rodrigues", nick: "Filipe",     status: "declined",
    email: "", phone: "+351 913 000 013", position: "Defesa",   foot: "Direito",
    goals: 2,  assists: 3,  mvps: 0, gamesPlayed: 4 },
  { id: 15, name: "Gonçalo Ferreira", nick: "Gonças",     status: "declined",
    email: "", phone: "+351 913 000 014", position: "Médio",    foot: "Esquerdo",
    goals: 4,  assists: 2,  mvps: 0, gamesPlayed: 3 },
];

const GAME = {
  label:     "Pelada dos Amigos",
  date:      "Sábado, 14 Jun",
  time:      "20:00",
  field:     "PITCH Club — Quadra 1",
  spots:     10,
  totalCost: 80,
  recurring: "Toda semana · Sáb às 20:00",
};

const LAST_GAME = {
  date: "7 Jun", result: "5–3",
  // simple per-player log of last game (for MVP voting context)
  scorers: [{ playerId: 2, goals: 2 }, { playerId: 6, goals: 2 }, { playerId: 1, goals: 1 }],
};

const HISTORY = [
  { id: 1, date: "7 Jun",  confirmed: 10, result: "5–3", allPaid: true,  mvpId: 2 },
  { id: 2, date: "31 Mai", confirmed: 10, result: "3–3", allPaid: true,  mvpId: 4 },
  { id: 3, date: "24 Mai", confirmed: 9,  result: "4–2", allPaid: false, mvpId: 1 },
  { id: 4, date: "17 Mai", confirmed: 10, result: "6–1", allPaid: true,  mvpId: 6 },
  { id: 5, date: "10 Mai", confirmed: 10, result: "2–4", allPaid: true,  mvpId: 3 },
];

const INITIAL_MATERIAL = [
  { id: 1, item: "Bola",         assignedTo: 2,    done: true  },
  { id: 2, item: "Coletes",      assignedTo: 1,    done: false },
  { id: 3, item: "Bomba de ar",  assignedTo: null, done: false },
];

const TOTAL_GAMES = 15;
const POSITIONS = ["Guarda-redes", "Defesa", "Médio", "Avançado"];
const FEET = ["Direito", "Esquerdo", "Ambos"];

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
const ini = (n) => n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const playerColor = (group, p) => AVATAR_PALETTE[group.indexOf(p) % AVATAR_PALETTE.length];

const Avatar = ({ name, color, size = 36, fontSize = 12, isMe }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.3,
    background: isMe ? C.accentDim : `${color}18`,
    border: `1.5px solid ${isMe ? C.accent : color}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize, fontWeight: 800, color: isMe ? C.accent : color, flexShrink: 0,
  }}>
    {ini(name)}
  </div>
);

const SectionLabel = ({ children, style }) => (
  <div style={{ fontSize: 10, color: C.text2, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12, ...style }}>
    {children}
  </div>
);

const BtnPrimary = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: "11px 16px", fontWeight: 800, fontSize: 14, cursor: "pointer", ...style }}>
    {children}
  </button>
);

const BtnGhost = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", ...style }}>
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────
// JOGO TAB
// ─────────────────────────────────────────────────────────
function JogoTab({ group, togglePaid, toggleMyStatus, material, toggleMaterial, teams, drawTeams, payMine }) {
  const confirmed = group.filter(p => p.status === "confirmed");
  const pending   = group.filter(p => p.status === "pending");
  const declined  = group.filter(p => p.status === "declined");
  const me        = group.find(p => p.isMe);
  const spotsLeft = GAME.spots - confirmed.length;
  const priceEach = Math.round(GAME.totalCost / GAME.spots);
  const paidCount = confirmed.filter(p => p.paid).length;
  const slots     = Array.from({ length: GAME.spots }, (_, i) => confirmed[i] ?? null);

  return (
    <div style={{ padding: "0 16px" }}>

      {/* Header */}
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.text2 }}>PRÓXIMO JOGO</div>
          <div style={{ fontSize: 10, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>RECORRENTE</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 2 }}>{GAME.label}</div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.text2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {GAME.date} · {GAME.time}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {GAME.field}</span>
        </div>
      </div>

      {/* SLOT GRID */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 32, fontWeight: 900, color: confirmed.length >= GAME.spots ? C.green : C.text1 }}>{confirmed.length}</span>
            <span style={{ fontSize: 18, fontWeight: 500, color: C.text3 }}>/{GAME.spots}</span>
          </div>
          {spotsLeft > 0
            ? <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{spotsLeft} {spotsLeft === 1 ? "vaga em aberto" : "vagas em aberto"}</div>
            : <div style={{ fontSize: 13, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Check size={14} /> Time completo!</div>
          }
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 4 }}>
          {slots.map((player, i) => {
            const color = player ? playerColor(group, player) : null;
            return player ? (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  width: "100%", aspectRatio: "1", borderRadius: 14,
                  background: player.isMe ? C.accentDim : `${color}18`,
                  border: `2px solid ${player.isMe ? C.accent : color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: player.isMe ? C.accent : color,
                  position: "relative",
                }}>
                  {ini(player.name)}
                  {player.paid && (
                    <div style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
                      <Check size={7} strokeWidth={3} color="#000" />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: player.isMe ? C.accent : C.text2, marginTop: 5, fontWeight: player.isMe ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.nick}</div>
              </div>
            ) : (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 14, border: `2px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.text3 }}>+</div>
                <div style={{ fontSize: 10, color: C.text3, marginTop: 5 }}>livre</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MY STATUS + PAYMENT */}
      {me?.status === "confirmed" ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: me.paid ? 0 : 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenDim, border: `1px solid rgba(0,208,138,0.3)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={20} color={C.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>Estás dentro!</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{me.paid ? "Pago ✓ — bom jogo!" : `Falta pagar €${priceEach}`}</div>
            </div>
            <button onClick={() => toggleMyStatus("declined")} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, color: C.text2, cursor: "pointer" }}>Cancelar</button>
          </div>
          {!me.paid && (
            <BtnPrimary onClick={payMine} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <CreditCard size={16} /> Pagar €{priceEach} · MB Way
            </BtnPrimary>
          )}
        </div>
      ) : me?.status === "declined" ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>Disseste que não podes. Mudaste de ideias?</div>
          <BtnGhost onClick={() => toggleMyStatus("confirmed")} style={{ width: "100%" }}>Afinal vou! Confirmar</BtnGhost>
        </div>
      ) : (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>Vais jogar no sábado?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <BtnPrimary onClick={() => toggleMyStatus("confirmed")} style={{ flex: 1, fontSize: 15 }}>Estou dentro!</BtnPrimary>
            <button onClick={() => toggleMyStatus("declined")} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Não posso</button>
          </div>
        </div>
      )}

      {/* TEAM DRAW — only when full */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: teams ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sorteio de Equipas</div>
            <div style={{ fontSize: 11, color: C.text2 }}>
              {confirmed.length >= GAME.spots ? "Time completo — pronto a sortear" : `Faltam ${spotsLeft} para sortear`}
            </div>
          </div>
          <button
            onClick={drawTeams}
            disabled={confirmed.length < 2}
            style={{
              background: confirmed.length >= GAME.spots ? C.accent : C.accentDim,
              color: confirmed.length >= GAME.spots ? C.bg : C.accent,
              border: `1px solid ${C.accentBorder}`,
              borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Shuffle size={14} /> {teams ? "Re-sortear" : "Sortear"}
          </button>
        </div>

        {teams && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ label: "COLETES", players: teams.a, color: C.accent }, { label: "SEM COLETES", players: teams.b, color: C.blue }].map(t => (
              <div key={t.label} style={{ background: C.surface, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: t.color, marginBottom: 10 }}>{t.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {t.players.map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: t.color }} />
                      <span style={{ fontSize: 12, fontWeight: p.isMe ? 800 : 500, color: p.isMe ? C.accent : C.text1 }}>{p.nick}</span>
                      <span style={{ fontSize: 9, color: C.text3, marginLeft: "auto" }}>{p.position.slice(0, 3).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PENDING */}
      {pending.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Sem resposta</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{pending.length} jogadores ainda não responderam</div>
            </div>
            <button style={{ background: C.whatsapp, color: "#000", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <MessageCircle size={13} /> Lembrar todos
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={p.name} color={playerColor(group, p)} size={32} fontSize={11} />
                <span style={{ flex: 1, fontSize: 13, color: C.text2 }}>{p.nick}</span>
                <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, cursor: "pointer" }}>Lembrar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DECLINED */}
      {declined.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>NÃO PODEM ({declined.length})</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {declined.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 10px" }}>
                <X size={12} color={C.red} />
                <span style={{ fontSize: 12, color: C.text2 }}>{p.nick}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENTS OVERVIEW */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Pagamentos</div>
            <div style={{ fontSize: 11, color: C.text2 }}>€{priceEach}/jogador · €{GAME.totalCost} total</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.green }}>€{paidCount * priceEach}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>de €{confirmed.length * priceEach} arrecadado</div>
          </div>
        </div>

        <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 14 }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.green, width: `${confirmed.length ? (paidCount / confirmed.length) * 100 : 0}%`, transition: "width 0.3s" }} />
        </div>

        {confirmed.filter(p => !p.paid).length > 0 ? (
          <>
            <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>DEVEM PAGAR</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {confirmed.filter(p => !p.paid).map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={11} isMe={p.isMe} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nick}</span>
                  <span style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>€{priceEach}</span>
                  <button onClick={() => togglePaid(p.id)} style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.accent, fontWeight: 700, cursor: "pointer" }}>Pago ✓</button>
                </div>
              ))}
            </div>
            <button style={{ width: "100%", background: C.whatsapp, color: "#000", border: "none", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MessageCircle size={15} /> Cobrar pelo WhatsApp
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 13, color: C.green, fontWeight: 700 }}>
            <Check size={14} style={{ display: "inline", marginRight: 6 }} /> Todos pagaram!
          </div>
        )}
      </div>

      {/* MATERIAL CHECKLIST */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <ClipboardList size={15} color={C.text2} />
          <div style={{ fontSize: 13, fontWeight: 700 }}>Material do Jogo</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {material.map(m => {
            const assignee = group.find(p => p.id === m.assignedTo);
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => toggleMaterial(m.id)} style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  background: m.done ? C.green : "transparent",
                  border: `1.5px solid ${m.done ? C.green : C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}>
                  {m.done && <Check size={13} strokeWidth={3} color="#000" />}
                </button>
                <span style={{ flex: 1, fontSize: 13, textDecoration: m.done ? "line-through" : "none", color: m.done ? C.text3 : C.text1 }}>{m.item}</span>
                {assignee
                  ? <span style={{ fontSize: 11, color: C.text2 }}>{assignee.nick}</span>
                  : <button style={{ background: "none", border: `1px dashed ${C.border}`, borderRadius: 8, padding: "3px 10px", fontSize: 11, color: C.text3, cursor: "pointer" }}>atribuir</button>
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STATS TAB — leaderboards + post-game flow + history
// ─────────────────────────────────────────────────────────
function StatsTab({ group, mvpVote, setMvpVote, statMode, setStatMode }) {
  const byGoals   = [...group].sort((a, b) => b.goals - a.goals);
  const byAssists = [...group].sort((a, b) => b.assists - a.assists);
  const byMvps    = [...group].sort((a, b) => b.mvps - a.mvps);
  const lists = { goals: byGoals, assists: byAssists, mvps: byMvps };
  const fields = { goals: "goals", assists: "assists", mvps: "mvps" };
  const list = lists[statMode].slice(0, 8);

  // MVP voting candidates — last game's confirmed players (mock: first 10)
  const candidates = group.filter(p => p.status === "confirmed").slice(0, 6);
  const voteOpen = mvpVote.open;

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Stats</div>
        <div style={{ fontSize: 13, color: C.text2 }}>Temporada · {TOTAL_GAMES} jogos</div>
      </div>

      {/* ── MVP VOTING — post-game flow ── */}
      {voteOpen && (
        <div style={{
          background: "linear-gradient(135deg, #12121A 0%, #0A1600 100%)",
          border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: 18, marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={14} color={C.accent} />
              <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: "0.06em" }}>VOTAÇÃO MVP</span>
            </div>
            <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>Fecha em 18h</span>
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 14 }}>
            Jogo de {LAST_GAME.date} ({LAST_GAME.result}) — quem foi o melhor em campo?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {candidates.map(p => {
              const selected = mvpVote.votedFor === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setMvpVote({ ...mvpVote, votedFor: selected ? null : p.id })}
                  style={{
                    background: selected ? C.accentDim : C.surface,
                    border: `1.5px solid ${selected ? C.accent : C.border}`,
                    borderRadius: 12, padding: "10px 6px", cursor: "pointer", textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: selected ? C.accent : C.text1 }}>{p.nick}</div>
                  <div style={{ fontSize: 9, color: C.text3, marginTop: 2 }}>{p.position}</div>
                  {selected && <div style={{ fontSize: 10, color: C.accent, marginTop: 3 }}>✓ o teu voto</div>}
                </button>
              );
            })}
          </div>
          {mvpVote.votedFor && (
            <BtnPrimary onClick={() => setMvpVote({ ...mvpVote, open: false })} style={{ width: "100%", marginTop: 12 }}>
              Confirmar Voto
            </BtnPrimary>
          )}
        </div>
      )}
      {!voteOpen && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Star size={18} color={C.accent} />
          <div style={{ flex: 1, fontSize: 13, color: C.text2 }}>Voto registado! Resultado quando a votação fechar.</div>
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["goals", "⚽ Golos"], ["assists", "🎯 Assists"], ["mvps", "⭐ MVPs"]].map(([m, label]) => {
          const active = statMode === m;
          return (
            <button key={m} onClick={() => setStatMode(m)} style={{ flex: 1, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: "none", borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 20 }}>
        {list.map((p, i) => {
          const value = p[fields[statMode]];
          const max = list[0][fields[statMode]] || 1;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: p.isMe ? C.accentDim : C.card, border: `1px solid ${p.isMe ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: i === 0 ? C.accent : i === 1 ? C.text2 : i === 2 ? C.orange : C.text3 }}>{i + 1}</span>
              <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={10} isMe={p.isMe} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>{p.nick}</div>
                {/* relative bar */}
                <div style={{ height: 3, background: C.border, borderRadius: 2, marginTop: 4, width: "85%" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: p.isMe ? C.accent : playerColor(group, p), width: `${(value / max) * 100}%` }} />
                </div>
              </div>
              <span style={{ fontSize: 17, fontWeight: 900, color: p.isMe ? C.accent : C.text1 }}>{value}</span>
            </div>
          );
        })}
      </div>

      {/* ── HISTORY ── */}
      <SectionLabel>HISTÓRICO DE JOGOS</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {HISTORY.map((g) => {
          const mvp = group.find(p => p.id === g.mvpId);
          return (
            <div key={g.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
              <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{g.result}</div>
                <div style={{ fontSize: 10, color: C.text2 }}>{g.date}</div>
              </div>
              <div style={{ width: 1, height: 30, background: C.border }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: C.text2 }}>{g.confirmed} jogadores</div>
                {mvp && <div style={{ fontSize: 12, marginTop: 1 }}>⭐ MVP: <span style={{ fontWeight: 700 }}>{mvp.nick}</span></div>}
              </div>
              <div style={{ fontSize: 11 }}>
                {g.allPaid ? <span style={{ color: C.green }}>Pago ✓</span> : <span style={{ color: C.orange }}>Pendente</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// GRUPO TAB
// ─────────────────────────────────────────────────────────
function GrupoTab({ group, openProfile }) {
  const sections = [
    { label: "CONFIRMADOS",  items: group.filter(p => p.status === "confirmed") },
    { label: "SEM RESPOSTA", items: group.filter(p => p.status === "pending")   },
    { label: "NÃO PODEM",    items: group.filter(p => p.status === "declined")  },
  ];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>O Grupo</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{group.length} jogadores · FC Amigos</div>
      </div>

      {sections.map(section => section.items.length > 0 && (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <SectionLabel style={{ color: C.text3, marginBottom: 10 }}>{section.label} ({section.items.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map(p => {
              const reliability = Math.round((p.gamesPlayed / TOTAL_GAMES) * 100);
              return (
                <button key={p.id} onClick={() => openProfile(p.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={40} fontSize={13} isMe={p.isMe} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>
                      {p.nick} {p.isMe && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}>(tu)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{p.position} · {p.gamesPlayed}/{TOTAL_GAMES} jogos</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 50 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: reliability >= 80 ? C.green : reliability >= 60 ? C.orange : C.red }}>{reliability}%</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>fiável</div>
                  </div>
                  <ChevronRight size={15} color={C.text3} />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ ...cardStyle, textAlign: "center", padding: "22px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Adicionar ao grupo</div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 14 }}>Convida um amigo pelo link ou WhatsApp</div>
        <button style={{ background: C.whatsapp, color: "#000", border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageCircle size={14} /> Convidar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PERFIL TAB — view + edit own profile / view others
// ─────────────────────────────────────────────────────────
function PerfilTab({ group, viewPlayerId, updateProfile, backToMe }) {
  const me = group.find(p => p.isMe);
  const player = group.find(p => p.id === viewPlayerId) ?? me;
  const isOwn = player.isMe;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(player);

  const winRate = Math.round((player.gamesPlayed / TOTAL_GAMES) * 100);

  const field = (label, key, type = "text") => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <input
        type={type}
        value={form[key] ?? ""}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }}
      />
    </div>
  );

  const chips = (label, key, options) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map(opt => {
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
          {field("Apelido (como aparece no jogo)", "nick")}
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
            { label: "Presença",     value: `${winRate}%`      },
            { label: "G+A / jogo",   value: player.gamesPlayed ? ((player.goals + player.assists) / player.gamesPlayed).toFixed(1) : "0" },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method (own profile only) */}
      {isOwn && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <SectionLabel>PAGAMENTO</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.blueDim, border: `1px solid rgba(72,149,255,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────
export default function PitchApp() {
  const [tab, setTab]               = useState("jogo");
  const [group, setGroup]           = useState(INITIAL_GROUP);
  const [material, setMaterial]     = useState(INITIAL_MATERIAL);
  const [teams, setTeams]           = useState(null);
  const [mvpVote, setMvpVote]       = useState({ open: true, votedFor: null });
  const [statMode, setStatMode]     = useState("goals");
  const [viewPlayerId, setViewPlayerId] = useState(null);

  const togglePaid = (id) =>
    setGroup(g => g.map(p => p.id === id ? { ...p, paid: !p.paid } : p));

  const payMine = () =>
    setGroup(g => g.map(p => p.isMe ? { ...p, paid: true } : p));

  const toggleMyStatus = (newStatus) => {
    setGroup(g => g.map(p => p.isMe ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false } : p));
    setTeams(null); // roster changed → invalidate draw
  };

  const toggleMaterial = (id) =>
    setMaterial(m => m.map(x => x.id === id ? { ...x, done: !x.done } : x));

  const updateProfile = (form) =>
    setGroup(g => g.map(p => p.isMe ? { ...p, ...form } : p));

  // Position-balanced team draw: sort by position, alternate assignment
  const drawTeams = () => {
    const confirmed = group.filter(p => p.status === "confirmed");
    const shuffled = [...confirmed].sort(() => Math.random() - 0.5);
    // group by position so each team gets a spread
    const byPos = POSITIONS.flatMap(pos => shuffled.filter(p => p.position === pos));
    const a = [], b = [];
    byPos.forEach((p, i) => (i % 2 === 0 ? a : b).push(p));
    setTeams({ a, b });
  };

  const openProfile = (id) => { setViewPlayerId(id); setTab("perfil"); };
  const backToMe = () => setViewPlayerId(null);

  const NAV = [
    { id: "jogo",   Icon: Zap,    label: "Jogo"   },
    { id: "stats",  Icon: Trophy, label: "Stats"  },
    { id: "grupo",  Icon: Users,  label: "Grupo"  },
    { id: "perfil", Icon: User,   label: "Perfil" },
  ];

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto",
      color: C.text1,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif",
    }}>
      <div style={{ paddingBottom: 80 }}>
        {tab === "jogo"   && <JogoTab group={group} togglePaid={togglePaid} toggleMyStatus={toggleMyStatus} material={material} toggleMaterial={toggleMaterial} teams={teams} drawTeams={drawTeams} payMine={payMine} />}
        {tab === "stats"  && <StatsTab group={group} mvpVote={mvpVote} setMvpVote={setMvpVote} statMode={statMode} setStatMode={setStatMode} />}
        {tab === "grupo"  && <GrupoTab group={group} openProfile={openProfile} />}
        {tab === "perfil" && <PerfilTab key={viewPlayerId ?? "me"} group={group} viewPlayerId={viewPlayerId} updateProfile={updateProfile} backToMe={backToMe} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "sticky", bottom: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: 14, paddingTop: 10 }}>
        {NAV.map(({ id, Icon, label }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => { setTab(id); if (id === "perfil") setViewPlayerId(null); }} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 0" }}>
              <Icon size={21} strokeWidth={active ? 2.5 : 1.5} color={active ? C.accent : C.text2} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.accent : C.text2 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
