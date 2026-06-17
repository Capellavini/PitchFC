import { useState } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { POSITIONS, FEET, NATIONALITIES } from "../data";
import { ATTR_LABELS } from "../lib/helpers";
import FutCard from "./FutCard";
import BtnPrimary from "./BtnPrimary";

const ATTR_NAMES = { rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };

/** Player onboarding — build your FUT card with a live preview. */
export default function OnboardingPlayer({ me, onDone, onBack, uploadMedia }) {
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    ...me,
    name: me.name ?? "", nick: me.nick ?? "", age: me.age ?? 25,
    nationality: me.nationality ?? "🇵🇹 Portugal", club: me.club ?? "FC Porto",
    position: me.position ?? "Médio", foot: me.foot ?? "Direito",
    attrs: me.attrs ?? { rit: 70, rem: 70, pas: 70, dri: 70, def: 70, fis: 70 },
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setAttr = (key, value) => setForm((f) => ({ ...f, attrs: { ...f.attrs, [key]: value } }));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const res = await uploadMedia(file);
    setUploading(false);
    if (res?.url) set("photo", res.url);
  };

  const chips = (label, key, options) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const active = form[key] === opt;
          return (
            <button key={opt} onClick={() => set(key, opt)} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "6px 13px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
              {opt}
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
        <div style={{ ...displayFont, fontSize: 22 }}>O teu cartão</div>
      </div>
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 16, paddingLeft: 34 }}>
        Estilo FUT — o cartão atualiza enquanto preenches.
      </div>

      {/* Live preview */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <FutCard player={form} width={250} />
      </div>

      {/* Photo */}
      <label style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, marginBottom: 14, cursor: "pointer" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Camera size={19} color={C.accent} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{form.photo ? "Trocar fotografia" : "Adicionar fotografia"}</div>
          <div style={{ fontSize: 11, color: C.text2 }}>{uploading ? "A carregar…" : "Aparece no cartão e nos jogos"}</div>
        </div>
        {form.photo && <img src={form.photo} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />}
        <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
      </label>

      {/* Identity */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {[["Nome completo", "name", "text"], ["Alcunha (nome no cartão)", "nick", "text"]].map(([label, key, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>{label}</div>
            <input type={type} value={form[key]} onChange={(e) => set(key, e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>Idade</div>
            <input type="number" min="14" max="70" value={form.age} onChange={(e) => set("age", Number(e.target.value))}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>Nacionalidade</div>
            <select value={form.nationality} onChange={(e) => set("nationality", e.target.value)}
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
              {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 5 }}>Clube do coração</div>
          <input type="text" value={form.club} onChange={(e) => set("club", e.target.value)} placeholder="ex.: FC Porto, Real Madrid, Flamengo…"
            style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
        </div>
      </div>

      {/* Position + foot */}
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {chips("Posição", "position", POSITIONS)}
        {chips("Pé dominante", "foot", FEET)}
      </div>

      {/* Attributes */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
          Atributos — sê honesto, a malta vai confirmar em campo 😄
        </div>
        {Object.keys(ATTR_LABELS).map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ width: 52, fontSize: 12, color: C.text2 }}>{ATTR_NAMES[k]}</span>
            <input type="range" min="40" max="99" value={form.attrs[k]} onChange={(e) => setAttr(k, Number(e.target.value))}
              style={{ flex: 1, accentColor: C.accent }} />
            <span style={{ ...displayFont, width: 28, fontSize: 16, color: C.accent, textAlign: "right" }}>{form.attrs[k]}</span>
          </div>
        ))}
      </div>

      <BtnPrimary onClick={() => onDone(form)} disabled={uploading} style={{ width: "100%", fontSize: 15, padding: 14, opacity: uploading ? 0.6 : 1 }}>
        {uploading ? "A carregar foto…" : "Criar o meu cartão ⚽"}
      </BtnPrimary>
    </div>
  );
}
