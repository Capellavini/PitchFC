import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";

const ITEMS = [
  ["free", "O PITCH Rivals é grátis?",
    "Sim. Criar a equipa, desafiar rivais e guardar o histórico de resultados não custa nada."],
  ["field", "Preciso de reservar campo?",
    "O PITCH não reserva campo nem cobra nada. Vocês combinam onde jogar e quem trata do campo — e o desafio mostra sempre quem confirma o campo e se já está confirmado. Aceitar um desafio não marca o campo."],
  ["dispute", "E se não concordarmos no resultado?",
    "Um capitão regista o resultado e o outro confirma ou contesta. Se houver contestação, propõe-se a correção e só conta quando os dois lados confirmam. Nada fica confirmado por silêncio."],
  ["accounts", "Os meus jogadores precisam de conta?",
    "Para entrar no plantel, sim: recebem um convite e entram com uma conta PITCH (grátis, demora um minuto). Para desafiar, responder e confirmar resultados basta o capitão ou o vice."],
  ["same", "Já uso o PITCH para o jogo da semana — é o mesmo?",
    "É a mesma app e o mesmo perfil de jogador. O vosso grupo da semana fica exatamente igual — a equipa é uma coisa à parte, com identidade própria, para jogar contra outras equipas."],
  ["when", "Quando abre?",
    "Estamos a abrir por fases, com um grupo pequeno de equipas. Inscreve a tua e falamos contigo no WhatsApp para marcar o primeiro desafio."],
];

/** Accordion FAQ for the PITCH Rivals landing (/rivals). */
export default function RivalsFaq() {
  const [openId, setOpenId] = useState(null);
  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      {ITEMS.map(([id, q, a], i) => {
        const open = openId === id;
        return (
          <div key={id} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <h3 style={{ margin: 0 }}>
              <button type="button" aria-expanded={open} aria-controls={`rv-faq-${id}`} onClick={() => setOpenId(open ? null : id)}
                style={{ width: "100%", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, background: "none", border: "none", color: C.text1, padding: `${S.md}px ${S.lg}px`, fontSize: 15, fontWeight: 700, textAlign: "left", cursor: "pointer", lineHeight: 1.35, fontFamily: "inherit" }}>
                <span>{q}</span>
                <ChevronDown size={18} color={C.text2} aria-hidden style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
            </h3>
            {open && <div id={`rv-faq-${id}`} style={{ padding: `0 ${S.lg}px ${S.lg}px`, fontSize: T.body + 1, color: C.text2, lineHeight: 1.6 }}>{a}</div>}
          </div>
        );
      })}
    </div>
  );
}
