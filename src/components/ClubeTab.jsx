import { useState } from "react";
import { CalendarDays, Ticket, Radar, Check, MapPin, CreditCard, Users, Plus, Trash2, ShieldCheck } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { COURT_HOURS } from "../data";
import { isoDay, dayChipLabel, fmtFullDay, fmtEUR } from "../lib/helpers";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const SEGMENTS = [
  { id: "reservas", Icon: CalendarDays, label: "Reservas" },
  { id: "eventos",  Icon: Ticket,       label: "Eventos"  },
  { id: "abertos",  Icon: Radar,        label: "Jogos abertos" },
];

const EMPTY_EVENT = { emoji: "📺", title: "", date: isoDay(3), time: "20:00", desc: "", kind: "", price: 0 };

/** Club tab: court booking, events with RSVP/payment, open matches.
 *  App owner (isAdmin) can create/remove events here. */
export default function ClubeTab({
  bookings, toggleBooking,
  events, rsvpEvent, payEvent,
  openMatches, joinOpenMatch,
  ownOpenSpots, ownPublished, publishOwnGame, game,
  isAdmin, onCreateEvent, onDeleteEvent,
}) {
  const [segment, setSegment] = useState("reservas");
  const [day, setDay] = useState(isoDay(0));
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState(EMPTY_EVENT);
  const days = Array.from({ length: 7 }, (_, i) => isoDay(i));

  const setD = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const submitEvent = async () => {
    if (!draft.title.trim()) return;
    await onCreateEvent(draft);
    setDraft(EMPTY_EVENT);
    setComposing(false);
  };

  const slotState = (court, hour) => {
    const b = bookings.find((x) => x.court === court && x.date === day && x.hour === hour);
    return b ? (b.mine ? "mine" : "taken") : "free";
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>O Clube</div>
        <div style={{ fontSize: 13, color: C.text2 }}>Campos, eventos e jogos abertos</div>
      </div>

      {/* segment control */}
      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
        {SEGMENTS.map(({ id, Icon, label }) => {
          const active = segment === id;
          return (
            <button key={id} onClick={() => setSegment(id)} style={{ flex: 1, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: "none", borderRadius: 10, padding: "9px 4px", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      {/* ── RESERVAS ─────────────────────────────────────── */}
      {segment === "reservas" && (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}>
            {days.map((d) => {
              const active = day === d;
              return (
                <button key={d} onClick={() => setDay(d)} style={{ background: active ? C.accentDim : C.card, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: active ? 800 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {dayChipLabel(d)}
                </button>
              );
            })}
          </div>

          {[1, 2].map((court) => (
            <div key={court} style={{ ...cardStyle, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <MapPin size={14} color={court === 1 ? C.accent : C.blue} />
                <span style={{ fontSize: 13, fontWeight: 800 }}>Campo {court}</span>
                <span style={{ fontSize: 11, color: C.text3, marginLeft: "auto" }}>{fmtFullDay(day)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {COURT_HOURS.map((hour) => {
                  const state = slotState(court, hour);
                  const booking = bookings.find((x) => x.court === court && x.date === day && x.hour === hour);
                  return (
                    <button
                      key={hour}
                      onClick={() => state !== "taken" && toggleBooking(court, day, hour)}
                      style={{
                        background: state === "mine" ? C.accentDim : state === "taken" ? C.surface : "transparent",
                        border: `1px solid ${state === "mine" ? C.accent : state === "taken" ? C.border : C.greenBorder}`,
                        color: state === "mine" ? C.accent : state === "taken" ? C.text3 : C.green,
                        borderRadius: 10, padding: "9px 4px", cursor: state === "taken" ? "default" : "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{hour}</div>
                      <div style={{ fontSize: 9, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {state === "mine" ? "Reservado ✓" : state === "taken" ? booking.groupName : "livre"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 24, textAlign: "center" }}>
            Toca num horário livre para reservar · toca na tua reserva para cancelar
          </div>
        </>
      )}

      {/* ── EVENTOS ──────────────────────────────────────── */}
      {segment === "eventos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {/* admin: create event */}
          {isAdmin && !composing && (
            <button onClick={() => setComposing(true)} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, cursor: "pointer", color: C.accent, border: `1px dashed ${C.accentBorder}`, background: C.accentDim, fontWeight: 800, fontSize: 13 }}>
              <Plus size={16} /> Criar evento <span style={{ fontSize: 10, color: C.text3, fontWeight: 400, display: "flex", alignItems: "center", gap: 3 }}><ShieldCheck size={11} /> dono</span>
            </button>
          )}
          {isAdmin && composing && (
            <div style={{ ...cardStyle, padding: 16, border: `1px solid ${C.accentBorder}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Novo evento</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input value={draft.emoji} onChange={(e) => setD("emoji", e.target.value)} maxLength={2}
                  style={{ width: 52, textAlign: "center", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 0", fontSize: 18, color: C.text1, outline: "none" }} />
                <input value={draft.title} onChange={(e) => setD("title", e.target.value)} placeholder="Título do evento"
                  style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <input type="date" value={draft.date} onChange={(e) => setD("date", e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text1, outline: "none", colorScheme: "dark" }} />
                <input type="time" value={draft.time} onChange={(e) => setD("time", e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text1, outline: "none", colorScheme: "dark" }} />
              </div>
              <textarea value={draft.desc} onChange={(e) => setD("desc", e.target.value)} placeholder="Descrição" rows={2}
                style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text1, outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 10 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <select value={draft.kind} onChange={(e) => setD("kind", e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 8px", fontSize: 13, color: C.text1, outline: "none" }}>
                  <option value="">Entrada livre</option>
                  <option value="mesa">Reserva de mesa</option>
                  <option value="bilhete">Bilhete</option>
                </select>
                <input type="number" min="0" value={draft.price} onChange={(e) => setD("price", Number(e.target.value))} placeholder="Preço €" disabled={!draft.kind}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: draft.kind ? C.text1 : C.text3, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <BtnPrimary onClick={submitEvent} style={{ flex: 1 }}>Publicar evento</BtnPrimary>
                <button onClick={() => { setComposing(false); setDraft(EMPTY_EVENT); }} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              </div>
            </div>
          )}

          {events.length === 0 && !composing && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "28px 20px", color: C.text2, fontSize: 13 }}>
              Ainda não há eventos no clube.
            </div>
          )}

          {events.map((ev) => {
            const priceLabel = ev.kind === "mesa" ? `Mesa · ${fmtEUR(ev.price)}` : ev.kind === "bilhete" ? `Bilhete · ${fmtEUR(ev.price)}` : "Entrada livre";
            return (
              <div key={ev.id} style={{ ...cardStyle, padding: 16 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {ev.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{ev.title}</div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{fmtFullDay(ev.date)} · {ev.time} · {priceLabel}</div>
                  </div>
                  {isAdmin && onDeleteEvent && (
                    <button onClick={() => window.confirm("Apagar este evento?") && onDeleteEvent(ev.id)}
                      title="Apagar evento"
                      style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", padding: 4, flexShrink: 0, alignSelf: "flex-start" }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5, marginBottom: 12 }}>{ev.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.text3, display: "flex", alignItems: "center", gap: 4 }}>
                    <Users size={11} /> {ev.going + (ev.myStatus ? 1 : 0)} confirmados
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    {ev.myStatus === null && (
                      <button onClick={() => rsvpEvent(ev.id)} style={{ background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                        Vou! 🎟
                      </button>
                    )}
                    {ev.myStatus === "going" && ev.price > 0 && (
                      <button onClick={() => payEvent(ev.id)} style={{ background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                        <CreditCard size={13} /> Pagar {fmtEUR(ev.price)} · MB Way
                      </button>
                    )}
                    {ev.myStatus === "going" && ev.price === 0 && (
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Confirmado</span>
                    )}
                    {ev.myStatus === "paid" && (
                      <span style={{ fontSize: 12, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><Check size={13} /> Pago · lugar garantido</span>
                    )}
                    {ev.myStatus !== null && (
                      <button onClick={() => rsvpEvent(ev.id, true)} style={{ background: "none", color: C.text3, border: "none", fontSize: 11, cursor: "pointer" }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── JOGOS ABERTOS ────────────────────────────────── */}
      {segment === "abertos" && (
        <>
          {/* publish own game */}
          {ownOpenSpots > 0 && (
            <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${ownPublished ? C.greenBorder : C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {ownPublished ? "As vossas vagas estão publicadas ✓" : `O vosso jogo tem ${ownOpenSpots} ${ownOpenSpots === 1 ? "vaga" : "vagas"}`}
                  </div>
                  <div style={{ fontSize: 11, color: C.text2 }}>
                    {ownPublished ? "Membros do clube podem inscrever-se" : "Publica para qualquer membro do clube se juntar"}
                  </div>
                </div>
                <button onClick={publishOwnGame} style={{ background: ownPublished ? C.surface : C.accent, color: ownPublished ? C.text2 : C.bg, border: ownPublished ? `1px solid ${C.border}` : "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {ownPublished ? "Retirar" : "Publicar"}
                </button>
              </div>
            </div>
          )}

          <SectionLabel style={{ marginBottom: 10 }}>PRECISAM DE JOGADORES</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {openMatches.map((m) => {
              const full = m.spotsLeft === 0;
              return (
                <div key={m.id} style={{ ...cardStyle, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{m.groupName}</div>
                      <div style={{ fontSize: 11, color: C.text2 }}>
                        {fmtFullDay(m.date)} · {m.time} · {m.court} · {fmtEUR(m.price)}/jogador
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, background: m.level === "Competitivo" ? C.redDim : C.blueDim, color: m.level === "Competitivo" ? C.red : C.blue, borderRadius: 20, padding: "3px 10px" }}>
                      {m.level}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: full ? C.text3 : C.orange }}>
                      {full ? "Completo" : `${m.spotsLeft} ${m.spotsLeft === 1 ? "vaga" : "vagas"}`}
                    </span>
                    <div style={{ marginLeft: "auto" }}>
                      {m.joined ? (
                        <span style={{ fontSize: 12, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Check size={13} /> Inscrito — até sábado!
                        </span>
                      ) : (
                        <button onClick={() => joinOpenMatch(m.id)} disabled={full} style={{ background: full ? C.surface : C.accent, color: full ? C.text3 : C.bg, border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: full ? "default" : "pointer" }}>
                          Inscrever-me
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
