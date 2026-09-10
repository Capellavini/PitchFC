import { useEffect, useState } from "react";
import { ChevronLeft, Plus, UserPlus, X } from "lucide-react";
import { C, cardStyle, displayFont } from "../theme";
import { computeOverall, playerColor } from "../lib/helpers";
import { t } from "../lib/i18n";
import Avatar from "./Avatar";
import SectionLabel from "./SectionLabel";
import BtnPrimary from "./BtnPrimary";

const teamOVR = (members) => {
  const ovrs = members.map((m) => computeOverall(m.players?.position, m.players?.attrs)).filter(Boolean);
  return ovrs.length ? Math.round(ovrs.reduce((s, v) => s + v, 0) / ovrs.length) : null;
};

/** Teams are a separate entity from Groups — a squad with its own
 *  identity (name, OVR, roster) that can outlive the group that spun it
 *  up. This is the entity + basic roster management only; Team
 *  Challenges (playing another team, rankings) is a deliberately
 *  separate follow-up once this foundation is actually used. */
export default function TeamsSection({ myTeams, groupRoster, groupName, myPlayerId, onCreateTeam, onFetchTeam, onAddTeamMember, onRemoveTeamMember }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(groupName ? `${groupName} FC` : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openTeamId, setOpenTeamId] = useState(null);
  const [detail, setDetail] = useState(null); // { ...team, members }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!openTeamId) { setDetail(null); return; }
    setLoadingDetail(true);
    onFetchTeam(openTeamId).then((res) => {
      setLoadingDetail(false);
      if (res?.data) setDetail(res.data);
    });
  }, [openTeamId, onFetchTeam]);

  const submitCreate = async () => {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    const res = await onCreateTeam({
      name: name.trim(),
      rosterPlayerIds: groupRoster.filter((p) => p.id !== myPlayerId).map((p) => p.id),
    });
    setBusy(false);
    if (res?.error) setError(res.error);
    else { setCreating(false); setName(""); }
  };

  if (openTeamId) {
    const isCaptain = detail?.captain_id === myPlayerId;
    const memberIds = new Set((detail?.members || []).map((m) => m.player_id));
    const candidates = groupRoster.filter((p) => !memberIds.has(p.id));
    return (
      <div>
        <button onClick={() => setOpenTeamId(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.text2, fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={15} /> {t("Times")}
        </button>
        {loadingDetail || !detail ? (
          <div style={{ fontSize: 12.5, color: C.text2 }}>{t("A carregar…")}</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: `${detail.color}22`, border: `2px solid ${detail.color}`, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 16, color: detail.color, flexShrink: 0 }}>
                {detail.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...displayFont, fontSize: 18 }}>{detail.name}</div>
                <div style={{ fontSize: 12, color: C.text2 }}>
                  {teamOVR(detail.members) ? `OVR ${teamOVR(detail.members)} · ` : ""}{detail.members.length} {t("jogadores")}{detail.city ? ` · ${detail.city}` : ""}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <SectionLabel style={{ marginBottom: 0 }}>{t("Elenco")}</SectionLabel>
              {isCaptain && (
                <button onClick={() => setAddOpen((v) => !v)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: 10, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  <UserPlus size={13} /> {t("Adicionar")}
                </button>
              )}
            </div>

            {addOpen && (
              <div style={{ ...cardStyle, marginBottom: 12 }}>
                {candidates.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text3 }}>{t("Ninguém do grupo por adicionar.")}</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {candidates.map((p) => (
                      <button key={p.id} onClick={async () => { await onAddTeamMember(detail.id, p.id); setOpenTeamId(detail.id); }}
                        style={{ background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        {p.nick}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(() => { const roster = detail.members.map((m) => m.players).filter(Boolean); return detail.members.map((m) => {
                const p = m.players;
                const ovr = p ? computeOverall(p.position, p.attrs) : null;
                return (
                  <div key={m.player_id} style={{ ...cardStyle, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={p?.nick || "?"} color={p ? playerColor(roster, p) : C.text3} size={30} fontSize={10} photo={p?.photo_url} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.nick}{m.role === "captain" && " · " + t("Capitão")}</span>
                    {ovr != null && <span style={{ ...displayFont, fontSize: 14, color: C.accent }}>{ovr}</span>}
                    {isCaptain && m.role !== "captain" && (
                      <button onClick={async () => { await onRemoveTeamMember(detail.id, m.player_id); setOpenTeamId(detail.id); }}
                        style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", display: "flex", padding: 2 }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              }); })()}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {myTeams.length === 0 && !creating && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "24px 20px" }}>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: 14, lineHeight: 1.6 }}>
            {t("Um time é diferente do grupo — tem nome, OVR e elenco próprios, e pode um dia desafiar outros times. Começa com o elenco deste grupo, mas depois cresce sozinho.")}
          </div>
          <BtnPrimary onClick={() => setCreating(true)} style={{ width: "100%" }}>{t("Criar Time a partir deste grupo")}</BtnPrimary>
        </div>
      )}

      {myTeams.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
          {myTeams.map(({ teams: tm }) => (
            <button key={tm.id} onClick={() => setOpenTeamId(tm.id)} style={{ ...cardStyle, textAlign: "left", cursor: "pointer", color: C.text1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${tm.color}22`, border: `1.5px solid ${tm.color}`, display: "flex", alignItems: "center", justifyContent: "center", ...displayFont, fontSize: 11, color: tm.color, marginBottom: 8 }}>
                {tm.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tm.name}</div>
              {tm.city && <div style={{ fontSize: 10.5, color: C.text2, marginTop: 2 }}>{tm.city}</div>}
            </button>
          ))}
          {!creating && (
            <button onClick={() => setCreating(true)} style={{ ...cardStyle, cursor: "pointer", color: C.text2, border: `1px dashed ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={18} /> <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t("Novo time")}</span>
            </button>
          )}
        </div>
      )}

      {creating && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>{t("Nome do time")}</div>
          <input value={name} onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.text1, outline: "none", marginBottom: 12 }} />
          <div style={{ fontSize: 11.5, color: C.text3, marginBottom: 14 }}>{t("O elenco inicial vem do grupo atual — dá para adicionar ou tirar gente depois.")}</div>
          {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <BtnPrimary onClick={submitCreate} disabled={busy || !name.trim()} style={{ flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? t("A criar…") : t("Criar")}</BtnPrimary>
            <button onClick={() => { setCreating(false); setError(null); }} style={{ flex: 1, background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{t("Cancelar")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
