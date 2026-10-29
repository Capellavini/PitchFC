import { useState } from "react";
import { Award, Users } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf, plural } from "../../lib/leagueCopy";
import { playerById, teamById, fmtDateTime, modOn } from "../../lib/leagueDemo";
import { fanVoteOpen, tallyFanVotes } from "../../lib/core/league";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";

/** Destaques: official MVP ("Craque oficial", chosen by the manager, with
 *  author) and the fans' vote ("Craque dos adeptos") — two separate
 *  structures, shown as two separate blocks. The partial tally never
 *  looks like a final result. */
export default function LeagueAwards({ ctx, match }) {
  const { state, role, acc, act, lang } = ctx;
  const candidates = [...(match.lineups?.[match.homeId] || []), ...(match.lineups?.[match.awayId] || [])].map((id) => playerById[id]).filter(Boolean);
  const [pick, setPick] = useState(match.officialMvp?.playerId || candidates[0]?.id || "");
  const open = fanVoteOpen(match);
  const tally = tallyFanVotes(state.fanVotes, match.id);
  const mine = state.fanVotes?.[match.id]?.[acc.accountId] || null;
  const mvp = match.officialMvp;

  return (
    <div style={{ display: "grid", gap: S.md }}>
      <section style={cardStyle} aria-labelledby="lg-official-mvp">
        <div id="lg-official-mvp" style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.sm }}>
          <Award size={16} color={C.gold} aria-hidden /> {t(LG.officialMvp)}
        </div>
        {mvp ? (
          <>
            <div style={{ fontSize: T.cardTitle + 2, fontWeight: 800 }}>{playerById[mvp.playerId].name}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{teamById[playerById[mvp.playerId].teamId].name} · {tf(t("decidido por {by}"), { by: mvp.by || t("Gestor (demo)") })}{mvp.at ? ` · ${fmtDateTime(mvp.at, lang)}` : ""}</div>
          </>
        ) : <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda não escolhido pela organização.")}</div>}
        {role === "manager" && candidates.length > 0 && (
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
            <label htmlFor="lg-mvp-pick" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t(LG.officialMvp)}</label>
            <select id="lg-mvp-pick" value={pick} onChange={(e) => setPick(e.target.value)} style={{ ...inputStyle(), flex: "1 1 180px", width: "auto" }}>
              {candidates.map((p) => <option key={p.id} value={p.id}>{p.name} · {teamById[p.teamId].short}</option>)}
            </select>
            <BtnGhost tone="accent" onClick={() => act.setMvp(match.id, pick)} style={{ flex: "1 1 140px" }}>{mvp ? t("Alterar craque oficial") : t("Definir craque oficial")}</BtnGhost>
          </div>
        )}
      </section>

      {modOn("fan_vote") && <section style={cardStyle} aria-labelledby="lg-fans-mvp">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
          <span id="lg-fans-mvp" style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Users size={16} color={C.blue} aria-hidden /> {t(LG.fansMvp)}
          </span>
          <Chip variant={open ? "orange" : "neutral"}>{open ? t("Votação aberta · parcial") : t("Votação fechada")}</Chip>
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
          {t("Um voto por conta e por jogo; podes mudar até a votação fechar. Não altera o craque oficial nem pontua no Pitch Manager.")}
        </div>
        {tally.rows.length === 0 && <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.sm }}>{t("Ainda sem votos.")}</div>}
        {tally.rows.slice(0, 5).map((r) => {
          const pct = tally.total ? Math.round((r.votes / tally.total) * 100) : 0;
          return (
            <div key={r.playerId} style={{ marginBottom: S.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: S.sm, fontSize: T.body }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{playerById[r.playerId]?.name}{r.playerId === mine ? ` · ${t("o teu voto")}` : ""}</span>
                <span style={{ color: C.text2, flexShrink: 0 }}>{r.votes} · {pct}%</span>
              </div>
              <div aria-hidden style={{ height: 6, background: C.surface, borderRadius: R.pill, marginTop: 4 }}>
                <div style={{ width: `${pct}%`, height: 6, background: open ? C.orange : C.blue, borderRadius: R.pill }} />
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: open ? S.md : 0 }}>{plural(tally.total, "voto", "votos")}{open ? ` · ${t("resultado parcial — não é final")}` : ""}</div>
        {open && candidates.length > 0 && (
          <div role="radiogroup" aria-label={t(LG.fansMvp)} style={{ display: "flex", flexWrap: "wrap", gap: S.xs }}>
            {candidates.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={mine === p.id} onClick={() => act.vote(match.id, p.id)}
                style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontSize: T.meta, fontWeight: 700, border: `1px solid ${mine === p.id ? C.accent : C.border}`, background: mine === p.id ? C.accent : "transparent", color: mine === p.id ? C.bg : C.text1 }}>
                {p.name.split(" ")[0]} {p.name.split(" ").slice(-1)[0][0]}. · {teamById[p.teamId].short}
              </button>
            ))}
          </div>
        )}
        {open && role === "manager" && (
          <BtnPrimary block onClick={() => act.closeVote(match.id)} style={{ marginTop: S.md }}>{t("Fechar votação dos adeptos")}</BtnPrimary>
        )}
      </section>}
    </div>
  );
}
