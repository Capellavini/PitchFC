import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { C, R, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import "../../lib/leagueFantasyCopy";
import { fantasyErrorText } from "../../lib/fantasyCopy";
import { PLAYERS, TEAMS, LEAGUE, LEAGUE_FANTASY, currentRound } from "../../lib/leagueDemo";
import { leagueRounds, fantasyAthletes } from "../../lib/leagueFantasy";
import { buildDemoFantasy, normalizeSquad, connectionRow } from "../../lib/fantasyDemo";
import FantasyTab from "../FantasyTab";

/** Pitch Manager of the league: the SAME game and engine as the group app
 *  (FantasyTab + core/fantasyRules.js), fed with this league's athletes and
 *  homologated rounds (lib/leagueFantasy.js). Managers are accounts, so the
 *  roster of the Fantasy is the league's athletes and the table is the managers.
 *  Demo: squads live in this browser only (state.fantasyV2). */
export default function LeagueFantasy({ ctx }) {
  const { state, acc, act, derived } = ctx;
  const rounds = useMemo(() => leagueRounds({ matches: state.matches, logs: state.logs, players: PLAYERS, teams: TEAMS }), [state.matches, state.logs]);
  const athletes = useMemo(() => fantasyAthletes(PLAYERS, TEAMS, derived.stats), [derived.stats]);
  const me = useMemo(() => ({ uuid: acc.accountId, name: t(acc.label), nick: t(acc.label), isMe: true, photo: null }), [acc.accountId, acc.label]);
  const mySquad = state.fantasyV2?.[acc.accountId] || LEAGUE_FANTASY.mySquad;

  const demo = useMemo(() => buildDemoFantasy({
    group: athletes, meParticipant: me,
    localDays: rounds.filter((r) => r.official).map((r) => ({ id: r.id, playedOn: r.playedOn, kickoffAt: r.kickoffAt, summary: r.summary, mvpKey: null })),
    mySquad, lockedSquad: LEAGUE_FANTASY.mySquad,
    rivals: LEAGUE_FANTASY.managers.map((m) => ({ participant: m.uuid, player_ids: m.player_ids, captain_id: m.captain_id })),
    budget: LEAGUE_FANTASY.budget, squadSize: LEAGUE_FANTASY.squadSize, startsWeeksAgo: LEAGUE_FANTASY.startsWeeksAgo,
    connectionConfig: LEAGUE_FANTASY.connection,
  }), [athletes, me, rounds, mySquad]);
  const participants = useMemo(() => [me, ...LEAGUE_FANTASY.managers.map((m) => ({ uuid: m.uuid, name: m.name, nick: m.nick, photo: null }))], [me]);

  const next = rounds.find((r) => r.round === currentRound(state.matches));
  const unavailable = async () => ({ error: t("Indisponível na demonstração.") });
  // Same contract as the group demo: lineup + Conexão in ONE write (undefined keeps the pair, null removes it).
  const onSaveSquad = async (_leagueId, playerIds, captainId, reserveIds, viceId, connection) => {
    const squad = normalizeSquad({ playerIds, reserveIds, captainId, viceId }, LEAGUE_FANTASY.squadSize);
    const row = connection === undefined ? undefined : connectionRow(connection);
    const ok = demo.validate(squad, row);
    if (typeof ok === "string") return { error: fantasyErrorText(ok) };
    const res = act.setFantasySquad({ ...mySquad, ...squad, prices_paid: ok.prices_paid, ...(row === undefined ? {} : { connection: row }) });
    return res?.ok === false ? { error: t("Não foi possível guardar. Tenta outra vez.") } : {};
  };
  // "Ver registo do jogo" → the league's own match page (the event ids are the league's).
  const onOpenRecord = ({ matchdayId, game } = {}) => {
    const matchId = rounds.find((r) => r.id === matchdayId)?.matchIds[(game ?? 1) - 1];
    if (matchId) ctx.open({ kind: "match", id: matchId });
  };

  return (
    <div>
      <div role="note" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", border: `1px dashed ${C.orange}88`, background: C.orangeDim, borderRadius: R.control, padding: S.md, marginBottom: S.lg }}>
        <FlaskConical size={18} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: T.meta, lineHeight: 1.55, color: C.text1 }}>
          <b>{t("Pitch Manager · demonstração")}.</b>{" "}
          {t("O mesmo jogo e as mesmas regras dos grupos, com os atletas desta liga. Só pontuam rondas com todos os jogos homologados; corrigir uma súmula recalcula os pontos. Sem dinheiro nem prémios.")}
        </div>
      </div>
      <FantasyTab
        group={demo.group} participants={participants} me={demo.me} isOrganizer={false} kickoffAt={next?.kickoffAt ?? null}
        groupName={LEAGUE.name} embedded rsvp={false}
        fantasyLeague={demo.fantasyLeague} fantasySquads={demo.fantasySquads} fantasyScores={demo.fantasyScores} fantasyTradeOffers={[]}
        fantasyRounds={demo.fantasyRounds} fantasyRoundPlayers={demo.fantasyRoundPlayers} fantasySeasons={demo.fantasySeasons} fantasyPrices={demo.fantasyPrices}
        onCreateLeague={unavailable} onCreateTradeOffer={unavailable} onCancelTradeOffer={unavailable} onRespondTradeOffer={unavailable} onSyncFantasy={null}
        onSaveSquad={onSaveSquad} onOpenRecord={onOpenRecord} />
    </div>
  );
}
