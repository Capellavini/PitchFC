import { useState, useRef, Fragment } from "react";
import { Goal, Footprints, Hand, Star, Flag, RotateCcw, Plus, Check, X, Undo2, ArrowLeftRight, Mic, LayoutGrid, ArrowRightCircle, Swords, Trophy, Settings2 } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import { t, tCtx } from "../lib/i18n";
import { playerColor } from "../lib/helpers";
import { voiceSupported, listenOnce, parseGoalCommand } from "../lib/voice";
import { currentTimerMinute } from "../lib/matchTimer";
import { goalsOf, isSave, playoffState, matchLabel, dayStats } from "../lib/matchdayLive";
import Avatar from "./Avatar";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import Collapsible from "./Collapsible";
import ListRow from "./ListRow";
import LiveEventSheet from "./LiveEventSheet";
import MatchTimer from "./MatchTimer";
import MatchdayStandings from "./MatchdayStandings";
import ScoreBlock from "./ScoreBlock";
import SectionLabel from "./SectionLabel";
import SegmentedControl from "./SegmentedControl";
import TacticsBoard from "./TacticsBoard";

const pill = (active) => ({
  flexShrink: 0, minHeight: 44, display: "inline-flex", alignItems: "center", gap: S.xs + 2,
  padding: `0 ${S.md + 2}px`, borderRadius: R.pill, cursor: "pointer", whiteSpace: "nowrap",
  // Focused match = strong neutral (the view SegmentedControl above already
  // carries the lime "active" state — two lime rows stacked read as noise).
  background: active ? C.card : "transparent", color: active ? C.text1 : C.text2,
  border: `1px solid ${active ? C.text2 : C.border}`, fontSize: 13, fontWeight: active ? 800 : 600,
});

/** One of the four big square live actions (Golo · Assistência · Defesa · MVP). */
function ActionSquare({ Icon, label, color, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      style={{ aspectRatio: "1 / 1", minHeight: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.sm, background: C.card, border: `1px solid ${C.border}`, borderRadius: R.card, color: C.text1, cursor: "pointer", padding: S.xs }}>
      <Icon size={26} color={color} strokeWidth={2.25} />
      <span style={{ fontSize: T.meta, fontWeight: 800, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/**
 * Matchday state B — LIVE. One match in focus at a time (pills switch
 * between "Jogo 1, Jogo 2…"): big ScoreBlock, device-local timer, the
 * four big action squares, an event timeline with undo/edit, and the red
 * "Terminar jogo" CTA that closes the whole day (stats → season, history,
 * clean sheets, MVP voting — see endMatchday in PitchApp).
 *
 * Organizer/assistant writes; everyone else gets the same screen
 * read-only (synced via games.live_matchday in cloud mode).
 */
export default function MatchdayLive({ matchday, teams, group, canManage, onAddMatch, onGoal, onEpicSave, onRemoveEvent, onUpdateEvent, onSetGoalkeeper, onSetMatchConcluded, onEnd, onCancel, onAdvancePlayoff, onSetPenaltyWinner, onSubstitute, onRevertSub }) {
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState("jogo"); // jogo | torneio | stats
  const [sheet, setSheet] = useState(null); // { kind, initial? }
  const [composing, setComposing] = useState(null); // { homeId, awayId }
  const [voice, setVoice] = useState(null); // { matchId, listening?, transcript?, parsed?, error? }
  const voiceStopRef = useRef(null);

  const list = Array.isArray(teams) ? teams : [];
  const matches = matchday.matches || [];
  const byId = (id) => group.find((p) => p.id === id);
  const teamById = (id) => list.find((x) => x.id === id);
  const teamName = (id) => teamById(id)?.name ?? "—";
  const teamColor = (id) => teamById(id)?.color ?? C.text2;
  const teamPlayers = (teamId) => (teamById(teamId)?.players ?? []).map(byId).filter(Boolean);
  // Per-match roster: the drawn team minus anyone subbed out of THIS match,
  // plus whoever came in — never touches the permanent draw.
  const matchRoster = (m, teamId) => {
    const subs = (m.subs || []).filter((s) => s.teamId === teamId);
    const outIds = new Set(subs.map((s) => s.outId));
    return [...teamPlayers(teamId).filter((p) => !outIds.has(p.id)), ...subs.map((s) => byId(s.inId)).filter(Boolean)];
  };
  const allPlayers = list.flatMap((tm) => teamPlayers(tm.id));

  const isCampeonato = matchday.mode === "campeonato";
  const isPersonalizado = matchday.mode === "personalizado";
  const showTournament = isCampeonato || isPersonalizado;
  const { roundSize } = playoffState(matchday);
  const leaders = dayStats(matchday, byId);

  // Focus: explicit pick, else the latest match still being played, else the last one.
  const playable = matches.filter((m) => !m.isBye);
  const fallback = [...playable].reverse().find((m) => !m.concluded) ?? playable[playable.length - 1] ?? matches[matches.length - 1];
  const m = matches.find((x) => x.id === selectedId) ?? fallback;

  const startCompose = () => {
    if (list.length === 2) { onAddMatch(list[0].id, list[1].id); setSelectedId(null); return; }
    setComposing({ homeId: list[0].id, awayId: list[1].id });
  };
  const confirmCompose = () => {
    if (composing.homeId === composing.awayId) return;
    onAddMatch(composing.homeId, composing.awayId);
    setComposing(null);
    setSelectedId(null);
  };

  // Push-to-talk goal logging — press-and-hold, never tap: the release is
  // the reliable end-of-recording signal on a noisy pitch. The button must
  // never unmount mid-press (the finger lifting has nothing to fire on).
  const beginVoice = () => {
    setVoice({ matchId: m.id, listening: true });
    voiceStopRef.current = listenOnce({
      onResult: (transcript) => setVoice({ matchId: m.id, transcript, parsed: parseGoalCommand(transcript, m.homeId, matchRoster(m, m.homeId), m.awayId, matchRoster(m, m.awayId)) }),
      onError: (error) => setVoice({ matchId: m.id, error }),
    });
  };
  const endVoice = () => { voiceStopRef.current?.(); voiceStopRef.current = null; };
  const confirmVoice = () => {
    if (!voice?.parsed) return;
    const { teamId, scorerId, assistId, ownGoal } = voice.parsed;
    onGoal(voice.matchId, { teamId, scorerId, assistId, ownGoal, minute: currentTimerMinute() });
    setVoice(null);
  };

  const modeChip = isPersonalizado ? { Icon: Settings2, label: t("Personalizado") }
    : isCampeonato ? { Icon: Trophy, label: t("Campeonato") } : { Icon: Swords, label: t("Avulsa") };

  const viewOptions = [
    { id: "jogo", label: "Jogo" },
    ...(showTournament ? [{ id: "torneio", label: "Classificação" }] : []),
    { id: "stats", label: "Stats do dia" },
  ];

  // ── Match body ─────────────────────────────────────────
  const renderMatch = () => {
    if (!m) return null;
    if (m.isBye) {
      return (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
          <ArrowRightCircle size={20} color={C.gold} />
          <div>
            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.08em" }}>{matchLabel(m, roundSize)}</div>
            <div style={{ fontSize: T.body, fontWeight: 700 }}>{teamName(m.homeId)} {t("passa à próxima ronda")}</div>
          </div>
        </div>
      );
    }
    const concluded = Boolean(m.concluded);
    const hg = goalsOf(m, m.homeId), ag = goalsOf(m, m.awayId);
    const tied = m.stage === "playoff" && hg === ag;
    const sides = [m.homeId, m.awayId];
    const events = (m.events || []).map((e, idx) => ({ e, idx })).reverse();
    const vs = voice?.matchId === m.id ? voice : null;
    const listening = Boolean(vs?.listening);
    const voiceHint = vs && !listening && !vs.parsed
      ? (vs.error === "not-allowed"
          ? t("Permissão de microfone negada — ativa o microfone para este site nas definições do browser.")
          : vs.error === "service-not-allowed"
            ? t("Este browser não permite reconhecimento de voz em páginas web (comum no Safari/iPhone) — experimenta no Chrome, num Android ou computador.")
            : vs.transcript
              ? `${t("Não percebi quem marcou em")} “${vs.transcript}”`
              : `${t("Não ouvi nada — mantém premido enquanto falas.")}${vs.error ? ` [${vs.error}]` : ""}`)
      : null;
    const gkNick = (id) => byId(id)?.nick;

    return (
      <>
        <ScoreBlock
          home={{ name: teamName(m.homeId), score: hg, color: teamColor(m.homeId), sub: m.homeGkId ? `${t("GR")} ${gkNick(m.homeGkId)}` : null }}
          away={{ name: teamName(m.awayId), score: ag, color: teamColor(m.awayId), sub: m.awayGkId ? `${t("GR")} ${gkNick(m.awayGkId)}` : null }}
          center={<>
            <span style={{ letterSpacing: "0.06em" }}>{matchLabel(m, roundSize)}</span>
            {concluded
              ? <span style={{ color: C.green }}>{t("FINAL")}</span>
              : <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.red }}><span style={{ width: 6, height: 6, borderRadius: 3, background: C.red, animation: "mdpulse 1.2s infinite" }} />{t("LIVE")}</span>}
          </>}
          style={{ marginBottom: S.lg }}
        />

        {!concluded && <MatchTimer />}

        {/* the four big actions */}
        {canManage && !concluded && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: S.sm, marginBottom: S.md }}>
            <ActionSquare Icon={Goal} label={t("Golo")} color={C.accent} onClick={() => setSheet({ kind: "goal" })} />
            <ActionSquare Icon={Footprints} label={t("Assistência")} color={C.text1} onClick={() => setSheet({ kind: onUpdateEvent ? "assist" : "goal" })} />
            <ActionSquare Icon={Hand} label={tCtx("action", "Defesa")} color={C.blue} onClick={() => setSheet({ kind: "save" })} />
            <ActionSquare Icon={Star} label={t("MVP")} color={C.gold} onClick={() => setSheet({ kind: "mvp" })} />
          </div>
        )}

        {/* voice goal — optional helper, confirm step before anything is written */}
        {canManage && !concluded && voiceSupported() && (
          vs?.parsed && !listening ? (
            <div style={{ ...cardStyle, marginBottom: S.lg, textAlign: "center" }}>
              <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.sm }}>{t("Ouvi:")} “{vs.transcript}”</div>
              <div style={{ fontSize: T.body, fontWeight: 700, marginBottom: S.md }}>
                {vs.parsed.ownGoal ? t("Próprio golo de") : t("Golo de")} {byId(vs.parsed.scorerId)?.nick}
                {vs.parsed.assistId && <> · {t("assist.")} {byId(vs.parsed.assistId)?.nick}</>}
                {" "}<span style={{ color: C.text2 }}>({teamName(vs.parsed.teamId)})</span>
              </div>
              <div style={{ display: "flex", gap: S.sm }}>
                <BtnGhost tone="accent" onClick={confirmVoice} style={{ flex: 1 }}><Check size={16} /> {t("Confirmar")}</BtnGhost>
                <BtnGhost onClick={() => setVoice(null)} style={{ flex: 1 }}>{t("Cancelar")}</BtnGhost>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: S.lg }}>
              {voiceHint && <div style={{ fontSize: T.meta, color: vs?.error === "not-allowed" ? C.orange : C.text2, textAlign: "center", marginBottom: S.sm }}>{voiceHint}</div>}
              <button type="button"
                onPointerDown={(e) => { e.preventDefault(); beginVoice(); }}
                onPointerUp={endVoice} onPointerLeave={endVoice} onPointerCancel={endVoice}
                onContextMenu={(e) => e.preventDefault()}
                style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm, background: listening ? C.accentDim : "transparent", color: listening ? C.accent : C.text2, border: `1px dashed ${listening ? C.accentBorder : C.border}`, borderRadius: R.control, fontSize: T.meta, fontWeight: 700, cursor: "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}>
                <Mic size={16} style={listening ? { animation: "mdpulse 1s infinite" } : undefined} />
                {listening ? t("A ouvir…") : t("Golo por voz — mantém premido e fala")}
              </button>
            </div>
          )
        )}

        {/* timeline */}
        <SectionLabel right={canManage && !concluded && events.length > 0 ? (
          <button type="button" onClick={() => onRemoveEvent(m.id, m.events.length - 1)}
            style={{ minHeight: 44, display: "flex", alignItems: "center", gap: S.xs, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", padding: 0 }}>
            <Undo2 size={14} /> {t("Desfazer último")}
          </button>
        ) : null}>{t("Lances")}</SectionLabel>
        <div style={{ ...cardStyle, padding: `0 ${S.lg}px`, marginBottom: S.lg }}>
          {events.length === 0 ? (
            <div style={{ fontSize: T.body, color: C.text2, padding: `${S.lg}px 0` }}>
              {canManage && !concluded ? t("Ainda sem lances. Usa os botões acima para registar.") : t("Ainda sem lances.")}
            </div>
          ) : events.map(({ e, idx }, i) => {
            const save = isSave(e);
            const who = byId(save ? e.playerId : e.scorerId);
            const meta = save ? t("Grande defesa")
              : e.ownGoal ? t("próprio golo")
              : e.assistId ? `${t("assist.")} ${byId(e.assistId)?.nick ?? "?"}` : t("sem assistência");
            const canAddAssist = canManage && Boolean(onUpdateEvent) && !save && !e.ownGoal && !e.assistId;
            return (
              <ListRow key={idx} divider={i > 0}
                leading={<span style={{ fontSize: 20 }} aria-hidden>{save ? "🧤" : "⚽"}</span>}
                title={<>{who?.nick ?? "?"}{e.minute ? <span style={{ color: C.text2, fontWeight: 600 }}> · {e.minute}'</span> : null}</>}
                meta={<><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: teamColor(e.teamId), marginRight: 6 }} />{teamName(e.teamId)} · {meta}</>}
                right={canManage ? (
                  <>
                    {canAddAssist && (
                      <button type="button" onClick={() => setSheet({ kind: "assist", initial: { goalIdx: idx, teamId: e.teamId, scorerId: e.scorerId } })}
                        style={{ minHeight: 44, background: "none", border: "none", color: C.accent, fontSize: T.meta, fontWeight: 800, cursor: "pointer", padding: `0 ${S.xs}px` }}>
                        + {t("assist.")}
                      </button>
                    )}
                    <button type="button" onClick={() => onRemoveEvent(m.id, idx)} aria-label={t("Remover")} title={t("Remover")}
                      style={{ width: 44, height: 44, marginRight: -12, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={16} />
                    </button>
                  </>
                ) : null} />
            );
          })}
        </div>

        {/* penalty shootout (play-off ties only) */}
        {tied && matchday.config?.penaltis && (
          <div style={{ ...cardStyle, marginBottom: S.lg }}>
            {m.penaltyWinnerId ? (
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", fontSize: T.body }}>
                <span style={{ flex: 1 }}>{t("Venceu nos pénaltis:")} <strong>{teamName(m.penaltyWinnerId)}</strong></span>
                {canManage && <BtnGhost compact onClick={() => onSetPenaltyWinner(m.id, null)}>{t("corrigir")}</BtnGhost>}
              </div>
            ) : !canManage ? (
              <div style={{ fontSize: T.body, color: C.text2 }}>{t("Empate — a aguardar o desempate por pénaltis.")}</div>
            ) : (
              <>
                <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md }}>{t("Empate — quem venceu nos pénaltis?")}</div>
                <div style={{ display: "flex", gap: S.sm }}>
                  {sides.map((tid) => <BtnGhost key={tid} onClick={() => onSetPenaltyWinner(m.id, tid)} style={{ flex: 1 }}>{teamName(tid)}</BtnGhost>)}
                </div>
              </>
            )}
          </div>
        )}

        {/* goalkeepers + substitutions + conclude (manager) */}
        {canManage && (
          <>
            <SectionLabel>{t("Guarda-redes")}</SectionLabel>
            <div style={{ ...cardStyle, marginBottom: S.lg }}>
              <div style={{ display: "flex", gap: S.sm }}>
                {[["homeGkId", m.homeId], ["awayGkId", m.awayId]].map(([side, teamId]) => (
                  <label key={side} style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: T.meta, fontWeight: 700, color: C.text2, marginBottom: S.xs, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamName(teamId)}</span>
                    <select value={m[side] ?? ""} onChange={(e) => onSetGoalkeeper(m.id, side, e.target.value ? Number(e.target.value) || e.target.value : null)}
                      style={{ width: "100%", minHeight: 44, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 8px", fontSize: T.body, color: m[side] ? C.text1 : C.text2, outline: "none" }}>
                      <option value="">{t("GR?")}</option>
                      {matchRoster(m, teamId).map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm }}>{t("Clean sheets e defesas espetaculares do GR escolhido contam ao terminar o dia.")}</div>
            </div>

            <div style={{ display: "flex", gap: S.sm, marginBottom: S.xl }}>
              <BtnGhost onClick={() => setSheet({ kind: "sub" })} style={{ flex: 1 }}>
                <ArrowLeftRight size={16} /> {t("Substituição")}
              </BtnGhost>
              {!concluded ? (
                <BtnGhost onClick={() => onSetMatchConcluded(m.id, true)} style={{ flex: 1, color: C.green, borderColor: C.greenBorder }}>
                  <Check size={16} /> {t("Concluir jogo")}
                </BtnGhost>
              ) : (
                <BtnGhost onClick={() => onSetMatchConcluded(m.id, false)} style={{ flex: 1 }}>
                  <RotateCcw size={16} /> {t("Reabrir")}
                </BtnGhost>
              )}
            </div>
          </>
        )}

        {/* tactics board — personal, device-local lineup planning; only once a team is big enough */}
        {sides.map(teamById).filter((tm) => tm && (tm.players?.length || 0) >= 7).map((tm) => (
          <Collapsible key={tm.id} icon={<LayoutGrid size={16} color={tm.color} />} title={`${t("Tática")} — ${tm.name}`}>
            <TacticsBoard team={tm} group={group} />
          </Collapsible>
        ))}
      </>
    );
  };

  return (
    <div>
      <style>{`@keyframes mdpulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* status row */}
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg, flexWrap: "wrap" }}>
        <Chip variant="red">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: C.red, animation: "mdpulse 1.2s infinite" }} />
            {t("Ao vivo")}
          </span>
        </Chip>
        <Chip Icon={modeChip.Icon}>{modeChip.label}</Chip>
      </div>

      {viewOptions.length > 1 && <SegmentedControl options={viewOptions} value={view} onChange={setView} />}

      {view === "jogo" && (
        <>
          {/* match switcher: Jogo 1 · Jogo 2 · … · + Novo */}
          {(matches.length > 1 || canManage) && (
            <div style={{ display: "flex", gap: S.sm, overflowX: "auto", scrollbarWidth: "none", marginBottom: S.lg, paddingBottom: 2 }}>
              {matches.map((x) => {
                const active = m && x.id === m.id;
                return (
                  <button key={x.id} type="button" onClick={() => setSelectedId(x.id)} style={pill(active)}>
                    {x.concluded && <Check size={14} color={active ? C.bg : C.green} />}
                    {matchLabel(x, roundSize)}
                    {x.concluded && !x.isBye && <span style={{ opacity: 0.8 }}>{goalsOf(x, x.homeId)}–{goalsOf(x, x.awayId)}</span>}
                  </button>
                );
              })}
              {canManage && !isPersonalizado && (
                <button type="button" onClick={startCompose} style={{ ...pill(false), borderStyle: "dashed" }}>
                  <Plus size={14} /> {t("Novo jogo")}
                </button>
              )}
            </div>
          )}

          {canManage && composing && (
            <div style={{ ...cardStyle, marginBottom: S.lg }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: S.md }}>
                <span style={{ flex: 1, fontSize: T.cardTitle, fontWeight: 700 }}>{t("Quem joga agora?")}</span>
                <button type="button" onClick={() => setComposing(null)} aria-label={t("Fechar")}
                  style={{ width: 44, height: 44, marginRight: -12, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
                {["homeId", "awayId"].map((side, idx) => (
                  <Fragment key={side}>
                    {idx === 1 && <span style={{ fontSize: T.meta, color: C.text2 }}>vs</span>}
                    <select value={composing[side]} onChange={(e) => setComposing((c) => ({ ...c, [side]: e.target.value }))}
                      style={{ flex: 1, minWidth: 0, minHeight: 44, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 8px", fontSize: T.body, color: C.text1, outline: "none" }}>
                      {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </Fragment>
                ))}
              </div>
              {composing.homeId === composing.awayId && <div style={{ fontSize: T.meta, color: C.red, marginBottom: S.sm }}>{t("Escolhe duas equipas diferentes.")}</div>}
              <BtnPrimary block onClick={confirmCompose} disabled={composing.homeId === composing.awayId}>{t("Criar jogo")}</BtnPrimary>
            </div>
          )}

          {renderMatch()}
        </>
      )}

      {view === "torneio" && showTournament && (
        <MatchdayStandings matchday={matchday} teams={list} canManage={canManage} onAdvancePlayoff={onAdvancePlayoff} />
      )}

      {view === "stats" && (
        <>
          <SectionLabel>{t("Stats do dia")}</SectionLabel>
          <div style={{ ...cardStyle, padding: `0 ${S.lg}px`, marginBottom: S.xl }}>
            {leaders.length === 0 ? (
              <div style={{ fontSize: T.body, color: C.text2, padding: `${S.lg}px 0` }}>{t("Ainda sem golos ou assistências registados hoje.")}</div>
            ) : leaders.map((row, i) => (
              <ListRow key={row.p.id} divider={i > 0}
                leading={<Avatar name={row.p.name} color={playerColor(group, row.p)} photo={row.p.photo} isMe={row.p.isMe} size={36} />}
                title={row.p.nick}
                meta={[row.goals ? `${row.goals} ${row.goals === 1 ? t("golo") : t("golos")}` : null, row.assists ? `${row.assists} ${t("assist.")}` : null, row.epicSaves ? `${row.epicSaves} ${row.epicSaves === 1 ? t("defesa") : t("defesas")}` : null].filter(Boolean).join(" · ")}
                right={<span style={{ fontSize: T.body, fontWeight: 800, color: i === 0 ? C.accent : C.text2 }}>#{i + 1}</span>} />
            ))}
          </div>
        </>
      )}

      {/* end of day */}
      {canManage && (
        <div style={{ marginTop: S.sm }}>
          <button type="button" onClick={onEnd}
            style={{ width: "100%", minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm, background: C.red, color: C.text1, border: `1px solid ${C.red}`, borderRadius: R.control, fontSize: T.body, fontWeight: 800, cursor: "pointer" }}>
            <Flag size={16} /> {t("Terminar jogo")}
          </button>
          <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center", marginTop: S.sm }}>{t("Fecha o dia: as stats entram na época e abre a votação MVP.")}</div>
          {onCancel && (
            <button type="button" onClick={onCancel}
              style={{ width: "100%", minHeight: 44, marginTop: S.xs, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: S.xs }}>
              <RotateCcw size={13} /> {t("Cancelar dia de jogo (começou errado)")}
            </button>
          )}
        </div>
      )}

      {sheet && m && (
        <LiveEventSheet key={sheet.kind + JSON.stringify(sheet.initial || {})}
          kind={sheet.kind} initial={sheet.initial} match={m} group={group}
          sides={[m.homeId, m.awayId]} roster={(teamId) => matchRoster(m, teamId)} allPlayers={allPlayers}
          playerById={byId} teamById={teamById} dayLeaders={leaders}
          onGoal={onGoal} onEpicSave={onEpicSave} onSubstitute={onSubstitute} onRevertSub={onRevertSub}
          onUpdateEvent={onUpdateEvent}
          onSwitchKind={(kind) => setSheet({ kind })}
          onClose={() => setSheet(null)} />
      )}
    </div>
  );
}
