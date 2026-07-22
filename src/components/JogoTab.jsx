import { useState } from "react";
import {
  Clock, MapPin, Check, X, MessageCircle,
  Shuffle, ClipboardList, CreditCard, Plus, Minus, Share2, Copy, ListOrdered, Lock, UserPlus, Pencil, RotateCcw, Undo2,
} from "lucide-react";
import { C, cardStyle, displayFont, fieldBackdrop } from "../theme";
import { ini, playerColor, fmtEUR, splitWaitlist, WEEKDAYS_PT } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, reminderMessage, groupReminderMessage, chargeMessage, waitlistNudgeMessage, groupInviteMessage, inviteMessage, magicConfirmUrl, lineupShareMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Collapsible from "./Collapsible";
import Matchday from "./Matchday";
import MatchTimer from "./MatchTimer";
import MatchSummary from "./MatchSummary";

export default function JogoTab({
  group, game, togglePaid, toggleMyStatus, payMine,
  material, toggleMaterial, assignMaterial, addMaterial,
  teams, drawTeams, onClearTeams, renameTeam, movePlayer, canManageTeams, matchdayProps, lastMatchday,
  inviteUrl, canManageGame, onSetSpots, onReschedule, confirmOpen = true, opensAtLabel, onSetPlayerStatus,
}) {
  const [newItem, setNewItem] = useState("");
  const [numTeams, setNumTeams] = useState(teams?.length || 2);
  const [copied, setCopied] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [draftDay, setDraftDay] = useState(game.weekday);
  const [draftTime, setDraftTime] = useState(game.time);

  const confirmed = group.filter((p) => p.status === "confirmed");
  const pending   = group.filter((p) => p.status === "pending");
  const declined  = group.filter((p) => p.status === "declined");
  const me        = group.find((p) => p.isMe);
  // Once the game is full, extra confirmations form an ordered waiting line.
  const { playing, waitlist } = splitWaitlist(confirmed, game.spots);
  const myWaitPos = me ? waitlist.findIndex((p) => p.id === me.id) + 1 : 0; // 1-based, 0 = not waiting
  const spotsLeft = game.spots - playing.length;
  const shareUrl  = inviteUrl || window.location.origin;
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const paidCount = playing.filter((p) => p.paid).length;
  const debtors   = playing.filter((p) => !p.paid);
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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.text2 }}>{t("PRÓXIMO JOGO")}</div>
              <div style={{ fontSize: 10, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>{t("RECORRENTE")}</div>
            </div>
            <div style={{ ...displayFont, fontSize: 24, marginBottom: 2 }}>{game.label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: C.text2, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {game.date} · {game.time}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {game.venue}</span>
              {canManageGame && onReschedule && (
                <button onClick={() => { setDraftDay(game.weekday); setDraftTime(game.time); setRescheduling(!rescheduling); }}
                  title={t("Alterar dia e hora do jogo")}
                  style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700 }}>
                  <Pencil size={12} /> {t("Alterar")}
                </button>
              )}
            </div>
          </div>
          <button onClick={copyShare} title={t("Copiar link do jogo")}
            style={{ flexShrink: 0, background: copied ? C.greenDim : C.accentDim, color: copied ? C.green : C.accent, border: `1px solid ${copied ? C.greenBorder : C.accentBorder}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {copied ? <><Check size={14} /> {t("Copiado")}</> : <><Share2 size={14} /> {t("Partilhar")}</>}
          </button>
        </div>
      </div>

      {/* RESCHEDULE — organizer moves the game to another day/time */}
      {rescheduling && canManageGame && (
        <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.accentBorder}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("Alterar dia e hora do jogo")}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {WEEKDAYS_PT.map((day, i) => {
              const active = draftDay === i;
              return (
                <button key={day} onClick={() => setDraftDay(i)}
                  style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                  {t(day.slice(0, 3))}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: C.text2 }}>{t("Hora:")}</span>
            <input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 14, color: C.text1, outline: "none", colorScheme: "dark" }} />
          </div>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
            {t("O próximo jogo passa para")} <b style={{ color: C.accent }}>{t(WEEKDAYS_PT[draftDay])?.toLowerCase()} {t("às")} {draftTime}</b>{game.recurring ? t(" — e as próximas semanas também.") : "."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <BtnPrimary onClick={() => { onReschedule(draftDay, draftTime); setRescheduling(false); }} style={{ flex: 1 }}>
              {t("Guardar")}
            </BtnPrimary>
            <button onClick={() => setRescheduling(false)}
              style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {t("Cancelar")}
            </button>
          </div>
        </div>
      )}

      {/* SLOT GRID — the pitch */}
      <div style={{
        ...cardStyle, marginBottom: 14, position: "relative", overflow: "hidden",
        ...fieldBackdrop(0.25, 0.55),
        border: `1px solid ${C.blueBorder}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, position: "relative" }}>
          <div>
            <span style={{ ...displayFont, fontSize: 34, color: playing.length >= game.spots ? C.green : C.text1 }}>{playing.length}</span>
            <span style={{ fontSize: 18, fontWeight: 500, color: C.text3 }}>/{game.spots}</span>
          </div>
          {spotsLeft > 0
            ? <div style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{spotsLeft} {spotsLeft === 1 ? t("vaga em aberto") : t("vagas em aberto")}</div>
            : (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}><Check size={14} /> {t("Equipa completa!")}</div>
                {waitlist.length > 0 && <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginTop: 2 }}>{waitlist.length} {t("na lista de espera")}</div>}
              </div>
            )
          }
        </div>

        {/* Spots control + share link — organizer only */}
        {canManageGame && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, position: "relative", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.text2 }}>{t("Nº de jogadores:")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => onSetSpots(game.spots - 1)} disabled={game.spots <= 2}
                style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, color: game.spots <= 2 ? C.text3 : C.text1, border: `1px solid ${C.border}`, cursor: game.spots <= 2 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: game.spots <= 2 ? 0.4 : 1 }}>
                <Minus size={14} />
              </button>
              <span style={{ ...displayFont, fontSize: 20, minWidth: 26, textAlign: "center" }}>{game.spots}</span>
              <button onClick={() => onSetSpots(game.spots + 1)} disabled={game.spots >= 22}
                style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, color: game.spots >= 22 ? C.text3 : C.text1, border: `1px solid ${C.border}`, cursor: game.spots >= 22 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: game.spots >= 22 ? 0.4 : 1 }}>
                <Plus size={14} />
              </button>
            </div>
            <button onClick={copyShare} title={t("Copiar link do jogo")}
              style={{ marginLeft: "auto", background: C.card, color: copied ? C.green : C.text2, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {copied ? <><Check size={13} /> {t("Copiado")}</> : <><Copy size={13} /> Link</>}
            </button>
          </div>
        )}

        {playing.length === 0 ? (
          <div style={{ textAlign: "center", padding: "18px 0 6px", fontSize: 13, color: C.text2, position: "relative" }}>
            {t("Ainda ninguém confirmou — sê o primeiro! ⚽")}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12, position: "relative" }}>
            {playing.map((player) => {
              const color = playerColor(group, player);
              return (
                <div key={player.id} style={{ textAlign: "center" }}>
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
                    {canManageTeams && !player.isMe && (
                      <button onClick={() => onSetPlayerStatus(player.id, "declined")} title={t("Remover do jogo")}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, background: C.red, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                        <X size={9} strokeWidth={3} color="#fff" />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: player.isMe ? C.accent : C.text2, marginTop: 5, fontWeight: player.isMe ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.nick}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Share the game sheet (confirmed list + venue/date/price) to the group chat */}
        {playing.length > 0 && (
          <button onClick={() => openWhatsApp(lineupShareMessage(game, playing, waitlist, price, shareUrl))}
            style={{ width: "100%", background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, position: "relative" }}>
            <MessageCircle size={15} /> {t("Partilhar lista no WhatsApp")}
          </button>
        )}
      </div>

      {/* INVITE CTA — prominent while the group is still small */}
      {canManageGame && group.length <= Math.max(6, Math.ceil(game.spots / 2)) && (
        <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.accentBorder}`, background: C.accentDim }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <UserPlus size={18} color={C.accent} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{t("Agora convida os jogadores 📣")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{t("Partilha o link — quem abrir entra logo no grupo.")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openWhatsApp(inviteUrl ? groupInviteMessage(game.groupName, shareUrl) : inviteMessage(game.groupName, game))}
              style={{ flex: 1, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MessageCircle size={14} /> {t("Convidar")}
            </button>
            <button onClick={copyShare}
              style={{ background: C.card, color: copied ? C.green : C.text1, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {copied ? <><Check size={14} /> {t("Copiado")}</> : <><Copy size={14} /> Link</>}
            </button>
          </div>
        </div>
      )}

      {/* MY STATUS + PAYMENT — gated by the recurring confirmation window */}
      {!confirmOpen ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Lock size={18} color={C.text2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t("Confirmações ainda fechadas")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{t("Abrem")} {opensAtLabel}. {t("Vais poder confirmar num toque.")}</div>
            </div>
          </div>
        </div>
      ) : me?.status === "confirmed" && myWaitPos > 0 ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...displayFont, fontSize: 18, color: C.accent }}>
              {myWaitPos}º
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{t("Estás na lista de espera")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{t("Entras automaticamente se alguém desistir. Sem pagar até entrares.")}</div>
            </div>
            <button onClick={() => toggleMyStatus("declined")} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, color: C.text2, cursor: "pointer" }}>{t("Sair")}</button>
          </div>
        </div>
      ) : me?.status === "confirmed" ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: me.paid ? 0 : 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenDim, border: `1px solid ${C.greenBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={20} color={C.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{t("Estás dentro!")}</div>
              <div style={{ fontSize: 12, color: C.text2 }}>{me.paid ? t("Pago ✓ — bom jogo!") : `${t("Falta pagar")} ${price}`}</div>
            </div>
            <button onClick={() => toggleMyStatus("declined")} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, color: C.text2, cursor: "pointer" }}>{t("Cancelar")}</button>
          </div>
          {!me.paid && (
            <BtnPrimary onClick={payMine} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <CreditCard size={16} /> {t("Pagar")} {price} · MB Way
            </BtnPrimary>
          )}
        </div>
      ) : me?.status === "declined" ? (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>{t("Disseste que não podes. Mudaste de ideias?")}</div>
          <BtnGhost onClick={() => toggleMyStatus("confirmed")} style={{ width: "100%" }}>{t("Afinal vou! Confirmar")}</BtnGhost>
        </div>
      ) : (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 12 }}>
            {spotsLeft > 0 ? t("Vais jogar?") : t("Jogo cheio — entra na lista de espera e entras se alguém desistir.")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <BtnPrimary onClick={() => toggleMyStatus("confirmed")} style={{ flex: 1, fontSize: 15 }}>{spotsLeft > 0 ? t("Estou dentro!") : t("Entrar na lista de espera")}</BtnPrimary>
            <button onClick={() => toggleMyStatus("declined")} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 13, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{t("Não posso")}</button>
          </div>
        </div>
      )}

      {/* WAITING LINE */}
      {waitlist.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.accentBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <ListOrdered size={15} color={C.accent} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Lista de espera")} ({waitlist.length})</div>
          </div>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>{t("Por ordem de confirmação. Entra automaticamente quem está em 1º se um titular desistir")}{canManageTeams ? t(" — avisa-os por WhatsApp para estarem a postos.") : "."}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {waitlist.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ ...displayFont, fontSize: 15, color: i === 0 ? C.accent : C.text3, width: 22, textAlign: "center" }}>{i + 1}º</div>
                <Avatar name={p.name} color={playerColor(group, p)} size={32} fontSize={11} isMe={p.isMe} photo={p.photo} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: p.isMe ? 800 : 500, color: p.isMe ? C.accent : C.text1 }}>{p.nick}{p.isMe && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}> {t("(tu)")}</span>}</span>
                {canManageTeams && !p.isMe ? (
                  <button onClick={() => openWhatsApp(waitlistNudgeMessage(p, game, i + 1, shareUrl), p.phone)}
                    title={`${t("Avisar")} ${p.nick}`}
                    style={{ background: i === 0 ? C.whatsapp : "none", color: i === 0 ? C.bg : C.whatsapp, border: `1px solid ${C.whatsapp}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <MessageCircle size={12} /> {t("Avisar")}
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: C.text3 }}>{p.position.slice(0, 3).toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TEAM DRAW */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Sorteio de Equipas")}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>
            {!canManageTeams ? t("Só o organizador (ou o auxiliar) pode sortear e renomear.") : playing.length < 2 ? t("Faltam confirmações para sortear") : t("Escolhe quantas equipas e sorteia — depois podes renomear.")}
          </div>
        </div>

        {/* number of teams — organizer/assistant only */}
        {canManageTeams && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.text2 }}>{t("Equipas:")}</span>
            {[2, 3, 4, 5, 6].map((n) => {
              const active = numTeams === n;
              const disabled = n > playing.length;
              return (
                <button key={n} onClick={() => !disabled && setNumTeams(n)} disabled={disabled}
                  style={{ width: 32, height: 32, borderRadius: 9, background: active ? C.accent : C.surface, color: active ? C.bg : disabled ? C.text3 : C.text1, border: `1px solid ${active ? C.accent : C.border}`, fontSize: 13, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }}>
                  {n}
                </button>
              );
            })}
            <button
              onClick={() => drawTeams(numTeams)}
              disabled={playing.length < 2}
              style={{
                marginLeft: "auto", background: playing.length >= 2 ? C.accent : C.accentDim,
                color: playing.length >= 2 ? C.bg : C.accent, border: `1px solid ${C.accentBorder}`,
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800,
                cursor: playing.length >= 2 ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Shuffle size={14} /> {teams ? t("Re-sortear") : t("Sortear")}
            </button>
          </div>
        )}

        {canManageTeams && teams && (
          <button onClick={onClearTeams}
            style={{ width: "100%", marginBottom: 12, background: "none", color: C.text2, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RotateCcw size={13} /> {t("Limpar sorteio")}
          </button>
        )}

        {teams && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {teams.map((tm) => (
              <div key={tm.id} style={{ background: C.surface, borderRadius: 12, padding: 12, minWidth: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: tm.color, flexShrink: 0 }} />
                  {canManageTeams ? (
                    <input
                      value={tm.name}
                      onChange={(e) => renameTeam(tm.id, e.target.value)}
                      style={{ flex: 1, minWidth: 0, background: "none", border: "none", borderBottom: `1px dashed ${C.border}`, color: tm.color, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", outline: "none", padding: "2px 0" }}
                    />
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, color: tm.color, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {resolveTeam(tm.players).map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: tm.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: p.isMe ? 800 : 500, color: p.isMe ? C.accent : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
                      {canManageTeams && teams.length > 1 ? (
                        <select
                          value={tm.id}
                          onChange={(e) => movePlayer(p.id, e.target.value)}
                          title="Mover de equipa"
                          style={{ marginLeft: "auto", background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 9, padding: "1px 2px", outline: "none", maxWidth: 70 }}
                        >
                          {teams.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 9, color: C.text3, marginLeft: "auto" }}>{p.position.slice(0, 3).toUpperCase()}</span>
                      )}
                    </div>
                  ))}
                  {tm.players.length === 0 && <span style={{ fontSize: 11, color: C.text3 }}>{t("sem jogadores")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MATCH TIMER */}
      <MatchTimer />

      {/* LIVE MATCHDAY */}
      <Matchday {...matchdayProps} group={group} teams={teams} />

      {/* MATCHDAY SUMMARY (current/last games) */}
      <MatchSummary matchday={matchdayProps.matchday} lastMatchday={lastMatchday} teams={teams} group={group} />

      {/* PENDING */}
      {pending.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Sem resposta")}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{pending.length} {pending.length === 1 ? t("jogador ainda não respondeu") : t("jogadores ainda não responderam")}</div>
            </div>
            <button onClick={() => openWhatsApp(groupReminderMessage(pending, game))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <MessageCircle size={13} /> {t("Lembrar todos")}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={p.name} color={playerColor(group, p)} size={32} fontSize={11} photo={p.photo} />
                <span style={{ flex: 1, fontSize: 13, color: C.text2 }}>{p.nick}</span>
                {canManageTeams && (
                  <button onClick={() => onSetPlayerStatus(p.id, "confirmed")} style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}55`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.green, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} /> {t("Confirmar")}
                  </button>
                )}
                <button onClick={() => openWhatsApp(reminderMessage(p, game, p.magicToken ? magicConfirmUrl(p.magicToken) : undefined), p.phone)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, cursor: "pointer" }}>{t("Lembrar")}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DECLINED */}
      {declined.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel style={{ marginBottom: 8 }}>{t("NÃO PODEM")} ({declined.length})</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {declined.map((p) => (
              <div key={p.id} onClick={canManageTeams ? () => onSetPlayerStatus(p.id, "confirmed") : undefined}
                title={canManageTeams ? t("Confirmar") : undefined}
                style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 10px", cursor: canManageTeams ? "pointer" : "default" }}>
                <X size={12} color={C.red} />
                <span style={{ fontSize: 12, color: C.text2 }}>{p.nick}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATERIAL CHECKLIST */}
      <Collapsible icon={<ClipboardList size={15} color={C.text2} />} title={t("Material do Jogo")} badge={`${material.filter((m) => m.done).length}/${material.length}`}>
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
                <option value="">{t("atribuir…")}</option>
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
            placeholder={t("Adicionar item…")}
            style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, color: C.text1, outline: "none" }}
          />
          <button onClick={submitNewItem} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Plus size={16} />
          </button>
        </div>
      </Collapsible>

      {/* PAYMENTS OVERVIEW */}
      <Collapsible
        icon={<CreditCard size={15} color={C.text2} />}
        title={t("Pagamentos")}
        subtitle={`${price}${t("/jogador")} · ${fmtEUR(game.monthlyPrice)} ${t("total")}`}
        badge={`${fmtEUR(paidCount * game.priceEach)} / ${fmtEUR(playing.length * game.priceEach)}`}
      >
        <div style={{ height: 4, background: C.border, borderRadius: 2, marginBottom: 14 }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.green, width: `${playing.length ? (paidCount / playing.length) * 100 : 0}%`, transition: "width 0.3s" }} />
        </div>

        {debtors.length > 0 ? (
          <>
            <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>{t("DEVEM PAGAR")}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {debtors.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={11} isMe={p.isMe} photo={p.photo} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nick}</span>
                  <span style={{ fontSize: 13, color: C.orange, fontWeight: 700 }}>{price}</span>
                  <button onClick={() => togglePaid(p.id)} style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.accent, fontWeight: 700, cursor: "pointer" }}>{t("Pago ✓")}</button>
                </div>
              ))}
            </div>
            <button onClick={() => openWhatsApp(chargeMessage(debtors, price, game, me?.phone))} style={{ width: "100%", background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MessageCircle size={15} /> {t("Cobrar pelo WhatsApp")}
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 13, color: C.green, fontWeight: 700 }}>
            <Check size={14} style={{ display: "inline", marginRight: 6 }} /> {t("Todos pagaram!")}
          </div>
        )}

        {/* Organizer-only: undo a payment marked by mistake */}
        {canManageGame && paidCount > 0 && (
          <div style={{ marginTop: debtors.length > 0 ? 16 : 12 }}>
            <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>{t("JÁ PAGARAM")}</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {playing.filter((p) => p.paid).map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={30} fontSize={11} isMe={p.isMe} photo={p.photo} />
                  <span style={{ flex: 1, fontSize: 13 }}>{p.nick}</span>
                  <button onClick={() => togglePaid(p.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Undo2 size={12} /> {t("Desfazer")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Collapsible>

    </div>
  );
}
