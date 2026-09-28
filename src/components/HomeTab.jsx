import { useState } from "react";
import { CalendarClock, Share2, X } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { usePersistentState } from "../lib/storage";
import SectionLabel from "./SectionLabel";
import PageHeader from "./PageHeader";
import NextActionCard from "./NextActionCard";
import PostMatchCardModal from "./PostMatchCard";

/** Home — "o que está a acontecer?" Cross-group, no group selector.
 *  Priority order (brief §5):
 *   1. next-action cards (confirm / pay / vote MVP), one CTA each —
 *      prepared by PitchApp as `nextActions` (NextActionCard props);
 *   2. the transient post-match recap ("Acabaste de jogar");
 *   3. activity: my own recent performances (Golaço reactions) + the
 *      Grupo | Amigos feed (`activityFeed`, the old Social tab).
 *  Career totals (streak / best night / recent summary) moved to Perfil
 *  — see CareerSummary. */
export default function HomeTab({ me, group = [], homeFeed = [], nextGame, nextActions = [], onToggleKudos, recentPerformance, attendanceStreak = 0, onCardGenerated, activityFeed }) {
  // Once dismissed (or shared), a matchday's banner never comes back —
  // only the organizer sees "Terminar dia" fire live; everyone else only
  // finds out on their next open of the app, which is exactly when this
  // banner should greet them.
  const [dismissed, setDismissed] = usePersistentState("home_share_dismissed", []);
  const [showCard, setShowCard] = useState(false);
  const showBanner = Boolean(recentPerformance) && !dismissed.includes(recentPerformance.id);
  const dismiss = () => setDismissed((d) => (d.includes(recentPerformance.id) ? d : [...d, recentPerformance.id]));

  return (
    <div style={{ padding: "0 16px" }}>
      <PageHeader title={`${t("Olá")}${me?.nick ? `, ${me.nick}` : ""}`} subtitle={t("O que está a acontecer")} />

      {/* 1 — NEXT ACTIONS */}
      {nextActions.map((a) => <NextActionCard key={a.id} {...a} />)}

      {/* No pending action → the next game, quietly. */}
      {nextActions.length === 0 && nextGame && (
        <div style={{ ...cardStyle, marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarClock size={19} color={C.text2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text3 }}>{t("PRÓXIMO JOGO")}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextGame.groupName}</div>
            <div style={{ fontSize: 12, color: C.text2 }}>{nextGame.dateLabel} · {nextGame.timeLabel}{nextGame.venue ? ` · ${nextGame.venue}` : ""}</div>
          </div>
        </div>
      )}

      {/* 2 — POST-MATCH RECAP */}
      {showBanner && (
        <div style={{ ...cardStyle, marginBottom: 12, border: `1px solid ${C.accentBorder}`, position: "relative" }}>
          <button onClick={dismiss} aria-label={t("Dispensar")}
            style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.accent, marginBottom: 6 }}>{t("ACABASTE DE JOGAR")}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 4 }}>{recentPerformance.groupName} · {recentPerformance.date}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 13, color: C.text2 }}>
            {recentPerformance.goals > 0 && <span>⚽ {recentPerformance.goals} {t("golos")}</span>}
            {recentPerformance.assists > 0 && <span>🎯 {recentPerformance.assists} {t("assist.")}</span>}
            {recentPerformance.mvp && <span>⭐ MVP</span>}
            {recentPerformance.isRecord && <span>🏆 {t("novo recorde pessoal")}</span>}
            {attendanceStreak >= 2 && <span>🔥 {attendanceStreak} {t("jornadas seguidas")}</span>}
          </div>
          <button onClick={() => setShowCard(true)} disabled={!recentPerformance.matchdayForCard}
            style={{ width: "100%", minHeight: 44, background: C.accent, color: C.bg, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: recentPerformance.matchdayForCard ? "pointer" : "default", opacity: recentPerformance.matchdayForCard ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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

      {/* 3 — ACTIVITY: my own recent performances… */}
      {homeFeed.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <SectionLabel>{t("A TUA ATIVIDADE")}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {homeFeed.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.groupName}</div>
                  <div style={{ fontSize: 11, color: C.text3, display: "flex", gap: 8 }}>
                    <span>{f.date}</span>
                    {f.goals > 0 && <span>⚽ {f.goals}</span>}
                    {f.assists > 0 && <span>🎯 {f.assists}</span>}
                    {f.cleanSheets > 0 && <span>🧤 {f.cleanSheets}</span>}
                    {f.mvp && <span>⭐ MVP</span>}
                  </div>
                </div>
                {onToggleKudos && (
                  <button onClick={() => onToggleKudos(f.id, f.kudosGivenByMe)}
                    style={{ minHeight: 36, background: f.kudosGivenByMe ? C.accentDim : "transparent", color: f.kudosGivenByMe ? C.accent : C.text2, border: `1px solid ${f.kudosGivenByMe ? C.accentBorder : C.border}`, borderRadius: 10, padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    ⚽ Golaço {f.kudosCount > 0 && f.kudosCount}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* …and the Grupo | Amigos feed (the old Social tab). */}
      {activityFeed}
    </div>
  );
}
