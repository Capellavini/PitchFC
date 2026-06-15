import { User, Megaphone, ChevronRight, ShieldCheck } from "lucide-react";
import { C, cardStyle, BRAND, fieldBackdrop } from "../theme";

/** Entry screen — choose role. No backend yet, so "login" is a local
 *  role pick; magic-link auth replaces this when Supabase lands. */
export default function AuthLanding({ onPick, onBack, isAdmin, onOpenAdmin }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "32px 20px", ...fieldBackdrop(0.45, 0.92),
    }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ width: "78%", maxWidth: 300 }} />
        <div style={{ fontSize: 14, color: C.text2, marginTop: 4 }}>
          O teu jogo semanal, organizado. ⚽
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

      {isAdmin && (
        <button onClick={onOpenAdmin} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "11px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", marginTop: 16, display: "flex", alignItems: "center", gap: 7, justifyContent: "center" }}>
          <ShieldCheck size={15} /> Painel de administrador
        </button>
      )}

      <div style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: C.text3 }}>
        Versão de demonstração — os dados ficam só neste dispositivo
      </div>

      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, fontSize: 13, cursor: "pointer", marginTop: 18, textDecoration: "underline" }}>
          ← Voltar à página inicial
        </button>
      )}
    </div>
  );
}
