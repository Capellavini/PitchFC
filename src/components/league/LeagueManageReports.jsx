import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { teamById } from "../../lib/leagueDemo";
import { corrections } from "../../lib/core/league";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import LeagueStateChip from "./LeagueStateChip";

const ORDER = { in_review: 0, ended_provisional: 1, live: 2, homologated: 3 };

/** Súmulas & validação: every started match, pending first, with the
 *  one-tap homologate for provisional results; everything else (send to
 *  review, correct an event) happens on the match page. */
export default function LeagueManageReports({ ctx, openMatch }) {
  const { state, derived, act } = ctx;
  const list = state.matches.filter((m) => m.state in ORDER).sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.kickoff.localeCompare(b.kickoff));
  return (
    <div>
      {list.map((m) => {
        const s = derived.scores[m.id];
        const fixes = corrections(state.logs[m.id] || []).length;
        const pending = m.state === "ended_provisional" || m.state === "in_review";
        return (
          <div key={m.id} style={{ ...cardStyle, marginBottom: S.sm, borderLeft: pending ? `3px solid ${C.orange}` : `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
              <span style={{ fontSize: T.body, fontWeight: 800 }}>{teamById[m.homeId].name} {s.home}–{s.away} {teamById[m.awayId].name}</span>
              <LeagueStateChip state={m.state} />
            </div>
            <div style={{ fontSize: T.meta, color: C.text2, margin: `${S.xs}px 0 ${S.sm}px` }}>
              {tf(t("{n} lances no registo · {c} correções"), { n: (state.logs[m.id] || []).length, c: fixes })}
              {m.contest && m.state === "in_review" ? ` · ${t("Contestação")}: “${m.contest.reason}”` : ""}
            </div>
            <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
              {pending && <BtnPrimary onClick={() => act.move(m.id, "homologated", {}, t("Resultado homologado — já conta na classificação oficial."))} style={{ flex: "1 1 140px" }}>{t("Homologar")}</BtnPrimary>}
              <BtnGhost onClick={() => openMatch(m.id)} style={{ flex: "1 1 140px" }}>{t("Abrir súmula")}</BtnGhost>
            </div>
          </div>
        );
      })}
    </div>
  );
}
