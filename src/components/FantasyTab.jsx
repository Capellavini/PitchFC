import { useState, useMemo } from "react";
import { Crown } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { fantasyPrice, DEFAULT_FANTASY_WEIGHTS } from "../lib/fantasy";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import Collapsible from "./Collapsible";

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: C.surface, color: C.text1,
  border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, marginTop: 4,
};

// A league runs from starts_at for duration_months (min 1) — after that
// it's read-only (final leaderboard) until the organizer starts the next one.
const leagueEndsAt = (league) => {
  const d = new Date(league.starts_at || league.created_at);
  d.setMonth(d.getMonth() + Math.max(1, league.duration_months || 1));
  return d;
};

/** Admin-only beta: Cartola-style fantasy game on top of the group's real
 *  matchdays. Non-exclusive picks (any participant can escalate any
 *  teammate). Each league runs for a fixed duration (organizer-set, min
 *  1 month); squads are editable until 8h before the next kickoff (see
 *  useCloud.js saveFantasySquad, which enforces the same window). */
export default function FantasyTab({ group, me, canManageTeams, kickoffAt, fantasyLeague, fantasySquads, fantasyScores, matchdays, onCreateLeague, onSaveSquad }) {
  if (!fantasyLeague) {
    return <CreateLeague canManageTeams={canManageTeams} onCreateLeague={onCreateLeague} />;
  }
  const ended = Date.now() > leagueEndsAt(fantasyLeague).getTime();
  return (
    <>
      <FantasyLeagueView
        group={group} me={me} league={fantasyLeague} ended={ended} kickoffAt={kickoffAt}
        squads={fantasySquads} scores={fantasyScores} matchdays={matchdays}
        onSaveSquad={onSaveSquad}
      />
      {ended && (
        <CreateLeague canManageTeams={canManageTeams} onCreateLeague={onCreateLeague} nextSeason />
      )}
    </>
  );
}

function CreateLeague({ canManageTeams, onCreateLeague, nextSeason }) {
  const [form, setForm] = useState({ name: "Liga Fantasy", budget: 120, squadSize: 5, durationMonths: 1 });
  const [creating, setCreating] = useState(false);

  if (!canManageTeams) {
    return nextSeason ? null : (
      <div style={{ padding: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: C.text2 }}>{t("Ainda não há Liga Fantasy neste grupo.")}</div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setCreating(true);
    await onCreateLeague({
      name: form.name.trim() || "Liga Fantasy",
      budget: Number(form.budget) || 120,
      squadSize: Number(form.squadSize) || 5,
      durationMonths: Math.max(1, Number(form.durationMonths) || 1),
    });
    setCreating(false);
  };

  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>{nextSeason ? t("PRÓXIMA TEMPORADA") : "FANTASY LEAGUE"}</SectionLabel>
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{t("Criar Liga Fantasy")}</div>
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
        <BtnPrimary onClick={submit} disabled={creating} style={{ width: "100%", marginTop: 16, opacity: creating ? 0.6 : 1 }}>
          {creating ? t("Um momento…") : t("Criar Liga Fantasy")}
        </BtnPrimary>
      </div>
    </div>
  );
}

function FantasyLeagueView({ group, me, league, ended, kickoffAt, squads, scores, matchdays, onSaveSquad }) {
  const weights = league.scoring_weights || DEFAULT_FANTASY_WEIGHTS;
  const mySquad = squads.find((s) => s.participant_id === me?.uuid);
  const [selected, setSelected] = useState(mySquad?.player_ids || []);
  const [captain, setCaptain] = useState(mySquad?.captain_id || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const lockAt = kickoffAt ? new Date(new Date(kickoffAt).getTime() - 8 * 3600 * 1000) : null;
  const locked = ended || (lockAt && Date.now() > lockAt.getTime());

  const prices = useMemo(
    () => Object.fromEntries(group.map((p) => [p.uuid, fantasyPrice(p, weights)])),
    [group, weights]
  );
  const total = selected.reduce((s, id) => s + (prices[id] || 0), 0);
  const overBudget = total > league.budget;
  const canSave = !locked && selected.length === league.squad_size && Boolean(captain) && !overBudget;

  const toggle = (id) => {
    if (locked) return;
    setSaved(false);
    setSelected((sel) => {
      if (sel.includes(id)) {
        if (captain === id) setCaptain(null);
        return sel.filter((x) => x !== id);
      }
      if (sel.length >= league.squad_size) return sel;
      return [...sel, id];
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await onSaveSquad(league.id, selected, captain);
    setSaving(false);
    if (!res?.error) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else setError(res.error);
  };

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

  return (
    <div style={{ padding: 16 }}>
      <SectionLabel>{(league.name || "Fantasy League").toUpperCase()}</SectionLabel>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{t("A tua escalação")}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: overBudget ? C.red : C.text2 }}>{total} / {league.budget}</div>
        </div>
        <div style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
          {t("Escolhe")} {league.squad_size} {t("colegas e define o capitão (pontos em dobro).")}
        </div>

        {locked && (
          <div style={{ fontSize: 11, color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
            {ended ? t("Liga terminada — consulta a classificação final abaixo.") : t("Escalação trancada — falta menos de 8h para o jogo.")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {group.map((p) => {
            const picked = selected.includes(p.uuid);
            const isCaptain = captain === p.uuid;
            return (
              <div key={p.uuid} onClick={() => toggle(p.uuid)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: locked ? "default" : "pointer",
                  background: picked ? C.accentDim : "transparent", border: `1px solid ${picked ? C.accentBorder : C.border}`, opacity: locked ? 0.6 : 1,
                }}>
                <Avatar name={p.name} color={playerColor(group, p)} size={32} fontSize={11} isMe={p.isMe} photo={p.photo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</div>
                  <div style={{ fontSize: 10, color: C.text2 }}>{t(p.position)}</div>
                </div>
                <div style={{ ...displayFont, fontSize: 13, color: C.accent }}>{prices[p.uuid]}</div>
                {picked && (
                  <span role="button" title={t("Capitão")}
                    onClick={(e) => { if (locked) return; e.stopPropagation(); setCaptain(p.uuid); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: isCaptain ? C.goldDim : "transparent", border: `1px solid ${isCaptain ? C.gold : C.border}`,
                    }}>
                    <Crown size={13} color={isCaptain ? C.gold : C.text3} />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {!locked && (
          <BtnPrimary onClick={save} disabled={!canSave || saving} style={{ width: "100%", marginTop: 14, opacity: (!canSave || saving) ? 0.5 : 1 }}>
            {saving ? t("Um momento…") : saved ? t("Escalação guardada ✓") : t("Guardar escalação")}
          </BtnPrimary>
        )}
        {error && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>{error}</div>}
      </div>

      <SectionLabel>{t("Classificação")}</SectionLabel>
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        {leaderboard.length === 0 && <div style={{ fontSize: 12, color: C.text2 }}>{t("Ainda sem jornadas fechadas.")}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leaderboard.map((row, i) => (
            <div key={row.pid} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ ...displayFont, width: 20, fontSize: 13, color: C.text3 }}>{i + 1}</div>
              <Avatar name={row.player?.name || "?"} color={row.player ? playerColor(group, row.player) : C.text3} size={28} fontSize={10} isMe={row.player?.isMe} photo={row.player?.photo} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: row.player?.isMe ? 800 : 600 }}>{row.player?.nick || "?"}</div>
              <div style={{ fontSize: 10, color: C.text2 }}>{row.rounds} {t("jornadas")}</div>
              <div style={{ ...displayFont, fontSize: 15, color: C.accent, minWidth: 36, textAlign: "right" }}>{Math.round(row.points)}</div>
            </div>
          ))}
        </div>
      </div>

      {lastRoundScores.length > 0 && (
        <Collapsible title={t("Última jornada")} subtitle={t("Pontos de cada participante")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lastRoundScores.map((s) => {
              const p = group.find((x) => x.uuid === s.participant_id);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={p?.name || "?"} color={p ? playerColor(group, p) : C.text3} size={26} fontSize={10} isMe={p?.isMe} photo={p?.photo} />
                  <div style={{ flex: 1, fontSize: 12 }}>{p?.nick || "?"}</div>
                  <div style={{ ...displayFont, fontSize: 13, color: C.accent }}>{Math.round(s.points)}</div>
                </div>
              );
            })}
          </div>
        </Collapsible>
      )}
    </div>
  );
}
