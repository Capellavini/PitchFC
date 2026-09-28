import { useState } from "react";
import { Trophy, Flame, MessageCircle, Send, Trash2, Share2, Star } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, AVATAR_PALETTE } from "../theme";
import { t } from "../lib/i18n";
import { openWhatsApp, sharePostMessage } from "../lib/whatsapp";
import { nickIn, teamColorOf } from "../lib/homeFeed";
import Avatar from "./Avatar";
import Chip from "./Chip";
import GolacoButton from "./GolacoButton";
import ScoreLine from "./ScoreLine";

// Stable palette colour per author/player id (no photo → coloured initials).
const colorFor = (key = "") => AVATAR_PALETTE[[...String(key)].reduce((h, c) => (h + c.charCodeAt(0)) % AVATAR_PALETTE.length, 0)];

/** Square-ish icon badge used as the leading element of auto items. */
function IconBadge({ Icon, color }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${color}22`, border: `1.5px solid ${color}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={18} color={color} />
    </div>
  );
}

function Header({ leading, title, meta, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {meta && <div style={{ fontSize: T.meta, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>}
      </div>
      {right}
    </div>
  );
}

const iconBtn = { minHeight: TOUCH.min, minWidth: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, background: "transparent", border: `1px solid ${C.border}`, color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.xs + 2, boxSizing: "border-box" };

function Footer({ children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.md }}>{children}</div>;
}

function ShareBtn({ text }) {
  return (
    <button type="button" onClick={() => openWhatsApp(sharePostMessage("PITCH", text))} aria-label={t("Partilhar")} style={{ ...iconBtn, marginLeft: "auto", padding: 0 }}>
      <Share2 size={16} />
    </button>
  );
}

// ── Auto: matchday result ──────────────────────────────────
function ResultBody({ md }) {
  const matches = md.summary?.matches || [];
  const colorOf = teamColorOf(md);
  const mvpNick = md.mvpNick ?? (md.mvpKey != null ? nickIn(md, md.mvpKey) : null);
  const top = [...(md.summary?.lines || [])].sort((a, b) => (b.goals || 0) - (a.goals || 0))[0];
  const scoreText = matches.map((m) => `${m.homeName} ${m.homeGoals}–${m.awayGoals} ${m.awayName}`).join(" · ") || md.resultText || "";
  return (
    <>
      <Header
        leading={<IconBadge Icon={Trophy} color={C.blue} />}
        title={`${t("Resultado")} · ${md.groupName || t("O teu grupo")}`}
        meta={md.dateLabel}
      />
      {matches.length > 0 ? (
        <div>
          {matches.slice(0, 3).map((m, i) => (
            <div key={m.n ?? i} style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <ScoreLine m={m} colorOf={colorOf} />
            </div>
          ))}
          {matches.length > 3 && <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center" }}>+{matches.length - 3} {t("jogos")}</div>}
        </div>
      ) : md.resultText ? (
        <div style={{ fontSize: T.h, fontWeight: 900, fontStyle: "italic", color: C.text1 }}>{md.resultText}</div>
      ) : null}
      {(mvpNick || (top && top.goals > 0)) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
          {mvpNick && <Chip Icon={Star}>MVP · {mvpNick}</Chip>}
          {top && top.goals > 0 && <Chip>⚽ {top.nick} · {top.goals}</Chip>}
        </div>
      )}
      <Footer><ShareBtn text={`${md.groupName ?? ""} ${md.dateLabel}: ${scoreText}`} /></Footer>
    </>
  );
}

// ── Auto: standout performance (MVP / hat-trick / mine / record) ──
function PerformanceBody({ item, kudos, onGolaco }) {
  const { md, line, isMvp, mine, isRecord } = item;
  const g = line.goals || 0, a = line.assists || 0, cs = line.cleanSheets || 0;
  const who = mine ? t("Tu") : line.nick;
  const headline = isRecord ? `🏆 ${t("Novo recorde pessoal")}`
    : isMvp ? `⭐ ${t("MVP da jornada")}`
    : g >= 3 ? `⚽ ${t("Hat-trick!")}`
    : mine ? t("A tua jornada")
    : t("Grande jornada");
  return (
    <>
      <Header
        leading={<Avatar name={line.nick} color={line.color || colorFor(line.key)} size={40} photo={line.photo} isMe={mine} />}
        title={who}
        meta={`${md.groupName ? `${md.groupName} · ` : ""}${md.dateLabel}`}
      />
      <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: isRecord || isMvp ? C.gold : C.text1, marginBottom: S.sm }}>{headline}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
        {g > 0 && <Chip>⚽ {g} {g === 1 ? t("golo") : t("golos")}</Chip>}
        {a > 0 && <Chip>🎯 {a} {a === 1 ? t("assistência") : t("assistências")}</Chip>}
        {cs > 0 && <Chip>🧤 {cs} {t("sem sofrer")}</Chip>}
      </div>
      <Footer>
        <GolacoButton active={kudos.mine} count={kudos.count} onClick={onGolaco} />
        <ShareBtn text={`${who} · ${headline} (${md.groupName ?? ""} ${md.dateLabel})`} />
      </Footer>
    </>
  );
}

// ── Auto: milestone (attendance streak) ────────────────────
function MilestoneBody({ item }) {
  return (
    <>
      <Header leading={<IconBadge Icon={Flame} color={C.orange} />} title={`${item.streak} ${t("jornadas seguidas")}`} meta={item.md?.dateLabel} />
      <div style={{ fontSize: T.body, color: C.text2 }}>{t("Não falhaste nenhuma. Mantém a série viva no próximo jogo.")}</div>
    </>
  );
}

// ── Manual post ─────────────────────────────────────────────
function PostBody({ post, social }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const color = post.mine ? C.accent : colorFor(post.author?.id);
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    social.onAddComment(post.id, text);
    setDraft("");
  };
  return (
    <>
      <Header
        leading={<Avatar name={post.author?.name || post.author?.nick} color={color} size={40} isMe={post.mine} photo={post.author?.photo} />}
        title={post.mine ? `${post.author?.nick ?? ""} ${t("· tu")}` : post.author?.nick}
        meta={post.time}
        right={post.mine ? (
          <button type="button" aria-label={t("Apagar publicação?")} onClick={() => window.confirm(t("Apagar publicação?")) && social.onDeletePost(post.id)}
            style={{ ...iconBtn, border: "none", padding: 0, color: C.text2 }}><Trash2 size={16} /></button>
        ) : null}
      />
      {post.text && <div style={{ fontSize: T.body, lineHeight: 1.5, color: C.text1, whiteSpace: "pre-wrap" }}>{post.text}</div>}
      {post.type === "photo" && post.media && (
        <img src={post.media} alt="" style={{ width: "100%", borderRadius: R.control, maxHeight: 320, objectFit: "cover", marginTop: S.md, display: "block" }} />
      )}
      {post.type === "video" && post.media && (
        <video src={post.media} controls playsInline style={{ width: "100%", borderRadius: R.control, maxHeight: 360, background: C.bg, marginTop: S.md, display: "block" }} />
      )}
      <Footer>
        <GolacoButton active={post.liked} count={post.likes?.length || 0} onClick={() => social.onToggleLike(post.id, post.liked)} />
        <button type="button" onClick={() => setOpen((v) => !v)} style={iconBtn}>
          <MessageCircle size={15} /> {post.comments?.length || t("Comentar")}
        </button>
        <ShareBtn text={post.text || t("uma publicação")} />
      </Footer>
      {open && (
        <div style={{ marginTop: S.md, borderTop: `1px solid ${C.border}`, paddingTop: S.md }}>
          {(post.comments || []).map((c) => (
            <div key={c.id} style={{ display: "flex", gap: S.sm, marginBottom: S.sm }}>
              <Avatar name={c.nick} color={colorFor(c.nick)} size={28} photo={c.photo} />
              <div style={{ flex: 1, background: C.surface, borderRadius: R.control, padding: `${S.sm}px ${S.md}px` }}>
                <span style={{ fontSize: T.meta, fontWeight: 700, color: C.text2 }}>{c.nick} </span>
                <span style={{ fontSize: T.meta, color: C.text1 }}>{c.text}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: S.sm }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t("Escreve um comentário…")}
              style={{ flex: 1, minHeight: TOUCH.min, boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: `0 ${S.md}px`, fontSize: T.body, color: C.text1, outline: "none" }} />
            <button type="button" onClick={submit} aria-label={t("Enviar")} style={{ ...iconBtn, borderRadius: R.control, color: C.accent, borderColor: C.accentBorder, background: C.accentDim }}><Send size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * FeedItem — one entry of Home's single activity feed. Auto-generated
 * items (result / performance / milestone) share the same card anatomy
 * as manual posts (header → body → Golaço/share footer), so football
 * activity reads first-class, not as a system notice.
 *
 * Props: item (lib/homeFeed buildFeed), social (post handlers),
 *        kudos { count, mine } + onGolaco (performance items).
 */
export default function FeedItem({ item, social, kudos = { count: 0, mine: false }, onGolaco }) {
  return (
    <article style={{ ...cardStyle }}>
      {item.kind === "result" && <ResultBody md={item.md} />}
      {item.kind === "performance" && <PerformanceBody item={item} kudos={kudos} onGolaco={onGolaco} />}
      {item.kind === "milestone" && <MilestoneBody item={item} />}
      {item.kind === "post" && <PostBody post={item.post} social={social} />}
    </article>
  );
}
