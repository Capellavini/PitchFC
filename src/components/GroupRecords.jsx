import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { C, S, R, T, cardStyle, displayFont } from "../theme";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnGhost from "./BtnGhost";
import MatchdayGames from "./MatchdayGames";

// Compact day highlights — computed from that day's saved per-player
// lines, no new data. Each award only shows if someone actually earned
// it (no "0 golos" Golden Boot).
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

/** Group page → Stats → "Histórico": one expandable row per matchday
 *  (games, per-player lines, MVP); the organizer can delete a day in
 *  cloud mode. Rows live inside a single card, divided by 1px lines. */
export default function GroupRecords({ records = [], canDelete, onDeleteMatchday }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div style={{ marginTop: S.xl }}>
      <SectionLabel>{t("Histórico")}</SectionLabel>
      {records.length === 0 ? (
        <div style={{ ...cardStyle, fontSize: T.body, color: C.text2 }}>{t("Ainda sem dias de jogo registados.")}</div>
      ) : (
        <div style={{ ...cardStyle, padding: "0 16px" }}>
          {records.map((r, i) => {
            const open = openId === r.id;
            const awards = dayAwards(r.summary?.lines);
            return (
              <div key={r.id} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                <button onClick={() => setOpenId(open ? null : r.id)}
                  style={{ width: "100%", minHeight: 56, background: "none", border: "none", cursor: "pointer", color: C.text1, display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px 0`, textAlign: "left" }}>
                  <div style={{ width: 52, flexShrink: 0 }}>
                    <div style={{ ...displayFont, fontSize: T.cardTitle + 2 }}>{r.totalGoals}⚽</div>
                    <div style={{ fontSize: T.meta, color: C.text2 }}>{r.date}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: T.body, fontWeight: 700 }}>{r.nGames} {r.nGames === 1 ? t("jogo") : t("jogos")}</div>
                    <div style={{ fontSize: T.meta, color: C.text2 }}>
                      ⭐ {r.mvpNick ? <>MVP: <b style={{ color: C.text1 }}>{r.mvpNick}</b></> : r.mvpOpen ? t("votação a decorrer") : t("sem votos")}
                    </div>
                  </div>
                  <ChevronDown size={18} color={C.text2} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                </button>
                {open && (
                  <div style={{ paddingBottom: S.lg }}>
                    {awards.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: S.xs + 2, marginBottom: S.md }}>
                        {awards.map(([icon, label, nick, val]) => (
                          <span key={label} title={label} style={{ display: "inline-flex", alignItems: "center", gap: S.xs + 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: "4px 10px 4px 6px", fontSize: T.meta }}>
                            <span>{icon}</span><b style={{ color: C.text1 }}>{nick}</b><span style={{ color: C.text2 }}>{val}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <MatchdayGames summary={r.summary} />
                    {(r.summary?.lines ?? []).length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: S.xs + 2, marginBottom: canDelete ? S.md : 0 }}>
                        {r.summary.lines.map((l) => (
                          <div key={l.key} style={{ display: "flex", alignItems: "center", gap: S.sm }}>
                            <Avatar name={l.name || l.nick} color={l.color || C.text2} size={24} fontSize={9} photo={l.photo} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: T.meta, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nick}</span>
                            <span style={{ fontSize: T.meta, color: C.text2, display: "flex", gap: S.sm, flexShrink: 0 }}>
                              {l.goals > 0 && <span>⚽ {l.goals}</span>}
                              {l.assists > 0 && <span>🎯 {l.assists}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {canDelete && onDeleteMatchday && (
                      <BtnGhost block compact tone="danger" onClick={() => onDeleteMatchday(r.id, r.date)}>
                        <Trash2 size={14} /> {t("Apagar este dia de jogo")}
                      </BtnGhost>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
