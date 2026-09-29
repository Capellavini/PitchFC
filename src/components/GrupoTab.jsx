import { useState } from "react";
import { MessageCircle, UserPlus, X, UserCheck, UserX, Trash2, UserMinus, ArrowDownAZ, Repeat, Lock, Unlock, ShieldCheck, MoreHorizontal } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont } from "../theme";
import { POSITIONS } from "../data";
import { playerColor, computeOverall } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, inviteMessage, groupInviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import ListRow from "./ListRow";
import TeamsSection from "./TeamsSection";

const tierColor = (overall) => overall >= 80 ? C.gold : overall >= 70 ? C.silver : C.bronze;
const EMPTY_GUEST = { name: "", position: "Médio", overall: "" };

/**
 * Group page → Plantel. The squad as one card of rows (avatar, nick,
 * position · fiabilidade %, OVR chip) — tap opens the player's profile.
 * Organizer/assistant tools (confirm, remove, auxiliar, avulso, lock…)
 * sit behind a per-row "…" so the list stays readable. Invite via
 * WhatsApp for everyone; guest players for managers; the player's
 * Teams (cloud) at the bottom. Game-status grouping lives in Game
 * Detail now; invite-link management + bans in Definições.
 */
export default function GrupoTab({ group, game, openProfile, cloudMode, inviteUrl, isOrganizer, onToggleAssistant, onSetPlayerType, onSetAttendanceLock, onAddManualPlayer, onSetPlayerStatus, onRemoveGuestPlayer, onRemoveMember, canManageTeams, totalGames, myTeams = [], myPlayerId, onCreateTeam, onFetchTeam, onAddTeamMember, onRemoveTeamMember }) {
  const [sortAZ, setSortAZ] = useState(false);
  const [manageId, setManageId] = useState(null);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const submitGuest = () => {
    if (!guest.name.trim()) return;
    onAddManualPlayer({ name: guest.name, position: guest.position, overall: guest.overall ? Number(guest.overall) : null });
    setGuest(EMPTY_GUEST);
    setGuestOpen(false);
  };
  const roster = sortAZ ? [...group].sort((a, b) => a.nick.localeCompare(b.nick, "pt")) : group;
  // Reliability % = games played / games the group has played. The
  // denominator never drops below the most-played member (local demo
  // data and legacy cloud counters can exceed the recorded matchdays).
  const gamesBase = Math.max(totalGames || 0, ...group.map((p) => p.gamesPlayed || 0));
  const reliability = (p) => (gamesBase ? Math.round(((p.gamesPlayed || 0) / gamesBase) * 100) : null);
  const inputSt = { width: "100%", boxSizing: "border-box", minHeight: TOUCH.min, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: "0 12px", fontSize: T.body, color: C.text1, outline: "none" };

  const actionsFor = (p) => {
    const a = [];
    if (canManageTeams && !p.isMe) {
      a.push(p.status === "confirmed"
        ? { key: "st", Icon: UserX, label: t("Remover do jogo"), onClick: () => onSetPlayerStatus(p.id, "declined") }
        : { key: "st", Icon: UserCheck, label: t("Confirmar"), onClick: () => onSetPlayerStatus(p.id, "confirmed") });
      if (p.isGuest) a.push({ key: "del", Icon: Trash2, label: t("Apagar jogador"), danger: true, onClick: () => onRemoveGuestPlayer(p.id, p.nick) });
      if (isOrganizer && !p.isGuest && !p.isOrganizerPlayer) a.push({ key: "rm", Icon: UserMinus, label: t("Remover do grupo"), danger: true, onClick: () => onRemoveMember(p.id, p.nick) });
    }
    if (cloudMode && isOrganizer && !p.isMe && !p.isOrganizerPlayer && !p.isGuest && onToggleAssistant) {
      a.push({ key: "as", Icon: ShieldCheck, label: p.isAssistant ? t("Remover auxiliar") : t("Tornar auxiliar"), onClick: () => onToggleAssistant(p.uuid, !p.isAssistant) });
    }
    if (cloudMode && isOrganizer && !p.isMe && onSetPlayerType) {
      a.push({ key: "ty", Icon: Repeat, label: p.playerType === "avulso" ? t("Tornar mensalista") : t("Tornar avulso"), onClick: () => onSetPlayerType(p.uuid, p.playerType === "avulso" ? "mensalista" : "avulso") });
    }
    if (cloudMode && isOrganizer && p.playerType === "avulso" && p.status === "confirmed" && onSetAttendanceLock) {
      a.push({ key: "lk", Icon: p.priorityLocked ? Unlock : Lock, label: p.priorityLocked ? t("Desbloquear vaga") : t("Confirmar definitivamente"), onClick: () => onSetAttendanceLock(p.uuid, !p.priorityLocked) });
    }
    return a;
  };

  return (
    <div>
      {/* toolbar: sort + invite */}
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.md }}>
        <BtnGhost compact tone={sortAZ ? "accent" : "neutral"} onClick={() => setSortAZ((s) => !s)} aria-pressed={sortAZ} style={{ minHeight: TOUCH.min }}>
          <ArrowDownAZ size={16} /> A–Z
        </BtnGhost>
        <div style={{ flex: 1 }} />
        <button onClick={() => openWhatsApp(inviteUrl ? groupInviteMessage(game.groupName, inviteUrl) : inviteMessage(game.groupName, game))}
          style={{ minHeight: TOUCH.min, background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, padding: "0 14px", fontSize: T.body, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: S.xs + 2 }}>
          <MessageCircle size={16} /> {t("Convidar")}
        </button>
      </div>

      <SectionLabel>{t("Plantel")} ({group.length})</SectionLabel>
      <div style={{ ...cardStyle, padding: "0 16px" }}>
        {roster.map((p, i) => {
          const locked = p.ratingsCount != null && p.ratingsCount < 3;
          const overall = locked ? 0 : computeOverall(p.position, p.attrs);
          const rel = reliability(p);
          const tags = [
            p.isOrganizerPlayer && "ORG",
            p.isAssistant && !p.isOrganizerPlayer && t("AUXILIAR"),
            p.playerType === "avulso" && `${t("AVULSO")}${p.priorityLocked ? " 🔒" : ""}`,
          ].filter(Boolean);
          const actions = actionsFor(p);
          const open = manageId === p.id;
          return (
            <div key={p.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: S.xs }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ListRow divider={false} onClick={() => openProfile(p.id)} chevron={false}
                    leading={<Avatar name={p.name} color={playerColor(group, p)} size={40} isMe={p.isMe} photo={p.photo} injured={p.injured} />}
                    title={<>
                      <span style={{ color: p.isMe ? C.accent : C.text1 }}>{p.nick}</span>
                      {p.isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("(tu)")}</span>}
                      {tags.map((tg) => <span key={tg} style={{ fontSize: T.min, color: C.text2, fontWeight: 800, marginLeft: S.xs + 2 }}>{tg}</span>)}
                    </>}
                    meta={`${t(p.position)} · ${rel == null ? "—" : `${rel}%`} ${t("fiabilidade")}`}
                    right={
                      <span title="Overall" style={{ minWidth: 40, height: 28, borderRadius: R.pill, border: `1px solid ${locked ? C.border : `${tierColor(overall)}66`}`, background: C.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "0 8px" }}>
                        <span style={{ ...displayFont, fontSize: T.body, color: locked ? C.text2 : tierColor(overall) }}>{locked ? "?" : overall}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: C.text2 }}>OVR</span>
                      </span>
                    } />
                </div>
                {actions.length > 0 && (
                  <button onClick={() => setManageId(open ? null : p.id)} aria-label={t("Gerir jogador")} aria-expanded={open}
                    style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -8, background: "none", border: "none", color: open ? C.text1 : C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MoreHorizontal size={20} />
                  </button>
                )}
              </div>
              {open && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, paddingBottom: S.md }}>
                  {actions.map(({ key, Icon, label, danger, onClick }) => (
                    <BtnGhost key={key} compact tone={danger ? "danger" : "neutral"} onClick={() => { onClick(); setManageId(null); }}>
                      <Icon size={14} /> {label}
                    </BtnGhost>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* manual / guest player (organizer or assistant) */}
      {canManageTeams && (
        guestOpen ? (
          <div style={{ ...cardStyle, marginTop: S.lg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
              <span style={{ fontSize: T.cardTitle, fontWeight: 700 }}>{t("Convidado")}</span>
              <button onClick={() => { setGuestOpen(false); setGuest(EMPTY_GUEST); }} aria-label={t("Cancelar")}
                style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -12, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
            </div>
            <input value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} placeholder={t("Nome do jogador")} style={{ ...inputSt, marginBottom: S.md }} />
            <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs + 2 }}>{t("Posição")}</div>
            <div style={{ display: "flex", gap: S.xs + 2, flexWrap: "wrap", marginBottom: S.md }}>
              {POSITIONS.map((pos) => {
                const active = guest.position === pos;
                return (
                  <button key={pos} onClick={() => setGuest((g) => ({ ...g, position: pos }))} style={{ minHeight: 36, background: active ? C.accent : "transparent", color: active ? C.bg : C.text2, border: `1px solid ${active ? C.accent : C.border}`, borderRadius: R.pill, padding: "0 12px", fontSize: T.meta, fontWeight: active ? 800 : 600, cursor: "pointer" }}>
                    {t(pos)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.xs + 2 }}>Overall {t("(opcional)")}</div>
            <input type="number" min="40" max="99" value={guest.overall} onChange={(e) => setGuest((g) => ({ ...g, overall: e.target.value }))} placeholder={t("ex.: 75")} style={{ ...inputSt, marginBottom: S.lg }} />
            <BtnPrimary block onClick={submitGuest}>{t("Adicionar jogador")}</BtnPrimary>
          </div>
        ) : (
          <BtnGhost block onClick={() => setGuestOpen(true)} style={{ marginTop: S.lg }}>
            <UserPlus size={16} /> {t("Adicionar convidado (sem conta)")}
          </BtnGhost>
        )
      )}

      {onCreateTeam && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel>{t("Equipas")}</SectionLabel>
          <TeamsSection
            myTeams={myTeams} groupRoster={group} groupName={game.groupName} myPlayerId={myPlayerId}
            onCreateTeam={onCreateTeam} onFetchTeam={onFetchTeam} onAddTeamMember={onAddTeamMember} onRemoveTeamMember={onRemoveTeamMember}
          />
        </div>
      )}
    </div>
  );
}
