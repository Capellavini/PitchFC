import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { PLAYERS, teamById, playerById, fmtDateTime } from "../../lib/leagueDemo";
import TacticsBoard from "../TacticsBoard";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

const OUTFIELD_F7 = 6; // Futebol 7 = GR + 6

/**
 * One team's Futebol 7 board for ONE match, on the shared TacticsBoard.
 * Everyone sees the published formation read-only; the team's Capitão
 * (own team, before/while the match) and the Gestor can edit and publish
 * it. Suspended players (DEMO_RULES) are listed but never placeable. The
 * board is stored in the demo state (match.tactics[teamId]).
 */
export default function LeagueTacticsPanel({ match, teamId, canEdit, discipline, onSave, lang }) {
  const published = match.tactics?.[teamId] || null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const ids = match.lineups?.[teamId]?.length ? match.lineups[teamId] : PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id);
  const group = ids.map((id) => playerById[id]).filter(Boolean);
  const blocked = PLAYERS.filter((p) => p.teamId === teamId && (discipline[p.id]?.pending || 0) > 0)
    .map((p) => ({ id: p.id, name: p.nick, reason: t("suspenso (regras demo) — não pode ser colocado") }));
  const team = { id: `${match.id}-${teamId}`, players: group.map((p) => p.id) };

  if (!published && !editing) {
    return (
      <div style={{ ...cardStyle, marginBottom: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><LayoutGrid size={16} aria-hidden /> {tf(t("Formação · {team}"), { team: teamById[teamId].name })}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: canEdit ? S.md : 0 }}>{t("Formação ainda não publicada.")}</div>
        {canEdit && <BtnPrimary block onClick={() => { setDraft(null); setEditing(true); }}>{t("Montar formação")}</BtnPrimary>}
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, marginBottom: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><LayoutGrid size={16} aria-hidden /> {tf(t("Formação · {team}"), { team: teamById[teamId].name })}</div>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>
        {editing ? t("Arrasta os atletas do banco para o campo (GR + 6). Só convocados; suspensos ficam de fora.")
          : tf(t("Publicada por {by} · {when}"), { by: published.by || "—", when: published.at ? fmtDateTime(published.at, lang) : "—" })}
      </div>
      <TacticsBoard key={editing ? "edit" : `ro-${published?.at}`} team={team} group={group} outfield={OUTFIELD_F7} blocked={blocked}
        value={editing ? (draft || published || { formation: undefined, slots: {} }) : published}
        onChange={editing ? setDraft : undefined} readOnly={!editing} />
      {canEdit && (
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
          {editing ? (
            <>
              <BtnPrimary onClick={() => { const b = draft || published || {}; const r = onSave({ formation: b.formation || "2-3-1", slots: b.slots || {} }); if (r?.ok || r?.same) setEditing(false); }} style={{ flex: "1 1 160px" }}>{t("Publicar formação")}</BtnPrimary>
              <BtnGhost onClick={() => { setEditing(false); setDraft(null); }} style={{ flex: "1 1 120px" }}>{t("Cancelar")}</BtnGhost>
            </>
          ) : <BtnGhost block onClick={() => { setDraft(null); setEditing(true); }}>{t("Editar formação")}</BtnGhost>}
        </div>
      )}
    </div>
  );
}
