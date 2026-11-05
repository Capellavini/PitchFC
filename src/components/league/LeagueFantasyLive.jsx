import { useMemo } from "react";
import { C, S, T } from "./visual/theme";
import { t } from "../../lib/i18n";
import "../../lib/leagueFantasyCopy";
import { fantasyErrorText } from "../../lib/fantasyCopy";
import { pmErrorText } from "../../lib/leaguePitchManagerApi";
import { PLAYERS, TEAMS, LEAGUE, COMPETITION } from "../../lib/leagueDemo";
import { buildLeagueFantasyLive, LEAGUE_FANTASY } from "../../lib/leagueFantasy";
import { normalizeSquad, connectionRow } from "../../lib/fantasyDemo";
import { useLeaguePitchManager } from "../../hooks/useLeaguePitchManager";
import FantasyTab from "../FantasyTab";
import BtnPrimary from "./visual/BtnPrimary";

const note = { color: C.text2, fontSize: T.body, textAlign: "center", padding: `${S.xxl}px ${S.lg}px` };

/** Pitch Manager of a REAL league: squads live on the server (one per account), each round is locked there at its
 *  first kick-off, and the points are the engine's over those locked lineups (lib/leagueFantasy.js). Same screen
 *  as the group app and the demo — only the data source changes.
 *  workspaceId null → the Gestor's own league; a member passes the league they belong to. */
export default function LeagueFantasyLive({ ctx, workspaceId = null }) {
  const { state, acc, derived, role } = ctx;
  const pm = useLeaguePitchManager({ workspaceId });
  // Who this manager is called in the table: an athlete by name, a captain by team, the Gestor as such.
  const label = useMemo(() => {
    if (role === "manager") return t("Gestor");
    if (acc.playerId) return PLAYERS.find((p) => p.id === acc.playerId)?.name || t("Atleta");
    if (acc.teamId) return `${t("Capitão")} · ${TEAMS.find((x) => x.id === acc.teamId)?.short || ""}`.trim();
    return t("Gestor");
  }, [role, acc.playerId, acc.teamId]);

  const built = useMemo(() => (pm.board && pm.phase === "ready"
    ? buildLeagueFantasyLive({ board: pm.board, state, label, players: PLAYERS, teams: TEAMS, stats: derived.stats, competitionId: COMPETITION.id })
    : null), [pm.board, pm.phase, state, label, derived.stats]);

  if (pm.phase === "loading") return <div role="status" style={note}>{t("A abrir o Pitch Manager…")}</div>;
  if (pm.phase === "off") return <div role="status" style={note}>{t(pmErrorText("module_off"))}</div>;
  if (pm.phase === "error" || !built) {
    return (
      <div role="alert" style={note}>
        <p style={{ margin: `0 0 ${S.md}px` }}>{t("Não conseguimos abrir o Pitch Manager. Verifica a ligação e tenta outra vez.")}</p>
        <BtnPrimary onClick={pm.reload}>{t("Tentar outra vez")}</BtnPrimary>
      </div>
    );
  }

  const { demo, participants, rounds } = built;
  // The server locks at the FIRST kick-off of a round, so "next" is the first round that hasn't kicked off yet.
  const now = Date.now();
  const next = rounds.find((r) => new Date(r.kickoffAt).getTime() > now);
  const unavailable = async () => ({ error: t("Ainda não disponível nas ligas.") });

  // Lineup + Conexão in ONE write (undefined keeps the saved pair, null removes it), like the group app.
  const onSaveSquad = async (_leagueId, playerIds, captainId, reserveIds, viceId, connection) => {
    const squad = normalizeSquad({ playerIds, reserveIds, captainId, viceId }, LEAGUE_FANTASY.squadSize);
    const row = connection === undefined ? undefined : connectionRow(connection);
    const ok = demo.validate(squad, row);
    if (typeof ok === "string") return { error: fantasyErrorText(ok) };
    const res = await pm.save({ ...squad, prices_paid: ok.prices_paid, connection: row === undefined ? (pm.board?.mine?.connection ?? null) : row }, label);
    return res.error ? { error: t(pmErrorText(res.error)) } : {};
  };
  // "Ver registo do jogo" → the league's own match page (the event ids are the league's).
  const onOpenRecord = ({ matchdayId, game } = {}) => {
    const matchId = rounds.find((r) => r.id === matchdayId)?.matchIds[(game ?? 1) - 1];
    if (matchId) ctx.open({ kind: "match", id: matchId });
  };

  return (
    <FantasyTab
      group={demo.group} participants={participants} me={demo.me} isOrganizer={false} kickoffAt={next?.kickoffAt ?? null}
      groupName={LEAGUE.name} embedded rsvp={false}
      fantasyLeague={demo.fantasyLeague} fantasySquads={demo.fantasySquads} fantasyScores={demo.fantasyScores} fantasyTradeOffers={[]}
      fantasyRounds={demo.fantasyRounds} fantasyRoundPlayers={demo.fantasyRoundPlayers} fantasySeasons={demo.fantasySeasons} fantasyPrices={demo.fantasyPrices}
      onCreateLeague={unavailable} onCreateTradeOffer={unavailable} onCancelTradeOffer={unavailable} onRespondTradeOffer={unavailable} onSyncFantasy={null}
      onSaveSquad={onSaveSquad} onOpenRecord={onOpenRecord} />
  );
}
