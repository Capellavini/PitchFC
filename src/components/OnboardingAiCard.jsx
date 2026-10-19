import { CalendarCheck } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont, inputStyle } from "../theme";
import { t, getLang } from "../lib/i18n";
import { OA, tf, MONTHS } from "../lib/onboardingAiCopy";
import { canCreate, perPlayerPrice, nextOccurrence, dayMonthIn, normTime, weekdayName, fmtMoney, FORMATS, SPOTS_MIN, SPOTS_MAX } from "../lib/onboardingAi";
import BtnPrimary from "./BtnPrimary";

/**
 * Editable confirmation card — every field inline, one primary CTA
 * ("Está certo, criar"). `proposal` is normalizeProposal()'s shape; edits
 * go back through onChange. The per-player split and the first game's date
 * are derived live (same Europe/Lisbon math the create path uses).
 */
export default function OnboardingAiCard({ proposal: p, lang = getLang(), onChange, onCreate, creating, error }) {
  const set = (k, v) => onChange({ ...p, [k]: v });
  const setOpen = (k, v) => onChange({ ...p, confirmationsOpen: { ...p.confirmationsOpen, [k]: v } });
  const perPlayer = perPlayerPrice(p.totalCost, p.spots);
  const ok = canCreate(p);
  const first = Number.isInteger(p.weekday) && normTime(p.time) ? nextOccurrence(p.weekday, p.time) : null;
  const dm = first ? dayMonthIn(first) : null;
  const firstLabel = dm ? `${weekdayName(p.weekday, lang)}, ${dm.day} ${(lang === "en" ? MONTHS.en : MONTHS.pt)[dm.month - 1]}` : null;
  const currencySymbol = p.currency === "BRL" ? "R$" : "€";

  const row = (label, control, key) => (
    <label key={key} style={{ display: "block", marginBottom: S.md }}>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs }}>{label}</div>
      {control}
    </label>
  );
  const field = { ...inputStyle(), background: C.surface };

  return (
    <div>
      <div style={{ fontSize: T.body, color: C.text2, margin: `${S.xs}px 0 ${S.md}px` }}>{t(OA.cardSub)}</div>
      <div style={{ ...cardStyle, marginBottom: S.lg }}>
        <div style={{ ...displayFont, fontSize: T.h, marginBottom: S.md }}>{t(OA.cardTitle)}</div>

        {row(t(OA.fName), <input value={p.groupName} maxLength={40} onChange={(e) => set("groupName", e.target.value)} style={field} />, "name")}
        {row(t(OA.fVenue), <input value={p.venue} maxLength={60} onChange={(e) => set("venue", e.target.value)} style={{ ...field, borderColor: p.venue.trim() ? C.border : C.orange }} />, "venue")}
        {!p.venue.trim() && <div style={{ fontSize: T.meta, color: C.orange, marginTop: -S.sm, marginBottom: S.md }}>{t(OA.missingVenue)}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: S.sm }}>
          {row(t(OA.fDay), (
            <select value={Number.isInteger(p.weekday) ? p.weekday : ""} onChange={(e) => set("weekday", e.target.value === "" ? null : Number(e.target.value))} style={{ ...field, colorScheme: "dark" }}>
              {!Number.isInteger(p.weekday) && <option value="">—</option>}
              {[1, 2, 3, 4, 5, 6, 0].map((i) => <option key={i} value={i}>{weekdayName(i, lang)}</option>)}
            </select>
          ), "day")}
          {row(t(OA.fTime), <input type="time" value={p.time || ""} onChange={(e) => set("time", e.target.value || null)} style={{ ...field, colorScheme: "dark" }} />, "time")}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: S.sm }}>
          {row(t(OA.fSpots), (
            <select value={p.spots} onChange={(e) => { const n = Number(e.target.value); onChange({ ...p, spots: n, format: Object.keys(FORMATS).find((k) => FORMATS[k] === n) || "other" }); }} style={{ ...field, colorScheme: "dark" }}>
              {Array.from({ length: (SPOTS_MAX - SPOTS_MIN) / 2 + 1 }, (_, i) => SPOTS_MIN + i * 2).map((n) => {
                const f = Object.keys(FORMATS).find((k) => FORMATS[k] === n);
                return <option key={n} value={n}>{f ? `${n} · ${f.replace("v", "×")}` : n}</option>;
              })}
            </select>
          ), "spots")}
          {row(`${t(OA.fCost)} (${currencySymbol})`, (
            <input type="number" inputMode="decimal" min={0} step="0.5" value={p.totalCost || ""} placeholder="0"
              onChange={(e) => set("totalCost", Math.max(0, Number(e.target.value) || 0))} style={field} />
          ), "cost")}
        </div>

        <div style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: R.control, padding: `${S.sm}px ${S.md}px`, marginBottom: S.md, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: S.sm }}>
          <span style={{ fontSize: T.meta, color: C.text2 }}>{t(OA.fPerPlayer)}</span>
          <span style={{ ...displayFont, fontSize: T.h, color: C.green }}>{fmtMoney(perPlayer, p.currency, lang)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, minHeight: TOUCH.min, marginBottom: S.sm }}>
          <span style={{ fontSize: T.body, fontWeight: 700 }}>{t(OA.fRecurring)}</span>
          <button type="button" role="switch" aria-checked={p.recurring} aria-label={t(OA.fRecurring)} onClick={() => set("recurring", !p.recurring)}
            style={{ width: 52, height: TOUCH.min, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <span style={{ width: 46, height: 26, borderRadius: 13, background: p.recurring ? C.accent : C.surface, border: `1px solid ${p.recurring ? C.accent : C.border}`, position: "relative", display: "block" }}>
              <span style={{ position: "absolute", top: 2, left: p.recurring ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: p.recurring ? C.bg : C.text3, transition: "left 0.2s" }} />
            </span>
          </button>
        </div>

        {p.recurring && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: S.sm }}>
            {row(t(OA.fOpens), (
              <select value={p.confirmationsOpen.daysBefore} onChange={(e) => setOpen("daysBefore", Number(e.target.value))} style={{ ...field, colorScheme: "dark" }}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n === 1 ? t(OA.opensDay1) : tf(OA.opensDays, { n })}</option>)}
              </select>
            ), "open")}
            {row(t(OA.at), <input type="time" value={p.confirmationsOpen.time} onChange={(e) => setOpen("time", e.target.value || "10:00")} style={{ ...field, colorScheme: "dark" }} />, "openTime")}
          </div>
        )}

        <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start", fontSize: T.meta, color: firstLabel ? C.text1 : C.orange, marginTop: S.xs }}>
          <CalendarCheck size={16} color={firstLabel ? C.accent : C.orange} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{firstLabel ? tf(OA.firstGame, { date: firstLabel, time: normTime(p.time) }) : t(OA.firstGameNone)}</span>
        </div>
      </div>

      {error && <div role="alert" style={{ fontSize: T.meta, color: C.red, marginBottom: S.md }}>{t(OA.createError)}</div>}
      <BtnPrimary block disabled={!ok || creating} onClick={onCreate} style={{ fontSize: T.cardTitle }}>
        {creating ? t(OA.creating) : t(OA.create)}
      </BtnPrimary>
    </div>
  );
}
