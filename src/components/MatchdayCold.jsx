import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import MatchdayGames from "./MatchdayGames";

const pad = (n) => String(n).padStart(2, "0");

/** Matchday's "cold" state for a regular player — no game today, nothing
 *  live, nothing to answer. Shows the countdown to the next game and the
 *  last matchday's recap. (Organizers never see this: they always get
 *  the full Matchday controls — see PitchApp.) */
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

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <SectionLabel>{t("PRÓXIMO JOGO")}</SectionLabel>
        {diff > 0 ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
              {[[days, t("dias")], [pad(hours), t("horas")], [pad(mins), t("min")]].map(([v, l]) => (
                <div key={l}>
                  <span style={{ ...displayFont, fontSize: 40, color: C.text1 }}>{v}</span>
                  <span style={{ fontSize: 12, color: C.text2, marginLeft: 4 }}>{l}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: C.text2 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {game.date} · {game.time}</span>
              {game.venue && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {game.venue}</span>}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.text2 }}>{t("Ainda não há jogo marcado.")}</div>
        )}
        <div style={{ fontSize: 12, color: C.text3, marginTop: 12 }}>{t("O Matchday acende no dia do jogo: equipas, marcador ao vivo e MVP.")}</div>
      </div>

      {lastMatchday && (lastMatchday.matches ?? []).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>{t("ÚLTIMO MATCHDAY")} · {lastMatchday.date}</SectionLabel>
          <MatchdayGames summary={lastMatchday} />
        </div>
      )}
    </>
  );
}
