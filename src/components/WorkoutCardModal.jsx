import { useState } from "react";
import { X, Watch, Image as ImageIcon, Upload, Send } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { renderWorkoutCard } from "../lib/workoutCard";
import { dataUrlToFile } from "../lib/postMatchCard";

const FIELDS = [
  { key: "distanceKm", label: "Distância (km)", placeholder: "5.2" },
  { key: "durationMin", label: "Duração (min)", placeholder: "42" },
  { key: "calories", label: "Calorias (kcal)", placeholder: "480" },
  { key: "avgHr", label: "FC média (bpm)", placeholder: "142" },
];

/** "Strava do futebol": a mini form for the watch numbers (no HealthKit
 *  access from a web app, so this is manual) + the game/location photo,
 *  rendered into a shareable card (renderWorkoutCard) that also carries
 *  the player's own goals/assists for the last matchday, then published
 *  straight to the Social feed like any other photo post. */
export default function WorkoutCardModal({ me, groupName, lastMatchday, social, onClose }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [watch, setWatch] = useState({ distanceKm: "", durationMin: "", calories: "", avgHr: "" });
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState("form"); // 'form' | 'generating' | 'preview' | 'publishing'
  const [cardUrl, setCardUrl] = useState(null);
  const [error, setError] = useState(null);

  const myKey = me ? (me.uuid ?? me.id) : null;
  const iPlayed = Boolean(me) && (lastMatchday?.candidates ?? []).some((c) => c.key === myKey);
  const myLine = (lastMatchday?.lines || []).find((l) => l.key === myKey);
  const pitch = iPlayed ? { goals: myLine?.goals || 0, assists: myLine?.assists || 0 } : null;

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const setField = (key, value) => setWatch((w) => ({ ...w, [key]: value }));
  const hasAnyStat = Object.values(watch).some((v) => v.trim() !== "");
  const canGenerate = Boolean(photoFile) || hasAnyStat;

  const generate = async () => {
    setError(null);
    setStage("generating");
    try {
      const dateLabel = new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
      const url = await renderWorkoutCard({
        photoFile, playerNick: me?.nick || "", groupName, dateLabel,
        watch: {
          distanceKm: parseFloat(watch.distanceKm) || 0,
          durationMin: parseFloat(watch.durationMin) || 0,
          calories: parseFloat(watch.calories) || 0,
          avgHr: parseFloat(watch.avgHr) || 0,
        },
        pitch,
      });
      setCardUrl(url);
      setStage("preview");
    } catch (err) {
      setError(err.message || t("Falha ao gerar o cartão."));
      setStage("form");
    }
  };

  const publish = async () => {
    setStage("publishing");
    setError(null);
    const file = dataUrlToFile(cardUrl, "pitch-treino.png");
    const up = await social.uploadMedia(file);
    if (up?.error) { setError(up.error); setStage("preview"); return; }
    await social.onCreatePost({ type: "photo", body: caption.trim(), media_url: up.url });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, display: "flex", alignItems: "center", gap: 6 }}>
            <Watch size={15} color={C.accent} /> {t("Registar treino")}
          </div>
          <button onClick={onClose} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={15} color={C.text2} />
          </button>
        </div>

        {stage === "preview" ? (
          <>
            <img src={cardUrl} alt="" style={{ width: "100%", borderRadius: 16, marginBottom: 14, display: "block" }} />
            {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button onClick={() => setStage("form")} disabled={stage === "publishing"} style={{ flex: 1, background: C.card, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {t("Voltar")}
              </button>
              <button onClick={publish} disabled={stage === "publishing"} style={{ flex: 2, background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: stage === "publishing" ? 0.6 : 1 }}>
                <Send size={16} /> {stage === "publishing" ? t("A publicar…") : t("Publicar no feed")}
              </button>
            </div>
          </>
        ) : (
          <div style={{ ...cardStyle, width: "100%", padding: 16 }}>
            <label style={{ display: "block", cursor: "pointer" }}>
              {photoPreview ? (
                <img src={photoPreview} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
              ) : (
                <div style={{ width: "100%", height: 160, borderRadius: 12, border: `1.5px dashed ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12, color: C.text3 }}>
                  <ImageIcon size={22} />
                  <span style={{ fontSize: 12 }}>{t("Foto do jogo/local (opcional)")}</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>{t(f.label)}</div>
                  <input type="number" inputMode="decimal" value={watch[f.key]} placeholder={f.placeholder}
                    onChange={(e) => setField(f.key, e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 13, color: C.text1, outline: "none" }} />
                </div>
              ))}
            </div>

            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder={t("Uma legenda (opcional)…")}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.text1, outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 12 }} />

            {pitch && (
              <div style={{ fontSize: 12, color: C.accent, marginBottom: 12 }}>
                {t("Vais juntar também os teus")} ⚽ {pitch.goals} · 🎯 {pitch.assists} {t("do último jogo.")}
              </div>
            )}

            {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{error}</div>}

            <button onClick={generate} disabled={!canGenerate || stage === "generating"} style={{ width: "100%", background: canGenerate ? C.accent : C.accentDim, color: canGenerate ? C.bg : C.text3, border: "none", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 800, cursor: canGenerate ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {stage === "generating" ? t("A gerar…") : <><Upload size={16} /> {t("Gerar cartão")}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
