import { useState } from "react";
import { ChevronLeft, MapPin, Users, Euro } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { WEEKDAYS_PT, fmtEUR } from "../lib/helpers";
import BtnPrimary from "./BtnPrimary";

/** Organizer onboarding — group, venue, schedule and price split. */
export default function OnboardingOrganizer({ settings, onDone, onBack }) {
  const [form, setForm] = useState({ ...settings });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const perPlayer = form.maxPlayers > 0 ? form.monthlyPrice / form.maxPlayers : 0;

  const input = (label, key, type = "text", extra = {}) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
      <input type={type} value={form[key]} {...extra}
        onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 4px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", padding: 4, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ ...displayFont, fontSize: 22 }}>O teu grupo</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16, paddingLeft: 34 }}>
        Define o jogo semanal — depois é só convidar a malta.
      </div>

      {/* Group + venue */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <MapPin size={15} color={C.accent} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Grupo e campo</span>
        </div>
        {input("Nome do grupo", "groupName")}
        {input("Campo / recinto", "venue")}
      </div>

      {/* Schedule */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Dia e hora do jogo</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {WEEKDAYS_PT.map((day, i) => {
            const active = form.weekday === i;
            return (
              <button key={day} onClick={() => set("weekday", i)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>Hora de início</div>
        <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", colorScheme: "dark" }} />
      </div>

      {/* Price */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Euro size={15} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Mensalidade</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {input("Preço mensal do campo (€)", "monthlyPrice", "number", { min: 0 })}
          {input("Nº de jogadores por jogo", "maxPlayers", "number", { min: 2, max: 22 })}
        </div>
        <div style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ ...displayFont, fontSize: 28, color: C.green }}>{fmtEUR(perPlayer)}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
            por jogador / mês — {fmtEUR(form.monthlyPrice)} ÷ {form.maxPlayers} jogadores
          </div>
        </div>
      </div>

      {/* What you get */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Users size={15} color={C.blue} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>O PITCH trata do resto</span>
        </div>
        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.8 }}>
          ✓ Convites e lembretes por WhatsApp<br />
          ✓ Confirmações com grelha de vagas em direto<br />
          ✓ Controlo de pagamentos por jogador<br />
          ✓ Sorteio de equipas equilibrado por posição<br />
          ✓ Stats, MVP e histórico de jogos
        </div>
      </div>

      <BtnPrimary onClick={() => onDone(form)} style={{ width: "100%", fontSize: 15, padding: 14 }}>
        Criar grupo e convidar 📣
      </BtnPrimary>
    </div>
  );
}
