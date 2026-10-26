import { useEffect, useState } from "react";
import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { LM } from "../../lib/leagueMatchCopy";
import { leagueCloudError, roleLabel } from "../../lib/leagueCloudCopy";
import Sheet from "../Sheet";

/** Gestor: assign the scorer (mesa) and referee of one match among the
 *  league's collaborators (league_collaborators → assign_official). An
 *  assigned official can operate the ficha de jogo of THIS match only. */
export default function LeagueCloudOfficialsSheet({ leagues, competition, match, officials, onChanged, onClose }) {
  const [people, setPeople] = useState(null);
  const [assigned, setAssigned] = useState(() => officials.map((o) => `${o.role}:${o.playerId}`));
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    leagues.fetchCollaborators(competition.leagueId, competition.id).then((r) => {
      if (!alive) return;
      if (r.error) setError(leagueCloudError(r.error)); else setPeople(r.data);
    });
    return () => { alive = false; };
  }, [leagues, competition]);

  const toggle = async (playerId, role) => {
    const k = `${role}:${playerId}`; const on = !assigned.includes(k);
    setError(null);
    const r = await leagues.assignOfficial(match.id, playerId, role, on);
    if (r.error) { setError(leagueCloudError(r.error)); return; }
    setAssigned((a) => (on ? [...a, k] : a.filter((x) => x !== k)));
    onChanged?.();
  };
  const pill = (active) => ({ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: R.pill, cursor: "pointer", fontWeight: 700, fontSize: T.meta,
    border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : "transparent", color: active ? C.bg : C.text1 });

  return (
    <Sheet title={t(LM.officials)} onClose={onClose}>
      <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5, marginBottom: S.md }}>
        {t("Só colaboradores da liga. Quem está atribuído opera a ficha de jogo deste jogo (lances, início e fim); homologar continua com quem o regulamento indica.")}
      </div>
      {people === null && !error && <div style={{ color: C.text2 }}>…</div>}
      {people && !people.length && <div style={{ color: C.text2, fontSize: T.body }}>{t("Ainda sem colaboradores. Convida a mesa e o árbitro na página da liga.")}</div>}
      {(people || []).map((p) => (
        <div key={p.playerId + p.role} style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, padding: `${S.sm}px 0` }}>
          <span style={{ flex: "1 1 140px", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: T.body, fontWeight: 700 }}>{p.name}</span>
            <span style={{ fontSize: T.meta, color: C.text2 }}>{roleLabel(p.role)}</span>
          </span>
          {["scorer", "referee"].map((role) => (
            <button key={role} type="button" aria-pressed={assigned.includes(`${role}:${p.playerId}`)} onClick={() => toggle(p.playerId, role)} style={pill(assigned.includes(`${role}:${p.playerId}`))}>
              {roleLabel(role)}
            </button>
          ))}
        </div>
      ))}
      {error && <div role="alert" style={{ color: C.red, fontSize: T.meta, marginTop: S.sm }}>{error}</div>}
    </Sheet>
  );
}
