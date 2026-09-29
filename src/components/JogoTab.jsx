import { useState, useEffect } from "react";
import {
  Clock, MapPin, Check, MessageCircle, CreditCard, Plus, Minus, Share2, Copy, Lock, UserPlus, Pencil, Cross, CalendarDays, History,
} from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont, fieldWash, BRAND } from "../theme";
import { ini, playerColor, fmtEUR, splitWaitlist, isoDay, toIsoDay, fmtFullDay } from "../lib/helpers";
import { t } from "../lib/i18n";
import { fetchGameWeather, weatherIconFor } from "../lib/weather";
import { openWhatsApp, groupInviteMessage, inviteMessage, lineupShareMessage } from "../lib/whatsapp";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import ListRow from "./ListRow";
import ShareSheet from "./ShareSheet";

const inputStyle = {
  borderRadius: R.control, padding: "0 12px", minHeight: TOUCH.min, fontSize: T.body, outline: "none", colorScheme: "dark",
};

/** Date + time pickers shared by "Agendar primeiro jogo" and "Alterar". */
function DateTimeInputs({ date, time, onDate, onTime }) {
  const st = { ...inputStyle, background: C.surface, border: `1px solid ${C.border}`, color: C.text1 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
      <input type="date" min={isoDay()} value={date} onChange={(e) => onDate(e.target.value)} style={st} />
      <input type="time" value={time} onChange={(e) => onTime(e.target.value)} style={st} />
    </div>
  );
}

/**
 * Jogar → Jogos. The next game card is the screen: the slot grid on
 * the field artwork answers "temos jogo?" at a glance, and my one-tap
 * confirm/decline (or pay) lives in the same card as its single
 * primary CTA. Everything operational — roster by status, payments,
 * reminders, material — moved to Game Detail (`onOpenDetail`). The team
 * draw is no longer here: it lives in Matchday pre-match.
 * Below: my other upcoming games (other groups), optional "Encontrar
 * jogo" (flagged), and past games.
 */
export default function JogoTab({
  group, game, toggleMyStatus, payMine,
  inviteUrl, canManageGame, onSetSpots, onReschedule, onScheduleGame, confirmOpen = true, opensAtLabel,
  onOpenDetail, upcoming = [], findGame = null, pastGames = [], onOpenHistory,
}) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  // A real calendar date, not just a weekday — the first/next game is
  // often weeks out (e.g. a one-off on 13/09), where "next Saturday"
  // silently picks the wrong date.
  const [draftDate, setDraftDate] = useState(() => game.kickoffAt ? toIsoDay(game.kickoffAt) : isoDay(7));
  const [draftTime, setDraftTime] = useState(game.time);
  const [weather, setWeather] = useState(null);

  // Passive weather info next to date/venue — silently absent if the
  // venue can't be geocoded or the game is outside the forecast window.
  const kickoffTime = game.kickoffAt?.getTime();
  useEffect(() => {
    let cancelled = false;
    setWeather(null);
    if (!game.noGameScheduled && (game.city || game.venue) && game.kickoffAt) {
      fetchGameWeather(game.venue, game.kickoffAt, game.city).then((w) => { if (!cancelled) setWeather(w); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.venue, game.city, kickoffTime, game.noGameScheduled]);

  const extras = (
    <>
      {upcoming.length > 0 && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel>{t("OUTROS JOGOS")}</SectionLabel>
          <div style={{ ...cardStyle, padding: "0 16px" }}>
            {upcoming.map((g, i) => (
              <ListRow key={g.id} divider={i > 0}
                leading={<CalendarDays size={20} color={C.text2} />}
                title={g.groupName}
                meta={`${g.dateLabel} · ${g.timeLabel}${g.venue ? ` · ${g.venue}` : ""}`}
                onClick={g.onOpen} chevron={Boolean(g.onOpen)} />
            ))}
          </div>
        </div>
      )}
      {findGame && <div style={{ marginTop: S.xl }}>{findGame}</div>}
      {pastGames.length > 0 && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel right={onOpenHistory ? (
            <button onClick={onOpenHistory} style={{ background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", minHeight: TOUCH.min, padding: 0 }}>{t("Ver tudo")}</button>
          ) : null}>{t("JOGOS ANTERIORES")}</SectionLabel>
          <div style={{ ...cardStyle, padding: "0 16px" }}>
            {pastGames.slice(0, 5).map((g, i) => (
              <ListRow key={g.id} divider={i > 0}
                leading={<History size={20} color={C.text2} />}
                title={g.date}
                meta={[g.games > 1 ? `${g.games} ${t("jogos")}` : null, g.confirmed ? `${g.confirmed} ${g.confirmed === 1 ? t("jogador") : t("jogadores")}` : null, g.mvpNick ? `MVP ${g.mvpNick}` : null].filter(Boolean).join(" · ")}
                right={<span style={{ ...displayFont, fontSize: T.cardTitle + 2, color: C.text1 }}>{g.result}</span>}
                onClick={onOpenHistory} chevron={false} />
            ))}
          </div>
        </div>
      )}
    </>
  );

  // "Ainda não sei o dia/hora" at onboarding — the group exists but has
  // no game yet. Everyone sees an empty state; only the organizer gets
  // the date/time picker to schedule the first one.
  if (game.noGameScheduled) {
    return (
      <div style={{ padding: "0 16px 24px" }}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 700, marginBottom: S.xs + 2 }}>{t("Nenhum jogo marcado")}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginBottom: canManageGame ? S.lg : 0 }}>
            {canManageGame ? t("Escolhe a data e a hora do primeiro jogo do grupo.") : t("O organizador ainda não marcou o próximo jogo.")}
          </div>
          {canManageGame && onScheduleGame && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: S.sm }}>
                <DateTimeInputs date={draftDate} time={draftTime} onDate={setDraftDate} onTime={setDraftTime} />
              </div>
              <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.lg }}>{fmtFullDay(draftDate)}</div>
              <BtnPrimary block onClick={() => onScheduleGame(draftDate, draftTime)}>{t("Agendar primeiro jogo")}</BtnPrimary>
            </>
          )}
        </div>
        {extras}
      </div>
    );
  }

  const confirmed = group.filter((p) => p.status === "confirmed");
  const me        = group.find((p) => p.isMe);
  // Once the game is full, extra confirmations form an ordered waiting line.
  const { playing, waitlist } = splitWaitlist(confirmed, game.spots);
  const myWaitPos = me ? waitlist.findIndex((p) => p.id === me.id) + 1 : 0; // 1-based, 0 = not waiting
  const spotsLeft = game.spots - playing.length;
  const full      = spotsLeft <= 0;
  const shareUrl  = inviteUrl || window.location.origin;
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const price     = fmtEUR(game.priceEach);
  const pending   = confirmOpen && me && me.status !== "confirmed" && me.status !== "declined";
  const emptySlots = Math.max(0, game.spots - playing.length);

  const iconBtn = { width: TOUCH.min, height: TOUCH.min, borderRadius: R.control, background: C.surface, border: `1px solid ${C.border}`, color: C.text1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 };

  // ── my status: ONE primary CTA for the card ─────────────────────
  let myBlock;
  if (!confirmOpen) {
    myBlock = (
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <Lock size={20} color={C.text2} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: T.body, fontWeight: 700 }}>{t("Confirmações ainda fechadas")}</div>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Abrem")} {opensAtLabel}. {t("Vais poder confirmar num toque.")}</div>
        </div>
      </div>
    );
  } else if (me?.status === "confirmed" && myWaitPos > 0) {
    myBlock = (
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <div style={{ ...displayFont, fontSize: T.h, color: C.orange, width: 36, textAlign: "center", flexShrink: 0 }}>{myWaitPos}º</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.body, fontWeight: 700 }}>{t("Estás na lista de espera")}</div>
          <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Entras automaticamente se alguém desistir. Sem pagar até entrares.")}</div>
        </div>
        <BtnGhost compact tone="danger" onClick={() => toggleMyStatus("declined")}>{t("Sair da lista")}</BtnGhost>
      </div>
    );
  } else if (me?.status === "confirmed") {
    myBlock = (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: me.paid ? 0 : S.md }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: C.greenDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Check size={18} color={C.green} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: T.body, fontWeight: 700, color: C.green }}>{t("Estás dentro!")}</div>
            <div style={{ fontSize: T.meta, color: C.text2 }}>{me.paid ? t("Pago ✓ — bom jogo!") : `${t("Falta pagar")} ${price}`}</div>
          </div>
          <BtnGhost compact tone="danger" onClick={() => toggleMyStatus("declined")}>{t("Cancelar")}</BtnGhost>
        </div>
        {!me.paid && game.priceEach > 0 && (
          <BtnPrimary block onClick={payMine}><CreditCard size={16} /> {t("Pagar")} {price} · MB Way</BtnPrimary>
        )}
      </>
    );
  } else if (me?.status === "declined") {
    myBlock = (
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <div style={{ flex: 1, fontSize: T.body, color: C.text2 }}>{t("Disseste que não podes. Mudaste de ideias?")}</div>
        <BtnGhost tone="accent" onClick={() => toggleMyStatus("confirmed")}>{t("Afinal vou!")}</BtnGhost>
      </div>
    );
  } else if (me) {
    myBlock = (
      <>
        <div style={{ fontSize: T.body, fontWeight: 700, marginBottom: S.md }}>
          {!full ? t("Vais jogar?") : t("Jogo cheio — entra na lista de espera e entras se alguém desistir.")}
        </div>
        <div style={{ display: "flex", gap: S.sm }}>
          <BtnPrimary onClick={() => toggleMyStatus("confirmed")} style={{ flex: 1 }}>{!full ? t("Estou dentro!") : t("Entrar na lista de espera")}</BtnPrimary>
          <BtnGhost onClick={() => toggleMyStatus("declined")} style={{ flex: 1 }}>{t("Não posso")}</BtnGhost>
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: "0 16px 24px" }}>

      {/* ── NEXT GAME — the slot grid is the hero ── */}
      <div style={{
        ...cardStyle, padding: 0, position: "relative", overflow: "hidden",
        borderLeft: pending ? `3px solid ${C.accent}` : cardStyle.border,
      }}>
        {/* Lighter wash than before so the navy pitch artwork reads behind
            the grid (the original hero); text sits on the darker top/bottom. */}
        <div style={{ position: "relative", overflow: "hidden", padding: S.lg }}>
          {/* portrait pitch: the landscape artwork rotated 90° (16:9 box
              whose height = card width), lines lifted a touch so it reads
              as a pitch like the original hero. */}
          <img src={BRAND.field} alt="" aria-hidden="true" style={{
            position: "absolute", top: "50%", left: "50%", width: "177.78%", aspectRatio: "16 / 9",
            transform: "translate(-50%, -50%) rotate(90deg)", objectFit: "cover",
            filter: "brightness(1.5) contrast(1.15)", pointerEvents: "none",
          }} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: fieldWash(0.3, 0.5), pointerEvents: "none" }} />
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: S.sm, marginBottom: S.lg, position: "relative" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.xs }}>
                <span style={{ fontSize: T.meta, fontWeight: 700, letterSpacing: "0.08em", color: C.text2 }}>{t("PRÓXIMO JOGO")}</span>
                {game.recurring && <Chip style={{ height: 22, fontSize: T.min }}>{t("Semanal")}</Chip>}
              </div>
              <div style={{ fontSize: T.h, fontWeight: 800, lineHeight: 1.2, overflowWrap: "break-word" }}>{game.label}</div>
              <div style={{ display: "flex", alignItems: "center", columnGap: S.md, rowGap: S.xs, fontSize: T.meta, color: C.text2, flexWrap: "wrap", marginTop: S.xs }}>
                <span style={{ display: "flex", alignItems: "center", gap: S.xs }}><Clock size={13} /> {game.date} · {game.time}</span>
                {game.venue && <span style={{ display: "flex", alignItems: "center", gap: S.xs }}><MapPin size={13} /> {game.venue}</span>}
                {weather && (() => {
                  const { Icon, label } = weatherIconFor(weather.code);
                  return (
                    <span title={label} style={{ display: "flex", alignItems: "center", gap: S.xs }}>
                      <Icon size={13} /> {weather.tMax}° / {weather.tMin}°
                    </span>
                  );
                })()}
              </div>
            </div>
            {canManageGame && onReschedule && (
              <button onClick={() => { setDraftDate(toIsoDay(game.kickoffAt)); setDraftTime(game.time); setRescheduling(!rescheduling); }}
                title={t("Alterar dia e hora do jogo")} aria-label={t("Alterar dia e hora do jogo")} style={iconBtn}>
                <Pencil size={16} />
              </button>
            )}
            <button onClick={() => setShareOpen(true)} title={t("Partilhar jogo")} aria-label={t("Partilhar jogo")} style={iconBtn}>
              <Share2 size={16} />
            </button>
          </div>

          {/* reschedule (organizer) */}
          {rescheduling && canManageGame && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: S.md, marginBottom: S.lg, position: "relative" }}>
              <div style={{ fontSize: T.body, fontWeight: 700, marginBottom: S.sm }}>{t("Alterar dia e hora do jogo")}</div>
              <DateTimeInputs date={draftDate} time={draftTime} onDate={setDraftDate} onTime={setDraftTime} />
              <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.sm}px 0 ${S.md}px` }}>
                {t("O próximo jogo passa para")} <b style={{ color: C.text1 }}>{fmtFullDay(draftDate)} {t("às")} {draftTime}</b>{game.recurring ? t(" — e as próximas semanas também, nesse dia da semana.") : "."}
              </div>
              <div style={{ display: "flex", gap: S.sm }}>
                <BtnPrimary onClick={() => { onReschedule(draftDate, draftTime); setRescheduling(false); }} style={{ flex: 1 }}>{t("Guardar")}</BtnPrimary>
                <BtnGhost onClick={() => setRescheduling(false)} style={{ flex: 1 }}>{t("Cancelar")}</BtnGhost>
              </div>
            </div>
          )}

          {/* count */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.md, position: "relative" }}>
            <div>
              <span style={{ ...displayFont, fontSize: 40, lineHeight: 1, color: full ? C.green : C.text1 }}>{playing.length}</span>
              <span style={{ fontSize: T.h, fontWeight: 600, color: C.text2 }}>/{game.spots}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              {!full
                ? <div style={{ fontSize: T.body, color: C.orange, fontWeight: 700 }}>{spotsLeft} {spotsLeft === 1 ? t("vaga em aberto") : t("vagas em aberto")}</div>
                : <div style={{ fontSize: T.body, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: S.xs, justifyContent: "flex-end" }}><Check size={15} /> {t("Equipa completa!")}</div>}
              {waitlist.length > 0 && <div style={{ fontSize: T.meta, color: C.orange, fontWeight: 700, marginTop: 2 }}>{waitlist.length} {t("na lista de espera")}</div>}
            </div>
          </div>

          {/* the grid: filled + empty squares */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: S.sm, rowGap: S.md, position: "relative" }}>
            {playing.map((player) => {
              const color = playerColor(group, player);
              return (
                <div key={player.id} style={{ textAlign: "center", minWidth: 0 }}>
                  <div style={{
                    width: "100%", aspectRatio: "1", borderRadius: 14, boxSizing: "border-box",
                    background: player.photo ? C.surface : player.isMe ? C.accentDim : `${color}22`,
                    border: `2px solid ${player.isMe ? C.accent : color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: T.body, fontWeight: 800, color: player.isMe ? C.accent : color, position: "relative",
                  }}>
                    {player.photo
                      ? <img src={player.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                      : ini(player.name)}
                    {player.paid && (
                      <div title={t("Pago")} style={{ position: "absolute", bottom: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
                        <Check size={8} strokeWidth={3} color={C.bg} />
                      </div>
                    )}
                    {player.injured && (
                      <div title={t("Lesionado")} style={{ position: "absolute", top: -6, left: -6, width: 16, height: 16, borderRadius: 8, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.card}` }}>
                        <Cross size={9} strokeWidth={3} color={C.text1} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: T.min, color: player.isMe ? C.accent : C.text2, marginTop: S.xs, fontWeight: player.isMe ? 800 : 600, lineHeight: 1.2, letterSpacing: "-0.02em", marginLeft: -2, marginRight: -2 }}>{player.nick}</div>
                </div>
              );
            })}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} style={{ textAlign: "center", minWidth: 0 }}>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 14, boxSizing: "border-box", border: `2px dashed ${C.border}`, background: `${C.bg}66`, display: "flex", alignItems: "center", justifyContent: "center", color: C.text3 }}>
                  <Plus size={16} />
                </div>
                <div style={{ fontSize: T.min, color: C.text3, marginTop: S.xs }}>&nbsp;</div>
              </div>
            ))}
          </div>

          {/* spots control — organizer only */}
          {canManageGame && (
            <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.md, position: "relative" }}>
              <span style={{ fontSize: T.meta, color: C.text2, flex: 1 }}>{t("Nº de jogadores:")}</span>
              <button onClick={() => onSetSpots(game.spots - 1)} disabled={game.spots <= 2} aria-label="-"
                style={{ ...iconBtn, opacity: game.spots <= 2 ? 0.4 : 1, cursor: game.spots <= 2 ? "default" : "pointer" }}><Minus size={16} /></button>
              <span style={{ ...displayFont, fontSize: T.h, minWidth: 28, textAlign: "center" }}>{game.spots}</span>
              <button onClick={() => onSetSpots(game.spots + 1)} disabled={game.spots >= 35} aria-label="+"
                style={{ ...iconBtn, opacity: game.spots >= 35 ? 0.4 : 1, cursor: game.spots >= 35 ? "default" : "pointer" }}><Plus size={16} /></button>
            </div>
          )}
        </div>

        {/* my status + the card's single primary CTA */}
        {myBlock && <div style={{ padding: S.lg, borderTop: `1px solid ${C.border}` }}>{myBlock}</div>}

        {/* → Game Detail */}
        {onOpenDetail && (
          <div style={{ padding: "0 16px" }}>
            <ListRow onClick={onOpenDetail}
              title={t("Detalhes do jogo")}
              meta={t("Plantel · Pagamentos · Material")} />
          </div>
        )}
      </div>

      {/* INVITE — prominent while the group is still small (organizer) */}
      {canManageGame && group.length <= Math.max(6, Math.ceil(game.spots / 2)) && (
        <div style={{ ...cardStyle, marginTop: S.lg }}>
          <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
            <UserPlus size={20} color={C.text2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: T.cardTitle, fontWeight: 700 }}>{t("Agora convida os jogadores 📣")}</div>
              <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Partilha o link — quem abrir entra logo no grupo.")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: S.sm }}>
            <button onClick={() => openWhatsApp(inviteUrl ? groupInviteMessage(game.groupName, shareUrl) : inviteMessage(game.groupName, game))}
              style={{ flex: 1, minHeight: TOUCH.button, background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, fontSize: T.body, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm }}>
              <MessageCircle size={16} /> {t("Convidar")}
            </button>
            <BtnGhost onClick={copyShare} style={copied ? { color: C.green, borderColor: C.greenBorder } : undefined}>
              {copied ? <><Check size={16} /> {t("Copiado")}</> : <><Copy size={16} /> Link</>}
            </BtnGhost>
          </div>
        </div>
      )}

      {extras}

      {shareOpen && (
        <ShareSheet
          title={t("Partilhar jogo")}
          onClose={() => setShareOpen(false)}
          options={[
            { icon: Copy, label: t("Copiar link do jogo"), done: copied, onClick: copyShare },
            ...(playing.length > 0 ? [{
              icon: MessageCircle,
              label: t("Enviar lista no WhatsApp"),
              desc: t("Confirmados, vagas e preço"),
              onClick: () => { openWhatsApp(lineupShareMessage(game, playing, waitlist, price, shareUrl)); setShareOpen(false); },
            }] : []),
          ]}
        />
      )}
    </div>
  );
}
