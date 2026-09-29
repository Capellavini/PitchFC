import { useState } from "react";
import { Trophy, Flame, MessageCircle, Send, Trash2, Share2, Star, Medal } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont, AVATAR_PALETTE } from "../theme";
import { t } from "../lib/i18n";
import { openWhatsApp, sharePostMessage } from "../lib/whatsapp";
import { POSITION_ABBR } from "../lib/helpers";
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

/** Big display-italic numbers row (mockup "100 MATCHES" style) — the
 *  hero of auto items, so they read as football, not system notices. */
function BigStats({ stats }) {
  const shown = stats.filter((s) => s.v > 0);
  if (!shown.length) return null;
  return (
    <div style={{ display: "flex", gap: S.xl, flexWrap: "wrap" }}>
      {shown.map((s) => (
        <div key={s.label} style={{ minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: 40, lineHeight: 1, color: s.color ?? C.text1 }}>{s.v}</div>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginTop: S.xs }}>{s.label}</div>
        </div>
      ))}
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
          {matches.length > 3 && <div style={{ fontSize: T.meta, color: C.text2, textAlign: "center" }}>+{matches.length - 3} {matches.length - 3 === 1 ? t("jogo") : t("jogos")}</div>}
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
function PerformanceBody({ item, kudos, onGolaco, nameOf }) {
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
        leading={<Avatar name={nameOf ? nameOf(line) : (line.name || line.nick)} color={line.color || colorFor(line.key)} size={40} photo={line.photo} isMe={mine} />}
        title={who}
        meta={`${md.groupName ? `${md.groupName} · ` : ""}${md.dateLabel}`}
      />
      <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: isRecord || isMvp ? C.gold : C.text1, marginBottom: S.md }}>{headline}</div>
      <BigStats stats={[
        { v: g, label: g === 1 ? t("golo") : t("golos") },
        { v: a, label: a === 1 ? t("assistência") : t("assistências") },
        { v: cs, label: t("sem sofrer"), color: C.green },
      ]} />
      <Footer>
        <GolacoButton active={kudos.mine} count={kudos.count} onClick={onGolaco} />
        <ShareBtn text={`${who} · ${headline} (${md.groupName ?? ""} ${md.dateLabel})`} />
      </Footer>
    </>
  );
}

// ── Auto: weekly podium of a matchday (top 3, same rule as Competir) ──
const PODIUM = [
  { idx: 1, color: C.silver, size: 44 }, // 2nd — left
  { idx: 0, color: C.gold, size: 56 },   // 1st — centre
  { idx: 2, color: C.bronze, size: 44 }, // 3rd — right
];
function PodiumBody({ item, nameOf, onOpenCompetir }) {
  const { md, top } = item;
  const stat = (l) => [l.goals ? `${l.goals} ⚽` : null, l.assists ? `${l.assists} ${t("assist.")}` : null, l.cleanSheets ? `${l.cleanSheets} 🧤` : null].filter(Boolean).join(" · ");
  return (
    <>
      <Header
        leading={<IconBadge Icon={Medal} color={C.gold} />}
        title={`${t("Pódio da jornada")}${md.groupName ? ` · ${md.groupName}` : ""}`}
        meta={md.dateLabel}
        right={onOpenCompetir ? <Chip onClick={onOpenCompetir}>{t("Ver ranking")}</Chip> : null}
      />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: S.sm }}>
        {PODIUM.map(({ idx, color, size }) => {
          const l = top[idx];
          if (!l) return <div key={idx} style={{ flex: 1 }} />;
          return (
            <div key={idx} style={{ flex: 1, minWidth: 0, textAlign: "center", paddingBottom: idx === 0 ? S.md : 0 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: S.xs }}>
                <Avatar name={nameOf ? nameOf(l) : (l.name || l.nick)} color={l.color || colorFor(l.key)} size={size} photo={l.photo} isMe={l.isMe} />
              </div>
              <div style={{ ...displayFont, fontSize: T.h, color, lineHeight: 1 }}>{t(`${idx + 1}º`)}</div>
              <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, marginTop: S.xs, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nick}</div>
              <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stat(l)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Auto: conquista unlocked (lib/achievements, replayed in time) ──
const TIER_COLOR = () => ({ legend: C.legend, gold: C.gold, silver: C.silver, bronze: C.bronze });
function AchievementBody({ item, kudos, onGolaco, nameOf }) {
  const { md, line, mine, achievements } = item;
  const [hero, ...rest] = achievements;
  const who = mine ? t("Tu") : line.nick;
  const color = TIER_COLOR()[hero.tier] ?? C.gold;
  const HeroIcon = hero.icon;
  return (
    <>
      <Header
        leading={<Avatar name={nameOf ? nameOf(line) : (line.name || line.nick)} color={line.color || colorFor(line.key)} size={40} photo={line.photo} isMe={mine} />}
        title={who}
        meta={`${md.groupName ? `${md.groupName} · ` : ""}${md.dateLabel}`}
      />
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, background: `radial-gradient(circle at 50% 35%, ${color}33, ${C.card} 72%)`, border: `1.5px solid ${color}88`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <HeroIcon size={24} color={color} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color }}>{t("Conquista desbloqueada")}</div>
          <div style={{ fontSize: T.h, fontWeight: 900, color: C.text1, lineHeight: 1.2, marginTop: 2 }}>{t(hero.name)}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t(hero.desc)}</div>
        </div>
      </div>
      {rest.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
          {rest.map((a) => <Chip key={a.id} Icon={a.icon}>{t(a.name)}</Chip>)}
        </div>
      )}
      <Footer>
        {onGolaco && <GolacoButton active={kudos.mine} count={kudos.count} onClick={onGolaco} />}
        <ShareBtn text={`${who} · ${t("Conquista desbloqueada")}: ${t(hero.name)} (${md.groupName ?? ""} ${md.dateLabel})`} />
      </Footer>
    </>
  );
}

// ── Auto: card crossed into LENDA (OVR ≥ 86, FutCard tier) ──
function LegendBody({ item, kudos, onGolaco, nameOf }) {
  const { line, mine, overall, position, md } = item;
  const who = mine ? t("Tu") : line.nick;
  return (
    <>
      <Header
        leading={<Avatar name={nameOf ? nameOf(line) : (line.name || line.nick)} color={line.color || colorFor(line.key)} size={40} photo={line.photo} isMe={mine} />}
        title={who}
        meta={[md?.groupName, item.dateLabel].filter(Boolean).join(" · ")}
      />
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: R.control, padding: `${S.lg}px`,
        background: `linear-gradient(155deg, ${C.legend}33 0%, ${C.card} 80%)`, border: `1px solid ${C.legend}66`,
        display: "flex", alignItems: "center", gap: S.lg,
      }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(115deg, transparent 0 14px, ${C.legend}0E 14px 17px)`, pointerEvents: "none" }} />
        <div style={{ position: "relative", textAlign: "center", minWidth: 64 }}>
          <div style={{ ...displayFont, fontSize: 56, lineHeight: 1, color: C.legend, textShadow: `0 0 14px ${C.legend}66` }}>{overall}</div>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.06em", color: C.text1, marginTop: S.xs }}>{POSITION_ABBR[position] ?? ""}</div>
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <div style={{ ...displayFont, fontSize: 34, lineHeight: 1, color: C.legend, letterSpacing: "0.04em" }}>{t("LENDA")}</div>
          <div style={{ fontSize: T.body, color: C.text1, marginTop: S.sm, lineHeight: 1.4 }}>
            {mine ? t("O teu card chegou ao nível Lenda.") : t("O card chegou ao nível Lenda.")}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{t("Overall 86+ pela avaliação dos colegas")}</div>
        </div>
      </div>
      <Footer>
        {onGolaco && <GolacoButton active={kudos.mine} count={kudos.count} onClick={onGolaco} />}
        <ShareBtn text={`${who} · ${t("LENDA")} ${overall}`} />
      </Footer>
    </>
  );
}

// ── Auto: milestone (attendance streak) ────────────────────
function MilestoneBody({ item }) {
  return (
    <>
      <Header leading={<IconBadge Icon={Flame} color={C.orange} />} title={t("Marco")} meta={item.md?.dateLabel} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: S.md, marginBottom: S.sm }}>
        <div style={{ ...displayFont, fontSize: 64, lineHeight: 0.9, color: C.text1 }}>{item.streak}</div>
        <div style={{ ...displayFont, fontSize: T.h, lineHeight: 1.1, color: C.orange, textTransform: "uppercase", paddingBottom: S.xxs }}>{t("jornadas seguidas")}</div>
      </div>
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
        <video src={post.media} poster={post.poster} controls playsInline style={{ width: "100%", borderRadius: R.control, maxHeight: 360, background: C.bg, marginTop: S.md, display: "block" }} />
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
 * items (result / podium / performance / achievement / legend / milestone) share the same card anatomy
 * as manual posts (header → body → Golaço/share footer), so football
 * activity reads first-class, not as a system notice.
 *
 * Props: item (lib/homeFeed buildFeed), social (post handlers),
 *        kudos { count, mine } + onGolaco (performance items).
 */
export default function FeedItem({ item, social, kudos = { count: 0, mine: false }, onGolaco, onOpenGotw, onOpenCompetir, nameOf }) {
  const edge = item.kind === "performance" && (item.isMvp || item.isRecord) ? C.gold
    : item.kind === "achievement" ? C.gold
    : item.kind === "legend" ? C.legend
    : item.kind === "milestone" ? C.orange : null;
  return (
    <article style={{ ...cardStyle, ...(edge ? { borderTop: `3px solid ${edge}` } : {}) }}>
      {item.kind === "gotw" && (
        // Golo da Semana leader: trophy banner on top of the video post
        // itself (the Golaço on it is still the vote).
        <>
          <div style={{ display: "flex", alignItems: "center", gap: S.md, paddingBottom: S.md, marginBottom: S.md, borderBottom: `1px solid ${C.border}` }}>
            <IconBadge Icon={Trophy} color={C.gold} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1 }}>{t("Golo da Semana")}</div>
              <div style={{ fontSize: T.meta, color: C.text2 }}>
                {`${item.post.author?.nick ?? ""} ${t("lidera com")} ${item.post.likes?.length || 0} ⚽ Golaço`}
              </div>
            </div>
            {onOpenGotw && <Chip onClick={onOpenGotw}>{t("Ver ranking")}</Chip>}
          </div>
          <PostBody post={item.post} social={social} />
        </>
      )}
      {item.kind === "result" && <ResultBody md={item.md} />}
      {item.kind === "performance" && <PerformanceBody item={item} kudos={kudos} onGolaco={onGolaco} nameOf={nameOf} />}
      {item.kind === "milestone" && <MilestoneBody item={item} />}
      {item.kind === "podium" && <PodiumBody item={item} nameOf={nameOf} onOpenCompetir={onOpenCompetir} />}
      {item.kind === "achievement" && <AchievementBody item={item} kudos={kudos} onGolaco={onGolaco} nameOf={nameOf} />}
      {item.kind === "legend" && <LegendBody item={item} kudos={kudos} onGolaco={onGolaco} nameOf={nameOf} />}
      {item.kind === "post" && <PostBody post={item.post} social={social} />}
    </article>
  );
}
