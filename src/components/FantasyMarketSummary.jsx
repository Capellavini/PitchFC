import { C, R, S, T } from "../theme";
import { fmtM } from "../lib/fantasy";
import { t } from "../lib/i18n";
import "../lib/fantasyConnectionCopy";

/**
 * FantasyMarketSummary — what the Mercado is about to do, BEFORE saving:
 * who leaves, who comes in, the bank afterwards and the transfer penalty
 * of the round. Computed from the saved squad vs the draft (same
 * transferState/bank the save will use); it changes nothing by itself.
 *
 *  - out / incoming   player objects (.nick, .uuid).
 *  - bankAfter        bank once the draft is saved ($M); over = negative.
 *  - penalty          points the next round will lose for extra transfers.
 */
export default function FantasyMarketSummary({ out, incoming, bankAfter, penalty }) {
  const none = !out.length && !incoming.length;
  const names = (list) => list.map((p) => p.nick).join(", ");
  const row = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: S.md, fontSize: T.body - 1, lineHeight: 1.4 };
  return (
    <div aria-live="polite" style={{ padding: `${S.sm}px ${S.md}px`, marginBottom: S.md, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, display: "flex", flexDirection: "column", gap: S.xs }}>
      {none ? (
        <div style={{ ...row, color: C.text2 }}>{t("Nenhuma troca por gravar.")}</div>
      ) : (
        <>
          {out.length > 0 && <div style={row}><span style={{ color: C.red, fontWeight: 800, flexShrink: 0 }}>{t("Sai")}</span><span style={{ color: C.text1, textAlign: "right", overflowWrap: "anywhere" }}>{names(out)}</span></div>}
          {incoming.length > 0 && <div style={row}><span style={{ color: C.green, fontWeight: 800, flexShrink: 0 }}>{t("Entra")}</span><span style={{ color: C.text1, textAlign: "right", overflowWrap: "anywhere" }}>{names(incoming)}</span></div>}
        </>
      )}
      <div style={{ ...row, color: C.text2 }}><span>{t("Saldo depois")}</span><span style={{ color: bankAfter < 0 ? C.red : C.text1, fontWeight: 800 }}>{fmtM(bankAfter)}</span></div>
      <div style={{ ...row, color: C.text2 }}><span>{t("Desconto de transferências")}</span><span style={{ color: penalty > 0 ? C.orange : C.text1, fontWeight: 800 }}>{penalty > 0 ? `−${penalty} pts` : "0 pts"}</span></div>
    </div>
  );
}
