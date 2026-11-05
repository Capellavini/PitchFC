import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { C, R, S, T, cardStyle } from "./visual/theme";
import { t } from "../../lib/i18n";
import "../../lib/leagueFantasyCopy";
import { fantasyErrorText } from "../../lib/fantasyCopy";
import { PLAYERS, TEAMS, LEAGUE, COMPETITION, currentRound } from "../../lib/leagueDemo";
import { buildLeagueFantasy } from "../../lib/leagueFantasy";
import { normalizeSquad, connectionRow } from "../../lib/fantasyDemo";
import FantasyTab from "../FantasyTab";

/** Pitch Manager of the league: the SAME game and engine as the group app
 *  (FantasyTab + core/fantasyRules.js), fed with this league's athletes and
 *  homologated rounds (lib/leagueFantasy.js). Managers are accounts, so the
 *  roster of the Fantasy is the league's athletes and the table is the managers.
 *  Demo: squads live in this browser only (state.fantasyV2). */
export default function LeagueFantasy({ ctx }) {
  const { state, acc, act, derived } = ctx;
  // The registry (PLAYERS, TEAMS, COMPETITION) mirrors the league last installed; `state` changes whenever it does.
  const built = useMemo(() => buildLeagueFantasy({ state, accountId: acc.accountId, label: t(acc.label), players: PLAYERS, teams: TEAMS, stats: derived.stats, competitionId: COMPETITION.id }),
    [state, derived.stats, acc.accountId, acc.label]); // eslint-disable-line react-hooks/exhaustive-deps
  const { seed, rounds, athletes, mySquad, demo, participants } = built;

  const next = rounds.find((r) => r.round === currentRound(state.matches));
  const unavailable = async () => ({ error: t("Indisponível na demonstração.") });
  // Same contract as the group demo: lineup + Conexão in ONE write (undefined keeps the pair, null removes it).
  const onSaveSquad = async (_leagueId, playerIds, captainId, reserveIds, viceId, connection) => {
    const squad = normalizeSquad({ playerIds, reserveIds, captainId, viceId }, seed.squadSize);
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

  if (athletes.length <= seed.squadSize) {
    return <div style={{ ...cardStyle, fontSize: T.body - 1, color: C.text2, lineHeight: 1.45 }}>{t("O Pitch Manager precisa de mais atletas inscritos na liga para poderes montar uma equipa.")}</div>;
  }
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
