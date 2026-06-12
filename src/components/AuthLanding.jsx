import { User, Megaphone, ChevronRight } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";

/** Entry screen — choose role. No backend yet, so "login" is a local
 *  role pick; magic-link auth replaces this when Supabase lands. */
export default function AuthLanding({ onPick }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 20px", position: "relative", overflow: "hidden" }}>
      {/* pitch lines backdrop */}
      <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}>
        <rect x="30" y="60" width="340" height="680" rx="8" fill="none" stroke={C.grassLine} strokeWidth="2" />
        <line x1="30" y1="400" x2="370" y2="400" stroke={C.grassLine} strokeWidth="2" />
        <circle cx="200" cy="400" r="70" fill="none" stroke={C.grassLine} strokeWidth="2" />
        <rect x="110" y="60" width="180" height="90" fill="none" stroke={C.grassLine} strokeWidth="2" />
        <rect x="110" y="650" width="180" height="90" fill="none" stroke={C.grassLine} strokeWidth="2" />
      </svg>

      <div style={{ position: "relative", textAlign: "center", marginBottom: 44 }}>
        <div style={{ ...displayFont, fontSize: 52, color: C.text1, lineHeight: 1 }}>
          PITCH<span style={{ color: C.accent }}>.</span>
        </div>
        <div style={{ fontSize: 14, color: C.text2, marginTop: 8 }}>
          O teu jogo semanal, organizado. ⚽
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
        <button onClick={() => onPick("player")} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, padding: 18, cursor: "pointer", textAlign: "left", width: "100%", color: C.text1, borderColor: C.accentBorder }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={22} color={C.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Sou Jogador</div>
            <div style={{ fontSize: 12, color: C.text2 }}>Cria o teu cartão FUT e entra no jogo</div>
          </div>
          <ChevronRight size={18} color={C.text3} />
        </button>

        <button onClick={() => onPick("organizer")} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, padding: 18, cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: C.blueDim, border: `1px solid ${C.blueBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Megaphone size={22} color={C.blue} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Sou Organizador</div>
            <div style={{ fontSize: 12, color: C.text2 }}>Define o campo, o horário e convida a malta</div>
          </div>
          <ChevronRight size={18} color={C.text3} />
        </button>
      </div>

      <div style={{ position: "relative", textAlign: "center", marginTop: 28, fontSize: 11, color: C.text3 }}>
        Versão de demonstração — os dados ficam só neste dispositivo
      </div>
    </div>
  );
}
