import { Star, Check } from "lucide-react";
import { C, R, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import BtnGhost from "./BtnGhost";
import SectionLabel from "./SectionLabel";

const ranks = () => [
  { n: 1, label: "1º lugar", color: C.gold, medal: "🥇" },
  { n: 2, label: "2º lugar", color: C.silver, medal: "🥈" },
  { n: 3, label: "3º lugar", color: C.bronze, medal: "🥉" },
];

/**
 * MVP after the final whistle (Matchday state C): the ranked top-3 ballot
 * while voting is open, the podium once the organizer closes it. Same
 * `mvp` view object PitchApp builds for cloud and local demo:
 * { open, candidates:[{key,nick,position}], myVotes:{1,2,3}, tally, podium,
 *   canClose, onVote(rank,key), onClear(rank), onClose() }.
 */
export default function MatchdayMvpVote({ mvp }) {
  if (!mvp) return null;

  // Assigning a candidate to a rank they already hold elsewhere moves
  // them (the DB rejects the same candidate at two ranks for one voter).
  const pickForRank = async (rank, key) => {
    if (mvp.myVotes[rank] === key) { await mvp.onClear(rank); return; }
    const otherRank = [1, 2, 3].find((r) => r !== rank && mvp.myVotes[r] === key);
    if (otherRank) await mvp.onClear(otherRank);
    await mvp.onVote(rank, key);
  };

  if (!mvp.open) {
    const podium = mvp.podium;
    if (!podium?.first) return null;
    const medals = ranks().map((r, i) => ({ ...r, nick: [podium.first, podium.second, podium.third][i] })).filter((r) => r.nick);
    return (
      <section style={{ marginBottom: S.xl }}>
        <SectionLabel>{t("MVP")}</SectionLabel>
        <div style={{ ...cardStyle, padding: `0 ${S.lg}px` }}>
          {medals.map((r, i) => (
            <div key={r.n} style={{ display: "flex", alignItems: "center", gap: S.md, minHeight: i === 0 ? 64 : 52, borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize: i === 0 ? 26 : 20 }} aria-hidden>{r.medal}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: i === 0 ? T.h : T.body, fontWeight: 800, color: i === 0 ? C.gold : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nick}</span>
              <span style={{ fontSize: T.meta, color: C.text2 }}>{t(r.label)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const done = [1, 2, 3].every((r) => mvp.myVotes[r]);
  return (
    <section style={{ marginBottom: S.xl }}>
      <SectionLabel right={done ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.green, fontWeight: 700 }}><Check size={14} /> {t("Votaste")}</span> : null}>
        {t("Votação MVP")}
      </SectionLabel>
      <div style={{ ...cardStyle, borderLeft: done ? `1px solid ${C.border}` : `3px solid ${C.accent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.cardTitle, fontWeight: 700, marginBottom: S.lg }}>
          <Star size={18} color={C.gold} /> {t("Quem foram os 3 melhores em campo?")}
        </div>
        {(mvp.candidates || []).length === 0 && <div style={{ fontSize: T.body, color: C.text2 }}>{t("Sem candidatos neste dia.")}</div>}
        {(mvp.candidates || []).length > 0 && ranks().map(({ n: rank, label, color }) => (
          <div key={rank} style={{ marginBottom: S.lg }}>
            <div style={{ fontSize: T.meta, fontWeight: 800, color, marginBottom: S.sm }}>{t(label)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: S.sm }}>
              {mvp.candidates.map((c) => {
                const selected = mvp.myVotes[rank] === c.key;
                const usedElsewhere = [1, 2, 3].some((r) => r !== rank && mvp.myVotes[r] === c.key);
                const votes = mvp.tally?.[c.key];
                return (
                  <button key={c.key} type="button" onClick={() => pickForRank(rank, c.key)} disabled={usedElsewhere}
                    style={{ minHeight: 52, background: selected ? `${color}22` : "transparent", border: `1.5px solid ${selected ? color : C.border}`, borderRadius: R.control, padding: `${S.sm}px ${S.xs}px`, cursor: usedElsewhere ? "default" : "pointer", textAlign: "center", opacity: usedElsewhere ? 0.35 : 1, minWidth: 0 }}>
                    <div style={{ fontSize: T.meta + 1, fontWeight: 800, color: selected ? color : C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nick}</div>
                    <div style={{ fontSize: T.min, color: C.text2, marginTop: 2 }}>
                      {votes > 0 ? `${votes} ${t("pts")}` : t(c.position)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {mvp.canClose && (
          <BtnGhost block tone="accent" onClick={mvp.onClose}>{t("Fechar votação e revelar o pódio")}</BtnGhost>
        )}
      </div>
    </section>
  );
}
