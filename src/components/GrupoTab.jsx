import { useState } from "react";
import { MessageCircle, ChevronRight, Copy, Check, ShieldCheck, UserPlus, X, UserCheck, UserX, Trash2 } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { TOTAL_GAMES, POSITIONS } from "../data";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, inviteMessage, groupInviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const tierColor = (overall) => overall >= 80 ? C.gold : overall >= 70 ? C.silver : C.bronze;
const EMPTY_GUEST = { name: "", position: "Médio", overall: "" };

export default function GrupoTab({ group, game, openProfile, cloudMode, inviteUrl, isOrganizer, onToggleAssistant, onAddManualPlayer, onSetPlayerStatus, onRemoveGuestPlayer, canManageTeams }) {
  const [copied, setCopied] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const submitGuest = () => {
    if (!guest.name.trim()) return;
    onAddManualPlayer({ name: guest.name, position: guest.position, overall: guest.overall ? Number(guest.overall) : null });
    setGuest(EMPTY_GUEST);
    setGuestOpen(false);
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const sections = [
    { label: "CONFIRMADOS",  items: group.filter((p) => p.status === "confirmed") },
    { label: "SEM RESPOSTA", items: group.filter((p) => p.status === "pending")   },
    { label: "NÃO PODEM",    items: group.filter((p) => p.status === "declined")  },
  ];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>{t("O Grupo")}</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{group.length} {t("jogadores")} · {game.groupName}</div>
      </div>

      {sections.map((section) => section.items.length > 0 && (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <SectionLabel style={{ color: C.text3, marginBottom: 10 }}>{t(section.label)} ({section.items.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map((p) => {
              const locked = p.ratingsCount != null && p.ratingsCount < 3;
              const overall = locked ? 0 : computeOverall(p.position, p.attrs);
              return (
                <button key={p.id} onClick={() => openProfile(p.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={40} fontSize={13} isMe={p.isMe} photo={p.photo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>
                      {p.nick} {p.isMe && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}>{t("(tu)")}</span>}
                      {p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.blue, fontWeight: 700, marginLeft: 6 }}>ORG</span>}
                      {p.isAssistant && !p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.green, fontWeight: 700, marginLeft: 6 }}>{t("AUXILIAR")}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{t(p.position)} · {p.gamesPlayed}/{TOTAL_GAMES} {t("jogos")}</div>
                  </div>
                  {canManageTeams && !p.isMe && (
                    <>
                      <span
                        role="button"
                        title={p.status === "confirmed" ? t("Remover do jogo") : t("Confirmar")}
                        onClick={(e) => { e.stopPropagation(); onSetPlayerStatus(p.id, p.status === "confirmed" ? "declined" : "confirmed"); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: p.status === "confirmed" ? C.orangeDim : C.greenDim, border: `1px solid ${p.status === "confirmed" ? C.orange : C.greenBorder}55`, cursor: "pointer", flexShrink: 0 }}
                      >
                        {p.status === "confirmed" ? <UserX size={14} color={C.orange} /> : <UserCheck size={14} color={C.green} />}
                      </span>
                      {p.isGuest && (
                        <span
                          role="button"
                          title={t("Apagar jogador")}
                          onClick={(e) => { e.stopPropagation(); onRemoveGuestPlayer(p.id, p.nick); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: C.redDim, border: `1px solid ${C.red}44`, cursor: "pointer", flexShrink: 0 }}
                        >
                          <Trash2 size={14} color={C.red} />
                        </span>
                      )}
                    </>
                  )}
                  {cloudMode && isOrganizer && !p.isMe && !p.isOrganizerPlayer && !p.isGuest && (
                    <span
                      role="button"
                      title={p.isAssistant ? t("Remover auxiliar") : t("Tornar auxiliar")}
                      onClick={(e) => { e.stopPropagation(); onToggleAssistant(p.uuid, !p.isAssistant); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: p.isAssistant ? C.greenDim : C.surface, border: `1px solid ${p.isAssistant ? C.greenBorder : C.border}`, cursor: "pointer", flexShrink: 0 }}
                    >
                      <ShieldCheck size={14} color={p.isAssistant ? C.green : C.text3} />
                    </span>
                  )}
                  <div style={{ ...displayFont, fontSize: 15, color: locked ? C.text3 : tierColor(overall), minWidth: 26, textAlign: "center" }}>
                    {locked ? "?" : overall}
                    <div style={{ fontSize: 8, fontWeight: 700, fontStyle: "normal", letterSpacing: "0.05em", color: C.text3 }}>OVR</div>
                  </div>
                  <ChevronRight size={15} color={C.text3} />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* manual / guest player (organizer or assistant) */}
      {canManageTeams && (
        guestOpen ? (
          <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.accentBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{t("Jogador avulso")}</span>
              <button onClick={() => { setGuestOpen(false); setGuest(EMPTY_GUEST); }} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <input value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} placeholder={t("Nome do jogador")}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{t("Posição")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {POSITIONS.map((pos) => {
                const active = guest.position === pos;
                return (
                  <button key={pos} onClick={() => setGuest((g) => ({ ...g, position: pos }))} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                    {t(pos)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>Overall <span style={{ color: C.text3 }}>{t("(opcional)")}</span></div>
            <input type="number" min="40" max="99" value={guest.overall} onChange={(e) => setGuest((g) => ({ ...g, overall: e.target.value }))} placeholder={t("ex.: 75")}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", marginBottom: 14 }} />
            <BtnPrimary onClick={submitGuest} style={{ width: "100%" }}>{t("Adicionar jogador")}</BtnPrimary>
          </div>
        ) : (
          <button onClick={() => setGuestOpen(true)} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14, cursor: "pointer", color: C.accent, border: `1px dashed ${C.accentBorder}`, background: C.accentDim, fontWeight: 800, fontSize: 13 }}>
            <UserPlus size={16} /> {t("Adicionar jogador avulso (sem conta)")}
          </button>
        )
      )}

      <div style={{ ...cardStyle, textAlign: "center", padding: "22px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t("Adicionar ao grupo")}</div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 14 }}>
          {inviteUrl ? t("Partilha o link de convite — quem abrir cria conta e entra logo no grupo.") : t("Convida um amigo pelo link ou WhatsApp")}
        </div>
        {inviteUrl ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => openWhatsApp(groupInviteMessage(game.groupName, inviteUrl))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <MessageCircle size={14} /> {t("Convidar")}
            </button>
            <button onClick={copyInvite} style={{ background: C.card, color: copied ? C.green : C.text1, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {copied ? <><Check size={14} /> {t("Copiado")}</> : <><Copy size={14} /> Link</>}
            </button>
          </div>
        ) : (
          <button onClick={() => openWhatsApp(inviteMessage(game.groupName, game))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MessageCircle size={14} /> {t("Convidar")}
          </button>
        )}
      </div>
    </div>
  );
}
