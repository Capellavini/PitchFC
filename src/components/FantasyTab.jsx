import { useState, useMemo } from "react";
import { Pencil, X, Search, Check, ArrowRightLeft, Cross, Plus, Lock, ChevronDown, Users } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { fantasyPrice, computeRoundPoints, DEFAULT_FANTASY_WEIGHTS, OWNERSHIP_CAP, fmtM, squadCostBasis, nextPricesPaid } from "../lib/fantasy";
import { t } from "../lib/i18n";
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
import FutCard from "./FutCard";

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface, color: C.text1,
  border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 12px", minHeight: TOUCH.min, fontSize: T.body, marginTop: S.xs,
};

const POSITION_ORDER = ["Guarda-redes", "Defesa", "Médio", "Avançado"];

// A league runs from starts_at for duration_months (min 1) — after that
// it's read-only (final leaderboard) until the organizer starts the next one.
const leagueEndsAt = (league) => {
  const d = new Date(league.starts_at || league.created_at);
  d.setMonth(d.getMonth() + Math.max(1, league.duration_months || 1));
  return d;
};

/** Admin-only beta: Pitch Manager — a Cartola/FPL-style fantasy game on
 *  top of the group's real matchdays. Players are owned exclusively —
 *  at most OWNERSHIP_CAP participants can hold the same real player;
 *  past that, the only way in is proposing a trade to a current owner.
 *  Each league runs for a fixed duration (organizer-set, min 1 month);
 *  squads are editable until 8h before the next kickoff. */
export default function FantasyTab({ group, me, isOrganizer, kickoffAt, fantasyLeague, fantasySquads, fantasyScores, fantasyTradeOffers, matchdays, onCreateLeague, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer, onSyncFantasy }) {
  if (!fantasyLeague) {
    return <CreateLeague isOrganizer={isOrganizer} onCreateLeague={onCreateLeague} />;
  }
  const ended = Date.now() > leagueEndsAt(fantasyLeague).getTime();
  return (
    <>
      <FantasyLeagueView
        group={group} me={me} isOrganizer={isOrganizer} league={fantasyLeague} ended={ended} kickoffAt={kickoffAt}
        squads={fantasySquads} scores={fantasyScores} offers={fantasyTradeOffers} matchdays={matchdays}
        onSaveSquad={onSaveSquad} onCreateTradeOffer={onCreateTradeOffer}
        onCancelTradeOffer={onCancelTradeOffer} onRespondTradeOffer={onRespondTradeOffer}
        onSyncFantasy={onSyncFantasy}
      />
      {ended && (
        <CreateLeague isOrganizer={isOrganizer} onCreateLeague={onCreateLeague} nextSeason />
      )}
    </>
  );
}

function CreateLeague({ isOrganizer, onCreateLeague, nextSeason }) {
  const [form, setForm] = useState({ name: "Pitch Manager", budget: 120, squadSize: 6, durationMonths: 1 });
  const [creating, setCreating] = useState(false);
  const startPrice = DEFAULT_FANTASY_WEIGHTS.priceBase;
  const affordable = Math.floor((Number(form.budget) || 0) / startPrice);

  if (!isOrganizer) {
    return nextSeason ? null : (
      <div style={{ padding: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: C.text2 }}>{t("Ainda não há Pitch Manager neste grupo.")}</div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setCreating(true);
    await onCreateLeague({
      name: form.name.trim() || "Pitch Manager",
      budget: Number(form.budget) || 120,
      squadSize: Number(form.squadSize) || 5,
      durationMonths: Math.max(1, Number(form.durationMonths) || 1),
    });
    setCreating(false);
  };

  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>{nextSeason ? t("PRÓXIMA TEMPORADA") : "PITCH MANAGER"}</SectionLabel>
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("Criar Pitch Manager")}</div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 16 }}>
          {t("Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.")}
        </div>
        <label style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{t("Nome da liga")}</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{t("Orçamento")}</label>
            <input type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: C.text2, fontWeight: 700 }}>{t("Jogadores por escalação")}</label>
            <input type="number" value={form.squadSize} onChange={(e) => setForm((f) => ({ ...f, squadSize: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <label style={{ fontSize: 11, color: C.text2, fontWeight: 700, marginTop: 10, display: "block" }}>{t("Duração (meses, mín. 1)")}</label>
        <input type="number" min={1} value={form.durationMonths} onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.value }))} style={inputStyle} />
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: 10 }}>
          {t("Todos começam a")} {fmtM(startPrice)}. {t("Com este orçamento dá para")} {affordable} {t("jogadores de início.")}
        </div>
        <BtnPrimary onClick={submit} disabled={creating} style={{ width: "100%", marginTop: 16, opacity: creating ? 0.6 : 1 }}>
          {creating ? t("Um momento…") : t("Criar Pitch Manager")}
        </BtnPrimary>
      </div>
    </div>
  );
}

function FantasyLeagueView({ group, me, isOrganizer, league, ended, kickoffAt, squads, scores, offers, matchdays, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer, onSyncFantasy }) {
  const weights = league.scoring_weights || DEFAULT_FANTASY_WEIGHTS;
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // number synced, or null before first click
  const runSync = async () => {
    setSyncing(true);
    const res = await onSyncFantasy();
    setSyncing(false);
    setSyncResult(res?.synced ?? 0);
    setTimeout(() => setSyncResult(null), 4000);
  };
  const mySquad = squads.find((s) => s.participant_id === me?.uuid);
  // squad_size is the minimum, not a hard cap — managers can buy extra
  // depth once the bank allows it; anyone beyond the minimum just needs
  // to be benched (reserveIds) since only non-reserves score.
  const complete = (mySquad?.player_ids?.length || 0) >= league.squad_size;
  const [selected, setSelected] = useState(mySquad?.player_ids || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  // Sub-views: A minha equipa (pitch) · Liga (table) · Mercado (squad
  // editor + trades). An incomplete squad opens straight on Mercado.
  const [view, setView] = useState(complete ? "equipa" : "mercado");
  const [sheetId, setSheetId] = useState(null); // player whose captain/bench sheet is open
  const [viewingId, setViewingId] = useState(null);
  const [tradeTarget, setTradeTarget] = useState(null); // { playerId, ownerSquad }
  const [sortMode, setSortMode] = useState("pos"); // 'pos' | 'points' — "todos os jogadores por pontuação"
  const [viewingPlayerId, setViewingPlayerId] = useState(null); // player card modal in the market list

  const lockAt = kickoffAt ? new Date(new Date(kickoffAt).getTime() - 8 * 3600 * 1000) : null;
  const locked = ended || (lockAt && Date.now() > lockAt.getTime());

  // Prices reset to the base price when a league starts and only move
  // with performance in rounds played *since* — not lifetime season stats.
  const roundsSinceStart = useMemo(
    () => matchdays.filter((md) => new Date(md.created_at) >= new Date(league.starts_at || league.created_at)),
    [matchdays, league.starts_at, league.created_at]
  );
  // The pitch view's live "+N" badges must only reflect a round played
  // since THIS league started — matchdays[0] alone ignores league.starts_at
  // and would show points from a game played before the league existed
  // (e.g. a fresh league right after a matchday, before any round locks).
  const lastRoundLines = roundsSinceStart[0]?.summary?.lines || null;
  const prices = useMemo(
    () => Object.fromEntries(group.map((p) => [p.uuid, fantasyPrice(p.uuid, roundsSinceStart, weights)])),
    [group, roundsSinceStart, weights]
  );
  // Raw fantasy points each real player has produced across rounds played
  // since the league started (no captain bonus — this is the player's own
  // output, not any one participant's squad), so anyone can compare who's
  // worth buying/trading for regardless of who currently owns them.
  const totalPoints = useMemo(
    () => Object.fromEntries(group.map((p) => [
      p.uuid, roundsSinceStart.reduce((sum, md) => sum + computeRoundPoints([p.uuid], null, md.summary?.lines, weights), 0),
    ])),
    [group, roundsSinceStart, weights]
  );
  // Ownership: how many participants currently hold each real player.
  const ownership = useMemo(() => {
    const counts = {};
    squads.forEach((s) => (s.player_ids || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
    return counts;
  }, [squads]);
  const ownersOf = (uuid) => squads.filter((s) => s.player_ids?.includes(uuid));
  // A squad's real spending power isn't just league.budget — completed
  // trades move cash in/out via budget_adjustment (see useCloud.js
  // respondTradeOffer). Bank uses each player's actual cost basis
  // (prices_paid), never their live market price — otherwise a squad
  // that simply plays well would see its own bank drift negative with
  // no purchase ever made (see fantasy_bank_fix migration).
  const squadBank = (squad) => league.budget + (squad?.budget_adjustment || 0) - squadCostBasis(squad?.prices_paid);
  const effectiveBudget = league.budget + (mySquad?.budget_adjustment || 0);

  // Same rule as the bank itself: players you already own are charged
  // what you actually paid, not today's live price — only genuinely new
  // picks in `selected` cost today's price. Mirrors exactly what
  // useCloud.js's saveFantasySquad will persist, so this preview can't
  // drift from what happens on save.
  const total = squadCostBasis(nextPricesPaid(mySquad?.prices_paid, selected, (id) => prices[id] || 0));
  const overBudget = total > effectiveBudget;
  const canSave = !locked && selected.length >= league.squad_size && !overBudget;

  const toggle = (id) => {
    if (locked) return;
    setSaved(false);
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      // No hard cap on squad size anymore — extra buys beyond
      // league.squad_size just sit on the bench (reserveIds), bounded
      // only by budget and the per-player ownership cap.
      if (group.find((p) => p.uuid === id)?.injured) return sel; // injured — can't be escalated
      const count = ownership[id] || 0;
      if (count >= OWNERSHIP_CAP) return sel; // full — trade instead
      return [...sel, id];
    });
  };

  const save = async (extra = {}) => {
    setSaving(true);
    setError(null);
    const res = await onSaveSquad(league.id, extra.playerIds ?? selected, extra.captainId ?? mySquad?.captain_id ?? null, extra.reserveIds ?? mySquad?.reserve_ids ?? []);
    setSaving(false);
    if (!res?.error) {
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      if ((extra.playerIds ?? selected).length >= league.squad_size) setView("equipa");
    } else setError(res.error);
    return res;
  };

  const toggleReserve = (id) => {
    const current = mySquad?.reserve_ids || [];
    save({ reserveIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
  };

  const filteredGroup = group.filter((p) => p.nick.toLowerCase().includes(search.trim().toLowerCase()));
  const byPosition = POSITION_ORDER.map((pos) => ({ pos, players: filteredGroup.filter((p) => p.position === pos) }));
  const byPoints = filteredGroup.slice().sort((a, b) => (totalPoints[b.uuid] || 0) - (totalPoints[a.uuid] || 0));

  // Leaderboard: sum every locked round's points per participant.
  const leaderboard = useMemo(() => {
    const byParticipant = {};
    scores.forEach((s) => {
      const row = byParticipant[s.participant_id] || { points: 0, rounds: 0 };
      row.points += Number(s.points) || 0;
      row.rounds += 1;
      byParticipant[s.participant_id] = row;
    });
    return Object.entries(byParticipant)
      .map(([pid, v]) => ({ pid, ...v, player: group.find((p) => p.uuid === pid) }))
      .sort((a, b) => b.points - a.points);
  }, [scores, group]);

  const lastMatchdayId = matchdays[0]?.id;
  const lastRoundScores = scores
    .filter((s) => s.matchday_id === lastMatchdayId)
    .sort((a, b) => b.points - a.points);

  const myOffers = offers.filter((o) => o.from_participant_id === me?.uuid);
  const incomingOffers = offers.filter((o) => o.to_participant_id === me?.uuid);

  const inMarket = view === "mercado";
  const myRankIdx = leaderboard.findIndex((r) => r.pid === me?.uuid);
  const myRow = myRankIdx >= 0 ? leaderboard[myRankIdx] : null;
  const myLastRound = lastRoundScores.find((s) => s.participant_id === me?.uuid);
  const sheetPlayer = sheetId && mySquad ? group.find((p) => p.uuid === sheetId) : null;
  const sheetBench = sheetPlayer ? (mySquad.reserve_ids || []).includes(sheetPlayer.uuid) : false;
  const viewOptions = [
    { id: "equipa", label: "A minha equipa" },
    { id: "liga", label: "Liga" },
    { id: "mercado", label: "Mercado", badge: incomingOffers.length > 0 },
  ];
  const lockedNotice = locked && (
    <div style={{ fontSize: T.meta, color: C.text1, lineHeight: 1.4, padding: `${S.sm}px ${S.md}px`, marginBottom: S.md, borderLeft: `3px solid ${C.orange}`, background: C.orangeDim, borderRadius: R.control }}>
      {ended ? t("Liga terminada — consulta a classificação final abaixo.") : t("Escalação trancada — falta menos de 8h para o jogo.")}
    </div>
  );
  const posLabel = { fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, margin: `${S.md}px 0 ${S.xs}px` };

  const renderMarketRow = (p, i) => {
    const picked = selected.includes(p.uuid);
    const count = ownership[p.uuid] || 0;
    const atCap = count >= OWNERSHIP_CAP && !picked;
    const owners = ownersOf(p.uuid).filter((s) => s.participant_id !== me?.uuid);
    return (
      <div key={p.uuid} style={{
        display: "flex", alignItems: "center", gap: S.md, minHeight: 56, padding: `${S.sm}px ${S.sm}px ${S.sm}px ${picked ? S.sm : 0}px`,
        borderTop: i > 0 ? `1px solid ${C.border}` : "none", borderLeft: picked ? `3px solid ${C.green}` : "none",
        background: picked ? C.surface : "transparent", opacity: locked ? 0.6 : 1,
      }}>
        <button type="button" onClick={() => setViewingPlayerId(p.uuid)} aria-label={`${p.nick} — ${t("ver cartão")}`}
          style={{ display: "flex", alignItems: "center", gap: S.md, flex: 1, minWidth: 0, minHeight: 44, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
          <Avatar name={p.name} color={playerColor(group, p)} size={40} isMe={p.isMe} photo={p.photo} injured={p.injured} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.body + 1, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sortMode === "points" ? `${t(p.position)} · ` : ""}OVR {computeOverall(p.position, p.attrs)} · {Math.round(totalPoints[p.uuid] || 0)} pts · <span title={t("Managers com este jogador")} style={{ color: atCap ? C.orange : C.text2, whiteSpace: "nowrap" }}><Users size={12} style={{ verticalAlign: -1 }} /> {count}/{OWNERSHIP_CAP}</span>
            </div>
          </div>
        </button>
        <span style={{ ...displayFont, fontSize: T.body, color: C.text1, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtM(prices[p.uuid])}</span>
        {locked ? null : (p.injured && !picked) ? (
          <Chip variant="red" Icon={Cross}>{t("Lesionado")}</Chip>
        ) : atCap ? (
          <BtnGhost onClick={() => setTradeTarget({ playerId: p.uuid, owners })} disabled={!owners.length}
            style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, fontSize: T.meta, flexShrink: 0 }}>
            <ArrowRightLeft size={14} /> {t("Oferta")}
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

  return (
    <div style={{ padding: `${S.xs}px ${S.lg}px ${S.xl}px` }}>
      <SectionLabel right={ended ? <Chip>{t("Terminada")}</Chip> : locked ? <Chip variant="orange" Icon={Lock}>{t("Trancada")}</Chip> : null}>
        {league.name || "Pitch Manager"}
      </SectionLabel>
      <FantasyStatsCard
        count={inMarket ? selected.length : (mySquad?.player_ids?.length || 0)}
        squadSize={league.squad_size}
        bank={effectiveBudget - (inMarket ? total : squadCostBasis(mySquad?.prices_paid))}
        overBudget={inMarket && overBudget}
        points={myRow ? myRow.points : null} lastRound={myLastRound ? myLastRound.points : null}
        rank={myRow ? myRankIdx + 1 : null} participants={leaderboard.length} />
      <SegmentedControl options={viewOptions} value={view} onChange={setView} />

      {/* ── A minha equipa ── */}
      {view === "equipa" && (complete ? (
        <>
          {lockedNotice}
          {!mySquad.captain_id && !locked && (
            <div style={{ ...cardStyle, borderLeft: `3px solid ${C.accent}`, marginBottom: S.md, padding: `${S.md}px ${S.lg}px`, fontSize: T.body - 1, color: C.text1, lineHeight: 1.4 }}>
              {t("Ainda sem capitão — toca num jogador no campo e escolhe «Tornar capitão».")}
            </div>
          )}
          <FantasyPitch
            group={group} playerIds={mySquad.player_ids} captainId={mySquad.captain_id} reserveIds={mySquad.reserve_ids}
            weights={weights} lastRoundLines={lastRoundLines} readOnly={locked} onSelect={(p) => setSheetId(p.uuid)}
          />
          <FantasyBench
            group={group} reserveIds={mySquad.reserve_ids} captainId={mySquad.captain_id} weights={weights} lastRoundLines={lastRoundLines}
            readOnly={locked} onSelect={(p) => setSheetId(p.uuid)}
          />
          {!locked && (
            <BtnGhost block onClick={() => setView("mercado")}>
              <Pencil size={16} /> {t("Editar escalação")}
            </BtnGhost>
          )}
        </>
      ) : (
        <div style={{ ...cardStyle }}>
          {lockedNotice}
          <div style={{ fontSize: T.cardTitle, fontWeight: 700, color: C.text1, marginBottom: S.xs }}>{t("Ainda sem equipa")}</div>
          <div style={{ fontSize: T.body - 1, color: C.text2, lineHeight: 1.4, marginBottom: locked ? 0 : S.lg }}>
            {t("Escolhe")} {league.squad_size} {t("colegas e define o capitão (pontos em dobro).")}
          </div>
          {!locked && <BtnPrimary block onClick={() => setView("mercado")}>{t("Montar equipa")}</BtnPrimary>}
        </div>
      ))}

      {/* ── Mercado (squad editor + trades) ── */}
      {inMarket && (
        <>
          {(myOffers.length > 0 || incomingOffers.length > 0) && (
            <div style={{ marginBottom: S.lg }}>
              <Collapsible title={t("Ofertas de troca")} subtitle={`${incomingOffers.length} ${t("recebidas")} · ${myOffers.length} ${t("enviadas")}`}>
                {incomingOffers.length > 0 && (
                  <div style={{ marginBottom: myOffers.length ? S.md : 0 }}>
                    <SectionLabel style={{ marginBottom: S.sm }}>{t("RECEBIDAS")}</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                      {incomingOffers.map((o) => (
                        <OfferRow key={o.id} offer={o} group={group} mine={false} onRespond={onRespondTradeOffer} />
                      ))}
                    </div>
                  </div>
                )}
                {myOffers.length > 0 && (
                  <div>
                    <SectionLabel style={{ marginBottom: S.sm }}>{t("ENVIADAS")}</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                      {myOffers.map((o) => (
                        <OfferRow key={o.id} offer={o} group={group} mine onCancel={onCancelTradeOffer} />
                      ))}
                    </div>
                  </div>
                )}
              </Collapsible>
            </div>
          )}

          <div style={{ ...cardStyle, marginBottom: S.xl }}>
            {lockedNotice}
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

            {!locked && overBudget && (
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

            <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
              {complete && (
                <BtnGhost onClick={() => { setSelected(mySquad.player_ids); setView("equipa"); }}>{t("Cancelar")}</BtnGhost>
              )}
              {!locked && (
                <BtnPrimary onClick={() => save()} disabled={!canSave || saving} style={{ flex: 1 }}>
                  {saving ? t("Um momento…") : saved ? t("Escalação guardada ✓") : t("Guardar escalação")}
                </BtnPrimary>
              )}
            </div>
            {error && <div style={{ fontSize: T.meta, color: C.red, marginTop: S.sm }}>{error}</div>}
          </div>
        </>
      )}

      {/* ── Liga ── */}
      {view === "liga" && (
        <>
          <SectionLabel right={isOrganizer && onSyncFantasy ? (
            <BtnGhost onClick={runSync} disabled={syncing} title={t("Recupera jornadas em que as stats gravaram mas a pontuação Fantasy falhou")}
              style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, fontSize: T.meta }}>
              {syncing ? t("A sincronizar…") : syncResult !== null ? (syncResult > 0 ? `✓ ${syncResult} ${t("recuperada(s)")}` : t("Tudo em dia")) : t("Sincronizar")}
            </BtnGhost>
          ) : null}>
            {t("Classificação")}
          </SectionLabel>
          <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: S.lg }}>
            {leaderboard.length === 0 && <div style={{ padding: S.lg, fontSize: T.body - 1, color: C.text2 }}>{t("Ainda sem jornadas fechadas.")}</div>}
            {leaderboard.map((row, i) => {
              const rivalSquad = squads.find((s) => s.participant_id === row.pid && s.player_ids?.length);
              const isMe = row.player?.isMe;
              const open = viewingId === row.pid;
              const rank = i + 1;
              const top3 = rank <= 3 && row.points > 0;
              const Tag = rivalSquad ? "button" : "div";
              return (
                <Tag key={row.pid} type={rivalSquad ? "button" : undefined} aria-expanded={rivalSquad ? open : undefined}
                  onClick={rivalSquad ? () => setViewingId((v) => (v === row.pid ? null : row.pid)) : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: S.md, width: "100%", minHeight: 56, boxSizing: "border-box",
                    padding: `${S.sm}px ${S.lg}px`, border: "none", borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                    background: isMe || open ? C.surface : "transparent", boxShadow: isMe ? `inset 3px 0 0 ${C.accent}` : "none",
                    color: "inherit", font: "inherit", textAlign: "left", cursor: rivalSquad ? "pointer" : "default",
                  }}>
                  <span style={{ ...displayFont, width: 24, textAlign: "center", fontSize: top3 ? T.h - 2 : T.body, color: top3 ? [C.gold, C.silver, C.bronze][rank - 1] : C.text2 }}>{rank}</span>
                  <Avatar name={row.player?.name || "?"} color={row.player ? playerColor(group, row.player) : C.text2} size={top3 ? 40 : 34} isMe={isMe} photo={row.player?.photo} injured={row.player?.injured} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: T.body + 1, fontWeight: top3 || isMe ? 800 : 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.player?.nick || "?"}{isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("· tu")}</span>}
                    </div>
                    <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{row.rounds} {t("jornadas")}</div>
                  </div>
                  <span style={{ ...displayFont, fontSize: top3 ? T.h + 2 : T.h - 2, color: top3 || isMe ? C.text1 : C.text2, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{Math.round(row.points)}</span>
                  {rivalSquad && <ChevronDown size={18} color={C.text2} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
                </Tag>
              );
            })}
          </div>

          {viewingId && (() => {
            const rivalSquad = squads.find((s) => s.participant_id === viewingId);
            const rival = group.find((p) => p.uuid === viewingId);
            if (!rivalSquad) return null;
            return (
              <div style={{ marginBottom: S.lg }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.xs }}>
                  <div style={{ fontSize: T.cardTitle, fontWeight: 700, color: C.text1 }}>{t("Escalação de")} {rival?.nick || "?"}</div>
                  <button type="button" onClick={() => setViewingId(null)} aria-label={t("Fechar")}
                    style={{ width: TOUCH.min, height: TOUCH.min, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><X size={18} /></button>
                </div>
                <FantasyPitch
                  group={group} playerIds={rivalSquad.player_ids} captainId={rivalSquad.captain_id} reserveIds={rivalSquad.reserve_ids}
                  weights={weights} lastRoundLines={lastRoundLines} readOnly
                />
              </div>
            );
          })()}

          {lastRoundScores.length > 0 && (
            <Collapsible title={t("Última jornada")} subtitle={t("Pontos de cada participante")}>
              {lastRoundScores.map((s, i) => {
                const p = group.find((x) => x.uuid === s.participant_id);
                return (
                  <div key={s.id ?? s.participant_id} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 48, borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                    <Avatar name={p?.name || "?"} color={p ? playerColor(group, p) : C.text2} size={32} isMe={p?.isMe} photo={p?.photo} injured={p?.injured} />
                    <div style={{ flex: 1, fontSize: T.body, fontWeight: p?.isMe ? 800 : 600, color: C.text1 }}>{p?.nick || "?"}</div>
                    <div style={{ ...displayFont, fontSize: T.cardTitle, color: C.text1 }}>{Math.round(s.points)}</div>
                  </div>
                );
              })}
            </Collapsible>
          )}
        </>
      )}

      {tradeTarget && (
        <TradeOfferPanel
          group={group} me={me} mySquad={mySquad} league={league} prices={prices} myBank={squadBank(mySquad)}
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
          p={sheetPlayer} group={group} captain={sheetPlayer.uuid === mySquad.captain_id} bench={sheetBench}
          pts={lastRoundLines ? computeRoundPoints([sheetPlayer.uuid], mySquad.captain_id, lastRoundLines, weights, mySquad.reserve_ids) : null}
          onCaptain={() => save({ captainId: sheetPlayer.uuid })}
          onToggleBench={() => toggleReserve(sheetPlayer.uuid)}
          onClose={() => setSheetId(null)}
        />
      )}

      {viewingPlayerId && (() => {
        const p = group.find((x) => x.uuid === viewingPlayerId);
        if (!p) return null;
        return (
          <PlayerCardModal
            player={p} price={prices[p.uuid]} points={totalPoints[p.uuid]}
            ownership={ownership[p.uuid] || 0} onClose={() => setViewingPlayerId(null)}
          />
        );
      })()}
    </div>
  );
}

/** Tapping a player in the market shows their FUT card (attributes) plus
 *  season totals and this league's fantasy output, so anyone can decide
 *  who's worth buying/trading for without leaving the list. */
function PlayerCardModal({ player, price, points, ownership, onClose }) {
  const stats = [
    ["⚽", t("Golos"), player.goals || 0],
    ["🎯", t("Assistências"), player.assists || 0],
    ["⭐", t("MVPs"), player.mvps || 0],
    ["🧤", t("Jogos"), player.gamesPlayed || 0],
  ];
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(10,15,24,0.75)", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
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
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.text1 }}>{fmtM(price)}</div>
              <div style={{ fontSize: T.min, fontWeight: 700, color: C.text2, marginTop: 2 }}>{t("PREÇO")}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.text1 }}>{Math.round(points || 0)}</div>
              <div style={{ fontSize: T.min, fontWeight: 700, color: C.text2, marginTop: 2 }}>{t("PTS NA LIGA")}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.text1 }}>{ownership}/{OWNERSHIP_CAP}</div>
              <div style={{ fontSize: T.min, fontWeight: 700, color: C.text2, marginTop: 2 }}>{t("DONOS")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Propose a trade for `target.playerId`, currently owned by one or
 *  more other participants (`target.owners`). Always asks which of the
 *  buyer's own picks gets released to make room — for a swap that IS
 *  the offered player; for cash it just returns to the pool. */
function TradeOfferPanel({ group, me, mySquad, prices, target, myBank, onClose, onSubmit }) {
  const [toParticipantId, setToParticipantId] = useState(target.owners[0]?.participant_id || "");
  const [givePlayerId, setGivePlayerId] = useState(mySquad?.player_ids?.[0] || "");
  const [offerType, setOfferType] = useState("swap");
  const [offerCash, setOfferCash] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const targetPlayer = group.find((p) => p.uuid === target.playerId);
  const mine = (mySquad?.player_ids || []).map((id) => group.find((p) => p.uuid === id)).filter(Boolean);

  // What this trade actually costs you: the target's price minus what
  // you free up by releasing your own player, plus any cash on top —
  // can't exceed what you actually have left in the bank.
  const priceDelta = (prices[target.playerId] || 0) - (prices[givePlayerId] || 0);
  const netCost = priceDelta + (offerType === "cash" ? Number(offerCash) || 0 : 0);
  const overBank = netCost > myBank;

  const submit = async () => {
    if (overBank) { setError(t("Não tens banco suficiente para esta oferta.")); return; }
    setSending(true);
    setError(null);
    const res = await onSubmit({ toParticipantId, givePlayerId, offerType, offerCash: Number(offerCash) || 0 });
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
        {mine.map((p) => <option key={p.uuid} value={p.uuid}>{p.nick} ({fmtM(prices[p.uuid])})</option>)}
      </select>

      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: offerType === "cash" ? 10 : 0 }}>
        {[["swap", "Troca direta"], ["cash", "Dinheiro"]].map(([id, label]) => {
          const active = offerType === id;
          return (
            <button key={id} onClick={() => setOfferType(id)}
              style={{ flex: 1, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 10, padding: "8px 6px", fontSize: 12, fontWeight: active ? 800 : 500, cursor: "pointer" }}>
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
        <span>{t("O teu banco")}</span>
        <span style={{ fontWeight: 700, color: C.text1 }}>{fmtM(myBank)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text2, marginTop: 4 }}>
        <span>{t("Custo desta troca")}</span>
        <span style={{ fontWeight: 700, color: overBank ? C.red : C.text1 }}>{fmtM(netCost)}</span>
      </div>

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
  const counterpart = group.find((p) => p.uuid === (mine ? offer.to_participant_id : offer.from_participant_id));
  const target = group.find((p) => p.uuid === offer.target_player_id);
  const give = group.find((p) => p.uuid === offer.give_player_id);

  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };

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
            <div style={{ color: C.text2 }}>{t("Recebes:")} <strong>{give?.nick}</strong>{offer.offer_type === "cash" ? ` + ${fmtM(offer.offer_cash)}` : ""} — {t("dás:")} <strong>{target?.nick}</strong></div>
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
    </div>
  );
}
