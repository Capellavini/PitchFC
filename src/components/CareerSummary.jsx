import { Flame, Trophy, Target, TrendingUp, CalendarCheck } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import ListRow from "./ListRow";

const iconDisc = (Icon, color) => (
  <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon size={18} color={color} />
  </span>
);

const value = (v) => <span style={{ ...displayFont, fontSize: T.h, color: C.text1, fontVariantNumeric: "tabular-nums" }}>{v}</span>;

/** Perfil → Resumo: career records as rows of ONE card (spec §2:
 *  most goals in a match, longest scoring streak, G+A per game), plus the
 *  cross-group attendance streak / best night when available (own
 *  profile, cloud). `records` comes from careerRecordsFor() in
 *  lib/profileStats; rows without data are simply left out. Renders
 *  nothing when there's nothing real to show. */
export default function CareerSummary({ records, gaPerGame, gamesPlayed = 0, personalRecords, attendanceStreak = 0 }) {
  const rows = [];
  if (records?.bestMatch) {
    rows.push({ id: "bm", icon: iconDisc(Target, C.accent), title: t("Mais golos num jogo"), meta: records.bestMatch.date, v: records.bestMatch.goals });
  }
  if (records?.streak > 0) {
    rows.push({ id: "st", icon: iconDisc(Flame, C.orange), title: t("Maior série a marcar"), meta: t("dias de jogo seguidos com golo"), v: records.streak });
  }
  if (gamesPlayed > 0) {
    rows.push({ id: "ga", icon: iconDisc(TrendingUp, C.green), title: t("G+A por jogo"), meta: `${gamesPlayed} ${gamesPlayed === 1 ? t("jogo") : t("jogos")} ${t("na época")}`, v: gaPerGame });
  }
  const night = personalRecords?.bestNight
    ? { ga: personalRecords.bestNight.goals + personalRecords.bestNight.assists, date: personalRecords.bestNight.date }
    : records?.bestNight;
  if (night?.ga > 0) {
    rows.push({ id: "bn", icon: iconDisc(Trophy, C.gold), title: t("Melhor noite"), meta: `${t("golos + assistências")} · ${night.date}`, v: night.ga });
  }
  if (attendanceStreak >= 2) {
    rows.push({ id: "as", icon: iconDisc(CalendarCheck, C.blue), title: t("Presenças seguidas"), meta: t("jornadas sem falhar"), v: attendanceStreak });
  }
  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: S.lg }}>
      <SectionLabel>{t("RECORDES")}</SectionLabel>
      <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
        {rows.map((r, i) => (
          <ListRow key={r.id} divider={i > 0} leading={r.icon} title={r.title} meta={r.meta} right={value(r.v)} />
        ))}
      </div>
    </div>
  );
}
