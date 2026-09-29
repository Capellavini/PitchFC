import { useEffect, useState } from "react";
import { Clock, MapPin, Users, Radio, Star } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import Chip from "./Chip";
import SectionLabel from "./SectionLabel";
import StatTile from "./StatTile";
import MatchdayGames from "./MatchdayGames";

const pad = (n) => String(n).padStart(2, "0");

/** Matchday's "cold" state for a regular player — no game today, nothing
 *  live, nothing to answer. An intentional resting screen: countdown to
 *  the next game, what lights up on the day, and the last matchday's
 *  recap. (Organizers/assistants never land here — they always get the
 *  full Matchday controls, see PitchApp's matchdayCold.) */
export default function MatchdayCold({ game, lastMatchday }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const kickoff = game?.kickoffAt instanceof Date ? game.kickoffAt.getTime() : null;
  const diff = kickoff && !game.noGameScheduled ? kickoff - now : null;
  const days = diff > 0 ? Math.floor(diff / 86400000) : 0;
  const hours = diff > 0 ? Math.floor((diff % 86400000) / 3600000) : 0;
  const mins = diff > 0 ? Math.floor((diff % 3600000) / 60000) : 0;

  const lightsUp = [
    [Users, t("Equipas sorteadas e confirmadas")],
    [Radio, t("Marcador ao vivo, golo a golo")],
    [Star, t("Votação MVP no fim")],
  ];

  return (
    <>
      <section style={{ marginBottom: S.xl }}>
        <SectionLabel>{t("Próximo jogo")}</SectionLabel>
        <div style={{ ...cardStyle }}>
          {diff > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: S.sm, marginBottom: S.md }}>
                <StatTile value={days} label={t("dias")} size="lg" />
                <StatTile value={pad(hours)} label={t("horas")} size="lg" />
                <StatTile value={pad(mins)} label={t("min")} size="lg" />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, justifyContent: "center" }}>
                <Chip Icon={Clock}>{game.date} · {game.time}</Chip>
                {game.venue && <Chip Icon={MapPin}>{game.venue}</Chip>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda não há jogo marcado.")}</div>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: S.lg, paddingTop: S.md }}>
            <div style={{ fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>{t("O Matchday acende no dia do jogo:")}</div>
            {lightsUp.map(([Icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 32, fontSize: T.body, color: C.text1 }}>
                <Icon size={16} color={C.text2} style={{ flexShrink: 0 }} /> {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {lastMatchday && (lastMatchday.matches ?? []).length > 0 && (
        <section style={{ marginBottom: S.xl }}>
          <SectionLabel>{t("Último Matchday")} · {lastMatchday.date}</SectionLabel>
          <MatchdayGames summary={lastMatchday} framed />
        </section>
      )}
    </>
  );
}
