import { Check, X } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, AVATAR_PALETTE } from "../theme";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

const colorFor = (key = "") => AVATAR_PALETTE[[...String(key)].reduce((h, c) => (h + c.charCodeAt(0)) % AVATAR_PALETTE.length, 0)];

const pillBtn = (tone) => ({
  minHeight: 36, padding: `0 ${S.md}px`, borderRadius: R.pill, fontSize: T.meta, fontWeight: 800, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: S.xs, flexShrink: 0,
  ...(tone === "green" ? { background: C.greenDim, color: C.green, border: `1px solid ${C.greenBorder}` }
    : tone === "lime" ? { background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}` }
    : { background: "transparent", color: C.text2, border: `1px solid ${C.border}` }),
});

function Row({ p, sub, right, divider }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: 56, borderTop: divider ? `1px solid ${C.border}` : "none" }}>
      <Avatar name={p.name || p.nick} color={colorFor(p.id)} size={36} photo={p.photo_url} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick || p.name}</div>
        {sub && <div style={{ fontSize: T.meta, color: C.text2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** Bilateral friendships (no asymmetric follow) — incoming requests,
 *  add-a-player list and current friends. Opened from the feed header on
 *  Home; same `social` handlers SocialTab used. Cloud only (local demo
 *  has no friends graph). */
export default function FriendsPanel({ social, adding }) {
  const { requests = [], candidates = [], sentPending = [], friends = [] } = social;
  return (
    <div style={{ ...cardStyle, padding: `${S.sm}px ${S.lg}px`, marginBottom: S.md }}>
      {requests.length > 0 && (
        <div style={{ paddingTop: S.sm }}>
          <SectionLabel style={{ marginBottom: 0 }}>{t("Pedidos de amizade")}</SectionLabel>
          {requests.map((r, i) => (
            <Row key={r.id} p={r.player} divider={i > 0} right={
              <div style={{ display: "flex", gap: S.xs }}>
                <button type="button" onClick={() => social.onRespondFriend(r.id, true)} style={pillBtn("green")}><Check size={14} /> {t("Aceitar")}</button>
                <button type="button" aria-label={t("Recusar")} onClick={() => social.onRespondFriend(r.id, false)} style={{ ...pillBtn(), padding: 0, width: 36, justifyContent: "center" }}><X size={14} /></button>
              </div>
            } />
          ))}
        </div>
      )}

      {adding && (
        <div style={{ paddingTop: S.sm, borderTop: requests.length ? `1px solid ${C.border}` : "none" }}>
          <SectionLabel style={{ marginBottom: 0 }}>{t("Jogadores no PITCH")}</SectionLabel>
          {candidates.length === 0 ? (
            <div style={{ fontSize: T.meta, color: C.text2, padding: `${S.md}px 0` }}>{t("Sem ninguém para adicionar por agora.")}</div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {candidates.map((c, i) => {
                const sent = sentPending.includes(c.id);
                return (
                  <Row key={c.id} p={c} sub={c.groups?.name ?? t("Sem grupo")} divider={i > 0} right={
                    <button type="button" disabled={sent} onClick={() => !sent && social.onSendFriend(c.id)} style={{ ...pillBtn(sent ? null : "lime"), cursor: sent ? "default" : "pointer" }}>
                      {sent ? t("Pedido enviado") : t("Adicionar")}
                    </button>
                  } />
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ paddingTop: S.sm, borderTop: requests.length || adding ? `1px solid ${C.border}` : "none" }}>
        <SectionLabel style={{ marginBottom: 0 }}>{t("Amigos")} {friends.length > 0 && `(${friends.length})`}</SectionLabel>
        {friends.length === 0 ? (
          <div style={{ fontSize: T.meta, color: C.text2, padding: `${S.md}px 0`, minHeight: TOUCH.min, boxSizing: "border-box" }}>
            {t("Ainda sem amigos. Adiciona quem joga contigo para veres a atividade deles aqui.")}
          </div>
        ) : friends.map((f, i) => (
          <Row key={f.id} p={f} divider={i > 0} right={
            <button type="button" onClick={() => social.onRemoveFriend(social.friendshipIdOf(f.id))} style={pillBtn()}>{t("Remover")}</button>
          } />
        ))}
      </div>
    </div>
  );
}
