import { useState } from "react";
import { ChevronLeft, ChevronRight, Shield, Star } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont } from "../theme";
import { MONTHS_PT } from "../lib/helpers";
import { t, getLang } from "../lib/i18n";
import { calendarDaysFor } from "../lib/profileStats";

// Sunday-first narrow weekday initials in the active language
// (2026-01-04 is a Sunday).
const weekdayInitials = () => {
  const lang = getLang() === "pt" ? "pt-PT" : getLang() === "pt-br" ? "pt-BR" : getLang();
  let fmt;
  try { fmt = new Intl.DateTimeFormat(lang, { weekday: "narrow" }); } catch { fmt = new Intl.DateTimeFormat("pt-PT", { weekday: "narrow" }); }
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 0, 4 + i)));
};

/** Perfil → Calendário (brief mockup screen 8): month grid, days this
 *  player played filled lime, a dot under days they scored, a gold star
 *  on MVP days; tap a played day for their line that night. Always
 *  renders the grid (+ legend) — an empty month just reads as "no games
 *  yet". Days need the ISO `playedOn` (cloud rows, the local demo seed
 *  and matchdays played locally since the redesign carry it). Minutes aren't tracked, so the day
 *  detail is golos/assistências/defesas/clean sheets only. */
export default function MatchdayCalendar({ days = [], playerKey, playerNick }) {
  const byIso = calendarDaysFor(days, playerKey, playerNick);
  const isos = Object.keys(byIso).sort();
  const latest = isos.length ? new Date(`${isos[isos.length - 1]}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(latest.getFullYear());
  const [viewMonth, setViewMonth] = useState(latest.getMonth());
  const [selectedIso, setSelectedIso] = useState(null);

  const changeMonth = (delta) => {
    setSelectedIso(null);
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = new Date(viewYear, viewMonth, 1).getDay();
  const isoOf = (day) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = new Date();
  const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const monthPrefix = isoOf(1).slice(0, 7);
  const monthEntries = isos.filter((iso) => iso.startsWith(monthPrefix)).map((iso) => byIso[iso]);
  const monthGoals = monthEntries.reduce((s, e) => s + e.goals, 0);

  const selected = selectedIso ? byIso[selectedIso] : null;
  const line = selected ? (selected.day.summary?.lines || []).find((l) => l.key === playerKey) : null;

  const navBtn = {
    width: TOUCH.min, height: TOUCH.min, borderRadius: R.control, background: "none",
    border: `1px solid ${C.border}`, color: C.text1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
  };

  return (
    <div style={{ ...cardStyle, marginBottom: S.lg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
        <button onClick={() => changeMonth(-1)} aria-label={t("Mês anterior")} style={navBtn}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1 }}>{t(MONTHS_PT[viewMonth])} {viewYear}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>
            {monthEntries.length} {monthEntries.length === 1 ? t("jogo") : t("jogos")} · {monthGoals} {monthGoals === 1 ? t("golo") : t("golos")}
          </div>
        </div>
        <button onClick={() => changeMonth(1)} aria-label={t("Mês seguinte")} style={navBtn}><ChevronRight size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: S.xs, marginBottom: S.xs }}>
        {weekdayInitials().map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: T.min, fontWeight: 800, color: C.text2, textTransform: "uppercase" }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: S.xs }}>
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = isoOf(day);
          const entry = byIso[iso];
          const isToday = iso === todayIso;
          const isSelected = selectedIso === iso;
          return (
            <button key={day} disabled={!entry} onClick={() => setSelectedIso(isSelected ? null : iso)}
              aria-label={entry ? `${day} · ${t("Jogo")}${entry.goals ? ` · ${entry.goals} ${entry.goals === 1 ? t("golo") : t("golos")}` : ""}${entry.mvp ? " · MVP" : ""}` : String(day)}
              style={{
                position: "relative", aspectRatio: "1", minHeight: 36, borderRadius: "50%", padding: 0,
                border: `${isSelected ? 2 : 1}px solid ${isSelected ? C.text1 : isToday ? C.text2 : "transparent"}`,
                background: entry ? C.accent : "transparent",
                color: entry ? C.bg : C.text2,
                fontSize: T.meta + 1, fontWeight: entry ? 900 : 500, cursor: entry ? "pointer" : "default",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
              <span style={{ lineHeight: 1 }}>{day}</span>
              {entry?.goals > 0 && <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.bg, marginTop: 2 }} />}
              {entry?.mvp && (
                <Star size={12} fill={C.gold} color={C.gold} style={{ position: "absolute", top: -3, right: -3 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: S.lg, marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}`, fontSize: T.meta, color: C.text2, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: S.xs + 2 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.accent }} /> {t("Jogo")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: S.xs + 2 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.bg, marginBottom: 1 }} />
          </span> {t("Golo")}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: S.xs + 2 }}>
          <Star size={12} fill={C.gold} color={C.gold} /> MVP
        </span>
      </div>

      {!isos.length && (
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.md }}>{t("Os dias em que jogas aparecem aqui, a verde-lima.")}</div>
      )}

      {selected && (
        <div style={{ marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: S.sm }}>{selected.day.date}</div>
          <div style={{ display: "flex", gap: S.lg, flexWrap: "wrap", alignItems: "baseline" }}>
            {[
              [line?.goals || 0, line?.goals === 1 ? t("golo") : t("golos")],
              [line?.assists || 0, t("assist.")],
              [line?.epicSaves || 0, line?.epicSaves === 1 ? t("defesa") : t("defesas")],
            ].map(([v, label]) => v > 0 && (
              <span key={label} style={{ display: "flex", alignItems: "baseline", gap: S.xs }}>
                <span style={{ ...displayFont, fontSize: T.h, color: C.text1 }}>{v}</span>
                <span style={{ fontSize: T.meta, color: C.text2 }}>{label}</span>
              </span>
            ))}
            {(line?.cleanSheets || 0) > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: S.xs, fontSize: T.meta, color: C.text2 }}>
                <Shield size={14} color={C.green} /> {line.cleanSheets} {line.cleanSheets === 1 ? t("baliza a zero") : t("balizas a zero")}
              </span>
            )}
            {selected.mvp && (
              <span style={{ display: "flex", alignItems: "center", gap: S.xs, fontSize: T.meta, fontWeight: 800, color: C.gold }}>
                <Star size={14} fill={C.gold} color={C.gold} /> {t("MVP do dia")}
              </span>
            )}
            {!(line?.goals || line?.assists || line?.epicSaves || line?.cleanSheets) && !selected.mvp && (
              <span style={{ fontSize: T.meta, color: C.text2 }}>{t("Jogou, sem golos/assistências registados.")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
