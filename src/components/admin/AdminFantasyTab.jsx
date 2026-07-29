import { Crown, ArmchairIcon } from "lucide-react";
import { C, cardStyle, displayFont } from "../../theme";

/** Every Pitch Manager (fantasy) league across every group, with each
 *  participant's current squad — was missing from the new desktop
 *  dashboard (only existed in the mobile in-app AdminPanel). */
export default function AdminFantasyTab({ fantasy }) {
  const { loading, error, leagues = [], squads = [], players = [] } = fantasy ?? {};

  if (loading) return <div style={{ fontSize: 13, color: C.text2 }}>A carregar…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.red }}>Erro: {error}</div>;
  if (leagues.length === 0) return <div style={{ fontSize: 13, color: C.text3 }}>Ainda não há nenhuma liga Pitch Manager criada.</div>;

  const nameOf = (id) => players.find((p) => p.id === id)?.nick ?? "?";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {leagues.map((lg) => {
        const squadsOf = squads.filter((s) => s.league_id === lg.id);
        return (
          <div key={lg.id} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ ...displayFont, fontSize: 18 }}>{lg.groups?.name ?? "?"}</div>
              <span style={{ fontSize: 12, color: C.text3 }}>${lg.budget}M · {lg.squad_size} jogadores</span>
            </div>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 16 }}>
              {lg.name} · criada {new Date(lg.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })} · {squadsOf.length} {squadsOf.length === 1 ? "participante" : "participantes"}
            </div>

            {squadsOf.length === 0 ? (
              <div style={{ fontSize: 12, color: C.text3 }}>Ninguém escalou ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {squadsOf.map((s) => {
                  const owner = players.find((p) => p.id === s.participant_id);
                  return (
                    <div key={s.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <div style={{ width: 180, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{owner?.nick ?? "?"}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{owner?.email ?? ""}</div>
                        {s.budget_adjustment ? <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>Ajuste de caixa: ${s.budget_adjustment}M</div> : null}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(s.player_ids || []).map((pid) => {
                          const isCaptain = pid === s.captain_id;
                          const isReserve = pid === s.reserve_id;
                          return (
                            <span key={pid} style={{
                              display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                              background: isCaptain ? C.goldDim : isReserve ? C.orangeDim : C.surface,
                              border: `1px solid ${isCaptain ? C.gold : isReserve ? C.orange : C.border}`,
                              borderRadius: 20, padding: "3px 8px", color: isCaptain ? C.gold : isReserve ? C.orange : C.text1,
                            }}>
                              {isCaptain && <Crown size={10} />}
                              {isReserve && <ArmchairIcon size={10} />}
                              {nameOf(pid)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
