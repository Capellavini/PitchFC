import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { C, cardStyle, displayFont, BRAND } from "../theme";
import { ATTR_LABELS, decodePayload, encodePayload } from "../lib/helpers";
import { openWhatsApp, rateResultMessage } from "../lib/whatsapp";
import FutCard from "./FutCard";
import BtnPrimary from "./BtnPrimary";

const ATTR_NAMES = { rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };

/** Standalone page opened from a "rate me" link (?rate=payload).
 *  No login needed — the friend rates and sends back a code.
 *  Becomes a real magic-link write when Supabase lands. */
export default function RatePlayer({ payload }) {
  const player = decodePayload(payload);
  const [attrs, setAttrs] = useState({ rit: 70, rem: 70, pas: 70, dri: 70, def: 70, fis: 70 });
  const [raterName, setRaterName] = useState("");
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!player?.nick) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 8 }}>Link inválido 😕</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>Pede ao teu amigo para enviar o link outra vez.</div>
        <a href="/" style={{ color: C.accent, fontSize: 13 }}>Ir para o PITCH</a>
      </div>
    );
  }

  const preview = { ...player, name: player.name ?? player.nick, attrs };

  const submit = () => {
    setCode(encodePayload({ from: raterName.trim() || "Anónimo", a: attrs, at: Date.now() }));
    window.scrollTo(0, 0);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — user can select the text */ }
  };

  if (code) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center" }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ height: 26, marginBottom: 24 }} />
        <div style={{ ...displayFont, fontSize: 24, marginBottom: 6 }}>Avaliação feita! ⚽</div>
        <div style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>
          Agora envia o código a <strong style={{ color: C.text1 }}>{player.nick}</strong> — ele cola-o na app e o cartão atualiza.
        </div>

        <div style={{ ...cardStyle, marginBottom: 14, textAlign: "left" }}>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>Código de avaliação</div>
          <div style={{ fontSize: 11, color: C.text1, wordBreak: "break-all", fontFamily: "monospace", background: C.surface, borderRadius: 10, padding: 10, border: `1px solid ${C.border}` }}>
            {code}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={copyCode} style={{ flex: 1, background: C.card, color: copied ? C.green : C.text1, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
          </button>
          <button onClick={() => openWhatsApp(rateResultMessage(player.nick, code))} style={{ flex: 1.4, background: C.whatsapp, color: C.bg, border: "none", borderRadius: 12, padding: 13, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MessageCircle size={15} /> Enviar por WhatsApp
          </button>
        </div>

        <a href="/" style={{ display: "inline-block", marginTop: 24, color: C.text2, fontSize: 13 }}>Conhecer o PITCH →</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 16px 40px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ height: 26, marginBottom: 18 }} />
        <div style={{ ...displayFont, fontSize: 24 }}>Avalia o {player.nick}</div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
          Sê justo — o cartão dele vai refletir a tua opinião 👀
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <FutCard player={preview} width={240} />
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {Object.keys(ATTR_LABELS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ width: 52, fontSize: 12, color: C.text2 }}>{ATTR_NAMES[k]}</span>
            <input type="range" min="40" max="99" value={attrs[k]}
              onChange={(e) => setAttrs((a) => ({ ...a, [k]: Number(e.target.value) }))}
              style={{ flex: 1, accentColor: C.accent }} />
            <span style={{ ...displayFont, width: 28, fontSize: 16, color: C.accent, textAlign: "right" }}>{attrs[k]}</span>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>O teu nome (opcional)</div>
        <input value={raterName} onChange={(e) => setRaterName(e.target.value)} placeholder="Quem está a avaliar?"
          style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
      </div>

      <BtnPrimary onClick={submit} style={{ width: "100%", fontSize: 15, padding: 14 }}>
        Enviar avaliação ⚽
      </BtnPrimary>
    </div>
  );
}
