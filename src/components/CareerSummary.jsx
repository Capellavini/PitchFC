import { Flame, Trophy } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";

/** Cross-group career block — streak, best night and the recent totals.
 *  Moved verbatim from Home to Perfil (PITCH ID) in the 5-tab IA: Home
 *  is "what's happening", Perfil is "who am I as a player". Renders
 *  nothing when there's no data (local demo has no cross-group feed). */
export default function CareerSummary({ personalRecords, attendanceStreak = 0 }) {
  if (!personalRecords && attendanceStreak < 2) return null;
  return (
    <>
      {(attendanceStreak >= 2 || personalRecords) && (
        <div style={{ display: "grid", gridTemplateColumns: attendanceStreak >= 2 && personalRecords ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 14 }}>
          {attendanceStreak >= 2 && (
            <div style={{ ...cardStyle, textAlign: "center" }}>
              <Flame size={18} color={C.orange} style={{ marginBottom: 6 }} />
              <div style={{ ...displayFont, fontSize: 22 }}>{attendanceStreak}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>{t("jornadas seguidas")}</div>
            </div>
          )}
          {personalRecords && (
            <div style={{ ...cardStyle, textAlign: "center" }}>
              <Trophy size={18} color={C.gold} style={{ marginBottom: 6 }} />
              <div style={{ ...displayFont, fontSize: 22 }}>{personalRecords.bestNight.goals + personalRecords.bestNight.assists}</div>
              <div style={{ fontSize: 10, color: C.text2, marginTop: 2 }}>{t("G+A na melhor noite")} · {personalRecords.bestNight.date}</div>
            </div>
          )}
        </div>
      )}

      {personalRecords && (
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <SectionLabel>{t("RESUMO RECENTE")}</SectionLabel>
          <div style={{ fontSize: 10, color: C.text3, marginBottom: 10 }}>{t("Baseado nas últimas jornadas carregadas, não a época inteira.")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[
              [t("Jornadas"), personalRecords.gamesInWindow],
              [t("Golos"), personalRecords.totalGoals],
              [t("Assist."), personalRecords.totalAssists],
              ["MVPs", personalRecords.mvps],
            ].map(([label, value]) => (
              <div key={label} style={{ background: C.surface, borderRadius: 10, padding: "10px 4px", textAlign: "center" }}>
                <div style={{ ...displayFont, fontSize: 17 }}>{value}</div>
                <div style={{ fontSize: 9, color: C.text2, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
