import { MessageCircle, ChevronRight } from "lucide-react";
import { C, cardStyle } from "../theme";
import { GROUP_NAME, TOTAL_GAMES } from "../data";
import { playerColor } from "../lib/helpers";
import { openWhatsApp, inviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

export default function GrupoTab({ group, openProfile }) {
  const sections = [
    { label: "CONFIRMADOS",  items: group.filter((p) => p.status === "confirmed") },
    { label: "SEM RESPOSTA", items: group.filter((p) => p.status === "pending")   },
    { label: "NÃO PODEM",    items: group.filter((p) => p.status === "declined")  },
  ];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>O Grupo</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{group.length} jogadores · {GROUP_NAME}</div>
      </div>

      {sections.map((section) => section.items.length > 0 && (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <SectionLabel style={{ color: C.text3, marginBottom: 10 }}>{section.label} ({section.items.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map((p) => {
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
        <button onClick={() => openWhatsApp(inviteMessage())} style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageCircle size={14} /> Convidar
        </button>
      </div>
    </div>
  );
}
