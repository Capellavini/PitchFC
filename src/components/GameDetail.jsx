import { MessageCircle, CreditCard, Check, X, UserCheck, Undo2 } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont } from "../theme";
import { playerColor, fmtEUR, splitWaitlist } from "../lib/helpers";
import { t } from "../lib/i18n";
import { openWhatsApp, chargeMessage, waitlistNudgeMessage, reminderMessage, groupReminderMessage, magicConfirmUrl } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import Chip from "./Chip";
import ListRow from "./ListRow";
import StatTile from "./StatTile";
import BackHeader from "./BackHeader";
import MaterialChecklist from "./MaterialChecklist";

const waBtn = (filled) => ({
  minHeight: 36, padding: "0 12px", borderRadius: R.control, cursor: "pointer",
  background: filled ? C.whatsapp : "transparent", color: filled ? C.bg : C.whatsapp,
  border: `1px solid ${C.whatsapp}`, fontSize: T.meta, fontWeight: 800,
  display: "inline-flex", alignItems: "center", gap: S.xs + 2,
});
const iconAction = (tone) => ({
  width: 36, height: 36, borderRadius: R.control, padding: 0, cursor: "pointer", flexShrink: 0,
  background: "transparent", border: `1px solid ${tone === "danger" ? `${C.red}66` : C.border}`,
  color: tone === "danger" ? C.red : C.green, display: "flex", alignItems: "center", justifyContent: "center",
});

/**
 * Game Detail — pushed from Jogar → Jogos (not a tab). The operational
 * side of the next game: roster by status (with the waiting line),
 * payment overview with the unchanged MB Way button, WhatsApp
 * reminders (organizer / assistants), and the material checklist.
 */
export default function GameDetail({
  group, game, gameId, onBack, togglePaid, payMine, canManageTeams, canManageGame, onSetPlayerStatus, inviteUrl,
  material = [], onToggleMaterial, onAssignMaterial, onAddMaterial,
}) {
  const confirmed = group.filter((p) => p.status === "confirmed");
  const pending   = group.filter((p) => p.status !== "confirmed" && p.status !== "declined");
  const declined  = group.filter((p) => p.status === "declined");
  const me        = group.find((p) => p.isMe);
  const { playing, waitlist } = splitWaitlist(confirmed, game.spots);
  const paidCount = playing.filter((p) => p.paid).length;
  const debtors   = playing.filter((p) => !p.paid);
  const price     = fmtEUR(game.priceEach);
  const shareUrl  = inviteUrl || window.location.origin;
  const iPlayUnpaid = me && playing.some((p) => p.id === me.id) && !me.paid && game.priceEach > 0;
  const avatar = (p) => <Avatar name={p.name} color={playerColor(group, p)} size={40} isMe={p.isMe} photo={p.photo} injured={p.injured} />;
  const nick = (p) => <>{p.nick}{p.isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("(tu)")}</span>}</>;

  const section = (label, count, rows, right) => rows.length > 0 && (
    <div style={{ marginTop: S.xl }}>
      <SectionLabel right={right}>{t(label)} ({count})</SectionLabel>
      <div style={{ ...cardStyle, padding: "0 16px" }}>{rows}</div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <BackHeader onBack={onBack} title={game.label} subtitle={`${game.date} · ${game.time}${game.venue ? ` · ${game.venue}` : ""}`} />

      {/* summary */}
      <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: S.sm }}>
        <StatTile value={`${playing.length}/${game.spots}`} label={t("Confirmados")} color={playing.length >= game.spots ? C.green : C.text1} />
        <StatTile value={pending.length} label={t("Sem resposta")} color={pending.length ? C.orange : C.text1} />
        <StatTile value={`${paidCount}/${playing.length}`} label={t("Pagos")} color={playing.length && paidCount === playing.length ? C.green : C.text1} />
      </div>

      {/* ROSTER BY STATUS */}
      {section("CONFIRMADOS", playing.length, playing.map((p, i) => (
        <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)} meta={t(p.position)}
          right={<>
            {game.priceEach > 0 && (p.paid ? <Chip variant="green" Icon={Check}>{t("Pago")}</Chip> : <Chip variant="orange">{price}</Chip>)}
            {canManageTeams && !p.isMe && (
              <button onClick={() => onSetPlayerStatus(p.id, "declined")} title={t("Remover do jogo")} aria-label={t("Remover do jogo")} style={iconAction("danger")}><X size={16} /></button>
            )}
          </>} />
      )))}

      {section("LISTA DE ESPERA", waitlist.length, waitlist.map((p, i) => (
        <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)}
          meta={`${i + 1}º · ${t(p.position)}`}
          right={canManageTeams && !p.isMe ? (
            <button onClick={() => openWhatsApp(waitlistNudgeMessage(p, game, i + 1, shareUrl), p.phone)} style={waBtn(i === 0)}>
              <MessageCircle size={14} /> {t("Avisar")}
            </button>
          ) : <span style={{ ...displayFont, fontSize: T.cardTitle, color: i === 0 ? C.orange : C.text2 }}>{i + 1}º</span>} />
      )))}

      {section("SEM RESPOSTA", pending.length, pending.map((p, i) => (
        <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)} meta={t(p.position)}
          right={canManageTeams && !p.isMe ? (<>
            <button onClick={() => openWhatsApp(reminderMessage(p, game, p.magicToken ? magicConfirmUrl(p.magicToken, gameId) : undefined), p.phone)} style={waBtn(false)}>
              <MessageCircle size={14} /> {t("Lembrar")}
            </button>
            <button onClick={() => onSetPlayerStatus(p.id, "confirmed")} title={t("Confirmar")} aria-label={t("Confirmar")} style={iconAction()}><UserCheck size={16} /></button>
          </>) : <Chip variant="orange">{t("Pendente")}</Chip>} />
      )), canManageTeams && pending.length > 1 ? (
        <button onClick={() => openWhatsApp(groupReminderMessage(pending, game))}
          style={{ background: "none", border: "none", color: C.whatsapp, fontSize: T.meta, fontWeight: 800, cursor: "pointer", minHeight: TOUCH.min, padding: 0, display: "inline-flex", alignItems: "center", gap: S.xs }}>
          <MessageCircle size={14} /> {t("Lembrar todos")}
        </button>
      ) : null)}

      {section("NÃO PODEM", declined.length, declined.map((p, i) => (
        <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)} meta={t(p.position)}
          right={canManageTeams && !p.isMe
            ? <button onClick={() => onSetPlayerStatus(p.id, "confirmed")} title={t("Confirmar")} aria-label={t("Confirmar")} style={iconAction()}><UserCheck size={16} /></button>
            : <Chip variant="red">{t("Não pode")}</Chip>} />
      )))}

      {/* PAYMENTS */}
      <div style={{ marginTop: S.xl }}>
        <SectionLabel right={<span style={{ fontSize: T.meta, color: C.text2 }}>{price}{t("/jogador")} · {fmtEUR(game.monthlyPrice)} {t("total")}</span>}>{t("Pagamentos")}</SectionLabel>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.sm }}>
            <span style={{ ...displayFont, fontSize: T.h + 4, color: C.text1 }}>{fmtEUR(paidCount * game.priceEach)}</span>
            <span style={{ fontSize: T.meta, color: C.text2 }}>{t("de")} {fmtEUR(playing.length * game.priceEach)}</span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: R.pill, marginBottom: S.lg }}>
            <div style={{ height: "100%", borderRadius: R.pill, background: C.green, width: `${playing.length ? (paidCount / playing.length) * 100 : 0}%`, transition: "width 0.3s" }} />
          </div>

          {iPlayUnpaid && (
            <BtnPrimary block onClick={payMine} style={{ marginBottom: S.md }}><CreditCard size={16} /> {t("Pagar")} {price} · MB Way</BtnPrimary>
          )}

          {debtors.length > 0 ? (
            <>
              <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", color: C.text2, marginBottom: S.xs }}>{t("DEVEM PAGAR")}</div>
              {debtors.map((p, i) => (
                <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)}
                  right={<>
                    <span style={{ fontSize: T.body, color: C.orange, fontWeight: 700 }}>{price}</span>
                    <BtnGhost compact tone="accent" onClick={() => togglePaid(p.id)}>{t("Pago ✓")}</BtnGhost>
                  </>} />
              ))}
              <button onClick={() => openWhatsApp(chargeMessage(debtors, price, game, me?.phone))}
                style={{ width: "100%", minHeight: TOUCH.button, marginTop: S.md, background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, fontSize: T.body, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm }}>
                <MessageCircle size={16} /> {t("Cobrar pelo WhatsApp")}
              </button>
            </>
          ) : playing.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: S.sm, fontSize: T.body, color: C.green, fontWeight: 700 }}>
              <Check size={16} /> {t("Todos pagaram!")}
            </div>
          ) : (
            <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda ninguém confirmou.")}</div>
          )}

          {/* Organizer-only: undo a payment marked by mistake */}
          {canManageGame && paidCount > 0 && (
            <div style={{ marginTop: S.lg }}>
              <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", color: C.text2, marginBottom: S.xs }}>{t("JÁ PAGARAM")}</div>
              {playing.filter((p) => p.paid).map((p, i) => (
                <ListRow key={p.id} divider={i > 0} leading={avatar(p)} title={nick(p)}
                  right={<BtnGhost compact onClick={() => togglePaid(p.id)}><Undo2 size={14} /> {t("Desfazer")}</BtnGhost>} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MATERIAL */}
      <div style={{ marginTop: S.xl }}>
        <SectionLabel>{t("Material")}</SectionLabel>
        <MaterialChecklist items={material} group={group} canManage={canManageTeams}
          onToggle={onToggleMaterial} onAssign={onAssignMaterial} onAdd={onAddMaterial} />
      </div>
    </div>
  );
}
