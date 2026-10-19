import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";
import "../lib/fantasyCopy";
import Avatar from "./Avatar";

const ITEM_ORDER = ["played", "goals", "assists", "saves", "cleanSheets", "wins", "hatTrick", "ownGoals", "noShow", "mvp"];
const itemLabel = (k, n) => {
  if (k === "mvp") return n === 1 ? "MVP" : n === 2 ? t("2.º MVP") : t("3.º MVP");
  const L = { played: "Jogou", goals: "Golos", assists: "Assist.", saves: "Defesas", cleanSheets: "Sem sofrer",
    wins: "Vitórias", hatTrick: "Hat-trick", ownGoals: "Autogolos", noShow: "Faltou" };
  return t(L[k] || k);
};
const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}`;

/** One participant's scored round, player by player: what each real
 *  player did (goals, CS per game, wins per game, no-show…), auto-subs,
 *  the captain/vice ×2 and the transfer cost. `score.breakdown` is the
 *  server's fantasy_v2_score_lineup() output (or scoreLineup() in demo). */
export default function FantasyRoundBreakdown({ score, group, title }) {
  const b = score?.breakdown;
  if (!b?.players) return null;
  const byId = (id) => group.find((p) => String(p.uuid) === String(id));
  const rows = b.players.filter((p) => p.slot === "starter" || p.counted);
  return (
    <div style={{ ...cardStyle, marginBottom: S.lg, padding: `${S.md}px ${S.lg}px` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <div style={{ fontSize: T.cardTitle, fontWeight: 800, color: C.text1, minWidth: 0 }}>{title || t("A tua última ronda")}</div>
        <div style={{ ...displayFont, fontSize: T.h + 2, color: C.text1, flexShrink: 0 }}>{Math.round(b.total)} <span style={{ fontSize: T.meta, color: C.text2 }}>pts</span></div>
      </div>
      {rows.map((r, i) => {
        const p = byId(r.id);
        const sub = r.subFor ? byId(r.subFor) : null;
        const out = r.subbedBy ? byId(r.subbedBy) : null;
        const items = ITEM_ORDER.filter((k) => r.items?.[k]);
        return (
          <div key={r.id} style={{ display: "flex", gap: S.md, padding: `${S.sm}px 0`, borderTop: i > 0 ? `1px solid ${C.border}` : "none", opacity: r.counted ? 1 : 0.6 }}>
            <Avatar name={p?.name || "?"} color={p ? playerColor(group, p) : C.text2} photo={p?.photo} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p?.nick || "?"}
                {r.mult > 1 && <span style={{ color: C.gold, fontWeight: 800 }}> · {String(r.id) === String(score.captain_id) ? t("Capitão ×2") : t("Vice ×2")}</span>}
              </div>
              <div style={{ fontSize: T.min, color: C.text2, marginTop: 2, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                {sub && <span style={{ color: C.green, fontWeight: 700 }}>{t("Entrou por")} {sub.nick} · </span>}
                {out && <span style={{ color: C.orange, fontWeight: 700 }}>{t("Não jogou — substituído por")} {out.nick}</span>}
                {!out && (items.length ? items.map((k, j) => (
                  <span key={k} style={{ whiteSpace: "nowrap" }}>
                    {j > 0 ? " · " : ""}{itemLabel(k, r.items[k].n)}{k !== "played" && k !== "noShow" && k !== "hatTrick" && k !== "mvp" ? ` ${r.items[k].n}` : ""} {signed(r.items[k].pts)}
                  </span>
                )) : t("Não jogou"))}
              </div>
            </div>
            <div style={{ ...displayFont, fontSize: T.body + 2, color: r.pts < 0 ? C.red : C.text1, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{signed(r.pts)}</div>
          </div>
        );
      })}
      {b.transferCost > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: `${S.sm}px 0 0`, borderTop: `1px solid ${C.border}`, fontSize: T.meta, color: C.orange, fontWeight: 700 }}>
          <span>{t("Transferências extra")}</span><span>−{b.transferCost}</span>
        </div>
      )}
      <div style={{ fontSize: T.min, color: C.text2, marginTop: S.sm, padding: `${S.xs}px ${S.sm}px`, background: C.surface, borderRadius: R.control, lineHeight: 1.4 }}>
        {t("Sem sofrer e vitórias contam por jogo da noite. Quem não jogou é trocado pelo primeiro suplente que jogou.")}
      </div>
    </div>
  );
}
