import { useState } from "react";
import { CalendarClock, Flame, Trophy, Share2, X } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { usePersistentState } from "../lib/storage";
import SectionLabel from "./SectionLabel";
import PostMatchCardModal from "./PostMatchCard";

/** The app's landing screen — player-first, cross-group: a "just played"
 *  share prompt when there's a fresh performance, next game (whichever
 *  group it's in), a streak/records teaser, and an activity feed of this
 *  player's own recent performances (any group) with Golaço reactions.
 *  Used to live as a sub-tab inside Perfil ("Início"); promoted to its
 *  own top-level tab so the app opens on "you" before it opens on any
 *  one group's screen — see BottomNav/PitchApp. */
export default function HomeTab({ me, group = [], homeFeed = [], nextGame, personalRecords, attendanceStreak = 0, onToggleKudos, recentPerformance, onCardGenerated }) {
  // Once dismissed (or shared), a matchday's banner never comes back —
  // this is the "have I already been shown this?" flag GPT's post-match
  // loop needs, since only the organizer sees "Terminar dia" fire live;
  // everyone else only finds out on their next open of the app, which is
  // exactly when this banner should greet them.
  const [dismissed, setDismissed] = usePersistentState("home_share_dismissed", []);
  const [showCard, setShowCard] = useState(false);
  const showBanner = Boolean(recentPerformance) && !dismissed.includes(recentPerformance.id);
  const dismiss = () => setDismissed((d) => (d.includes(recentPerformance.id) ? d : [...d, recentPerformance.id]));

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>{t("Olá")}{me?.nick ? `, ${me.nick}` : ""}</div>
      </div>

      {showBanner && (
        <div style={{ ...cardStyle, marginBottom: 14, background: `linear-gradient(135deg, ${C.card} 0%, ${C.accentDim} 100%)`, border: `1px solid ${C.accentBorder}`, position: "relative" }}>
          <button onClick={dismiss} title={t("Dispensar")}
            style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex", padding: 2 }}>
            <X size={15} />
          </button>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.accent, marginBottom: 6 }}>{t("ACABASTE DE JOGAR")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, marginBottom: 4 }}>{recentPerformance.groupName} · {recentPerformance.date}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: C.text2 }}>
            {recentPerformance.goals > 0 && <span>⚽ {recentPerformance.goals} {t("golos")}</span>}
            {recentPerformance.assists > 0 && <span>🎯 {recentPerformance.assists} {t("assist.")}</span>}
            {recentPerformance.mvp && <span>⭐ MVP</span>}
            {recentPerformance.isRecord && <span>🏆 {t("novo recorde pessoal")}</span>}
            {attendanceStreak >= 2 && <span>🔥 {attendanceStreak} {t("jornadas seguidas")}</span>}
          </div>
          <button onClick={() => setShowCard(true)} disabled={!recentPerformance.matchdayForCard}
            style={{ width: "100%", background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 800, cursor: recentPerformance.matchdayForCard ? "pointer" : "default", opacity: recentPerformance.matchdayForCard ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Share2 size={15} /> {t("Partilhar o meu desempenho")}
          </button>
        </div>
      )}

      {showCard && recentPerformance?.matchdayForCard && me && (
        <PostMatchCardModal
          player={me} group={group} matchday={recentPerformance.matchdayForCard}
          groupName={recentPerformance.groupName} isMVP={recentPerformance.mvp}
          onClose={() => { setShowCard(false); dismiss(); }}
          onGenerated={onCardGenerated}
        />
      )}

      {nextGame && (
        <div style={{ ...cardStyle, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarClock size={19} color={C.accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", color: C.text3 }}>{t("PRÓXIMO JOGO")}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextGame.groupName}</div>
            <div style={{ fontSize: 11, color: C.text2 }}>{nextGame.dateLabel} · {nextGame.timeLabel}{nextGame.venue ? ` · ${nextGame.venue}` : ""}</div>
          </div>
        </div>
      )}

      {(attendanceStreak >= 2 || personalRecords) && (
        <div style={{ display: "grid", gridTemplateColumns: attendanceStreak >= 2 && personalRecords ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 14 }}>
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

      {homeFeed.length > 0 ? (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <SectionLabel>{t("A TUA ATIVIDADE")}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {homeFeed.map((f) => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.groupName}</div>
                    <div style={{ fontSize: 10.5, color: C.text3 }}>{f.date}</div>
                  </div>
                  <span style={{ fontSize: 11.5, color: C.text2, display: "flex", gap: 8, flexShrink: 0 }}>
                    {f.goals > 0 && <span>⚽ {f.goals}</span>}
                    {f.assists > 0 && <span>🎯 {f.assists}</span>}
                    {f.cleanSheets > 0 && <span>🧤 {f.cleanSheets}</span>}
                    {f.mvp && <span>⭐ MVP</span>}
                  </span>
                </div>
                {onToggleKudos && (
                  <button onClick={() => onToggleKudos(f.id, f.kudosGivenByMe)}
                    style={{ alignSelf: "flex-start", background: f.kudosGivenByMe ? C.accentDim : "transparent", color: f.kudosGivenByMe ? C.accent : C.text2, border: `1px solid ${f.kudosGivenByMe ? C.accentBorder : C.border}`, borderRadius: 10, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                    ⚽ Golaço {f.kudosCount > 0 && f.kudosCount}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : !nextGame && (
        <div style={{ ...cardStyle, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12.5, color: C.text2 }}>{t("Ainda sem jogos por aqui — quando jogares, a tua atividade aparece nesta tela.")}</div>
        </div>
      )}
    </div>
  );
}
