import { useState } from "react";
import { ImagePlus, Video, Watch } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";

/** Collapsed "partilha um momento" row → expands into the manual-post
 *  composer (text + photo/video + workout card). Manual posts are the
 *  minority in the feed, so the composer stays one quiet line until
 *  tapped. Uses the same social handlers SocialTab uses. Matchday's
 *  "Submeter ao Golo da Semana" reuses it already open (initialOpen +
 *  placeholder), closing itself via onPublished. */
export default function FeedComposer({ me, social, onWorkout, initialOpen = false, placeholder, onPublished, style }) {
  const [open, setOpen] = useState(initialOpen);
  const [draft, setDraft] = useState("");
  const [media, setMedia] = useState(null); // { url, kind: 'photo' | 'video' }
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const canPublish = (draft.trim() || media) && !uploading;
  const publish = () => {
    if (!canPublish) return;
    social.onCreatePost({ type: media ? media.kind : "text", body: draft.trim(), media_url: media?.url ?? null });
    setDraft(""); setMedia(null); setErr(null); setOpen(false);
    onPublished?.();
  };
  const pick = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null); setUploading(true); setOpen(true);
    const res = await social.uploadMedia(file);
    setUploading(false);
    if (res?.error) { setErr(res.error); return; }
    setMedia({ url: res.url, kind });
  };

  const tool = { display: "inline-flex", alignItems: "center", gap: S.xs + 2, minHeight: TOUCH.min, padding: `0 ${S.xs}px`, fontSize: T.meta, fontWeight: 700, color: uploading ? C.text2 : C.text2, background: "none", border: "none", cursor: uploading ? "default" : "pointer" };

  return (
    <div style={{ ...cardStyle, padding: `${S.md}px ${S.lg}px`, marginBottom: S.md, ...style }}>
      <div style={{ display: "flex", alignItems: open ? "flex-start" : "center", gap: S.md }}>
        <Avatar name={me?.name || me?.nick} color={C.accent} size={36} isMe photo={me?.photo} />
        {open ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={placeholder || t("Partilha um momento, um golo, uma jogada…")}
            style={{ flex: 1, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `${S.sm + 2}px ${S.md}px`, fontSize: T.body, color: C.text1, outline: "none", resize: "none", fontFamily: "inherit" }} />
        ) : (
          <button type="button" onClick={() => setOpen(true)} style={{ flex: 1, minHeight: TOUCH.min, textAlign: "left", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: `0 ${S.lg}px`, fontSize: T.body, color: C.text2, cursor: "text" }}>
            {t("Partilha um momento…")}
          </button>
        )}
      </div>

      {media && (
        <div style={{ position: "relative", marginTop: S.md }}>
          {media.kind === "video"
            ? <video src={media.url} controls playsInline style={{ width: "100%", borderRadius: R.control, maxHeight: 280, background: C.bg }} />
            : <img src={media.url} alt="" style={{ width: "100%", borderRadius: R.control, maxHeight: 240, objectFit: "cover" }} />}
          <button type="button" onClick={() => setMedia(null)} style={{ position: "absolute", top: S.sm, right: S.sm, minHeight: 32, background: C.bg, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: `0 ${S.md}px`, fontSize: T.meta, cursor: "pointer" }}>{t("Remover")}</button>
        </div>
      )}
      {uploading && <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t("A carregar ficheiro…")}</div>}
      {err && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{t("Falha no upload:")} {err}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
        <label style={tool}>
          <ImagePlus size={16} /> {t("Foto")}
          <input type="file" accept="image/*" disabled={uploading} onChange={(e) => pick(e, "photo")} style={{ display: "none" }} />
        </label>
        <label style={tool}>
          <Video size={16} /> {t("Vídeo")}
          <input type="file" accept="video/*" disabled={uploading} onChange={(e) => pick(e, "video")} style={{ display: "none" }} />
        </label>
        {onWorkout && (
          <button type="button" onClick={onWorkout} style={tool}><Watch size={16} /> {t("Treino")}</button>
        )}
        {open && (
          <BtnPrimary compact onClick={publish} disabled={!canPublish} style={{ marginLeft: "auto", minHeight: TOUCH.min }}>{t("Publicar")}</BtnPrimary>
        )}
      </div>
    </div>
  );
}
