import { useState, useMemo } from "react";
import { Pencil, X, Search, Check, ArrowRightLeft, Cross } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor, computeOverall } from "../lib/helpers";
import { fantasyPrice, computeRoundPoints, DEFAULT_FANTASY_WEIGHTS, OWNERSHIP_CAP, fmtM } from "../lib/fantasy";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import Collapsible from "./Collapsible";
import FantasyPitch, { FantasyBench } from "./FantasyPitch";
import FutCard from "./FutCard";

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface, color: C.text1,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, marginTop: 4,
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
export default function FantasyTab({ group, me, isOrganizer, kickoffAt, fantasyLeague, fantasySquads, fantasyScores, fantasyTradeOffers, matchdays, onCreateLeague, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer }) {
  if (!fantasyLeague) {
    return <CreateLeague isOrganizer={isOrganizer} onCreateLeague={onCreateLeague} />;
  }
  const ended = Date.now() > leagueEndsAt(fantasyLeague).getTime();
  return (
    <>
      <FantasyLeagueView
        group={group} me={me} league={fantasyLeague} ended={ended} kickoffAt={kickoffAt}
        squads={fantasySquads} scores={fantasyScores} offers={fantasyTradeOffers} matchdays={matchdays}
        onSaveSquad={onSaveSquad} onCreateTradeOffer={onCreateTradeOffer}
        onCancelTradeOffer={onCancelTradeOffer} onRespondTradeOffer={onRespondTradeOffer}
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
        <div style={{ fontSize: 11, color: C.text3, marginTop: 10 }}>
          {t("Todos começam a")} {fmtM(startPrice)}. {t("Com este orçamento dá para")} {affordable} {t("jogadores de início.")}
        </div>
        <BtnPrimary onClick={submit} disabled={creating} style={{ width: "100%", marginTop: 16, opacity: creating ? 0.6 : 1 }}>
          {creating ? t("Um momento…") : t("Criar Pitch Manager")}
        </BtnPrimary>
      </div>
    </div>
  );
}

function FantasyLeagueView({ group, me, league, ended, kickoffAt, squads, scores, offers, matchdays, onSaveSquad, onCreateTradeOffer, onCancelTradeOffer, onRespondTradeOffer }) {
  const weights = league.scoring_weights || DEFAULT_FANTASY_WEIGHTS;
  const mySquad = squads.find((s) => s.participant_id === me?.uuid);
  const complete = mySquad?.player_ids?.length === league.squad_size;
  const [selected, setSelected] = useState(mySquad?.player_ids || []);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(!complete);
  const [viewingId, setViewingId] = useState(null);
  const [tradeTarget, setTradeTarget] = useState(null); // { playerId, ownerSquad }
  const [sortMode, setSortMode] = useState("pos"); // 'pos' | 'points' — "todos os jogadores por pontuação"
  const [viewingPlayerId, setViewingPlayerId] = useState(null); // player card modal in the market list
  const lastRoundLines = matchdays[0]?.summary?.lines || null;

  const lockAt = kickoffAt ? new Date(new Date(kickoffAt).getTime() - 8 * 3600 * 1000) : null;
  const locked = ended || (lockAt && Date.now() > lockAt.getTime());

  // Prices reset to the base price when a league starts and only move
  // with performance in rounds played *since* — not lifetime season stats.
  const roundsSinceStart = useMemo(
    () => matchdays.filter((md) => new Date(md.created_at) >= new Date(league.starts_at || league.created_at)),
    [matchdays, league.starts_at, league.created_at]
  );
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
  // respondTradeOffer). Ignoring it here would let someone keep spending
  // through the squad editor past what they actually have left.
  const squadSpend = (squad) => (squad?.player_ids || []).reduce((s, id) => s + (prices[id] || 0), 0);
  const squadBank = (squad) => league.budget + (squad?.budget_adjustment || 0) - squadSpend(squad);
  const effectiveBudget = league.budget + (mySquad?.budget_adjustment || 0);

  const total = selected.reduce((s, id) => s + (prices[id] || 0), 0);
  const overBudget = total > effectiveBudget;
  const canSave = !locked && selected.length === league.squad_size && !overBudget;

  const toggle = (id) => {
    if (locked) return;
    setSaved(false);
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      if (sel.length >= league.squad_size) return sel;
      if (group.find((p) => p.uuid === id)?.injured) return sel; // injured — can't be escalated
      const count = ownership[id] || 0;
      if (count >= OWNERSHIP_CAP) return sel; // full — trade instead
      return [...sel, id];
    });
  };

  const save = async (extra = {}) => {
    setSaving(true);
    setError(null);
    const res = await onSaveSquad(league.id, extra.playerIds ?? selected, extra.captainId ?? mySquad?.captain_id ?? null, extra.reserveId ?? mySquad?.reserve_id ?? null);
    setSaving(false);
    if (!res?.error) {
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      if ((extra.playerIds ?? selected).length === league.squad_size) setEditing(false);
    } else setError(res.error);
    return res;
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

  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>{(league.name || "Pitch Manager").toUpperCase()}</SectionLabel>

      {complete && !editing ? (
        <>
          <TopBar total={total} budget={effectiveBudget} count={selected.length} squadSize={league.squad_size} overBudget={false} />
          {!locked && (
            <button onClick={() => setEditing(true)} style={{ background: C.surface, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
            <Pencil size={11} /> {t("Editar escalação")}
          </button>
          )}
          {!mySquad.captain_id && (
            <div style={{ fontSize: 11, color: C.orange, marginBottom: 8 }}>{t("Ainda sem capitão — toca na coroa de um jogador no campo.")}</div>
          )}
          <FantasyPitch
            group={group} playerIds={mySquad.player_ids} captainId={mySquad.captain_id} reserveId={mySquad.reserve_id}
            weights={weights} lastRoundLines={lastRoundLines} readOnly={locked}
            onSetCaptain={(id) => save({ captainId: id })}
            onSetReserve={(id) => save({ reserveId: mySquad.reserve_id === id ? null : id })}
          />
          <FantasyBench
            group={group} reserveId={mySquad.reserve_id} captainId={mySquad.captain_id} weights={weights} lastRoundLines={lastRoundLines}
            readOnly={locked} onSetReserve={(id) => save({ reserveId: mySquad.reserve_id === id ? null : id })}
          />
        </>
      ) : (
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <TopBar total={total} budget={effectiveBudget} count={selected.length} squadSize={league.squad_size} overBudget={overBudget} />
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} color={C.text3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Pesquisar por nome…")}
            style={{ ...inputStyle, marginTop: 0, paddingLeft: 30 }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["pos", "Por posição"], ["points", "Por pontuação"]].map(([id, label]) => {
            const active = sortMode === id;
            return (
              <button key={id} onClick={() => setSortMode(id)}
                style={{ flex: 1, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 10, padding: "7px 6px", fontSize: 12, fontWeight: active ? 800 : 500, cursor: "pointer" }}>
                {t(label)}
              </button>
            );
          })}
        </div>

        {locked && (
          <div style={{ fontSize: 11, color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
            {ended ? t("Liga terminada — consulta a classificação final abaixo.") : t("Escalação trancada — falta menos de 8h para o jogo.")}
          </div>
        )}
        {!locked && overBudget && (
          <div style={{ fontSize: 11, color: C.red, background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 12, fontWeight: 700 }}>
            {t("Falta")} {fmtM(total - effectiveBudget)} — {t("tira alguém ou troca por um mais barato.")}
          </div>
        )}

        {(() => {
          const renderRow = (p) => {
            const picked = selected.includes(p.uuid);
            const count = ownership[p.uuid] || 0;
            const atCap = count >= OWNERSHIP_CAP && !picked;
            const owners = ownersOf(p.uuid).filter((s) => s.participant_id !== me?.uuid);
            return (
              <div key={p.uuid}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10,
                  background: picked ? C.accentDim : "transparent", border: `1px solid ${picked ? C.accentBorder : C.border}`, opacity: locked ? 0.6 : 1 }}>
                <button onClick={() => setViewingPlayerId(p.uuid)}
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={38} fontSize={13} isMe={p.isMe} photo={p.photo} injured={p.injured} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text1 }}>{p.nick}</div>
                    <div style={{ fontSize: 10, color: atCap ? C.red : C.text2 }}>
                      {sortMode === "points" ? `${t(p.position)} · ` : ""}{count}/{OWNERSHIP_CAP} {t("disponível")}
                    </div>
                  </div>
                </button>
                <div style={{ textAlign: "center", minWidth: 26 }}>
                  <div style={{ ...displayFont, fontSize: 13, color: C.text1 }}>{computeOverall(p.position, p.attrs)}</div>
                  <div style={{ fontSize: 7, fontWeight: 700, color: C.text3 }}>OVR</div>
                </div>
                <div style={{ textAlign: "center", minWidth: 26 }}>
                  <div style={{ ...displayFont, fontSize: 13, color: C.accent }}>{Math.round(totalPoints[p.uuid] || 0)}</div>
                  <div style={{ fontSize: 7, fontWeight: 700, color: C.text3 }}>PTS</div>
                </div>
                <div style={{ ...displayFont, fontSize: 12, color: C.accent, minWidth: 44, textAlign: "right" }}>{fmtM(prices[p.uuid])}</div>
                {locked ? null : (p.injured && !picked) ? (
                  <span style={{ background: C.redDim, color: C.red, border: `1px solid ${C.red}55`, borderRadius: 8, padding: "5px 8px", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <Cross size={11} /> {t("Lesionado")}
                  </span>
                ) : atCap ? (
                  <button onClick={() => setTradeTarget({ playerId: p.uuid, owners })} disabled={!owners.length}
                    style={{ background: C.orangeDim, color: C.orange, border: `1px solid ${C.orange}55`, borderRadius: 8, padding: "5px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <ArrowRightLeft size={11} /> {t("Oferta")}
                  </button>
                ) : (
                  <button onClick={() => toggle(p.uuid)}
                    style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0, background: picked ? C.redDim : C.greenDim, color: picked ? C.red : C.green, border: `1px solid ${picked ? C.red : C.greenBorder}`, cursor: "pointer", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {picked ? "×" : "+"}
                  </button>
                )}
              </div>
            );
          };

          if (sortMode === "points") {
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text3, marginBottom: 6 }}>{t("Todos os jogadores").toUpperCase()}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {byPoints.map(renderRow)}
                </div>
              </div>
            );
          }
          return byPosition.map(({ pos, players }) => players.length > 0 && (
            <div key={pos} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.text3, marginBottom: 6 }}>{t(pos).toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {players.map(renderRow)}
              </div>
            </div>
          ));
        })()}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          {complete && (
            <button onClick={() => { setSelected(mySquad.player_ids); setEditing(false); }}
              style={{ background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "0 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t("Cancelar")}
            </button>
          )}
          {!locked && (
            <BtnPrimary onClick={() => save()} disabled={!canSave || saving} style={{ flex: 1, opacity: (!canSave || saving) ? 0.5 : 1 }}>
              {saving ? t("Um momento…") : saved ? t("Escalação guardada ✓") : t("Guardar escalação")}
            </BtnPrimary>
          )}
        </div>
        {error && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>
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

      {(myOffers.length > 0 || incomingOffers.length > 0) && (
        <Collapsible title={t("Ofertas de troca")} subtitle={`${incomingOffers.length} ${t("recebidas")} · ${myOffers.length} ${t("enviadas")}`}>
          {incomingOffers.length > 0 && (
            <div style={{ marginBottom: myOffers.length ? 14 : 0 }}>
              <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>{t("RECEBIDAS")}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {incomingOffers.map((o) => (
                  <OfferRow key={o.id} offer={o} group={group} mine={false} onRespond={onRespondTradeOffer} />
                ))}
              </div>
            </div>
          )}
          {myOffers.length > 0 && (
            <div>
              <SectionLabel style={{ marginBottom: 8, color: C.text3 }}>{t("ENVIADAS")}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myOffers.map((o) => (
                  <OfferRow key={o.id} offer={o} group={group} mine onCancel={onCancelTradeOffer} />
                ))}
              </div>
            </div>
          )}
        </Collapsible>
      )}

      <SectionLabel>{t("Classificação")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {leaderboard.length === 0 && <div style={{ fontSize: 12, color: C.text2 }}>{t("Ainda sem jornadas fechadas.")}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaderboard.map((row, i) => {
            const rivalSquad = squads.find((s) => s.participant_id === row.pid && s.player_ids?.length);
            return (
              <div key={row.pid} onClick={() => rivalSquad && setViewingId((v) => (v === row.pid ? null : row.pid))}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: rivalSquad ? "pointer" : "default" }}>
                <div style={{ ...displayFont, width: 20, fontSize: 13, color: C.text3 }}>{i + 1}</div>
                <Avatar name={row.player?.name || "?"} color={row.player ? playerColor(group, row.player) : C.text3} size={28} fontSize={10} isMe={row.player?.isMe} photo={row.player?.photo} injured={row.player?.injured} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: row.player?.isMe ? 800 : 600 }}>{row.player?.nick || "?"}</div>
                <div style={{ fontSize: 10, color: C.text2 }}>{row.rounds} {t("jornadas")}</div>
                <div style={{ ...displayFont, fontSize: 15, color: C.accent, minWidth: 36, textAlign: "right" }}>{Math.round(row.points)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {viewingId && (() => {
        const rivalSquad = squads.find((s) => s.participant_id === viewingId);
        const rival = group.find((p) => p.uuid === viewingId);
        if (!rivalSquad) return null;
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t("Escalação de")} {rival?.nick || "?"}</div>
              <button onClick={() => setViewingId(null)} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <FantasyPitch
              group={group} playerIds={rivalSquad.player_ids} captainId={rivalSquad.captain_id} reserveId={rivalSquad.reserve_id}
              weights={weights} lastRoundLines={lastRoundLines} readOnly
            />
          </div>
        );
      })()}

      {lastRoundScores.length > 0 && (
        <Collapsible title={t("Última jornada")} subtitle={t("Pontos de cada participante")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lastRoundScores.map((s) => {
              const p = group.find((x) => x.uuid === s.participant_id);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p?.name || "?"} color={p ? playerColor(group, p) : C.text3} size={26} fontSize={10} isMe={p?.isMe} photo={p?.photo} injured={p?.injured} />
                  <div style={{ flex: 1, fontSize: 12 }}>{p?.nick || "?"}</div>
                  <div style={{ ...displayFont, fontSize: 13, color: C.accent }}>{Math.round(s.points)}</div>
                </div>
              );
            })}
          </div>
        </Collapsible>
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
        <button onClick={onClose} style={{ alignSelf: "flex-end", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}>
          <X size={16} color={C.text2} />
        </button>
        <FutCard player={player} width={260} ratingsCount={player.ratingsCount} />
        <div style={{ ...cardStyle, width: "100%", marginTop: 12, boxSizing: "border-box" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            {stats.map(([emoji, label, value]) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ ...displayFont, fontSize: 16, color: C.text1 }}>{emoji} {value}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.text3, marginTop: 2 }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: C.border, marginBottom: 12 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.accent }}>{fmtM(price)}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: C.text3, marginTop: 2 }}>{t("PREÇO")}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.accent }}>{Math.round(points || 0)}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: C.text3, marginTop: 2 }}>{t("PTS NA LIGA")}</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...displayFont, fontSize: 15, color: C.text1 }}>{ownership}/{OWNERSHIP_CAP}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: C.text3, marginTop: 2 }}>{t("DONOS")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** FPL-style header: red "players selected" badge + green "bank" badge. */
function TopBar({ total, budget, count, squadSize, overBudget }) {
  const bank = budget - total;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <div style={{ flex: 1, background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
        <div style={{ ...displayFont, fontSize: 16, color: C.red }}>{count}/{squadSize}</div>
        <div style={{ fontSize: 9, color: C.text2, fontWeight: 700 }}>{t("Selecionados")}</div>
      </div>
      <div style={{ flex: 1, background: overBudget ? `${C.red}18` : C.greenDim, border: `1px solid ${overBudget ? C.red : C.greenBorder}`, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
        <div style={{ ...displayFont, fontSize: 16, color: overBudget ? C.red : C.green }}>{fmtM(bank)}</div>
        <div style={{ fontSize: 9, color: C.text2, fontWeight: 700 }}>{t("Banco")}</div>
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
    <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.orange}55` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{t("Oferta por")} {targetPlayer?.nick}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
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
  );
}

function OfferRow({ offer, group, mine, onCancel, onRespond }) {
  const [busy, setBusy] = useState(false);
  const counterpart = group.find((p) => p.uuid === (mine ? offer.to_participant_id : offer.from_participant_id));
  const target = group.find((p) => p.uuid === offer.target_player_id);
  const give = group.find((p) => p.uuid === offer.give_player_id);

  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };

  return (
    <div style={{ background: C.surface, borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
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
        <button onClick={() => act(() => onCancel(offer.id))} disabled={busy} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, cursor: "pointer" }}>{t("Cancelar oferta")}</button>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => act(() => onRespond(offer, true))} disabled={busy} style={{ background: C.greenDim, border: `1px solid ${C.greenBorder}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.green, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Check size={12} /> {t("Aceitar")}</button>
          <button onClick={() => act(() => onRespond(offer, false))} disabled={busy} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.text2, cursor: "pointer" }}>{t("Recusar")}</button>
        </div>
      )}
    </div>
  );
}
