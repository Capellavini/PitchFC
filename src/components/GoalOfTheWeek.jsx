import { useState } from "react";
import { Play } from "lucide-react";
import { C, S, R, T, TOUCH, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Golo da Semana — the group's video posts from the last 7 days,
 *  ranked by ⚽ Golaço reactions. The Golaço IS the vote (same
 *  social.onToggleLike the feed uses), so there's no separate ballot or
 *  new table: whichever video has the most Golaços this week leads.
 *
 *  `postDates` ({ [postId]: ISO created_at }) scopes to the last 7 days
 *  in cloud mode; local demo posts carry no timestamp, so all of them
 *  count. The leader's video is shown; the rest expand on tap. */
export default function GoalOfTheWeek({ social, group = [], postDates }) {
  const [openId, setOpenId] = useState(null);
  if (!social) return null;

  const now = Date.now();
  const candidates = (social.posts || [])
    .filter((p) => p.type === "video" && p.media && p.author?.groupId === social.myGroupId)
    .filter((p) => {
      const iso = postDates?.[p.id];
      return !iso || now - new Date(iso).getTime() <= WEEK_MS;
    })
    .sort((a, b) => b.likes.length - a.likes.length);

  const colorOf = (authorId) => {
    const p = group.find((x) => (x.uuid ?? x.id) === authorId);
    return p ? playerColor(group, p) : C.blue;
  };

  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel right={<span style={{ fontSize: T.meta, color: C.text2 }}>{t("últimos 7 dias")}</span>}>{t("Golo da Semana")}</SectionLabel>

      {candidates.length === 0 ? (
        <div style={{ ...cardStyle, fontSize: T.body - 1, color: C.text2, lineHeight: 1.45 }}>
          {t("Ainda não há golos em vídeo esta semana. Publica o teu no feed — o vídeo com mais ⚽ Golaço ganha.")}
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: `${S.md}px ${S.lg}px`, fontSize: T.meta, color: C.text2, borderBottom: `1px solid ${C.border}` }}>
            {t("O teu ⚽ Golaço é o voto. Ganha o vídeo com mais Golaços.")}
          </div>
          {candidates.map((p, i) => {
            const open = i === 0 ? openId !== `x-${p.id}` : openId === p.id;
            const toggleOpen = () => setOpenId(i === 0 ? (open ? `x-${p.id}` : null) : (open ? null : p.id));
            const leader = i === 0 && p.likes.length > 0;
            return (
              <div key={p.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none", padding: `${S.md}px ${S.lg}px` }}>
                <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
                  <span style={{ ...displayFont, width: 20, textAlign: "center", fontSize: T.body + 2, color: leader ? C.gold : C.text2 }}>{i + 1}</span>
                  <button type="button" onClick={toggleOpen} aria-expanded={open}
                    style={{ flex: 1, minWidth: 0, minHeight: TOUCH.min, display: "flex", alignItems: "center", gap: S.md, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
                    <Avatar name={p.author.name || p.author.nick} color={colorOf(p.author.id)} size={36} isMe={p.mine} photo={p.author.photo} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: T.body + 1, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.author.nick}</div>
                      <div style={{ fontSize: T.meta, color: C.text2, display: "flex", alignItems: "center", gap: S.xs, overflow: "hidden", whiteSpace: "nowrap" }}>
                        <Play size={11} /> {p.text ? p.text : p.time}
                      </div>
                    </div>
                  </button>
                  <button type="button" onClick={() => social.onToggleLike(p.id, p.liked)} aria-pressed={p.liked}
                    style={{ minHeight: TOUCH.min, minWidth: 64, borderRadius: R.control, padding: `0 ${S.md}px`, background: p.liked ? C.accentDim : "transparent", color: p.liked ? C.accent : C.text1, border: `1px solid ${p.liked ? C.accentBorder : C.border}`, fontSize: T.body - 1, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
                    ⚽ {p.likes.length}
                  </button>
                </div>
                {open && (
                  <video src={p.media} controls playsInline preload="metadata"
                    style={{ width: "100%", borderRadius: R.control, maxHeight: 320, background: C.bg, marginTop: S.md, display: "block" }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
