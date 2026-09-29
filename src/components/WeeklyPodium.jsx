import { Star } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import Chip from "./Chip";
import SectionLabel from "./SectionLabel";

const PLACES = [
  { idx: 1, color: C.silver, size: 48, lift: 0 },  // 2nd — left
  { idx: 0, color: C.gold,   size: 60, lift: 16 }, // 1st — centre, raised
  { idx: 2, color: C.bronze, size: 48, lift: 0 },  // 3rd — right
];

/** Weekly podium — top 3 performers of the last matchday (from its
 *  summary.lines, already sorted by goals×2 + assists), plus the MVP
 *  result or an "MVP voting open" chip. Renders nothing if no matchday
 *  has been played yet or nobody contributed. */
export default function WeeklyPodium({ lastMatchday, mvp, group = [] }) {
  // Full name → the same 2-letter initials as every other Avatar (nick alone gives 1).
  const nameOf = (l) => l.name || group.find((p) => (l.key != null && (p.uuid ?? p.id) === l.key) || p.nick === l.nick)?.name || l.nick;
  const lines = (lastMatchday?.lines || []).filter((l) => (l.goals || 0) + (l.assists || 0) + (l.cleanSheets || 0) > 0);
  if (!lastMatchday || lines.length === 0) return null;
  const top = lines.slice(0, 3);
  const mvpNick = mvp && !mvp.open ? mvp.podium?.first : null;

  const statLine = (l) => [
    l.goals ? `${l.goals} ⚽` : null,
    l.assists ? `${l.assists} ${t("assist.")}` : null,
    l.cleanSheets ? `${l.cleanSheets} 🧤` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ marginBottom: S.xl }}>
      <SectionLabel right={<span style={{ fontSize: T.meta, color: C.text2 }}>{lastMatchday.date}</span>}>{t("Pódio da jornada")}</SectionLabel>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: S.sm }}>
          {PLACES.map(({ idx, color, size, lift }) => {
            const l = top[idx];
            if (!l) return <div key={idx} style={{ flex: 1 }} />;
            return (
              <div key={idx} style={{ flex: 1, minWidth: 0, textAlign: "center", paddingBottom: lift }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: S.sm }}>
                  <Avatar name={nameOf(l)} color={l.color || color} size={size} isMe={l.isMe} photo={l.photo} />
                </div>
                <div style={{ ...displayFont, fontSize: T.h, color, lineHeight: 1 }}>{t(`${idx + 1}º`)}</div>
                <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, marginTop: S.xs, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {l.nick}
                </div>
                <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{statLine(l)}</div>
              </div>
            );
          })}
        </div>

        {(mvpNick || mvp?.open) && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: S.lg, paddingTop: S.md, borderTop: `1px solid ${C.border}` }}>
            {mvpNick
              ? <Chip Icon={Star}>{`MVP · ${mvpNick}`}</Chip>
              : <Chip variant="orange" Icon={Star}>{t("Votação MVP aberta")}</Chip>}
          </div>
        )}
      </div>
    </div>
  );
}
