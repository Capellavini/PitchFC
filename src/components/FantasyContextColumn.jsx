import { C, R, S, T, cardStyle, displayFont } from "../theme";
import { playerColor, POSITION_ABBR } from "../lib/helpers";
import { fmtM } from "../lib/fantasy";
import { t } from "../lib/i18n";
import "../lib/fantasyConnectionCopy";
import Avatar from "./Avatar";

const eyebrow = { fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.sm };
const empty = { fontSize: T.body - 1, color: C.text2, lineHeight: 1.4 };

/**
 * FantasyContextColumn — secondary column next to the pitch on wide
 * screens: my last result, the league's top of the table and who is in form.
 * Everything is derived from real rounds; with too little data each card
 * says so instead of inventing rows.
 *
 *  - lastScore / lastRoundNo / lastRank   my score row of the last scored round.
 *  - standings   [{ participant_id, points, rank }] (Campeonato).
 *  - form        [{ player, pts }] best raw players of the last round.
 *  - priceOf(uuid)
 */
export default function FantasyContextColumn({ group, me, lastScore, lastRoundNo, lastRank, standings, form, priceOf }) {
  const byId = (id) => group.find((p) => String(p.uuid) === String(id));
  const cap = lastScore?.breakdown?.players?.find((p) => p.mult > 1) || null;
  const top = standings.slice(0, 3);
  const mine = standings.find((r) => r.participant_id === me?.uuid);
  const rows = mine && !top.includes(mine) ? [...top, mine] : top;
  return (
    <aside aria-label={t("Contexto")} style={{ display: "flex", flexDirection: "column", gap: S.md }}>
      <section style={{ ...cardStyle, background: C.surface }}>
        <div style={eyebrow}>{t("O teu último jogo")}{lastRoundNo ? ` · ${t("Ronda")} ${String(lastRoundNo).padStart(2, "0")}` : ""}</div>
        {lastScore ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, flexWrap: "wrap" }}>
              <span style={{ ...displayFont, fontSize: 56, lineHeight: 1, color: C.accent }}>{Math.round(lastScore.points)}</span>
              <span style={{ fontSize: T.body, color: C.text2 }}>pts</span>
              {lastRank && <span style={{ marginLeft: "auto", fontSize: T.body - 1, fontWeight: 700, color: C.green }}>{lastRank}.º {t("na ronda")}</span>}
            </div>
            {cap && <div style={{ fontSize: T.body - 1, color: C.text2, marginTop: S.sm }}>{byId(cap.id)?.nick ?? "?"} {t("fez")} {Math.round(cap.pts)} pts {t("como capitão")}.</div>}
          </>
        ) : <div style={empty}>{t("Ainda sem rondas pontuadas.")}</div>}
      </section>

      <section style={{ ...cardStyle, background: C.surface }}>
        <div style={eyebrow}>{t("Na tua liga")}</div>
        {rows.length ? rows.map((r, i) => {
          const p = byId(r.participant_id);
          const isMe = r.participant_id === me?.uuid;
          return (
            <div key={r.participant_id} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 40, borderTop: i ? `1px solid ${C.border}` : "none", color: isMe ? C.accent : C.text1, fontWeight: isMe ? 800 : 600 }}>
              <span style={{ width: 22, color: C.text2, fontVariantNumeric: "tabular-nums" }}>{r.rank}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.nick ?? "?"}{isMe ? ` · ${t("tu")}` : ""}</span>
              <span style={{ ...displayFont, fontVariantNumeric: "tabular-nums" }}>{Math.round(r.points)}</span>
            </div>
          );
        }) : <div style={empty}>{t("Ainda sem rondas pontuadas.")}</div>}
      </section>

      <section style={{ ...cardStyle, background: C.surface }}>
        <div style={eyebrow}>{t("Em boa fase")}</div>
        {form.length ? form.map(({ player, pts }, i) => (
          <div key={player.uuid} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 48, borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <Avatar name={player.name} color={playerColor(group, player)} photo={player.photo} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: T.body, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.nick}</div>
              <div style={{ fontSize: T.min, color: C.text2 }}>{t(POSITION_ABBR[player.position] || "MED")} · {fmtM(priceOf(player.uuid))}</div>
            </div>
            <span style={{ ...displayFont, fontSize: T.cardTitle, color: C.green, fontVariantNumeric: "tabular-nums" }}>+{Math.round(pts)}</span>
          </div>
        )) : <div style={{ ...empty, borderRadius: R.control }}>{t("Sem dados suficientes para mostrar quem está em boa fase.")}</div>}
      </section>
    </aside>
  );
}
