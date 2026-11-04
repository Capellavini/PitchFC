import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { athletePool } from "../../lib/leagueSeason";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

/** After "Nova época" the squads are empty (registrations usually involve fees). The athletes' profiles wait here:
 *  the Gestor ticks whoever the organisation accepts back and they return to the team they played for. */
export default function LeagueReenroll({ ctx }) {
  const { state, act } = ctx;
  const pool = athletePool(state);
  const teams = state.data.teams || [];
  const [picked, setPicked] = useState(() => new Set());
  const groups = useMemo(() => {
    const by = new Map();
    for (const p of pool) { const k = p.pastTeamId; if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
    return [...by.entries()].map(([teamId, list]) => ({ team: teams.find((x) => x.id === teamId) || null, teamId, list: list.sort((a, b) => String(a.name).localeCompare(String(b.name))) }))
      .filter((g) => g.team).sort((a, b) => String(a.team.name).localeCompare(String(b.team.name)));
  }, [pool, teams]);
  if (!groups.length) return null;
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleTeam = (list) => setPicked((s) => { const n = new Set(s); const all = list.every((p) => n.has(p.id)); for (const p of list) { if (all) n.delete(p.id); else n.add(p.id); } return n; });
  const go = () => { if (act.reenrollAthletes([...picked].map((id) => ({ id }))).ok) setPicked(new Set()); };
  return (
    <section style={{ ...cardStyle, marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
        <UserPlus size={18} color={C.accent} aria-hidden />
        <h2 style={{ margin: 0, fontSize: T.cardTitle }}>{t("Atletas da época anterior")}</h2>
      </div>
      <p style={{ margin: `0 0 ${S.md}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Os plantéis começam vazios. Marca quem a organização aceita de volta: o perfil e o histórico mantêm-se, e o atleta volta à mesma equipa.")}</p>
      <div style={{ display: "grid", gap: S.md }}>
        {groups.map((g) => (
          <div key={g.teamId} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: S.md }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.xs }}>
              <strong style={{ fontSize: T.body }}>{g.team.name}</strong>
              <BtnGhost compact onClick={() => toggleTeam(g.list)}>{t("Marcar toda a equipa")}</BtnGhost>
            </div>
            {g.list.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 44, fontSize: T.body, cursor: "pointer" }}>
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 20, height: 20, accentColor: C.accent }} />
                <span>{p.number != null ? `${p.number} · ` : ""}{p.name}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: S.md }}>
        <BtnPrimary disabled={!picked.size} onClick={go}>{tf(t("Reinscrever {n}"), { n: picked.size })}</BtnPrimary>
      </div>
    </section>
  );
}
