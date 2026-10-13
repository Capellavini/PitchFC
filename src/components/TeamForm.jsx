import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError } from "../lib/rivalsCopy";
import { TEAM_FORMATS } from "../lib/rivals";
import FormField from "./FormField";
import ColorSwatches from "./ColorSwatches";
import OptionPills from "./OptionPills";
import TeamBadge from "./TeamBadge";

/** The team fields shared by CreateTeamSheet and TeamEditSheet: crest,
 *  name, kit colours, country (PT/BR), city, district/state, format, home
 *  pitch. Controlled: `value` + `onChange(nextValue)`. `nameLocked` greys
 *  out the name (a vice can't rename). */
export default function TeamForm({ value: f, onChange, uploadBadge, nameLocked = false, autoFocusName = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const set = (k) => (e) => onChange({ ...f, [k]: e?.target ? e.target.value : e });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadBadge) return;
    setUploading(true); setError(null);
    const r = await uploadBadge(file);
    setUploading(false);
    if (r.error) setError(rivalsError(r.error)); else onChange({ ...f, logoUrl: r.data });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: S.md + 2, marginBottom: S.lg + 2 }}>
        <TeamBadge team={{ ...f, name: f.name || "?" }} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {uploadBadge && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{
              display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, background: C.card, color: C.text1,
              border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md + 2}px`, fontSize: T.meta + 1, fontWeight: 700, cursor: "pointer",
            }}>
              <Camera size={16} color={C.accent} /> {uploading ? t(RC.uploading) : f.logoUrl ? t(RC.changeBadge) : t(RC.uploadBadge)}
            </button>
          )}
          {f.logoUrl ? (
            <button type="button" onClick={() => onChange({ ...f, logoUrl: null })} style={{ minHeight: TOUCH.min, background: "none", border: "none", color: C.text2, fontSize: T.meta, padding: 0, cursor: "pointer" }}>
              {t(RC.useInitials)}
            </button>
          ) : (
            <div style={{ fontSize: T.min + 0.5, color: C.text2, marginTop: 6, lineHeight: 1.4 }}>{t(RC.badgeHint)}</div>
          )}
          {error && <div role="alert" style={{ fontSize: T.meta, color: C.red, marginTop: 6 }}>{error}</div>}
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </div>
      </div>

      <FormField label={t(RC.teamName)} hint={nameLocked ? t(RC.renameCaptainOnly) : null}>
        <input value={f.name} onChange={set("name")} maxLength={40} placeholder={t(RC.namePlaceholder)} disabled={nameLocked}
          autoFocus={autoFocusName} style={{ ...inputStyle(), opacity: nameLocked ? 0.6 : 1 }} />
      </FormField>
      <FormField group label={t(RC.primaryColor)}><ColorSwatches label={t(RC.primaryColor)} value={f.color} onChange={set("color")} /></FormField>
      <FormField group label={t(RC.secondaryColor)}><ColorSwatches label={t(RC.secondaryColor)} value={f.secondaryColor} onChange={set("secondaryColor")} /></FormField>
      <FormField group label={t(RC.country)}>
        <OptionPills label={t(RC.country)} value={f.country}
          options={[{ id: "PT", label: t(RC.portugal) }, { id: "BR", label: t(RC.brazil) }]}
          onChange={(country) => onChange({ ...f, country })} />
      </FormField>
      <div style={{ display: "flex", gap: S.sm + 2, flexWrap: "wrap" }}>
        <FormField label={t(RC.city)} style={{ flex: "1 1 140px" }}>
          <input value={f.city} onChange={set("city")} maxLength={60} placeholder={f.country === "BR" ? "São Paulo" : "Matosinhos"} style={inputStyle()} />
        </FormField>
        <FormField label={t(f.country === "BR" ? RC.regionBR : RC.regionPT)} style={{ flex: "1 1 110px" }}>
          <input value={f.region} onChange={set("region")} maxLength={60} placeholder={f.country === "BR" ? "SP" : "Porto"} style={inputStyle()} />
        </FormField>
      </div>
      <FormField group label={t(RC.format)}>
        <OptionPills label={t(RC.format)} value={f.format} options={TEAM_FORMATS.map((x) => ({ id: x, label: x }))} onChange={set("format")} />
      </FormField>
      <FormField label={t(RC.homeVenue)} hint={t(RC.homeVenueHint)} style={{ marginBottom: S.sm }}>
        <input value={f.homeVenue} onChange={set("homeVenue")} maxLength={80} style={inputStyle()} />
      </FormField>
    </>
  );
}
