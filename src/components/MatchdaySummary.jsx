import { useState } from "react";
import { Trophy, Star, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { C, S, T, R, TOUCH, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { nickIn, teamColorOf } from "../lib/homeFeed";
import Chip from "./Chip";
import ScoreLine from "./ScoreLine";
import GolacoButton from "./GolacoButton";
import { openWhatsApp, sharePostMessage } from "../lib/whatsapp";

/** One social entry for the whole session. Expansion never writes game data. */
export default function MatchdaySummary({ item, featured, nameOf, kudosFor, onGolaco, onShare }) {
  const [open, setOpen] = useState(false);
  const { md, myKey, highlights = [], achievements = [], legends = [], streak = 0 } = item;
  const matches = md.summary?.matches || [];
  const teams = [...new Set(matches.flatMap((m) => [m.homeName, m.awayName]))];
  const totals = Object.fromEntries(teams.map((name) => [name, 0]));
  matches.forEach((m) => { totals[m.homeName] += m.homeGoals || 0; totals[m.awayName] += m.awayGoals || 0; });
  const colorOf = teamColorOf(md);
  const lines = md.summary?.lines || [];
  const mine = lines.find((line) => line.key === myKey);
  const mvpNick = md.mvpNick ?? (md.mvpKey != null ? nickIn(md, md.mvpKey) : null);
  const scorers = [...lines].filter((line) => (line.goals || 0) > 0).sort((a,b) => b.goals - a.goals);
  const leader = scorers[0];
  const scoreText = matches.map((m) => `${m.homeName} ${m.homeGoals}–${m.awayGoals} ${m.awayName}`).join(" · ") || md.resultText || "";
  const share = () => onShare ? onShare() : openWhatsApp(sharePostMessage("PITCH", `${md.groupName || ""} ${md.dateLabel}: ${scoreText}${mvpNick ? ` · MVP: ${mvpNick}` : ""}`));
  const button = { minHeight: TOUCH.min, border: `1px solid ${C.border}`, borderRadius: R.pill, background: "transparent", color: C.text2, padding: `0 ${S.md}px`, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: S.sm, fontSize: T.meta, fontWeight: 700, cursor: "pointer" };
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.md }}>
        <Trophy size={24} color={C.accent} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.meta, color: C.accent, fontWeight: 800 }}>{t(featured ? "O teu último jogo" : "Resumo do jogo")}</div>
          <div style={{ fontSize: T.cardTitle, color: C.text1, fontWeight: 800, overflowWrap: "anywhere" }}>{md.groupName || t("O teu grupo")}</div>
        </div>
        <span style={{ color: C.text2, fontSize: T.meta }}>{md.dateLabel}</span>
      </div>
      {matches.length === 1 ? <ScoreLine m={matches[0]} colorOf={colorOf} big />
        : matches.length > 1 ? <>
          {teams.length === 2 && <ScoreLine m={{ homeName: teams[0], awayName: teams[1], homeGoals: totals[teams[0]], awayGoals: totals[teams[1]] }} colorOf={colorOf} big />}
          <div style={{ fontSize: T.meta, color: C.text2 }}>{matches.length} {t("jogos")}{teams.length === 2 ? ` · ${t("Total de golos")}` : ""}</div>
        </>
        : md.resultText ? <div style={{ ...displayFont, fontSize: 26, color: C.text1 }}>{md.resultText}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
        {mvpNick && <Chip Icon={Star}>MVP · {mvpNick}</Chip>}
        {md.summary?.champion && <Chip Icon={Trophy}>{t("Campeão")} · {md.summary.champion}</Chip>}
        {leader && <Chip>⚽ {leader.nick} · {leader.goals}</Chip>}
      </div>
      {mine && <div style={{ marginTop: S.md, color: C.text2, fontSize: T.body }}>
        <strong style={{ color: C.text1 }}>{t("A tua noite")}</strong> · {mine.goals || 0} {t((mine.goals || 0) === 1 ? "golo" : "golos")} · {mine.assists || 0} {t("assist.")}
      </div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={button}>
          {t(open ? "Fechar destaques" : "Ver destaques")}{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button type="button" onClick={share} style={{ ...button, marginLeft: "auto" }}><Share2 size={16} />{t("Partilhar")}</button>
      </div>
      {open && <div style={{ marginTop: S.md, borderTop: `1px solid ${C.border}`, paddingTop: S.md }}>
        {matches.length > 1 && matches.map((m,i) => <ScoreLine key={m.n ?? i} m={m} colorOf={colorOf} />)}
        {highlights.length > 0 && <div style={{ marginTop: S.md }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, marginBottom: S.sm }}>{t("Destaques")}</div>
          {highlights.map((it) => {
            const kudos = kudosFor?.(it) || { count: 0, mine: false };
            return <div key={it.id} style={{ padding: `${S.sm}px 0`, display: "flex", alignItems: "center", gap: S.sm, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1, overflowWrap: "anywhere" }}>{it.mine ? t("Tu") : (nameOf?.(it.line) || it.line.nick)}</div>
                <div style={{ fontSize: T.meta, color: C.text2 }}>{it.line.goals || 0} ⚽ · {it.line.assists || 0} {t("assist.")}{it.isMvp ? " · MVP" : ""}{it.isRecord ? ` · ${t("Novo recorde pessoal")}` : ""}{it.line.cleanSheets ? ` · ${it.line.cleanSheets} ${t("sem sofrer")}` : ""}</div>
              </div>
              {onGolaco && <GolacoButton active={kudos.mine} count={kudos.count} onClick={() => onGolaco(it)} />}
            </div>;
          })}
        </div>}
        {achievements.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm, marginTop: S.md }}>
          {achievements.flatMap((it) => it.achievements.map((a) => <Chip key={`${it.id}-${a.id}`} Icon={a.icon}>{it.mine ? t("Tu") : it.line.nick} · {t(a.name)}</Chip>))}
        </div>}
        {legends.map((it) => <div key={it.id} style={{ marginTop: S.sm, fontSize: T.meta, color: C.legend }}>{it.mine ? t("Tu") : it.line.nick} · {t("LENDA")} {it.overall}</div>)}
        {streak > 0 && <div style={{ marginTop: S.sm, color: C.text2, fontSize: T.meta }}>{streak} {t("jornadas seguidas")}</div>}
        {(item.top || []).length > 1 && <div style={{ marginTop: S.md, color: C.text2, fontSize: T.meta }}>
          {t("Pódio da jornada")} · {item.top.map((line,i) => `${i+1}º ${line.nick}`).join(" · ")}
        </div>}
      </div>}
    </>
  );
}
