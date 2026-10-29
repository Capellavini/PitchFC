import { useMemo, useState } from "react";
import { Plus, Shield } from "lucide-react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t } from "../../lib/i18n";
import { roleErrorText } from "../../lib/leagueRoles";
import { draftFromPlayers, squadProblems, squadPayload, isSquadDirty } from "../../lib/leagueSquad";
import BackHeader from "../BackHeader";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";

const POSITIONS = ["GR", "DEF", "MED", "AVA"];

/** The captain's squad: name, number, position and who wears the armband, for their own team only.
 *  Saved through the server, which refuses anything outside this team. */
export default function LeagueSquadEditor({ ctx, embedded = false }) {
  const { state, acc, back, notify, store } = ctx;
  const team = (state.data.teams || []).find((x) => x.id === acc.teamId);
  const players = useMemo(() => (state.data.players || []).filter((p) => p.teamId === acc.teamId), [state.data.players, acc.teamId]);
  const [draft, setDraft] = useState(() => draftFromPlayers(players));
  const [busy, setBusy] = useState(false);
  const problems = squadProblems(draft);
  const dirty = isSquadDirty(draft, players);
  const set = (key, patch) => setDraft((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setCaptain = (key) => setDraft((d) => d.map((r) => ({ ...r, captain: r.key === key ? !r.captain : false })));
  const add = () => setDraft((d) => [...d, { key: `new-${Date.now()}-${d.length}`, id: null, name: "", number: "", position: "", captain: false }]);
  const remove = (key) => setDraft((d) => d.filter((r) => r.key !== key));

  const save = async () => {
    setBusy(true);
    const r = await store.saveSquad(acc.teamId, squadPayload(draft));
    setBusy(false);
    if (r.error) { notify(t(roleErrorText(r.error)), "error"); return; }
    notify(t("Plantel guardado."));
    setDraft(draftFromPlayers(r.players || []));
  };

  return (
    <div>
      {!embedded && <BackHeader title={t("O meu plantel")} subtitle={team?.name} onBack={back} />}
      {embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg }}>
          <Shield size={20} color={C.accent} aria-hidden />
          <div><div style={{ fontWeight: 900, fontSize: T.cardTitle }}>{t("O meu plantel")}</div><div style={{ fontSize: T.meta, color: C.text2 }}>{team?.name}</div></div>
        </div>
      )}
      <p style={{ margin: `0 0 ${S.lg}px`, fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>
        {t("Acrescenta, corrige ou tira atletas da tua equipa. Só tu e o gestor da liga veem os dados completos. Atletas com jogos registados não podem ser removidos.")}
      </p>
      <SectionLabel>{`${t("Atletas")} · ${draft.length}`}</SectionLabel>
      <div style={{ display: "grid", gap: S.sm }}>
        {draft.map((r) => (
          <div key={r.key} style={{ ...cardStyle, display: "grid", gap: S.sm, padding: S.md }}>
            <div style={{ display: "grid", gridTemplateColumns: "64px minmax(0, 1fr)", gap: S.sm }}>
              <input aria-label={t("Número")} inputMode="numeric" value={r.number} onChange={(e) => set(r.key, { number: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="Nº" style={{ ...inputStyle(), textAlign: "center", fontWeight: 900 }} />
              <input aria-label={t("Nome")} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} maxLength={80} placeholder={t("Nome do atleta")} style={inputStyle()} autoComplete="off" />
            </div>
            <div style={{ display: "flex", gap: S.sm, alignItems: "center", flexWrap: "wrap" }}>
              <input aria-label={t("Posição")} list="squad-positions" value={r.position} onChange={(e) => set(r.key, { position: e.target.value.slice(0, 20) })} placeholder={t("Posição")} style={{ ...inputStyle(), flex: "1 1 110px", minWidth: 0 }} />
              <button type="button" onClick={() => setCaptain(r.key)} aria-pressed={r.captain}
                style={{ minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: 12, border: `1px solid ${r.captain ? C.accent : C.border}`, background: r.captain ? C.accent : "transparent", color: r.captain ? C.bg : C.text1, fontWeight: 800, cursor: "pointer" }}>
                {t("Capitão")}
              </button>
              <BtnGhost tone="danger" onClick={() => remove(r.key)}>{t("Tirar")}</BtnGhost>
            </div>
          </div>
        ))}
        <datalist id="squad-positions">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      {!draft.length && <div style={{ ...cardStyle, color: C.text2 }}>{t("O plantel ainda está vazio. Acrescenta o primeiro atleta.")}</div>}
      <div style={{ marginTop: S.md }}><BtnGhost onClick={add} disabled={draft.length >= 40}><Plus size={16} aria-hidden /> {t("Acrescentar atleta")}</BtnGhost></div>
      {problems.length > 0 && <ul role="alert" style={{ margin: `${S.md}px 0 0`, paddingLeft: S.lg, color: C.orange, fontSize: T.meta, lineHeight: 1.6 }}>{problems.map((p) => <li key={p}>{t(p)}</li>)}</ul>}
      <div style={{ position: "sticky", bottom: 88, marginTop: S.xl, display: "flex", gap: S.sm }}>
        <BtnPrimary block disabled={busy || !dirty || problems.length > 0} onClick={save}>{busy ? t("A guardar…") : t("Guardar plantel")}</BtnPrimary>
      </div>
    </div>
  );
}
