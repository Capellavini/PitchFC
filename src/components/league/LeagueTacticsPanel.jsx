import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { C, S, T, cardStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { PLAYERS as DEMO_PLAYERS, teamById as DEMO_TEAMS, playerById as DEMO_BY_ID, fmtDateTime } from "../../lib/leagueDemo";
import TacticsBoard from "../TacticsBoard";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

const OUTFIELD_F7 = 6; // Futebol 7 = GR + 6

/**
 * One team's board for ONE match, on the shared TacticsBoard. Everyone
 * sees the published formation read-only; the team's Capitão (own team,
 * before the match) and the Gestor can edit and publish it. Suspended
 * players are listed but never placeable.
 *
 * Demo (/league/demo): Futebol 7, data from the demo seed, stored in
 * match.tactics[teamId]. Cloud leagues pass:
 *   dir        { teamById, playerById } of the competition
 *   outfield   GR excluded — 4 futsal/F5, 6 F7, 10 F11 (lib/leagueFormat)
 *   squadIds   who can be placed (ficha or homologated squad)
 *   blockedIds suspended players
 *   published  { formation, slots, by, at, version } from match_formation
 *   onSave     async → { ok } (save_match_formation)
 */
export default function LeagueTacticsPanel({ match, teamId, canEdit, discipline = {}, onSave, lang, dir = null, outfield = OUTFIELD_F7, squadIds = null, blockedIds = null, published: publishedProp }) {
  const teamById = dir?.teamById || DEMO_TEAMS, playerById = dir?.playerById || DEMO_BY_ID;
  const published = publishedProp !== undefined ? publishedProp : (match.tactics?.[teamId] || null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const ids = squadIds || (match.lineups?.[teamId]?.length ? match.lineups[teamId] : DEMO_PLAYERS.filter((p) => p.teamId === teamId).map((p) => p.id));
  const group = ids.map((id) => playerById[id]).filter(Boolean);
  const blocked = blockedIds
    ? blockedIds.map((id) => playerById[id]).filter(Boolean).map((p) => ({ id: p.id, name: p.nick || p.name, reason: t("suspenso — não pode ser colocado") }))
    : DEMO_PLAYERS.filter((p) => p.teamId === teamId && (discipline[p.id]?.pending || 0) > 0)
      .map((p) => ({ id: p.id, name: p.nick, reason: t("suspenso (regras demo) — não pode ser colocado") }));
  const team = { id: `${match.id}-${teamId}`, players: group.map((p) => p.id) };
  const name = teamById[teamId]?.name || "—";

  if (!published && !editing) {
    return (
      <div style={{ ...cardStyle, marginBottom: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><LayoutGrid size={16} aria-hidden /> {tf(t("Formação · {team}"), { team: name })}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginBottom: canEdit ? S.md : 0 }}>{t("Formação ainda não publicada.")}</div>
        {canEdit && <BtnPrimary block onClick={() => { setDraft(null); setEditing(true); }}>{t("Montar formação")}</BtnPrimary>}
      </div>
    );
  }

  const save = async () => {
    const b = draft || published || {};
    setBusy(true);
    const r = await onSave({ formation: b.formation || "2-3-1", slots: b.slots || {} });
    setBusy(false);
    if (r?.ok || r?.same) setEditing(false);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, fontWeight: 800, marginBottom: S.xs }}><LayoutGrid size={16} aria-hidden /> {tf(t("Formação · {team}"), { team: name })}</div>
      <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>
        {editing ? tf(t("Arrasta os atletas do banco para o campo (GR + {n}). Suspensos ficam de fora."), { n: outfield })
          : tf(t("Publicada por {by} · {when}"), { by: published.by || "—", when: published.at ? fmtDateTime(published.at, lang) : "—" })}
      </div>
      <TacticsBoard key={editing ? "edit" : `ro-${published?.at}-${published?.version || ""}`} team={team} group={group} outfield={outfield} blocked={blocked}
        value={editing ? (draft || published || { formation: undefined, slots: {} }) : published}
        onChange={editing ? setDraft : undefined} readOnly={!editing} />
      {canEdit && (
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
          {editing ? (
            <>
              <BtnPrimary disabled={busy} onClick={save} style={{ flex: "1 1 160px" }}>{t("Publicar formação")}</BtnPrimary>
              <BtnGhost onClick={() => { setEditing(false); setDraft(null); }} style={{ flex: "1 1 120px" }}>{t("Cancelar")}</BtnGhost>
            </>
          ) : <BtnGhost block onClick={() => { setDraft(null); setEditing(true); }}>{t("Editar formação")}</BtnGhost>}
        </div>
      )}
    </div>
  );
}
