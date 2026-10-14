import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";

const ITEMS = [
  ["group", "É preciso ter um grupo no PITCH?", "Não. Podes criar a tua equipa ou entrar por convite, com a mesma conta de jogador."],
  ["field", "O PITCH reserva o campo ou recebe o pagamento?", "Não. Os capitães combinam o local, o custo e quem trata da reserva. O desafio reúne esses detalhes."],
  ["invite", "Posso desafiar uma equipa que ainda não usa o PITCH?", "Podes enviar um convite por link. O capitão rival vê a proposta e precisa de uma conta e de uma equipa para responder. Os desafios estão a abrir por fases."],
  ["dispute", "E se não concordarmos com o resultado?", "Na confirmação de resultados, que está em desenvolvimento, o placar só entra no histórico quando os dois capitães concordam. Uma contestação exige uma nova proposta e confirmação."],
  ["free", "O PITCH Rivals é grátis?", "Sim. Criar a equipa e convidar o plantel é grátis. O desafio e o histórico básico também fazem parte da versão gratuita."],
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
