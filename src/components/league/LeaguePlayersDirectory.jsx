import { useState } from "react";
import { GitCompare } from "lucide-react";
import { C, S, T, TOUCH, cardStyle, inputStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { POSITION_LABEL, tf } from "../../lib/leagueCopy";
import { PLAYERS, TEAMS, teamById, ovrOfPlayer } from "../../lib/leagueDemo";
import BackHeader from "../BackHeader";
import SegmentedControl from "../SegmentedControl";
import BtnGhost from "../BtnGhost";
import Avatar from "../Avatar";
import LeagueOvrChip from "./LeagueOvrChip";

const SORTS = [{ id: "ovr", label: "OVR" }, { id: "goals", label: "Golos" }, { id: "assists", label: "Assistências" }, { id: "mvps", label: "Craque" }];

/** Atletas da competição: every inscribed athlete with photo/initials and
 *  OVR, filter by team / position, sort by OVR or official stats, and a
 *  way into Comparar atletas. */
export default function LeaguePlayersDirectory({ ctx }) {
  const { derived, acc, back, open } = ctx;
  const [team, setTeam] = useState("");
  const [pos, setPos] = useState("");
  const [sort, setSort] = useState("ovr");
  const val = (p) => (sort === "ovr" ? ovrOfPlayer(p) : derived.stats[p.id]?.[sort] || 0);
  const rows = PLAYERS.filter((p) => (!team || p.teamId === team) && (!pos || p.position === pos))
    .sort((a, b) => (val(b) - val(a)) || (ovrOfPlayer(b) - ovrOfPlayer(a)) || a.name.localeCompare(b.name, "pt"));

  return (
    <div>
      <BackHeader title={t("Atletas")} subtitle={tf(t("{n} inscritos nesta competição"), { n: PLAYERS.length })} onBack={back} />
      <BtnGhost block onClick={() => open({ kind: "compare" })} style={{ marginBottom: S.md }}><GitCompare size={16} aria-hidden /> {t("Comparar atletas")}</BtnGhost>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: S.sm, marginBottom: S.md }}>
        <label style={{ fontSize: T.meta, color: C.text2, fontWeight: 700 }}>{t("Equipa")}
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...inputStyle(), marginTop: S.xs }}>
            <option value="">{t("Todas")}</option>
            {TEAMS.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: T.meta, color: C.text2, fontWeight: 700 }}>{t("Posição")}
          <select value={pos} onChange={(e) => setPos(e.target.value)} style={{ ...inputStyle(), marginTop: S.xs }}>
            <option value="">{t("Todas")}</option>
            {Object.keys(POSITION_LABEL).map((k) => <option key={k} value={k}>{t(POSITION_LABEL[k])}</option>)}
          </select>
        </label>
      </div>
      <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
      <div style={{ ...cardStyle, padding: `0 ${S.md}px` }}>
        {rows.map((p, i) => (
          <button key={p.id} type="button" onClick={() => open({ kind: "player", id: p.id })}
            style={{ width: "100%", minHeight: TOUCH.button + 8, display: "flex", alignItems: "center", gap: S.md, background: "none", border: "none", borderTop: i ? `1px solid ${C.border}` : "none", color: C.text1, cursor: "pointer", textAlign: "left", padding: `${S.xs}px 0` }}>
            <span style={{ width: 18, fontSize: T.meta, fontWeight: 800, color: C.text2, flexShrink: 0 }}>{i + 1}</span>
            <Avatar name={p.name} photo={p.photo} color={teamById[p.teamId].color} size={36} isMe={p.id === acc.playerId} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nick}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamById[p.teamId].short} · {t(POSITION_LABEL[p.position])}</span>
            </span>
            {sort !== "ovr" && <span style={{ ...displayFont, fontSize: 18, flexShrink: 0 }}>{val(p)}</span>}
            <LeagueOvrChip ovr={ovrOfPlayer(p)} size="sm" />
          </button>
        ))}
      </div>
      <div style={{ fontSize: T.meta, color: C.text2, marginTop: S.sm, lineHeight: 1.5 }}>{t("Golos, assistências e craque contam só jogos homologados desta competição.")}</div>
    </div>
  );
}
