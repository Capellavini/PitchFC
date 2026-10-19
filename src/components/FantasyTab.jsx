import { useState, useMemo } from "react";
import { Pencil, X, Search, Check, ArrowRightLeft, Cross, Plus, Users, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall, POSITION_ABBR } from "../lib/helpers";
import { fmtM, squadCostBasis, nextPricesPaid } from "../lib/fantasy";
import { FANTASY_V2, ownershipCap, transferState, seasonStandings } from "../lib/core/fantasyRules";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import Collapsible from "./Collapsible";
import SegmentedControl from "./SegmentedControl";
import FantasyPitch from "./FantasyPitch";
import FantasyBench from "./FantasyBench";
import FantasyPlayerSheet from "./FantasyPlayerSheet";
import FantasyStatsCard from "./FantasyStatsCard";
import FantasyCreateLeague from "./FantasyCreateLeague";
import FantasyLockBar from "./FantasyLockBar";
import FantasyRoundBreakdown from "./FantasyRoundBreakdown";
import FantasyTables from "./FantasyTables";
import FutCard from "./FutCard";

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface, color: C.text1,
  border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 12px", minHeight: TOUCH.min, fontSize: T.body, marginTop: S.xs,
};

const POSITION_ORDER = ["Guarda-redes", "Defesa", "Médio", "Avançado"];
// RSVP for the next game (attendances), read at render time so the
// light/dark theme swap of C is picked up.
const rsvpOf = (p) => (p.status === "confirmed" ? { emoji: "✅", label: "confirmado", color: C.green }
  : p.status === "declined" ? { emoji: "❌", label: "não vai", color: C.red }
    : { emoji: "⏳", label: "pendente", color: C.orange });

/** Pitch Manager v2 (Clássico): a Cartola/FPL-style game on the group's
 *  real matchdays. The DB is the referee — the round locks at kickoff
 *  (lineup snapshot), the server scores it (fantasy_v2_* rules, mirrored
 *  in src/lib/core/fantasyRules.js) and squads are only written through
 *  save_fantasy_squad. Taça do Mês + Campeonato renew by themselves. */
export default function FantasyTab({
  group, me, isOrganizer, kickoffAt, fantasyLeague, fantasySquads = [], fantasyScores = [], fantasyTradeOffers = [],
  fantasyRounds = [], fantasyRoundPlayers = [], fantasySeasons = [], fantasyPrices = {},
  onCreateLeague, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer, onSyncFantasy,
}) {
  if (!fantasyLeague) return <FantasyCreateLeague isOrganizer={isOrganizer} onCreateLeague={onCreateLeague} />;
  return (
    <FantasyLeagueView
      group={group} me={me} isOrganizer={isOrganizer} league={fantasyLeague} kickoffAt={kickoffAt}
      squads={fantasySquads} scores={fantasyScores} offers={fantasyTradeOffers}
      rounds={fantasyRounds} roundPlayers={fantasyRoundPlayers} seasons={fantasySeasons} priceMap={fantasyPrices}
      onSaveSquad={onSaveSquad} onCreateTradeOffer={onCreateTradeOffer}
      onCancelTradeOffer={onCancelTradeOffer} onRespondTradeOffer={onRespondTradeOffer} onSyncFantasy={onSyncFantasy}
    />
  );
}

function FantasyLeagueView({ group, me, isOrganizer, league, kickoffAt, squads, scores, offers, rounds, roundPlayers, seasons, priceMap, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer, onSyncFantasy }) {
  const base = Number(league.scoring_weights?.priceBase) || FANTASY_V2.priceBase;
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const runSync = async () => {
    setSyncing(true);
    const res = await onSyncFantasy();
    setSyncing(false);
    setSyncResult(res?.error ? res.error : (res?.synced ?? 0));
    setTimeout(() => setSyncResult(null), 4000);
  };
  const mySquad = squads.find((s) => s.participant_id === me?.uuid);
  const complete = (mySquad?.player_ids?.length || 0) >= league.squad_size;
  const [selected, setSelected] = useState(mySquad?.player_ids || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState(complete ? "equipa" : "mercado");
  const [sheetId, setSheetId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [sortMode, setSortMode] = useState("pos");
  const [viewingPlayerId, setViewingPlayerId] = useState(null);

  const now = Date.now();
  const priceOf = (id) => Number(priceMap?.[id]?.price ?? base);
  const trendOf = (id) => {
    const p = priceMap?.[id];
    if (!p || p.prev == null) return 0;
    return Math.sign(Number(p.price) - Number(p.prev));
  };
  const scoredRounds = useMemo(
    () => rounds.filter((r) => r.status === "scored").sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at)),
    [rounds]
  );
  const lastRound = scoredRounds[0] || null;
  const inProgress = rounds.some((r) => r.status === "locked" && !r.matchday_id && new Date(r.kickoff_at).getTime() <= now);
  const pointsById = useMemo(() => {
    if (!lastRound) return null;
    return Object.fromEntries(roundPlayers.filter((rp) => rp.round_id === lastRound.id).map((rp) => [rp.player_id, rp.points]));
  }, [roundPlayers, lastRound]);

  const campeonato = seasons.find((s) => s.kind === "season" && s.status === "open");
  const month = seasons.find((s) => s.kind === "month" && s.status === "open");
  // Each real player's raw output this Campeonato (no captaincy).
  const seasonPoints = useMemo(() => {
    const inSeason = new Set(rounds.filter((r) => campeonato && new Date(r.kickoff_at) >= new Date(campeonato.starts_at)
      && new Date(r.kickoff_at) < new Date(campeonato.ends_at) && r.status === "scored").map((r) => r.id));
    const acc = {};
    roundPlayers.forEach((rp) => { if (inSeason.has(rp.round_id)) acc[rp.player_id] = (acc[rp.player_id] || 0) + Number(rp.points || 0); });
    return acc;
  }, [rounds, roundPlayers, campeonato]);

  const ownership = useMemo(() => {
    const counts = {};
    squads.forEach((s) => { if (s.participant_id !== me?.uuid) (s.player_ids || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1; }); });
    return counts;
  }, [squads, me?.uuid]);
  const participants = squads.filter((s) => s.participant_id !== me?.uuid && s.player_ids?.length).length + 1;
  const cap = ownershipCap(participants);
  const ownersOf = (uuid) => squads.filter((s) => s.player_ids?.includes(uuid));

  const squadBank = (squad) => league.budget + Number(squad?.budget_adjustment || 0) - squadCostBasis(squad?.prices_paid);
  const effectiveBudget = league.budget + Number(mySquad?.budget_adjustment || 0);
  const total = squadCostBasis(nextPricesPaid(mySquad?.prices_paid, selected, priceOf));
  const overBudget = total > effectiveBudget;
  const canSave = selected.length >= league.squad_size && !overBudget;
  const editingIds = view === "mercado" ? selected : (mySquad?.player_ids || []);
  const transfers = transferState(mySquad?.locked_player_ids ?? null, editingIds, mySquad?.free_transfers);

  const toggle = (id) => {
    setSaved(false);
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      if (group.find((p) => p.uuid === id)?.injured) return sel;
      if ((ownership[id] || 0) >= cap) return sel;
      return [...sel, id];
    });
  };

  const save = async (extra = {}) => {
    setSaving(true);
    setError(null);
    const prevIds = mySquad?.player_ids || [];
    const ids = extra.playerIds ?? [...prevIds.filter((id) => selected.includes(id)), ...selected.filter((id) => !prevIds.includes(id))];
    const bench = extra.reserveIds ?? (mySquad?.reserve_ids || []).filter((id) => ids.includes(id));
    const res = await onSaveSquad(league.id, ids, extra.captainId !== undefined ? extra.captainId : (mySquad?.captain_id ?? null),
      bench, extra.viceId !== undefined ? extra.viceId : (mySquad?.vice_captain_id ?? null));
    setSaving(false);
    if (!res?.error) {
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      if (ids.length >= league.squad_size && !extra.stay) setView("equipa");
    } else setError(res.error);
    return res;
  };

  const reserves = mySquad?.reserve_ids || [];
  const starters = (mySquad?.player_ids || []).filter((id) => !reserves.includes(id));
  const toBench = (id) => save({ playerIds: mySquad.player_ids, reserveIds: [...reserves, id], stay: true });
  const toStarter = (id) => {
    // Swap with the last starter who isn't captain/vice (keeps the XI size).
    const demote = [...starters].reverse().find((s) => s !== mySquad.captain_id && s !== mySquad.vice_captain_id) || starters[starters.length - 1];
    const next = starters.length >= league.squad_size && demote ? reserves.map((r) => (r === id ? demote : r)) : reserves.filter((r) => r !== id);
    return save({ playerIds: mySquad.player_ids, reserveIds: next, stay: true });
  };
  const moveUp = (id) => {
    const i = reserves.indexOf(id);
    if (i <= 0) return null;
    const next = reserves.slice();
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    return save({ playerIds: mySquad.player_ids, reserveIds: next, stay: true });
  };

  const filteredGroup = group.filter((p) => p.nick.toLowerCase().includes(search.trim().toLowerCase()));
  const byPosition = POSITION_ORDER.map((pos) => ({ pos, players: filteredGroup.filter((p) => p.position === pos) }));
  const byPoints = filteredGroup.slice().sort((a, b) => (seasonPoints[b.uuid] || 0) - (seasonPoints[a.uuid] || 0));

  const campeonatoRows = campeonato ? seasonStandings(scores, rounds, campeonato) : [];
  const myRow = campeonatoRows.find((r) => r.participant_id === me?.uuid) || null;
  const lastRoundScores = lastRound ? scores.filter((s) => s.round_id === lastRound.id).sort((a, b) => b.points - a.points) : [];
  const myLastRound = lastRoundScores.find((s) => s.participant_id === me?.uuid) || null;

  const myOffers = offers.filter((o) => o.from_participant_id === me?.uuid);
  const incomingOffers = offers.filter((o) => o.to_participant_id === me?.uuid);
  const inMarket = view === "mercado";
  const sheetPlayer = sheetId && mySquad ? group.find((p) => p.uuid === sheetId) : null;
  const sheetBenchIndex = sheetPlayer ? reserves.indexOf(sheetPlayer.uuid) : -1;
  const viewOptions = [
    { id: "equipa", label: "A minha equipa" },
    { id: "liga", label: "Liga" },
    { id: "mercado", label: "Mercado", badge: incomingOffers.length > 0 },
  ];
  const posLabel = { fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, margin: `${S.md}px 0 ${S.xs}px` };
  const lockBar = <FantasyLockBar kickoffAt={kickoffAt} inProgress={inProgress} transfers={transfers} now={now} />;

  const renderMarketRow = (p, i) => {
    const picked = selected.includes(p.uuid);
    const count = (ownership[p.uuid] || 0) + (picked ? 1 : 0);
    const atCap = (ownership[p.uuid] || 0) >= cap && !picked;
    const owners = ownersOf(p.uuid).filter((s) => s.participant_id !== me?.uuid);
    const rsvp = rsvpOf(p);
    const trend = trendOf(p.uuid);
    return (
      <div key={p.uuid} style={{
        display: "flex", alignItems: "center", gap: S.sm, minHeight: 56, padding: `${S.sm}px ${S.xs}px ${S.sm}px ${picked ? S.sm : 0}px`,
        borderTop: i > 0 ? `1px solid ${C.border}` : "none", borderLeft: picked ? `3px solid ${C.green}` : "none",
        background: picked ? C.surface : "transparent",
      }}>
        <button type="button" onClick={() => setViewingPlayerId(p.uuid)} aria-label={`${p.nick} — ${t("ver cartão")}`}
          style={{ display: "flex", alignItems: "center", gap: S.sm, flex: 1, minWidth: 0, minHeight: 44, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
          <Avatar name={p.name} color={playerColor(group, p)} size={36} isMe={p.isMe} photo={p.photo} injured={p.injured} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.body + 1, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</div>
            <div style={{ fontSize: T.min, color: C.text2, marginTop: 2, lineHeight: 1.4 }}>
              <span style={{ whiteSpace: "nowrap" }}>
                <span role="img" title={`${t("Próximo jogo")}: ${t(rsvp.label)}`} aria-label={`${t("Próximo jogo")}: ${t(rsvp.label)}`}>{rsvp.emoji}</span>
                {" "}{t(POSITION_ABBR[p.position] || "MED")} · {Math.round(seasonPoints[p.uuid] || 0)} pts
              </span>{" "}
              <span title={t("Managers com este jogador")} style={{ color: atCap ? C.orange : C.text2, whiteSpace: "nowrap" }}>· <Users size={11} style={{ verticalAlign: -1 }} /> {count}/{cap}</span>
            </div>
          </div>
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} title={trend > 0 ? t("Preço a subir") : trend < 0 ? t("Preço a descer") : undefined}>
          <span style={{ ...displayFont, fontSize: T.body - 1, color: C.text1, fontVariantNumeric: "tabular-nums" }}>{fmtM(priceOf(p.uuid))}</span>
          {trend > 0 && <ArrowUp size={12} color={C.green} aria-label={t("Preço a subir")} />}
          {trend < 0 && <ArrowDown size={12} color={C.red} aria-label={t("Preço a descer")} />}
        </span>
        {(p.injured && !picked) ? (
          <Chip variant="red" Icon={Cross}>{t("Lesionado")}</Chip>
        ) : atCap ? (
          <BtnGhost onClick={() => setTradeTarget({ playerId: p.uuid, owners })} disabled={!owners.length}
            aria-label={t("Oferta")} style={{ minHeight: TOUCH.min, minWidth: TOUCH.min, padding: `0 ${S.sm}px`, fontSize: T.meta, flexShrink: 0 }}>
            <ArrowRightLeft size={14} />
          </BtnGhost>
        ) : (
          <button type="button" onClick={() => toggle(p.uuid)} aria-label={picked ? t("Remover") : t("Adicionar")} aria-pressed={picked}
            style={{ width: TOUCH.min, height: TOUCH.min, borderRadius: "50%", flexShrink: 0, background: picked ? C.greenDim : "transparent", color: picked ? C.green : C.text1, border: `1px solid ${picked ? C.greenBorder : C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            {picked ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
          </button>
        )}
      </div>
    );
  };

  const rivalSquad = viewingId ? squads.find((s) => s.participant_id === viewingId) : null;
  const rival = viewingId ? group.find((p) => p.uuid === viewingId) : null;

  return (
    <div style={{ padding: `${S.xs}px ${S.lg}px ${S.xl}px` }}>
      <SectionLabel right={<Chip variant="lime">{t("Clássico")}</Chip>}>{league.name || "Pitch Manager"}</SectionLabel>
      <FantasyStatsCard
        count={inMarket ? selected.length : (mySquad?.player_ids?.length || 0)}
        squadSize={league.squad_size}
        bank={effectiveBudget - (inMarket ? total : squadCostBasis(mySquad?.prices_paid))}
        overBudget={inMarket && overBudget}
        points={myRow ? myRow.points : null} lastRound={myLastRound ? Number(myLastRound.points) : null}
        rank={myRow ? myRow.rank : null} participants={campeonatoRows.length} />
      <SegmentedControl options={viewOptions} value={view} onChange={setView} />

      {/* ── A minha equipa ── */}
      {view === "equipa" && (complete ? (
        <>
          {lockBar}
          {!mySquad.captain_id && (
            <div style={{ ...cardStyle, borderLeft: `3px solid ${C.accent}`, marginBottom: S.md, padding: `${S.md}px ${S.lg}px`, fontSize: T.body - 1, color: C.text1, lineHeight: 1.4 }}>
              {t("Ainda sem capitão — toca num jogador no campo e escolhe «Tornar capitão».")}
            </div>
          )}
          <FantasyPitch group={group} playerIds={mySquad.player_ids} captainId={mySquad.captain_id} viceId={mySquad.vice_captain_id}
            reserveIds={reserves} pointsById={pointsById} onSelect={(p) => setSheetId(p.uuid)} />
          <FantasyBench group={group} reserveIds={reserves} pointsById={pointsById} onSelect={(p) => setSheetId(p.uuid)} />
          {error && <div style={{ fontSize: T.meta, color: C.red, margin: `-${S.md}px 0 ${S.md}px` }}>{error}</div>}
          {myLastRound?.breakdown && <FantasyRoundBreakdown score={myLastRound} group={group} />}
          <BtnGhost block onClick={() => { setSelected(mySquad.player_ids); setView("mercado"); }}>
            <Pencil size={16} /> {t("Editar escalação")}
          </BtnGhost>
        </>
      ) : (
        <div style={{ ...cardStyle }}>
          {lockBar}
          <div style={{ fontSize: T.cardTitle, fontWeight: 700, color: C.text1, marginBottom: S.xs }}>{t("Ainda sem equipa")}</div>
          <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.4, marginBottom: S.lg }}>
            {t("Escolhe")} {league.squad_size} {t("titulares, capitão e vice-capitão. Extras ficam no banco e entram se alguém faltar.")}
          </div>
          <BtnPrimary block onClick={() => setView("mercado")}>{t("Montar equipa")}</BtnPrimary>
        </div>
      ))}

      {/* ── Mercado ── */}
      {inMarket && (
        <>
          {(myOffers.length > 0 || incomingOffers.length > 0) && (
            <div style={{ marginBottom: S.lg }}>
              <Collapsible title={t("Ofertas de troca")} subtitle={`${incomingOffers.length} ${t("recebidas")} · ${myOffers.length} ${t("enviadas")}`}>
                {incomingOffers.length > 0 && (
                  <div style={{ marginBottom: myOffers.length ? S.md : 0 }}>
                    <SectionLabel style={{ marginBottom: S.sm }}>{t("RECEBIDAS")}</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                      {incomingOffers.map((o) => <OfferRow key={o.id} offer={o} group={group} mine={false} onRespond={onRespondTradeOffer} />)}
                    </div>
                  </div>
                )}
                {myOffers.length > 0 && (
                  <div>
                    <SectionLabel style={{ marginBottom: S.sm }}>{t("ENVIADAS")}</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                      {myOffers.map((o) => <OfferRow key={o.id} offer={o} group={group} mine onCancel={onCancelTradeOffer} />)}
                    </div>
                  </div>
                )}
              </Collapsible>
            </div>
          )}

          <div style={{ ...cardStyle, marginBottom: S.xl, padding: `${S.md}px ${S.md}px` }}>
            {lockBar}
            <div style={{ position: "relative", marginBottom: S.sm }}>
              <Search size={16} color={C.text2} style={{ position: "absolute", left: S.md, top: "50%", transform: "translateY(-50%)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Pesquisar por nome…")} aria-label={t("Pesquisar por nome…")}
                style={{ ...inputStyle, marginTop: 0, paddingLeft: S.xxl + 4 }} />
            </div>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
              {[["pos", "Por posição"], ["points", "Por pontuação"]].map(([id, label]) => (
                <Chip key={id} variant={sortMode === id ? "lime" : "neutral"} onClick={() => setSortMode(id)}>{t(label)}</Chip>
              ))}
            </div>
            <div style={{ fontSize: T.min, color: C.text2, marginTop: S.sm }}>
              {t("Próximo jogo")}: ✅ {t("confirmado")} · ⏳ {t("pendente")} · ❌ {t("não vai")}
            </div>
            {overBudget && (
              <div style={{ fontSize: T.meta, color: C.red, fontWeight: 700, padding: `${S.sm}px ${S.md}px`, marginTop: S.sm, border: `1px solid ${C.red}55`, background: C.redDim, borderRadius: R.control }}>
                {t("Falta")} {fmtM(total - effectiveBudget)} — {t("tira alguém ou troca por um mais barato.")}
              </div>
            )}

            {sortMode === "points" ? (
              <>
                <div style={posLabel}>{t("Todos os jogadores")}</div>
                {byPoints.map(renderMarketRow)}
              </>
            ) : byPosition.map(({ pos, players }) => players.length > 0 && (
              <div key={pos}>
                <div style={posLabel}>{t(pos)}</div>
                {players.map(renderMarketRow)}
              </div>
            ))}

            <div style={{ fontSize: T.min, color: C.text2, marginTop: S.md, lineHeight: 1.4 }}>
              {league.squad_size} {t("titulares; os restantes ficam no banco, pela ordem em que os escolheste.")}
            </div>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
              {complete && (
                <BtnGhost onClick={() => { setSelected(mySquad.player_ids); setView("equipa"); }}>{t("Cancelar")}</BtnGhost>
              )}
              <BtnPrimary onClick={() => save()} disabled={!canSave || saving} style={{ flex: 1 }}>
                {saving ? t("Um momento…") : saved ? t("Escalação guardada ✓") : t("Guardar escalação")}
              </BtnPrimary>
            </div>
            {error && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{error}</div>}
          </div>
        </>
      )}

      {/* ── Liga ── */}
      {view === "liga" && (
        <>
          <SectionLabel right={isOrganizer && onSyncFantasy ? (
            <BtnGhost onClick={runSync} disabled={syncing} title={t("Volta a calcular as rondas a partir dos dias de jogo gravados")}
              style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, fontSize: T.meta }}>
              <RefreshCw size={14} /> {syncing ? t("A recalcular…") : syncResult !== null ? (typeof syncResult === "string" ? syncResult : syncResult > 0 ? `✓ ${syncResult} ${t("recuperada(s)")}` : t("Tudo em dia")) : t("Recalcular")}
            </BtnGhost>
          ) : null}>
            {t("Classificação")}
          </SectionLabel>
          <FantasyTables group={group} seasons={seasons} scores={scores} rounds={rounds} squads={squads}
            selectedId={viewingId} onSelect={(pid) => setViewingId((v) => (v === pid ? null : pid))} />

          {rivalSquad && (
            <div style={{ marginBottom: S.lg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.xs }}>
                <div style={{ fontSize: T.cardTitle, fontWeight: 700, color: C.text1 }}>{t("Escalação de")} {rival?.nick || "?"}</div>
                <button type="button" onClick={() => setViewingId(null)} aria-label={t("Fechar")}
                  style={{ width: TOUCH.min, height: TOUCH.min, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><X size={18} /></button>
              </div>
              <FantasyPitch group={group} playerIds={rivalSquad.player_ids} captainId={rivalSquad.captain_id} viceId={rivalSquad.vice_captain_id}
                reserveIds={rivalSquad.reserve_ids} pointsById={pointsById} readOnly />
            </div>
          )}

          {lastRoundScores.length > 0 && (
            <Collapsible title={t("Última ronda")} subtitle={t("Pontos de cada participante")}>
              {lastRoundScores.map((s, i) => {
                const p = group.find((x) => x.uuid === s.participant_id);
                return (
                  <div key={s.id ?? s.participant_id} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 48, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                    <Avatar name={p?.name || "?"} color={p ? playerColor(group, p) : C.text2} size={32} isMe={p?.isMe} photo={p?.photo} injured={p?.injured} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: p?.isMe ? 800 : 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.nick || "?"}</div>
                    {Number(s.transfer_cost || s.breakdown?.transferCost || 0) > 0 && (
                      <span style={{ fontSize: T.min, color: C.orange, fontWeight: 700 }}>−{s.transfer_cost || s.breakdown?.transferCost} {t("transf.")}</span>
                    )}
                    <div style={{ ...displayFont, fontSize: T.cardTitle, color: C.text1 }}>{Math.round(s.points)}</div>
                  </div>
                );
              })}
            </Collapsible>
          )}
          {month && (
            <div style={{ fontSize: T.min, color: C.text2, marginTop: S.md, lineHeight: 1.4 }}>
              {t("A Taça do Mês fecha no fim de cada mês e o Campeonato a 31 de julho — os campeões ficam no Perfil.")}
            </div>
          )}
        </>
      )}

      {tradeTarget && (
        <TradeOfferPanel
          group={group} mySquad={mySquad} priceOf={priceOf} myBank={squadBank(mySquad)}
          target={tradeTarget} onClose={() => setTradeTarget(null)}
          onSubmit={async (payload) => {
            const res = await onCreateTradeOffer(league.id, payload.toParticipantId, tradeTarget.playerId, payload.givePlayerId, payload.offerType, payload.offerCash);
            if (!res?.error) setTradeTarget(null);
            return res;
          }}
        />
      )}

      {sheetPlayer && (
        <FantasyPlayerSheet
          p={sheetPlayer} group={group} captain={sheetPlayer.uuid === mySquad.captain_id} vice={sheetPlayer.uuid === mySquad.vice_captain_id}
          bench={sheetBenchIndex >= 0} benchIndex={sheetBenchIndex}
          pts={pointsById ? (pointsById[sheetPlayer.uuid] ?? null) : null}
          onCaptain={() => save({ playerIds: mySquad.player_ids, captainId: sheetPlayer.uuid,
            viceId: mySquad.vice_captain_id === sheetPlayer.uuid ? mySquad.captain_id : undefined, stay: true })}
          onVice={() => save({ playerIds: mySquad.player_ids, viceId: sheetPlayer.uuid, stay: true })}
          onToggleBench={() => (sheetBenchIndex >= 0 ? toStarter(sheetPlayer.uuid) : toBench(sheetPlayer.uuid))}
          onMoveUp={() => moveUp(sheetPlayer.uuid)}
          onClose={() => setSheetId(null)}
        />
      )}

      {viewingPlayerId && (() => {
        const p = group.find((x) => x.uuid === viewingPlayerId);
        if (!p) return null;
        return (
          <PlayerCardModal player={p} price={priceOf(p.uuid)} points={seasonPoints[p.uuid]}
            ownership={ownership[p.uuid] || 0} cap={cap} onClose={() => setViewingPlayerId(null)} />
        );
      })()}
    </div>
  );
}

/** Tapping a player in the market shows their FUT card plus season totals
 *  and this Campeonato's fantasy output. */
function PlayerCardModal({ player, price, points, ownership, cap, onClose }) {
  const stats = [
    ["⚽", t("Golos"), player.goals || 0],
    ["🎯", t("Assistências"), player.assists || 0],
    ["⭐", t("MVPs"), player.mvps || 0],
    ["🧤", t("Jogos"), player.gamesPlayed || 0],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 320, width: "100%" }}>
        <button type="button" onClick={onClose} aria-label={t("Fechar")} style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, width: TOUCH.min, height: TOUCH.min, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}>
          <X size={16} color={C.text2} />
        </button>
        <FutCard player={player} width={260} ratingsCount={player.ratingsCount} />
        <div style={{ ...cardStyle, width: "100%", marginTop: 12, boxSizing: "border-box" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            {stats.map(([emoji, label, value]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ ...displayFont, fontSize: 16, color: C.text1 }}>{emoji} {value}</div>
                <div style={{ fontSize: T.min, fontWeight: 700, color: C.text2, marginTop: 2 }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: C.border, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[[fmtM(price), t("PREÇO")], [Math.round(points || 0), t("PTS NA ÉPOCA")], [`${ownership}/${cap}`, t("DONOS")]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ ...displayFont, fontSize: 15, color: C.text1 }}>{v}</div>
                <div style={{ fontSize: T.min, fontWeight: 700, color: C.text2, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Propose a trade for `target.playerId`, owned by other participants.
 *  The server (accept_fantasy_trade) re-derives both squads on accept. */
function TradeOfferPanel({ group, mySquad, priceOf, target, myBank, onClose, onSubmit }) {
  const [toParticipantId, setToParticipantId] = useState(target.owners[0]?.participant_id || "");
  const [givePlayerId, setGivePlayerId] = useState(mySquad?.player_ids?.[0] || "");
  const [offerType, setOfferType] = useState("swap");
  const [offerCash, setOfferCash] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const targetPlayer = group.find((p) => p.uuid === target.playerId);
  const mine = (mySquad?.player_ids || []).map((id) => group.find((p) => p.uuid === id)).filter(Boolean);
  const netCost = (priceOf(target.playerId) - priceOf(givePlayerId)) + (offerType === "cash" ? Number(offerCash) || 0 : 0);
  const overBank = netCost > myBank;

  const submit = async () => {
    if (overBank) { setError(t("Não tens banco suficiente para esta oferta.")); return; }
    setSending(true);
    setError(null);
    const res = await onSubmit({ toParticipantId, givePlayerId, offerType, offerCash: Math.max(0, Number(offerCash) || 0) });
    setSending(false);
    if (res?.error) setError(res.error);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...cardStyle, width: "100%", maxWidth: 380, border: `1px solid ${C.orange}55` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>{t("Oferta por")} {targetPlayer?.nick}</div>
          <button type="button" onClick={onClose} aria-label={t("Fechar")} style={{ width: TOUCH.min, height: TOUCH.min, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><X size={18} /></button>
        </div>
        <label style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{t("A quem fazer a oferta")}</label>
        <select value={toParticipantId} onChange={(e) => setToParticipantId(e.target.value)} style={inputStyle}>
          {target.owners.map((s) => {
            const owner = group.find((p) => p.uuid === s.participant_id);
            return <option key={s.participant_id} value={s.participant_id}>{owner?.nick || "?"}</option>;
          })}
        </select>
        <label style={{ fontSize: 11, color: C.text2, fontWeight: 700, marginTop: 10, display: "block" }}>{t("Jogador teu que libertas para abrir espaço")}</label>
        <select value={givePlayerId} onChange={(e) => setGivePlayerId(e.target.value)} style={inputStyle}>
          {mine.map((p) => <option key={p.uuid} value={p.uuid}>{p.nick} ({fmtM(priceOf(p.uuid))})</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: offerType === "cash" ? 10 : 0 }}>
          {[["swap", "Troca direta"], ["cash", "Dinheiro"]].map(([id, label]) => {
            const active = offerType === id;
            return (
              <button key={id} type="button" onClick={() => setOfferType(id)}
                style={{ flex: 1, minHeight: TOUCH.min, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 10, padding: "8px 6px", fontSize: 12, fontWeight: active ? 800 : 500, cursor: "pointer" }}>
                {t(label)}
              </button>
            );
          })}
        </div>
        {offerType === "cash" && (
          <>
            <label style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{t("Valor da oferta")}</label>
            <input type="number" min={0} value={offerCash} onChange={(e) => setOfferCash(e.target.value)} style={inputStyle} />
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, marginTop: 12 }}>
          <span>{t("O teu banco")}</span><span style={{ fontWeight: 700, color: C.text1 }}>{fmtM(myBank)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, marginTop: 4 }}>
          <span>{t("Custo desta troca")}</span><span style={{ fontWeight: 700, color: overBank ? C.red : C.text1 }}>{fmtM(netCost)}</span>
        </div>
        <div style={{ fontSize: T.min, color: C.text2, marginTop: S.sm, lineHeight: 1.4 }}>{t("Uma troca aceite conta como transferência na próxima ronda.")}</div>
        <BtnPrimary onClick={submit} disabled={sending || !toParticipantId || !givePlayerId || overBank} style={{ width: "100%", marginTop: 10, opacity: (sending || overBank) ? 0.6 : 1 }}>
          {sending ? t("Um momento…") : overBank ? t("Banco insuficiente") : t("Enviar oferta")}
        </BtnPrimary>
        {error && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}

function OfferRow({ offer, group, mine, onCancel, onRespond }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const counterpart = group.find((p) => p.uuid === (mine ? offer.to_participant_id : offer.from_participant_id));
  const target = group.find((p) => p.uuid === offer.target_player_id);
  const give = group.find((p) => p.uuid === offer.give_player_id);
  const act = async (fn) => { setBusy(true); setError(null); const res = await fn(); setBusy(false); if (res?.error) setError(res.error); };
  return (
    <div style={{ background: C.surface, borderRadius: R.control, padding: S.md }}>
      <div style={{ fontSize: T.body - 1, lineHeight: 1.4, marginBottom: S.sm }}>
        {mine ? (
          <>
            <div>{t("A tua oferta a")} {counterpart?.nick}: <strong>{give?.nick}</strong>{offer.offer_type === "cash" ? ` + ${fmtM(offer.offer_cash)}` : ""}</div>
            <div style={{ color: C.text2 }}>{t("Em troca de:")} <strong>{target?.nick}</strong></div>
          </>
        ) : (
          <>
            <div><strong>{counterpart?.nick}</strong> {t("quer trocar contigo")}</div>
            <div style={{ color: C.text2 }}>{t("Recebes:")} <strong>{offer.offer_type === "cash" ? fmtM(offer.offer_cash) : give?.nick}</strong> — {t("dás:")} <strong>{target?.nick}</strong></div>
          </>
        )}
      </div>
      {mine ? (
        <BtnGhost onClick={() => act(() => onCancel(offer.id))} disabled={busy} style={{ minHeight: TOUCH.min, fontSize: T.meta }}>{t("Cancelar oferta")}</BtnGhost>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <BtnPrimary onClick={() => act(() => onRespond(offer, true))} disabled={busy} style={{ flex: 1, minHeight: TOUCH.min }}><Check size={16} /> {t("Aceitar")}</BtnPrimary>
          <BtnGhost onClick={() => act(() => onRespond(offer, false))} disabled={busy} style={{ flex: 1, minHeight: TOUCH.min }}>{t("Recusar")}</BtnGhost>
        </div>
      )}
      {error && <div style={{ fontSize: T.min, color: C.red, marginTop: S.xs }}>{error}</div>}
    </div>
  );
}
