import { useState } from "react";
import {
  Clock, MapPin, Check, X, MessageCircle,
  Shuffle, ClipboardList, CreditCard, Plus,
} from "lucide-react";
import { C, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { ini, playerColor, fmtEUR } from "../lib/helpers";
import { openWhatsApp, reminderMessage, groupReminderMessage, chargeMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Matchday from "./Matchday";

export default function JogoTab({
  group, game, togglePaid, toggleMyStatus, payMine,
  material, toggleMaterial, assignMaterial, addMaterial,
  teams, drawTeams, matchdayProps,
}) {
  const [newItem, setNewItem] = useState("");

  const confirmed = group.filter((p) => p.status === "confirmed");
  const pending   = group.filter((p) => p.status === "pending");
  const declined  = group.filter((p) => p.status === "declined");
  const me        = group.find((p) => p.isMe);
  const spotsLeft = game.spots - confirmed.length;
  const paidCount = confirmed.filter((p) => p.paid).length;
  const debtors   = confirmed.filter((p) => !p.paid);
  const slots     = Array.from({ length: game.spots }, (_, i) => confirmed[i] ?? null);
  const price     = fmtEUR(game.priceEach);

  const resolveTeam = (ids) => ids.map((id) => group.find((p) => p.id === id)).filter(Boolean);

  const submitNewItem = () => {
    const item = newItem.trim();
    if (!item) return;
    addMaterial(item);
    setNewItem("");
  };

  return (
    <div style={{ padding: "0 16px" }}>

      {/* Header */}
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.text2 }}>PRÓXIMO JOGO</div>
          <div style={{ fontSize: 10, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>RECORRENTE</div>
        </div>
        <div style={{ ...displayFont, fontSize: 24, marginBottom: 2 }}>{game.label}</div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.text2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {game.date} · {game.time}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {game.venue}</span>
        </div>
      </div>

      {/* SLOT GRID — the pitch */}
      <div style={{
        ...cardStyle, marginBottom: 14, position: "relative", overflow: "hidden",
        ...fieldBackdrop(0.25, 0.55),
        border: `1px solid ${C.blueBorder}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, position: "relative" }}>
          <div>
            <span style={{ ...displayFont, fontSize: 34, color: confirmed.length >= game.spots ? C.green : C.text1 }}>{confirmed.length}</span>
            <span style={{ fontSize: 18, fontWeight: 500, color: C.text3 }}>/{game.spots}</span>
          </div>
          {spotsLeft > 0
            ? <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{spotsLeft} {spotsLeft === 1 ? "vaga em aberto" : "vagas em aberto"}</div>
            : <div style={{ fontSize: 13, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Check size={14} /> Equipa completa!</div>
          }
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 4, position: "relative" }}>
          {slots.map((player, i) => {
            const color = player ? playerColor(group, player) : null;
            return player ? (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  width: "100%", aspectRatio: "1", borderRadius: 14,
                  background: player.photo ? C.surface : player.isMe ? C.accentDim : `${color}18`,
                  border: `2px solid ${player.isMe ? C.accent : color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: player.isMe ? C.accent : color,
                  position: "relative", overflow: "visible",
                }}>
                  {player.photo
                    ? <img src={player.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                    : ini(player.name)}
                  {player.paid && (
                    <div style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
                      <Check size={7} strokeWidth={3} color={C.bg} />
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: player.isMe ? C.accent : C.text2, marginTop: 5, fontWeight: player.isMe ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.nick}</div>
              </div>
            ) : (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 14, border: `2px dashed ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.text3 }}>+</div>
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
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenDim, border: `1px solid ${C.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={20} color={C.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>Estás dentro!</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{me.paid ? "Pago ✓ — bom jogo!" : `Falta pagar ${price}`}</div>
            </div>
            <button onClick={() => toggleMyStatus("declined")} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, color: C.text2, cursor: "pointer" }}>Cancelar</button>
          </div>
          {!me.paid && (
            <BtnPrimary onClick={payMine} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <CreditCard size={16} /> Pagar {price} · MB Way
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
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>Vais jogar?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <BtnPrimary onClick={() => toggleMyStatus("confirmed")} style={{ flex: 1, fontSize: 15 }}>Estou dentro!</BtnPrimary>
            <button onClick={() => toggleMyStatus("declined")} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Não posso</button>
          </div>
        </div>
      )}

      {/* TEAM DRAW */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: teams ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sorteio de Equipas</div>
            <div style={{ fontSize: 11, color: C.text2 }}>
              {confirmed.length >= game.spots ? "Equipa completa — pronto a sortear" : `Faltam ${spotsLeft} para sortear`}
            </div>
          </div>
          <button
            onClick={drawTeams}
            disabled={confirmed.length < 2}
            style={{
              background: confirmed.length >= game.spots ? C.accent : C.accentDim,
              color: confirmed.length >= game.spots ? C.bg : C.accent,
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
            {[{ label: "COLETES", players: resolveTeam(teams.a), color: C.accent }, { label: "SEM COLETES", players: resolveTeam(teams.b), color: C.blue }].map((t) => (
              <div key={t.label} style={{ background: C.surface, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: t.color, marginBottom: 10 }}>{t.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {t.players.map((p) => (
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

      {/* LIVE MATCHDAY */}
      <Matchday {...matchdayProps} group={group} teams={teams} />

      {/* PENDING */}
      {pending.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Sem resposta</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{pending.length} {pending.length === 1 ? "jogador ainda não respondeu" : "jogadores ainda não responderam"}</div>
            </div>
            <button onClick={() => openWhatsApp(groupReminderMessage(pending, game))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <MessageCircle size={13} /> Lembrar todos
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={p.name} color={playerColor(group, p)} size={32} fontSize={11} photo={p.photo} />
                <span style={{ flex: 1, fontSize: 13, color: C.text2 }}>{p.nick}</span>
                <button onClick={() => openWhatsApp(reminderMessage(p, game), p.phone)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, cursor: "pointer" }}>Lembrar</button>
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
            {declined.map((p) => (
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
            <div style={{ fontSize: 11, color: C.text2 }}>{price}/jogador por mês · {fmtEUR(game.monthlyPrice)} total</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...displayFont, fontSize: 19, color: C.green }}>{fmtEUR(paidCount * game.priceEach)}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>de {fmtEUR(confirmed.length * game.priceEach)} recebidos</div>
          </div>
        </div>

        <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 14 }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.green, width: `${confirmed.length ? (paidCount / confirmed.length) * 100 : 0}%`, transition: "width 0.3s" }} />
        </div>

        {debtors.length > 0 ? (
          <>
            <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>DEVEM PAGAR</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {debtors.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={11} isMe={p.isMe} photo={p.photo} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nick}</span>
                  <span style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{price}</span>
                  <button onClick={() => togglePaid(p.id)} style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.accent, fontWeight: 700, cursor: "pointer" }}>Pago ✓</button>
                </div>
              ))}
            </div>
            <button onClick={() => openWhatsApp(chargeMessage(debtors, price, game, me?.phone))} style={{ width: "100%", background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
          {material.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => toggleMaterial(m.id)} style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                background: m.done ? C.green : "transparent",
                border: `1.5px solid ${m.done ? C.green : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                {m.done && <Check size={13} strokeWidth={3} color={C.bg} />}
              </button>
              <span style={{ flex: 1, fontSize: 13, textDecoration: m.done ? "line-through" : "none", color: m.done ? C.text3 : C.text1 }}>{m.item}</span>
              <select
                value={m.assignedTo ?? ""}
                onChange={(e) => assignMaterial(m.id, e.target.value ? Number(e.target.value) : null)}
                style={{
                  background: C.surface, borderRadius: 8, padding: "4px 8px", fontSize: 11,
                  border: m.assignedTo ? `1px solid ${C.border}` : `1px dashed ${C.border}`,
                  color: m.assignedTo ? C.text2 : C.text3, cursor: "pointer", outline: "none",
                }}
              >
                <option value="">atribuir…</option>
                {group.map((p) => (
                  <option key={p.id} value={p.id}>{p.nick}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNewItem()}
            placeholder="Adicionar item…"
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.text1, outline: "none" }}
          />
          <button onClick={submitNewItem} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
