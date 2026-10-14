import { useEffect, useMemo, useState } from "react";
import { Shield, Swords } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC, RC, tf } from "../lib/rivalsCopy";
import { isLeader } from "../lib/rivals";
import { inboxBuckets } from "../lib/rivalsChallenges";
import ChallengeCard from "./ChallengeCard";
import ChallengeDetail from "./ChallengeDetail";
import ChallengeComposer from "./ChallengeComposer";
import MatchDetail from "./MatchDetail";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

const TABS = [
  { id: "received", label: CC.received, empty: CC.emptyReceived },
  { id: "sent", label: CC.sent, empty: CC.emptySent },
  { id: "history", label: CC.history, empty: CC.emptyHistory },
];

/**
 * Competir → Desafios (PITCH Rivals). Chips Recebidos · Enviados ·
 * Histórico (counts; a dot when something needs me), one ChallengeCard
 * per challenge (action-needed first), and pushed screens for a challenge
 * (ChallengeDetail) and its shared match (MatchDetail). "Desafiar equipa"
 * opens the composer (directed or a claimable link). `focus` =
 * { challengeId, match?, n } — deep links (?desafio, after sending) open
 * one directly. `onGoToTeam` → Equipa segment (no team yet).
 */
export default function ChallengesInbox({ teams, focus, onGoToTeam }) {
  const [tab, setTab] = useState("received");
  const [openId, setOpenId] = useState(null);
  const [matchId, setMatchId] = useState(null); // challenge id whose match is open
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (!focus?.challengeId) return;
    setOpenId(focus.challengeId);
    setMatchId(focus.match ? focus.challengeId : null);
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const buckets = useMemo(() => inboxBuckets(teams.challenges), [teams.challenges]);
  const canChallenge = teams.myTeams.some((tm) => isLeader(tm.role));

  if (matchId) return <MatchDetail teams={teams} challengeId={matchId} onBack={() => setMatchId(null)} />;
  if (openId) {
    return <ChallengeDetail teams={teams} challengeId={openId} onBack={() => setOpenId(null)} onOpenMatch={(id) => setMatchId(id)} />;
  }

  if (!teams.myTeams.length) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px` }}>
        <Shield size={28} color={C.text2} aria-hidden style={{ marginBottom: S.md }} />
        <div style={{ fontSize: T.body, color: C.text1, fontWeight: 700, lineHeight: 1.5, marginBottom: S.lg }}>{t(CC.noTeamForChallenges)}</div>
        {onGoToTeam && <BtnPrimary block onClick={onGoToTeam}>{t(RC.createTeam)}</BtnPrimary>}
      </div>
    );
  }

  const items = buckets[tab];
  const current = TABS.find((x) => x.id === tab);
  const needs = (id) => buckets[id].filter((x) => x.view.needsAction).length;

  return (
    <div>
      {canChallenge && (
        <BtnPrimary block onClick={() => setComposing(true)} style={{ marginBottom: S.lg }}><Swords size={18} aria-hidden /> {t(CC.newChallenge)}</BtnPrimary>
      )}

      <div role="tablist" aria-label={t(RC.segChallenges)} style={{ display: "flex", gap: 6, marginBottom: S.lg, flexWrap: "wrap" }}>
        {TABS.map((x) => {
          const on = x.id === tab;
          const n = buckets[x.id].length;
          const dot = needs(x.id) > 0;
          return (
            <button key={x.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(x.id)}
              aria-label={`${t(x.label)} · ${n}${dot ? ` · ${tf(CC.needsYou, { n: needs(x.id) })}` : ""}`}
              style={{
                minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer",
                background: on ? C.accent : "transparent", color: on ? C.bg : C.text2, border: `1px solid ${on ? C.accent : C.border}`,
                fontSize: T.meta + 1, fontWeight: on ? 800 : 600, display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              {t(x.label)}{n ? ` · ${n}` : ""}
              {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: on ? C.bg : C.orange }} />}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-live="polite" aria-busy={teams.loading}>
        {teams.loading && !items.length ? (
          <div style={{ fontSize: T.body, color: C.text2 }}>{t(CC.loadingChallenges)}</div>
        ) : items.length ? (
          items.map((item) => <ChallengeCard key={item.ch.id} item={item} onOpen={() => (item.ch.match && ["confirm_field", "review_change"].includes(item.view.nextAction) ? setMatchId(item.ch.id) : setOpenId(item.ch.id))} />)
        ) : (
          <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px` }}>
            <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5 }}>{t(current.empty)}</div>
            {tab !== "history" && canChallenge && (
              <BtnGhost tone="accent" onClick={() => setComposing(true)} style={{ marginTop: S.md }}><Swords size={16} aria-hidden /> {t(CC.newChallenge)}</BtnGhost>
            )}
          </div>
        )}
      </div>

      {composing && (
        <ChallengeComposer teams={teams} mode="new" onClose={() => setComposing(false)}
          onDone={(d) => { setComposing(false); setTab("sent"); if (d?.challengeId) setOpenId(d.challengeId); }} />
      )}
    </div>
  );
}
