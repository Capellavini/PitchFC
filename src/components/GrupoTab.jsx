import { useState } from "react";
import { MessageCircle, ChevronRight, Copy, Check, ShieldCheck } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { TOTAL_GAMES } from "../data";
import { playerColor, computeOverall } from "../lib/helpers";
import { openWhatsApp, inviteMessage, groupInviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

const tierColor = (overall) => overall >= 80 ? C.gold : overall >= 70 ? C.silver : C.bronze;

export default function GrupoTab({ group, game, openProfile, cloudMode, inviteUrl, isOrganizer, onToggleAssistant }) {
  const [copied, setCopied] = useState(false);
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
        <div style={{ ...displayFont, fontSize: 22 }}>O Grupo</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{group.length} jogadores · {game.groupName}</div>
      </div>

      {sections.map((section) => section.items.length > 0 && (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <SectionLabel style={{ color: C.text3, marginBottom: 10 }}>{section.label} ({section.items.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map((p) => {
              const reliability = Math.round((p.gamesPlayed / TOTAL_GAMES) * 100);
              const overall = computeOverall(p.position, p.attrs);
              return (
                <button key={p.id} onClick={() => openProfile(p.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={40} fontSize={13} isMe={p.isMe} photo={p.photo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>
                      {p.nick} {p.isMe && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}>(tu)</span>}
                      {p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.blue, fontWeight: 700, marginLeft: 6 }}>ORG</span>}
                      {p.isAssistant && !p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.green, fontWeight: 700, marginLeft: 6 }}>AUXILIAR</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{p.position} · {p.gamesPlayed}/{TOTAL_GAMES} jogos</div>
                  </div>
                  {cloudMode && isOrganizer && !p.isMe && !p.isOrganizerPlayer && (
                    <span
                      role="button"
                      title={p.isAssistant ? "Remover auxiliar" : "Tornar auxiliar"}
                      onClick={(e) => { e.stopPropagation(); onToggleAssistant(p.uuid, !p.isAssistant); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: p.isAssistant ? C.greenDim : C.surface, border: `1px solid ${p.isAssistant ? C.greenBorder : C.border}`, cursor: "pointer", flexShrink: 0 }}
                    >
                      <ShieldCheck size={14} color={p.isAssistant ? C.green : C.text3} />
                    </span>
                  )}
                  <div style={{ ...displayFont, fontSize: 15, color: tierColor(overall), minWidth: 26, textAlign: "center" }}>
                    {overall}
                    <div style={{ fontSize: 8, fontWeight: 700, fontStyle: "normal", letterSpacing: "0.05em", color: C.text3 }}>OVR</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 44 }}>
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
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 14 }}>
          {inviteUrl ? "Partilha o link de convite — quem abrir cria conta e entra logo no grupo." : "Convida um amigo pelo link ou WhatsApp"}
        </div>
        {inviteUrl ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => openWhatsApp(groupInviteMessage(game.groupName, inviteUrl))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <MessageCircle size={14} /> Convidar
            </button>
            <button onClick={copyInvite} style={{ background: C.card, color: copied ? C.green : C.text1, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Link</>}
            </button>
          </div>
        ) : (
          <button onClick={() => openWhatsApp(inviteMessage(game.groupName, game))} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MessageCircle size={14} /> Convidar
          </button>
        )}
      </div>
    </div>
  );
}
