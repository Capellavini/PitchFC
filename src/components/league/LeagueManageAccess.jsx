import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, UserPlus } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { accessByTeam, inviteMessage, inviteUsage, inviteUrl, roleErrorText, whatsappShareUrl } from "../../lib/leagueRoles";
import SectionLabel from "../SectionLabel";
import BtnGhost from "../BtnGhost";

const WA_GREEN = "#25D366"; // WhatsApp actions always use this green

/** One open invite: the link, how much of it is used, copy / WhatsApp / revoke. */
function InviteLine({ invite, leagueName, teamName, onCopy, onRevoke, busy }) {
  const url = inviteUrl(invite.token, window.location.origin);
  const text = inviteMessage({ league: leagueName, role: invite.role, team: teamName, url });
  return (
    <div style={{ display: "grid", gap: S.xs, padding: `${S.sm}px 0`, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: T.meta, color: C.text2 }}>
        {invite.player_name ? `${t("Para")} ${invite.player_name} · ` : ""}{inviteUsage(invite)}
      </div>
      <code style={{ overflowWrap: "anywhere", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: T.meta }}>{url}</code>
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
        <BtnGhost onClick={() => onCopy(url)}><Copy size={16} aria-hidden /> {t("Copiar")}</BtnGhost>
        <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: `0 ${S.md}px`, borderRadius: 12, background: WA_GREEN, color: "#04210f", fontWeight: 800, fontSize: T.body, textDecoration: "none" }}>
          <MessageCircle size={16} aria-hidden /> {t("Enviar por WhatsApp")}
        </a>
        <BtnGhost tone="danger" disabled={busy} onClick={() => onRevoke(invite.id)}>{t("Revogar")}</BtnGhost>
      </div>
    </div>
  );
}

function PersonLine({ member, onRemove, busy }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, padding: `${S.xs}px 0` }}>
      <span style={{ fontSize: T.body, minWidth: 0, overflowWrap: "anywhere" }}>{member.player_name ? `${member.player_name} · ` : ""}{member.email}</span>
      <BtnGhost tone="danger" disabled={busy} onClick={() => onRemove(member.id)}>{t("Remover")}</BtnGhost>
    </div>
  );
}

/** Gerir → Acessos: who may enter this league and with what. A captain edits their own squad;
 *  an athlete sees the league and their own record. Everything is a link the Gestor shares. */
export default function LeagueManageAccess({ ctx }) {
  const { store, state, notify } = ctx;
  const api = store?.roles;
  const [rows, setRows] = useState(null); // { invites, members } | null while loading
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const leagueName = state.data.league?.name || "";

  const load = useCallback(async () => {
    const [i, m] = await Promise.all([api.invites(), api.members()]);
    if (i.error || m.error) { setFailed(true); return; }
    setFailed(false);
    setRows({ invites: i.data || [], members: m.data || [] });
  }, [api]);
  useEffect(() => { if (api) load(); }, [api, load]);

  const teams = state.data.teams || [];
  const grouped = useMemo(() => accessByTeam({ teams, invites: rows?.invites, members: rows?.members }), [teams, rows]);
  if (!api) return null;

  const run = async (fn, okText) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.error) { notify(t(roleErrorText(r.error)), "error"); return; }
    if (okText) notify(t(okText));
    await load();
  };
  const copy = async (url) => { try { await navigator.clipboard.writeText(url); notify(t("Ligação copiada.")); } catch { notify(t("Não foi possível copiar. Seleciona a ligação e copia."), "error"); } };
  const create = (role, teamId) => run(() => api.createInvite(role, teamId), "Convite criado.");
  const revoke = (id) => run(() => api.revokeInvite(id), "Convite revogado.");
  const remove = (id) => run(() => api.removeMember(id), "Acesso removido.");

  if (failed) return <div role="alert" style={{ ...cardStyle, maxWidth: 640 }}>{t("Não foi possível abrir os acessos.")} <BtnGhost onClick={load}>{t("Tentar outra vez")}</BtnGhost></div>;
  if (!rows) return <div role="status" style={{ color: C.text2 }}>{t("A abrir os acessos…")}</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <SectionLabel>{t("Acessos das equipas")}</SectionLabel>
      <p style={{ margin: `0 0 ${S.lg}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
        {t("Convida o capitão de cada equipa para gerir o plantel, e os atletas para verem os jogos e o seu registo. Cada pessoa só vê a sua parte. Os convites valem 14 dias e podes revogá-los.")}
      </p>
      {!teams.length && <div style={{ ...cardStyle, color: C.text2 }}>{t("Ainda não há equipas. Acrescenta equipas em Gerir → Inscrições e volta aqui.")}</div>}
      <div style={{ display: "grid", gap: S.lg }}>
        {grouped.map((g) => (
          <div key={g.team.id} style={cardStyle}>
            <div style={{ fontWeight: 900, fontSize: T.cardTitle, marginBottom: S.sm }}>{g.team.name}</div>

            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("Capitão")}</div>
            {g.captains.map((m) => <PersonLine key={m.id} member={m} onRemove={remove} busy={busy} />)}
            {g.captainInvites.map((i) => <InviteLine key={i.id} invite={i} leagueName={leagueName} teamName={g.team.name} onCopy={copy} onRevoke={revoke} busy={busy} />)}
            {!g.captains.length && !g.captainInvites.length && <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0` }}>{t("Ainda sem capitão.")}</div>}
            <div style={{ margin: `${S.sm}px 0 ${S.lg}px` }}>
              <BtnGhost disabled={busy} onClick={() => create("captain", g.team.id)}><UserPlus size={16} aria-hidden /> {t("Convidar capitão")}</BtnGhost>
            </div>

            <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {t("Atletas")}{g.athletes.length ? ` · ${g.athletes.length}` : ""}
            </div>
            {g.athletes.map((m) => <PersonLine key={m.id} member={m} onRemove={remove} busy={busy} />)}
            {g.teamInvite
              ? <InviteLine invite={g.teamInvite} leagueName={leagueName} teamName={g.team.name} onCopy={copy} onRevoke={revoke} busy={busy} />
              : <div style={{ margin: `${S.sm}px 0 0` }}><BtnGhost disabled={busy} onClick={() => create("athlete", g.team.id)}><UserPlus size={16} aria-hidden /> {t("Ligação para os atletas")}</BtnGhost></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
