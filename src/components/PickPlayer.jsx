import { ChevronLeft } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import Avatar from "./Avatar";

/** Cloud mode entry: the roster lives in Supabase, so instead of
 *  creating a profile you claim yours. Magic links (?p=token) skip
 *  this screen entirely. */
export default function PickPlayer({ players, groupName, onPick, onBack }) {
  return (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 4px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", padding: 4, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ ...displayFont, fontSize: 22 }}>Quem és tu?</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16, paddingLeft: 34 }}>
        Escolhe o teu jogador no {groupName}. (Dica: o organizador pode enviar-te um link pessoal que salta este passo.)
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {players.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
            <Avatar name={p.name} color={playerColor(players, p)} size={40} fontSize={13} photo={p.photo} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nick}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{p.name} · {p.position}</div>
            </div>
            <div style={{ ...displayFont, fontSize: 16, color: C.gold }}>{computeOverall(p.position, p.attrs)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
