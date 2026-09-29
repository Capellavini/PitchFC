import { useState } from "react";
import { MessageCircle, Copy, Check, UserCheck, MapPin, CalendarClock, Euro, Users, Pencil } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle } from "../theme";
import { fmtEUR, WEEKDAYS_PT } from "../lib/helpers";
import { t, tCtx } from "../lib/i18n";
import { openWhatsApp, groupInviteMessage } from "../lib/whatsapp";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";
import ListRow from "./ListRow";

/**
 * Group page → Definições (organizer only). Group facts at a glance +
 * "Editar grupo" (opens the existing full-screen group editor), the two
 * invite links (mensalista gets confirmation priority, avulso starts on
 * the waitlist — see joinGroupByToken) and the banned-players list.
 */
export default function GroupSettings({ game, onEditGroup, inviteUrl, inviteUrlAvulso, bannedMembers = [], onUnbanMember }) {
  const [copied, setCopied] = useState(null); // 'mensalista' | 'avulso'
  const copy = async (url, which) => {
    try { await navigator.clipboard.writeText(url); setCopied(which); setTimeout(() => setCopied(null), 2000); } catch { /* ignore */ }
  };
  const icon = (Icon) => <Icon size={20} color={C.text2} />;
  const weekday = game.weekday != null ? t(WEEKDAYS_PT[game.weekday]) : null;

  const links = [
    inviteUrl && { id: "mensalista", title: t("Link mensalista"), meta: t("Prioridade nas confirmações"), url: inviteUrl },
    inviteUrlAvulso && { id: "avulso", title: t("Link avulso"), meta: t("Entra na lista de espera por defeito"), url: inviteUrlAvulso },
  ].filter(Boolean);

  return (
    <div>
      <SectionLabel>{tCtx("group", "Grupo")}</SectionLabel>
      <div style={{ ...cardStyle, padding: "0 16px 16px" }}>
        <div style={{ marginBottom: S.sm }}>
          <ListRow divider={false} leading={icon(MapPin)} title={game.venue || "—"} meta={game.city || t("Campo")} />
          <ListRow leading={icon(CalendarClock)} title={`${weekday ? `${weekday} · ` : ""}${game.time}`} meta={game.recurring ? t("Semanal") : t("Jogo avulso")} />
          <ListRow leading={icon(Euro)} title={`${fmtEUR(game.monthlyPrice)} ${t("total")}`} meta={`${fmtEUR(game.priceEach)}${t("/jogador")}`} />
          <ListRow leading={icon(Users)} title={`${game.spots} ${t("jogadores")}`} meta={t("Vagas por jogo")} />
        </div>
        <BtnPrimary block onClick={onEditGroup} disabled={!onEditGroup}><Pencil size={16} /> {t("Editar grupo")}</BtnPrimary>
      </div>

      {links.length > 0 && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel>{t("Convites")}</SectionLabel>
          <div style={{ ...cardStyle, padding: "0 16px" }}>
            {links.map((l, i) => (
              <ListRow key={l.id} divider={i > 0} leading={icon(MessageCircle)} title={l.title} meta={l.meta}
                right={<>
                  <button onClick={() => openWhatsApp(groupInviteMessage(game.groupName, l.url))}
                    style={{ minHeight: 36, padding: "0 12px", background: C.whatsapp, color: C.bg, border: "none", borderRadius: R.control, fontSize: T.meta, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: S.xs }}>
                    <MessageCircle size={14} /> {t("Enviar")}
                  </button>
                  <button onClick={() => copy(l.url, l.id)} aria-label={t("Copiar link")}
                    style={{ width: TOUCH.min, height: TOUCH.min, marginRight: -8, background: "none", border: "none", color: copied === l.id ? C.green : C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {copied === l.id ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </>} />
            ))}
          </div>
        </div>
      )}

      {bannedMembers.length > 0 && (
        <div style={{ marginTop: S.xl }}>
          <SectionLabel>{t("Jogadores banidos")} ({bannedMembers.length})</SectionLabel>
          <div style={{ ...cardStyle, padding: "0 16px" }}>
            {bannedMembers.map((b, i) => (
              <ListRow key={b.player_id} divider={i > 0}
                leading={<Avatar name={b.players?.name || "?"} color={C.text3} size={40} photo={b.players?.photo_url} />}
                title={b.players?.nick || "?"} meta={t("Bloqueados de voltar a entrar")}
                right={<BtnGhost compact onClick={() => onUnbanMember(b.player_id)}><UserCheck size={14} /> {t("Desbanir")}</BtnGhost>} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
