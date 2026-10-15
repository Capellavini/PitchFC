import { useState } from "react";
import { FastForward, UserRoundCog } from "lucide-react";
import { C, R, S, T } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError } from "../lib/rivalsCopy";
import { MC } from "../lib/rivalsMatchCopy";
import BtnGhost from "./BtnGhost";

/** DEMO MODE ONLY (teams.demoTools exists only without Supabase). Real
 *  kickoffs are agreed by both teams and the other captain is a real
 *  person — here a lone tester fast-forwards the clock and lets the rival
 *  captain report first, to walk the whole loop. Never rendered in cloud. */
export default function DemoMatchTools({ tools, matchId, scheduled, kicked, resultNone }) {
  const [error, setError] = useState(null);
  if (!tools || !scheduled) return null;
  const run = async (fn) => { const r = await fn(matchId); setError(r.error ? rivalsError(r.error) : null); };
  return (
    <div style={{ border: `1px dashed ${C.text3}`, borderRadius: R.card, padding: S.md, marginBottom: S.xl }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t(RC.demoTitle)}</div>
      <div style={{ fontSize: T.meta + 1, color: C.text2, lineHeight: 1.5, margin: `${S.xs}px 0 ${S.sm}px` }}>{t(MC.demoToolsBody)}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: S.sm }}>
        {!kicked && <BtnGhost onClick={() => run(tools.advanceMatch)} style={{ flex: "1 1 200px" }}><FastForward size={16} aria-hidden /> {t(MC.demoAdvance)}</BtnGhost>}
        {kicked && resultNone && <BtnGhost onClick={() => run(tools.rivalReports)} style={{ flex: "1 1 200px" }}><UserRoundCog size={16} aria-hidden /> {t(MC.demoRivalReports)}</BtnGhost>}
      </div>
      <div aria-live="polite">{error && <div role="alert" style={{ fontSize: T.meta + 1, color: C.red, marginTop: S.sm }}>{error}</div>}</div>
    </div>
  );
}
