import { useState } from "react";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { MONTHS_PT } from "../lib/helpers";
import { t } from "../lib/i18n";

const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Apple-Fitness-style month calendar: days this player actually played
 *  get a dot, tapping one opens their personal line for that day. Cloud
 *  only — local demo doesn't persist the per-day summary this needs.
 *  Minutes played aren't tracked yet (the live timer isn't tied to a
 *  specific match), so this only ever shows golos/assistências/etc. */
export default function MatchdayCalendar({ records, playerKey }) {
  const playedDays = records.filter((r) => (r.summary?.candidates || []).some((c) => c.key === playerKey));
  const latest = playedDays[0]?.playedOn ? new Date(`${playedDays[0].playedOn}T12:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(latest.getFullYear());
  const [viewMonth, setViewMonth] = useState(latest.getMonth());
  const [selected, setSelected] = useState(null); // record for the tapped day

  const recordByIso = {};
  playedDays.forEach((r) => { if (r.playedOn) recordByIso[r.playedOn] = r; });

  const changeMonth = (delta) => {
    setSelected(null);
    let m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const isoOf = (day) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayIso = new Date().toISOString().slice(0, 10);

  const line = selected ? (selected.summary?.lines || []).find((l) => l.key === playerKey) : null;
  const isMVP = selected && selected.mvpNick && (selected.summary?.lines || []).some((l) => l.key === playerKey && l.nick === selected.mvpNick);

  if (!records.length) {
    return (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{t("Calendário")}</div>
        <div style={{ fontSize: 11, color: C.text2 }}>{t("Ainda sem dias de jogo registados nesta época.")}</div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={() => changeMonth(-1)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text2 }}>
          <ChevronLeft size={15} />
        </button>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{t(MONTHS_PT[viewMonth])} {viewYear}</div>
        <button onClick={() => changeMonth(1)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text2 }}>
          <ChevronRight size={15} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {WEEKDAY_INITIALS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: C.text3 }}>{w}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = isoOf(day);
          const record = recordByIso[iso];
          const isToday = iso === todayIso;
          const isSelected = selected?.playedOn === iso;
          return (
            <button key={day} disabled={!record} onClick={() => setSelected(record)}
              style={{
                aspectRatio: "1", borderRadius: 9, border: `1px solid ${isSelected ? C.accent : isToday ? C.border : "transparent"}`,
                background: isSelected ? C.accent : record ? C.accentDim : "transparent",
                color: isSelected ? C.bg : record ? C.accent : isToday ? C.text1 : C.text3,
                fontSize: 11, fontWeight: record ? 800 : 500, cursor: record ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
              }}>
              {day}
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ background: C.surface, borderRadius: 12, padding: 12, marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text2, marginBottom: 8 }}>{selected.date.toUpperCase()}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["⚽", line?.goals || 0, t("golos")],
              ["🎯", line?.assists || 0, t("assist.")],
              ["🧤", line?.epicSaves || 0, t("defesas")],
            ].map(([icon, v, label]) => v > 0 && (
              <div key={label} style={{ background: C.card, borderRadius: 10, padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <span>{icon}</span><span style={{ ...displayFont, fontSize: 14 }}>{v}</span><span style={{ color: C.text3 }}>{label}</span>
              </div>
            ))}
            {(line?.cleanSheets || 0) > 0 && (
              <div style={{ background: C.card, borderRadius: 10, padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <Shield size={12} color={C.green} /><span style={{ ...displayFont, fontSize: 14 }}>{line.cleanSheets}</span><span style={{ color: C.text3 }}>{t("clean sheets")}</span>
              </div>
            )}
            {!line && (
              <div style={{ fontSize: 12, color: C.text3 }}>{t("Jogou, sem golos/assistências registados.")}</div>
            )}
            {isMVP && (
              <div style={{ background: C.goldDim, color: C.gold, borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>⭐ {t("MVP do dia")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
