import { useState } from "react";
import { Award, Users } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { getLang, t } from "../../lib/i18n";
import { plural, tf } from "../../lib/leagueCopy";
import { LM } from "../../lib/leagueMatchCopy";
import { roleLabel } from "../../lib/leagueCloudCopy";
import { fmtDateTime } from "../../lib/leagueDemo";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";

/** Destaques of a REAL league match — the same two separate blocks as
 *  the demo's LeagueAwards: "Craque oficial" (award_official_mvp, the
 *  regulation's mvp.official_by; re-award needs a reason) and "Craque dos
 *  adeptos" (open_fan_vote / cast_fan_vote; the tally is hidden until the
 *  window closes — it never feeds the official award). */
export default function LeagueCloudAwards({ page, dir, perms, candidates, onAward, onOpenVote, onVote, onCloseDemo }) {
  const lang = getLang();
  const mvp = page.officialMvp;
  const vote = page.fanVote || { state: "none", items: [] };
  const [pick, setPick] = useState(mvp?.playerId || candidates[0]?.id || "");
  const [reason, setReason] = useState("");
  const teamShort = (tid) => dir.teamById[tid]?.short || "—";
  const open = vote.state === "open";
  const total = vote.totalVotes ?? (vote.items || []).reduce((n, x) => n + x.votes, 0);

  return (
    <div style={{ display: "grid", gap: S.md }}>
      <section style={cardStyle} aria-labelledby="lgc-official-mvp">
        <div id="lgc-official-mvp" style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S.sm }}>
          <Award size={16} color={C.gold} aria-hidden /> {t(LM.officialMvp)}
        </div>
        {mvp ? (
          <>
            <div style={{ fontSize: T.cardTitle + 2, fontWeight: 800 }}>{mvp.name || dir.playerById[mvp.playerId]?.name || "—"}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{dir.teamById[mvp.teamId]?.name || "—"} · {tf(t("decidido por {by}"), { by: roleLabel(mvp.role || "manager") })}{mvp.revision > 1 ? ` · ${tf(t("revisão {n}"), { n: mvp.revision })}` : ""}</div>
          </>
        ) : <div style={{ fontSize: T.body, color: C.text2 }}>{t("Ainda não escolhido pela organização.")}</div>}
        {perms.officialMvp && candidates.length > 0 && (
          <div style={{ display: "grid", gap: S.sm, marginTop: S.md }}>
            <label htmlFor="lgc-mvp-pick" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t(LM.officialMvp)}</label>
            <select id="lgc-mvp-pick" value={pick} onChange={(e) => setPick(e.target.value)} style={inputStyle()}>
              {candidates.map((p) => <option key={p.id} value={p.id}>{p.name} · {teamShort(p.teamId)}</option>)}
            </select>
            {mvp && <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={t("Motivo da alteração (obrigatório)")} aria-label={t("Motivo da alteração (obrigatório)")} style={inputStyle()} />}
            <BtnGhost tone="accent" onClick={() => onAward(pick, mvp ? reason.trim() : null)}>{mvp ? t("Alterar craque oficial") : t("Definir craque oficial")}</BtnGhost>
          </div>
        )}
      </section>

      <section style={cardStyle} aria-labelledby="lgc-fans-mvp">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
          <span id="lgc-fans-mvp" style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Users size={16} color={C.blue} aria-hidden /> {t(LM.fansMvp)}
          </span>
          <Chip variant={open ? "orange" : "neutral"}>{vote.state === "none" ? t("Votação não aberta") : open ? t("Votação aberta") : t("Votação fechada")}</Chip>
        </div>
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
          {t("Um voto por conta e por jogo; podes mudar até a votação fechar. Os resultados só aparecem no fecho. Não altera o craque oficial.")}
          {open && vote.closesAt ? ` ${tf(t("Fecha {when}."), { when: fmtDateTime(vote.closesAt, lang) })}` : ""}
        </div>
        {vote.state === "closed" && (
          <>
            {(vote.items || []).length === 0 && <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.sm }}>{t("Sem votos.")}</div>}
            {(vote.items || []).slice(0, 5).map((r) => {
              const pct = total ? Math.round((r.votes / total) * 100) : 0;
              return (
                <div key={r.playerId} style={{ marginBottom: S.sm }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: S.sm, fontSize: T.body }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}{r.playerId === vote.myVote ? ` · ${t("o teu voto")}` : ""}</span>
                    <span style={{ color: C.text2, flexShrink: 0 }}>{r.votes} · {pct}%</span>
                  </div>
                  <div aria-hidden style={{ height: 6, background: C.surface, borderRadius: R.pill, marginTop: 4 }}>
                    <div style={{ width: `${pct}%`, height: 6, background: C.blue, borderRadius: R.pill }} />
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: T.meta, color: C.text2 }}>{plural(total, "voto", "votos")}</div>
          </>
        )}
        {open && perms.vote && candidates.length > 0 && (
          <div role="radiogroup" aria-label={t(LM.fansMvp)} style={{ display: "flex", flexWrap: "wrap", gap: S.xs }}>
            {candidates.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={vote.myVote === p.id} onClick={() => onVote(p.id)}
                style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontSize: T.meta, fontWeight: 700, border: `1px solid ${vote.myVote === p.id ? C.accent : C.border}`, background: vote.myVote === p.id ? C.accent : "transparent", color: vote.myVote === p.id ? C.bg : C.text1 }}>
                {p.name} · {teamShort(p.teamId)}
              </button>
            ))}
          </div>
        )}
        {open && !perms.vote && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Entra na tua conta PITCH para votar.")}</div>}
        {perms.openFanVote && <BtnPrimary block onClick={onOpenVote} style={{ marginTop: S.md }}>{t(LM.openVote)}</BtnPrimary>}
        {open && onCloseDemo && <BtnGhost block onClick={onCloseDemo} style={{ marginTop: S.md }}>{t("Fechar votação agora (só no modo local)")}</BtnGhost>}
      </section>
    </div>
  );
}
