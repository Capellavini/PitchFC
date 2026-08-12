import { useState } from "react";
import { MessageCircle, ChevronRight, ChevronDown, Copy, Check, ShieldCheck, UserPlus, X, UserCheck, UserX, Trash2, UserMinus, Ban, ArrowDownAZ } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { POSITIONS } from "../data";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, inviteMessage, groupInviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import Collapsible from "./Collapsible";

const tierColor = (overall) => overall >= 80 ? C.gold : overall >= 70 ? C.silver : C.bronze;
const EMPTY_GUEST = { name: "", position: "Médio", overall: "" };

export default function GrupoTab({ group, game, openProfile, cloudMode, inviteUrl, isOrganizer, onToggleAssistant, onAddManualPlayer, onSetPlayerStatus, onRemoveGuestPlayer, onRemoveMember, bannedMembers, onUnbanMember, canManageTeams, records = [], onDeleteMatchday, totalGames }) {
  const [view, setView] = useState("squad"); // 'squad' | 'records'
  const [sortAZ, setSortAZ] = useState(false);
  const [openRecordId, setOpenRecordId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const submitGuest = () => {
    if (!guest.name.trim()) return;
    onAddManualPlayer({ name: guest.name, position: guest.position, overall: guest.overall ? Number(guest.overall) : null });
    setGuest(EMPTY_GUEST);
    setGuestOpen(false);
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const sortItems = (items) => (sortAZ ? [...items].sort((a, b) => a.nick.localeCompare(b.nick, "pt")) : items);
  // Compact day highlights for Records — computed from that day's saved
  // per-player lines, no new data. Each award only shows if someone
  // actually earned it (no "0 golos" Golden Boot).
  const dayAwards = (lines) => {
    const list = lines || [];
    if (!list.length) return [];
    const bestBy = (score) => list.reduce((best, l) => (score(l) > score(best || {}) ? l : best), null);
    const goldenBoot = bestBy((l) => l.goals || 0);
    const bestOfDay = bestBy((l) => (l.goals || 0) + (l.assists || 0));
    const playmaker = bestBy((l) => l.assists || 0);
    const goldenGlove = bestBy((l) => l.cleanSheets || 0);
    return [
      goldenBoot?.goals > 0 && ["🥇", t("Golden Boot"), goldenBoot.nick, goldenBoot.goals],
      bestOfDay && (bestOfDay.goals || 0) + (bestOfDay.assists || 0) > 0 && ["🌟", t("Best of the Day"), bestOfDay.nick, (bestOfDay.goals || 0) + (bestOfDay.assists || 0)],
      playmaker?.assists > 0 && ["🎯", t("Playmaker"), playmaker.nick, playmaker.assists],
      goldenGlove?.cleanSheets > 0 && ["🧤", t("Golden Glove"), goldenGlove.nick, goldenGlove.cleanSheets],
    ].filter(Boolean);
  };
  const sections = [
    { label: "CONFIRMADOS",  items: sortItems(group.filter((p) => p.status === "confirmed")) },
    { label: "SEM RESPOSTA", items: sortItems(group.filter((p) => p.status === "pending"))   },
    { label: "NÃO PODEM",    items: sortItems(group.filter((p) => p.status === "declined"))  },
  ];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ padding: "20px 0 16px" }}>
        <div style={{ ...displayFont, fontSize: 22 }}>League</div>
        <div style={{ fontSize: 13, color: C.text2 }}>{group.length} {t("jogadores")} · {game.groupName}</div>
      </div>

      <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 }}>
        {[["squad", "Squad"], ["records", "Records"]].map(([id, label]) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id)} style={{ flex: 1, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: "none", borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>

      {view === "records" ? (
        <div style={{ marginBottom: 24 }}>
          {records.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "22px 20px" }}>
              <div style={{ fontSize: 13, color: C.text2 }}>{t("Ainda sem dias de jogo registados.")}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {records.map((r) => {
                const open = openRecordId === r.id;
                return (
                  <div key={r.id} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                    <button onClick={() => setOpenRecordId(open ? null : r.id)}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", color: C.text1, display: "flex", alignItems: "center", gap: 12, padding: 14, textAlign: "left" }}>
                      <div style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
                        <div style={{ ...displayFont, fontSize: 16 }}>{r.totalGoals}⚽</div>
                        <div style={{ fontSize: 10, color: C.text2 }}>{r.date}</div>
                      </div>
                      <div style={{ width: 1, height: 30, background: C.border }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.text2 }}>{r.nGames} {r.nGames === 1 ? t("jogo") : t("jogos")}</div>
                        {r.mvpNick ? (
                          <div style={{ fontSize: 12, marginTop: 1 }}>⭐ MVP: <span style={{ fontWeight: 700 }}>{r.mvpNick}</span></div>
                        ) : (
                          <div style={{ fontSize: 12, marginTop: 1, color: C.text3 }}>⭐ {r.mvpOpen ? t("votação a decorrer") : t("sem votos")}</div>
                        )}
                      </div>
                      <ChevronDown size={16} color={C.text3} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                    </button>
                    {open && (
                      <div style={{ padding: "0 14px 14px" }}>
                        {dayAwards(r.summary?.lines).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                            {dayAwards(r.summary?.lines).map(([icon, label, nick, val]) => (
                              <div key={label} title={label} style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px 4px 6px" }}>
                                <span style={{ fontSize: 12 }}>{icon}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.text1 }}>{nick}</span>
                                <span style={{ fontSize: 10, color: C.text3 }}>{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(r.summary?.matches ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                            {r.summary.matches.map((m) => (
                              <div key={m.n} style={{ background: C.surface, borderRadius: 10, padding: "8px 10px", textAlign: "center", flex: 1, minWidth: 90 }}>
                                <div style={{ fontSize: 9, color: C.text3, fontWeight: 800 }}>{t("JOGO")} {m.n}</div>
                                <div style={{ ...displayFont, fontSize: 16 }}>{m.homeGoals}–{m.awayGoals}</div>
                                <div style={{ fontSize: 9, color: C.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.homeName} vs {m.awayName}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {(r.summary?.lines ?? []).length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: isOrganizer && cloudMode ? 12 : 0 }}>
                            {r.summary.lines.map((l) => (
                              <div key={l.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Avatar name={l.nick} color={l.color || C.text2} size={24} fontSize={9} photo={l.photo} />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nick}</span>
                                <span style={{ fontSize: 11, color: C.text2, display: "flex", gap: 8, flexShrink: 0 }}>
                                  {l.goals > 0 && <span>⚽ {l.goals}</span>}
                                  {l.assists > 0 && <span>🎯 {l.assists}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {isOrganizer && cloudMode && onDeleteMatchday && (
                          <button onClick={() => onDeleteMatchday(r.id, r.date)}
                            style={{ width: "100%", background: C.redDim, color: C.red, border: `1px solid ${C.red}44`, borderRadius: 10, padding: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Trash2 size={13} /> {t("Apagar este dia de jogo")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setSortAZ((s) => !s)}
          style={{ background: sortAZ ? C.accentDim : C.card, color: sortAZ ? C.accent : C.text2, border: `1px solid ${sortAZ ? C.accentBorder : C.border}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          <ArrowDownAZ size={13} /> A–Z
        </button>
        <div style={{ flex: 1 }} />
        {inviteUrl ? (
          <>
            <button onClick={() => openWhatsApp(groupInviteMessage(game.groupName, inviteUrl))}
              style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <MessageCircle size={13} /> {t("Convidar")}
            </button>
            <button onClick={copyInvite}
              style={{ background: C.card, color: copied ? C.green : C.text2, border: `1px solid ${copied ? C.greenBorder : C.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </>
        ) : (
          <button onClick={() => openWhatsApp(inviteMessage(game.groupName, game))}
            style={{ background: C.whatsapp, color: C.bg, border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <MessageCircle size={13} /> {t("Convidar")}
          </button>
        )}
      </div>

      {sections.map((section) => section.items.length > 0 && (
        <div key={section.label} style={{ marginBottom: 20 }}>
          <SectionLabel style={{ color: C.text3, marginBottom: 10 }}>{t(section.label)} ({section.items.length})</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {section.items.map((p) => {
              const locked = p.ratingsCount != null && p.ratingsCount < 3;
              const overall = locked ? 0 : computeOverall(p.position, p.attrs);
              return (
                <button key={p.id} onClick={() => openProfile(p.id)} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", color: C.text1 }}>
                  <Avatar name={p.name} color={playerColor(group, p)} size={40} fontSize={13} isMe={p.isMe} photo={p.photo} injured={p.injured} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: p.isMe ? 800 : 600, color: p.isMe ? C.accent : C.text1 }}>
                      {p.nick} {p.isMe && <span style={{ fontSize: 10, color: C.text2, fontWeight: 400 }}>{t("(tu)")}</span>}
                      {p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.blue, fontWeight: 700, marginLeft: 6 }}>ORG</span>}
                      {p.isAssistant && !p.isOrganizerPlayer && <span style={{ fontSize: 9, color: C.green, fontWeight: 700, marginLeft: 6 }}>{t("AUXILIAR")}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.text2 }}>{t(p.position)} · {p.gamesPlayed}/{totalGames || 0} {t("jogos")}</div>
                  </div>
                  {canManageTeams && !p.isMe && (
                    <>
                      <span
                        role="button"
                        title={p.status === "confirmed" ? t("Remover do jogo") : t("Confirmar")}
                        onClick={(e) => { e.stopPropagation(); onSetPlayerStatus(p.id, p.status === "confirmed" ? "declined" : "confirmed"); }}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: p.status === "confirmed" ? C.orangeDim : C.greenDim, border: `1px solid ${p.status === "confirmed" ? C.orange : C.greenBorder}55`, cursor: "pointer", flexShrink: 0 }}
                      >
                        {p.status === "confirmed" ? <UserX size={14} color={C.orange} /> : <UserCheck size={14} color={C.green} />}
                      </span>
                      {p.isGuest && (
                        <span
                          role="button"
                          title={t("Apagar jogador")}
                          onClick={(e) => { e.stopPropagation(); onRemoveGuestPlayer(p.id, p.nick); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: C.redDim, border: `1px solid ${C.red}44`, cursor: "pointer", flexShrink: 0 }}
                        >
                          <Trash2 size={14} color={C.red} />
                        </span>
                      )}
                      {isOrganizer && !p.isGuest && !p.isOrganizerPlayer && (
                        <span
                          role="button"
                          title={t("Remover do grupo")}
                          onClick={(e) => { e.stopPropagation(); onRemoveMember(p.id, p.nick); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: C.redDim, border: `1px solid ${C.red}44`, cursor: "pointer", flexShrink: 0 }}
                        >
                          <UserMinus size={14} color={C.red} />
                        </span>
                      )}
                    </>
                  )}
                  {cloudMode && isOrganizer && !p.isMe && !p.isOrganizerPlayer && !p.isGuest && (
                    <span
                      role="button"
                      title={p.isAssistant ? t("Remover auxiliar") : t("Tornar auxiliar")}
                      onClick={(e) => { e.stopPropagation(); onToggleAssistant(p.uuid, !p.isAssistant); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: p.isAssistant ? C.greenDim : C.surface, border: `1px solid ${p.isAssistant ? C.greenBorder : C.border}`, cursor: "pointer", flexShrink: 0 }}
                    >
                      <ShieldCheck size={14} color={p.isAssistant ? C.green : C.text3} />
                    </span>
                  )}
                  <div style={{ ...displayFont, fontSize: 15, color: locked ? C.text3 : tierColor(overall), minWidth: 26, textAlign: "center" }}>
                    {locked ? "?" : overall}
                    <div style={{ fontSize: 8, fontWeight: 700, fontStyle: "normal", letterSpacing: "0.05em", color: C.text3 }}>OVR</div>
                  </div>
                  <ChevronRight size={15} color={C.text3} />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* manual / guest player (organizer or assistant) */}
      {canManageTeams && (
        guestOpen ? (
          <div style={{ ...cardStyle, marginBottom: 14, border: `1px solid ${C.accentBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{t("Jogador avulso")}</span>
              <button onClick={() => { setGuestOpen(false); setGuest(EMPTY_GUEST); }} style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <input value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} placeholder={t("Nome do jogador")}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{t("Posição")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {POSITIONS.map((pos) => {
                const active = guest.position === pos;
                return (
                  <button key={pos} onClick={() => setGuest((g) => ({ ...g, position: pos }))} style={{ background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text2, border: `1px solid ${active ? C.accentBorder : C.border}`, borderRadius: 20, padding: "5px 11px", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" }}>
                    {t(pos)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>Overall <span style={{ color: C.text3 }}>{t("(opcional)")}</span></div>
            <input type="number" min="40" max="99" value={guest.overall} onChange={(e) => setGuest((g) => ({ ...g, overall: e.target.value }))} placeholder={t("ex.: 75")}
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", marginBottom: 14 }} />
            <BtnPrimary onClick={submitGuest} style={{ width: "100%" }}>{t("Adicionar jogador")}</BtnPrimary>
          </div>
        ) : (
          <button onClick={() => setGuestOpen(true)} style={{ ...cardStyle, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14, cursor: "pointer", color: C.accent, border: `1px dashed ${C.accentBorder}`, background: C.accentDim, fontWeight: 800, fontSize: 13 }}>
            <UserPlus size={16} /> {t("Adicionar jogador avulso (sem conta)")}
          </button>
        )
      )}

      {isOrganizer && bannedMembers?.length > 0 && (
        <Collapsible icon={<Ban size={16} color={C.red} />} title={t("Jogadores banidos")} subtitle={t("Bloqueados de voltar a entrar")} badge={bannedMembers.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bannedMembers.map((b) => (
              <div key={b.player_id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, borderRadius: 12, padding: "10px 12px" }}>
                <Avatar name={b.players?.name || "?"} color={C.text3} size={32} fontSize={11} photo={b.players?.photo_url} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{b.players?.nick}</div>
                <button onClick={() => onUnbanMember(b.player_id)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 9, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  <UserCheck size={13} /> {t("Desbanir")}
                </button>
              </div>
            ))}
          </div>
        </Collapsible>
      )}
      </>
      )}
    </div>
  );
}
