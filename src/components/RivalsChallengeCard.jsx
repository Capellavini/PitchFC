import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import { C, R, S, T, displayFont } from "../theme";
import RivalsCrest from "./RivalsCrest";

const Row = ({ icon: Icon, label, value, note, noteColor }) => (
  <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.sm + 2}px 0`, borderTop: `1px solid ${C.border}` }}>
    <Icon size={16} color={C.text2} />
    <span style={{ fontSize: T.meta, color: C.text2, width: 54, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: T.body, fontWeight: 700, color: C.text1, flex: 1, minWidth: 0 }}>{value}</span>
    {note && <span style={{ fontSize: T.min, fontWeight: 800, color: noteColor, whiteSpace: "nowrap" }}>{note}</span>}
  </div>
);

const Team = ({ initials, color, name, tag }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.sm, flex: 1, minWidth: 0 }}>
    <RivalsCrest initials={initials} color={color} size={58} />
    <div style={{ fontSize: T.body, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{name}</div>
    <div style={{ fontSize: T.min, color: C.text2, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{tag}</div>
  </div>
);

/**
 * Hero visual of /rivals: the moment a captain opens a challenge link.
 * Pure JSX mock — not interactive, exposed to screen readers as one image
 * with a text description. Mirrors the spec's card (§8): opponent + crest,
 * date/time, format, field + who confirms it, proposal state, next action.
 */
export default function RivalsChallengeCard() {
  return (
    <div className="rv-float" role="img"
      aria-label="Exemplo de desafio: Coletes FC desafia Os Galácticos para sábado às 20:00, Futebol 7, Campo 2 em Matosinhos, 60 euros divididos a meias. Estado: aguardando resposta. Ações: aceitar ou contrapropor."
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card + 4, padding: S.lg + 4, boxShadow: "0 24px 60px rgba(0,0,0,.45)", maxWidth: 420, width: "100%", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.lg, flexWrap: "wrap" }}>
        <span style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.14em", color: C.text2 }}>DESAFIO RECEBIDO</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.orangeDim, color: C.orange, borderRadius: R.pill, padding: "5px 10px", fontSize: T.min, fontWeight: 800 }}>
          <span className="rv-pulse" style={{ width: 7, height: 7, borderRadius: 4, background: C.orange }} />
          Aguardando resposta
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg }}>
        <Team initials="CF" color={C.accent} name="Coletes FC" tag="Desafiante" />
        <div style={{ ...displayFont, fontSize: 28, color: C.text3, flexShrink: 0 }}>VS</div>
        <Team initials="OG" color={C.blue} name="Os Galácticos" tag="A tua equipa" />
      </div>

      <div style={{ ...displayFont, fontSize: 22, textAlign: "center", marginBottom: S.md, letterSpacing: "0.01em" }}>
        SÁB 20:00 <span style={{ color: C.text3 }}>·</span> Campo 2 <span style={{ color: C.text3 }}>·</span> <span style={{ color: C.accent }}>F7</span>
      </div>

      <Row icon={CalendarDays} label="Quando" value="Sáb, 18 out · 20:00 · 60 min" />
      <Row icon={MapPin} label="Campo" value="Campo 2 · Matosinhos" note="Coletes confirma" noteColor={C.orange} />
      <Row icon={Users} label="Formato" value="Futebol 7" />
      <Row icon={Wallet} label="Custo" value="60 € · a meias" />

      <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
        <div style={{ flex: 1, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", background: C.accent, color: C.bg, borderRadius: R.control, fontWeight: 800, fontSize: T.body }}>Aceitar</div>
        <div style={{ flex: 1, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}`, color: C.text1, borderRadius: R.control, fontWeight: 800, fontSize: T.body }}>Contrapropor</div>
      </div>
      <div style={{ fontSize: T.min, color: C.text2, textAlign: "center", marginTop: S.md }}>Aceitar não reserva o campo — fica claro quem trata disso.</div>
    </div>
  );
}
