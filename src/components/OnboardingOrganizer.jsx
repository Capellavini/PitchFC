import { useState } from "react";
import { ChevronLeft, MapPin, Users, Euro } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { WEEKDAYS_PT, fmtEUR } from "../lib/helpers";
import { t, getLang } from "../lib/i18n";
import BtnPrimary from "./BtnPrimary";

/** Organizer onboarding — group, venue, schedule and price split. */
export default function OnboardingOrganizer({ settings, onDone, onBack }) {
  const [form, setForm] = useState({ ...settings });
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const perPlayer = form.maxPlayers > 0 ? form.monthlyPrice / form.maxPlayers : 0;
  const en = getLang() === "en";

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
        <div style={{ ...displayFont, fontSize: 22 }}>{t("O teu grupo")}</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16, paddingLeft: 34 }}>
        {t("Define o jogo semanal — depois é só convidar a malta.")}
      </div>

      {/* Group + venue */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <MapPin size={15} color={C.accent} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("Grupo e campo")}</span>
        </div>
        {input(t("Nome do grupo"), "groupName")}
        {input(t("Campo / recinto"), "venue")}
      </div>

      {/* Schedule */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t("Dia e hora do jogo")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {WEEKDAYS_PT.map((day, i) => {
            const active = form.weekday === i;
            return (
              <button key={day} onClick={() => set("weekday", i)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                {t(day.slice(0, 3))}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Hora de início")}</div>
        <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", colorScheme: "dark" }} />
      </div>

      {/* Recurring + confirmation-open window */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: form.recurring ? 14 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Jogo recorrente")}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{t("Abre a confirmação automaticamente todas as semanas")}</div>
          </div>
          <button onClick={() => set("recurring", !form.recurring)} aria-label="Alternar jogo recorrente"
            style={{ width: 46, height: 26, borderRadius: 13, background: form.recurring ? C.accent : C.surface, border: `1px solid ${form.recurring ? C.accent : C.border}`, position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
            <span style={{ position: "absolute", top: 2, left: form.recurring ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: form.recurring ? C.bg : C.text3, transition: "left 0.2s" }} />
          </button>
        </div>

        {form.recurring && (
          <>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{t("As confirmações abrem em…")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {WEEKDAYS_PT.map((day, i) => {
                const active = form.openWeekday === i;
                return (
                  <button key={day} onClick={() => set("openWeekday", i)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                    {t(day.slice(0, 3))}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("…a esta hora")}</div>
            <input type="time" value={form.openTime} onChange={(e) => set("openTime", e.target.value)}
              style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", colorScheme: "dark", marginBottom: 12 }} />
            <div style={{ background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: 12, fontSize: 12, color: C.text2 }}>
              {en ? (
                <>📅 Every <b style={{ color: C.accent }}>{t(WEEKDAYS_PT[form.openWeekday])} at {form.openTime}</b> confirmations open for the <b style={{ color: C.text1 }}>{t(WEEKDAYS_PT[form.weekday])}</b> game.</>
              ) : (
                <>📅 Todas as <b style={{ color: C.accent }}>{WEEKDAYS_PT[form.openWeekday]?.toLowerCase()}s às {form.openTime}</b> abre a confirmação para o jogo de <b style={{ color: C.text1 }}>{WEEKDAYS_PT[form.weekday]?.toLowerCase()}</b>.</>
              )}
            </div>
          </>
        )}
      </div>

      {/* Price */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Euro size={15} color={C.green} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("Mensalidade")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {input(t("Preço mensal do campo (€)"), "monthlyPrice", "number", { min: 0 })}
          {input(t("Nº de jogadores por jogo"), "maxPlayers", "number", { min: 2, max: 22 })}
        </div>
        <div style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
          <div style={{ ...displayFont, fontSize: 28, color: C.green }}>{fmtEUR(perPlayer)}</div>
          <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
            {t("por jogador / mês")} — {fmtEUR(form.monthlyPrice)} ÷ {form.maxPlayers} {t("jogadores")}
          </div>
        </div>
      </div>

      {/* What you get */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Users size={15} color={C.blue} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{t("O PITCH trata do resto")}</span>
        </div>
        <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.8 }}>
          ✓ {t("Convites e lembretes por WhatsApp")}<br />
          ✓ {t("Confirmações com grelha de vagas em direto")}<br />
          ✓ {t("Controlo de pagamentos por jogador")}<br />
          ✓ {t("Sorteio de equipas equilibrado por posição")}<br />
          ✓ {t("Stats, MVP e histórico de jogos")}
        </div>
      </div>

      <BtnPrimary onClick={() => onDone(form)} style={{ width: "100%", fontSize: 15, padding: 14 }}>
        {t("Criar grupo e convidar 📣")}
      </BtnPrimary>
    </div>
  );
}
