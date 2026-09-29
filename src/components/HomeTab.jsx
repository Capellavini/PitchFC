import { useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Radio, ClipboardList } from "lucide-react";
import { S } from "../theme";
import { t } from "../lib/i18n";
import { fmtDayMonth } from "../lib/helpers";
import { usePersistentState } from "../lib/storage";
import { normalizeMatchdays, buildFeed, recentMatchday, goalOfTheWeekRanking } from "../lib/homeFeed";
import PageHeader from "./PageHeader";
import Chip from "./Chip";
import NextActionCard from "./NextActionCard";
import LastResultCard from "./LastResultCard";
import ActivityFeed from "./ActivityFeed";
import PostMatchCardModal from "./PostMatchCard";
import WorkoutCardModal from "./WorkoutCardModal";

/**
 * Home — "o que está a acontecer?" (docs/REDESIGN-SPEC.md §2). No group
 * selector. Top to bottom:
 *  1. ONE next-action card, the most urgent of: live matchday → confirm
 *     → pay → vote MVP → result pending. Mini slot grid when it's about
 *     the next game; one lime CTA. No action → the next game, quietly.
 *  2. Last result recap if a matchday was played in the last 7 days.
 *  3. A single chronological activity feed (my groups + friends): auto
 *     football items first-class, manual posts allowed, ⚽ Golaço.
 * Career/profile totals live in Perfil, not here.
 *
 * Data props (all prepared by PitchApp, cloud or local demo):
 *  - nextActions   NextActionCard props in priority order (confirm, pay, mvp).
 *  - slots         { taken, spots, groupName, myStatus } for the active game.
 *  - nextGame      { groupName, dateLabel, timeLabel, venue } or null.
 *  - liveMatchday / resultPending  booleans for the Matchday actions.
 *  - onOpenCompetir  opens Competir from the Golo da Semana leader item.
 *  - feedMatchdays cloud matchday rows (with groupName) | null in demo.
 *  - localHistory  { lastMatchday, history, mvpKey, groupName } | null in cloud.
 *  - social, postTs, myGroupIds, friendsEnabled — feed posts + friends.
 *  - peerRatings   cloud peer_ratings rows (LENDA feed item timing) | null.
 *  - kudos (cloud matchday_kudos rows) + onToggleKudos(mdId, toKey, given);
 *    without onToggleKudos (demo) Golaço is kept locally.
 */
export default function HomeTab({
  me, group = [], myKey, nextGame, nextActions = [], slots,
  liveMatchday, resultPending, onOpenJogar, onOpenMatchday, onOpenCompetir,
  feedMatchdays, localHistory, social, postTs, myGroupIds = [], friendsEnabled,
  kudos, onToggleKudos, attendanceStreak = 0, onCardGenerated, groupName, lastMatchdayForWorkout, peerRatings,
}) {
  const [showCard, setShowCard] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [localKudos, setLocalKudos] = usePersistentState("home_kudos", {});

  // ── 1. The single most urgent action ──
  const gameExtras = slots ? { slots, onOpen: onOpenJogar, openLabel: t("Ver jogo") } : { onOpen: onOpenJogar, openLabel: t("Ver jogo") };
  const liveAction = liveMatchday ? {
    id: "live", Icon: Radio, eyebrow: t("AO VIVO"),
    title: slots?.groupName || nextGame?.groupName || t("Dia de jogo"),
    subtitle: t("O dia de jogo está a decorrer"),
    primaryLabel: t("Abrir Matchday"), onPrimary: onOpenMatchday,
  } : null;
  const resultAction = resultPending ? {
    id: "result", Icon: ClipboardList, eyebrow: t("RESULTADO EM FALTA"),
    title: t("Regista o resultado de hoje"),
    subtitle: slots?.groupName,
    primaryLabel: t("Abrir Matchday"), onPrimary: onOpenMatchday,
  } : null;
  const primary = [
    liveAction,
    ...nextActions.map((a) => (a.id === "confirm" || a.id === "pay" ? { ...a, ...gameExtras } : a)),
    resultAction,
  ].filter(Boolean)[0];

  // ── 2 + 3. Matchdays → recap + feed ──
  const matchdays = useMemo(
    () => normalizeMatchdays({ cloudRows: feedMatchdays, local: localHistory, fmt: fmtDayMonth }),
    [feedMatchdays, localHistory],
  );
  const recent = recentMatchday(matchdays);
  // Current Golo da Semana leader (needs ≥1 Golaço) → its own feed item.
  const gotwLeader = goalOfTheWeekRanking(social, postTs)[0];
  const gotwLeaderId = gotwLeader && (gotwLeader.likes?.length || 0) > 0 ? gotwLeader.id : null;
  // LENDA placement: latest peer rating per player (cloud peer_ratings rows).
  const ratingTs = useMemo(() => (peerRatings || []).reduce((m, r) => {
    const ms = Date.parse(r.created_at) || 0;
    if (ms > (m[r.player_id] || 0)) m[r.player_id] = ms;
    return m;
  }, {}), [peerRatings]);
  const items = useMemo(() => buildFeed({
    matchdays, posts: social?.posts || [], postTs, myKey, meId: social?.meId,
    friendIds: social?.friendIds || [], myGroupIds, streak: attendanceStreak, gotwLeaderId,
    players: group, activeGroupName: groupName, ratingTs,
  }), [matchdays, social, postTs, myKey, myGroupIds, attendanceStreak, gotwLeaderId, group, groupName, ratingTs]);

  // Full name for Avatar initials (2 letters, like everywhere else) —
  // older saved summary lines only carry the nick.
  const nameOf = (line) => line.name || group.find((p) => (p.uuid ?? p.id) === line.key)?.name || line.nick;

  // Golaço on auto items (performance, achievement, legend): cloud = the
  // matchday_kudos row for (matchday, player) — the same row that night's
  // performance card uses; demo = kept locally per item.
  const kudosFor = (item) => {
    if (onToggleKudos) {
      if (!item.md || !item.line) return { count: 0, mine: false };
      const rows = (kudos || []).filter((k) => k.matchday_id === item.md.id && k.to_player_id === item.line.key);
      return { count: rows.length, mine: rows.some((k) => k.from_player_id === myKey) };
    }
    const mine = Boolean(localKudos[item.id]);
    return { count: mine ? 1 : 0, mine };
  };
  const onGolaco = (item) => {
    if (onToggleKudos) return item.md && item.line ? onToggleKudos(item.md.id, item.line.key, kudosFor(item).mine) : undefined;
    setLocalKudos((m) => ({ ...m, [item.id]: !m[item.id] }));
  };

  const myStatusChip = slots?.myStatus === "confirmed" ? <Chip variant="green">{t("Estás dentro")}</Chip>
    : slots?.myStatus === "declined" ? <Chip variant="red">{t("Não vais")}</Chip> : null;
  const nextIsActive = nextGame && slots && nextGame.groupName === slots.groupName;

  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      <PageHeader title={`${t("Olá")}${me?.nick ? `, ${me.nick}` : ""}`} subtitle={t("O que está a acontecer")} />

      {/* 1 — NEXT ACTION (exactly one card) */}
      {primary ? (
        <NextActionCard {...primary} />
      ) : nextGame ? (
        <NextActionCard neutral Icon={CalendarClock}
          eyebrow={t("PRÓXIMO JOGO")} status={nextIsActive ? myStatusChip : null}
          title={nextGame.groupName}
          subtitle={`${nextGame.dateLabel} · ${nextGame.timeLabel}${nextGame.venue ? ` · ${nextGame.venue}` : ""}`}
          slots={nextIsActive ? slots : null}
          primaryLabel={t("Ver jogo")} onPrimary={onOpenJogar} />
      ) : (
        <NextActionCard neutral Icon={CalendarPlus}
          eyebrow={t("SEM JOGO MARCADO")}
          title={t("Nada agendado por agora")}
          subtitle={t("Quando houver jogo num dos teus grupos, aparece aqui.")}
          primaryLabel={t("Ir para Jogar")} onPrimary={onOpenJogar} />
      )}

      {/* 2 — LAST RESULT (last 7 days) */}
      {recent && (
        <LastResultCard md={recent} myKey={myKey}
          onShare={me && (recent.summary?.lines || []).some((l) => l.key === myKey) ? () => setShowCard(true) : undefined} />
      )}

      {/* 3 — SINGLE ACTIVITY FEED */}
      <ActivityFeed items={items} social={social} me={me}
        kudosFor={kudosFor} onGolaco={onGolaco}
        friendsEnabled={friendsEnabled}
        onWorkout={me && social ? () => setShowWorkout(true) : undefined}
        onOpenGotw={onOpenCompetir} onOpenCompetir={onOpenCompetir} nameOf={nameOf} />

      {showCard && recent && me && (
        <PostMatchCardModal
          player={me} group={group}
          matchday={{ date: recent.dateLabel, mode: recent.mode, ...(recent.summary || {}) }}
          groupName={recent.groupName} isMVP={recent.mvpKey != null && recent.mvpKey === myKey}
          onClose={() => setShowCard(false)}
          onGenerated={onCardGenerated}
        />
      )}
      {showWorkout && (
        <WorkoutCardModal me={me} groupName={groupName} lastMatchday={lastMatchdayForWorkout} social={social}
          onClose={() => setShowWorkout(false)} onGenerated={onCardGenerated} />
      )}
    </div>
  );
}
