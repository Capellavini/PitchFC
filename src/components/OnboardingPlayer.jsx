import { useState } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { POSITIONS, FEET, NATIONALITIES } from "../data";
import { defaultAttrsFor } from "../lib/helpers";
import { t } from "../lib/i18n";
import FutCard from "./FutCard";
import BtnPrimary from "./BtnPrimary";

/** Player onboarding — build your FUT card with a live preview.
 *
 *  `quick`: minimal cartão used by the unified group-join flow (both the
 *  ?join= link and the manual invite-code path) — only Nome + Posição are
 *  asked (foto stays optional), everything else (idade, nacionalidade,
 *  clube, pé, alcunha) takes a sensible default and is editable later from
 *  o Perfil. This isn't just about fewer taps: the OVR/attributes on the
 *  card stay locked behind "?" until 3+ peer ratings come in anyway (see
 *  FutCard's `ratingsCount` gate), so asking for them up front was always
 *  low-value friction — position is the one field that matters immediately,
 *  since the balanced team draw depends on it. */
export default function OnboardingPlayer({ me, onDone, onBack, uploadMedia, quick = false }) {
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    ...me,
    name: me.name ?? "", nick: me.nick ?? "", age: me.age ?? 25,
    nationality: me.nationality ?? "🇵🇹 Portugal", club: me.club ?? "FC Porto",
    position: me.position ?? "Médio", foot: me.foot ?? "Direito",
    attrs: me.attrs ?? defaultAttrsFor(me.position ?? "Médio"),
  });

  // Goalkeepers use a completely different attribute set (diving/
  // handling/kicking/reflexes/speed/positioning) than outfield players —
  // switching position resets attrs to the matching default (there's no
  // slider here to edit them anyway; ratings unlock the real numbers).
  // In quick mode there's no separate "alcunha" field, so the nick is
  // kept in sync with the first word of the name as it's typed.
  const set = (key, value) => setForm((f) => {
    if (key === "position") return { ...f, position: value, attrs: defaultAttrsFor(value) };
    if (quick && key === "name") return { ...f, name: value, nick: value.trim().split(" ")[0] || value };
    return { ...f, [key]: value };
  });

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadMedia(file);
    setUploading(false);
    if (res?.url) set("photo", res.url);
  };

  // Options keep their PT value (that's what gets stored); only the chip
  // label is translated.
  const chips = (label, key, options) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <button key={opt} onClick={() => set(key, opt)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
              {t(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 0 4px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.text2, cursor: "pointer", padding: 4, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ ...displayFont, fontSize: 22 }}>{t("O teu cartão")}</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16, paddingLeft: 34 }}>
        {quick
          ? t("Só o essencial para já — completa o resto quando quiseres no Perfil.")
          : t("Estilo FUT — o cartão atualiza enquanto preenches.")}
      </div>

      {/* Live preview — locked (0 ratings): a brand new card has no
          stats yet, friends' ratings unlock the numbers later. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <FutCard player={form} width={250} ratingsCount={0} />
      </div>

      {/* Photo — optional/skippable even outside quick mode. */}
      <label style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Camera size={19} color={C.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{form.photo ? t("Trocar fotografia") : t("Adicionar fotografia")}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>{uploading ? t("A carregar…") : (quick ? t("Opcional — podes saltar") : t("Aparece no cartão e nos jogos"))}</div>
        </div>
        {form.photo && <img src={form.photo} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />}
        <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
      </label>

      {/* Identity */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ marginBottom: quick ? 0 : 12 }}>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Nome completo")}</div>
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
        </div>
        {!quick && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Alcunha (nome no cartão)")}</div>
            <input type="text" value={form.nick} onChange={(e) => set("nick", e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
        )}
        {!quick && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Idade")}</div>
                <input type="number" min="14" max="70" value={form.age} onChange={(e) => set("age", Number(e.target.value))}
                  style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Nacionalidade")}</div>
                <select value={form.nationality} onChange={(e) => set("nationality", e.target.value)}
                  style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{t("Clube do coração")}</div>
              <input type="text" value={form.club} onChange={(e) => set("club", e.target.value)} placeholder={t("ex.: FC Porto, Real Madrid, Flamengo…")}
                style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
            </div>
          </>
        )}
      </div>

      {/* Position (+ foot outside quick mode) */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {chips(t("Posição"), "position", POSITIONS)}
        {!quick && chips(t("Pé dominante"), "foot", FEET)}
      </div>

      <BtnPrimary onClick={() => onDone(form)} disabled={uploading} style={{ width: "100%", fontSize: 15, padding: 14, opacity: uploading ? 0.6 : 1 }}>
        {uploading ? t("A carregar foto…") : t("Criar o meu cartão ⚽")}
      </BtnPrimary>
    </div>
  );
}
