import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { C, S, T, cardStyle, displayFont } from "../theme";
import { playerColor } from "../lib/helpers";
import { seasonStandings } from "../lib/core/fantasyRules";
import { t } from "../lib/i18n";
import { seasonLabel } from "../lib/fantasyCopy";
import Avatar from "./Avatar";
import SegmentedControl from "./SegmentedControl";

/** Liga view: the two competitions that renew by themselves — Taça do Mês
 *  (calendar month) and Campeonato da Época (Aug → Jul) — plus the
 *  current champions (latest closed period of each). Standings are live
 *  sums of scored rounds inside the open period's window. */
export default function FantasyTables({ group, participants = null, seasons, scores, rounds, squads, selectedId, onSelect, roundNoOf = null }) {
  // "Ronda" = the last scored round alone (official totals, Conexão already in).
  const lastRound = (rounds || []).filter((r) => r.status === "scored").sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))[0] || null;
  const [kind, setKind] = useState(lastRound ? "round" : "month");
  const open = kind === "round"
    ? (lastRound ? { starts_at: lastRound.kickoff_at, ends_at: new Date(new Date(lastRound.kickoff_at).getTime() + 1).toISOString(), label: roundNoOf ? `${t("Ronda")} ${String(roundNoOf(lastRound.id)).padStart(2, "0")}` : "" } : null)
    : (seasons || []).find((s) => s.kind === kind && s.status === "open");
  const rows = open ? seasonStandings(scores, rounds, open) : [];
  // Rows are managers: the group's members in the group app, accounts in Ligas.
  const people = participants || group;
  const byId = (id) => people.find((p) => String(p.uuid) === String(id));
  const lastClosed = (k) => (seasons || []).filter((s) => s.kind === k && s.status === "closed")
    .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))[0];
  const champs = [["month", t("Taça do Mês")], ["season", t("Campeonato")], ["legacy", t("Temporada 1")]]
    .map(([k, name]) => ({ k, name, s: lastClosed(k) }))
    .filter((c) => c.s && (c.s.champion_ids || []).length);

  return (
    <>
      <SegmentedControl options={[...(lastRound ? [{ id: "round", label: "Ronda" }] : []), { id: "month", label: "Taça do Mês" }, { id: "season", label: "Campeonato" }]} value={kind} onChange={setKind} />
      <div style={{ fontSize: T.meta, color: C.text2, margin: `0 0 ${S.sm}px` }}>
        {open ? (kind === "round" ? `${t("Ronda encerrada")} · ${open.label}` : `${kind === "month" ? t("Taça do Mês") : t("Campeonato da Época")} · ${seasonLabel(open)}`) : t("A abrir a próxima temporada…")}
      </div>
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden", marginBottom: S.lg }}>
        {rows.length === 0 && <div style={{ padding: S.lg, fontSize: T.body - 1, color: C.text2 }}>{t("Ainda sem rondas pontuadas nesta competição.")}</div>}
        {rows.map((row, i) => {
          const player = byId(row.participant_id);
          const hasSquad = (squads || []).some((s) => String(s.participant_id) === String(row.participant_id) && s.player_ids?.length);
          const isMe = player?.isMe;
          const top3 = row.rank <= 3;
          const isOpen = selectedId === row.participant_id;
          const Tag = hasSquad && onSelect ? "button" : "div";
          return (
            <Tag key={row.participant_id} type={Tag === "button" ? "button" : undefined} aria-expanded={Tag === "button" ? isOpen : undefined}
              onClick={Tag === "button" ? () => onSelect(row.participant_id) : undefined}
              style={{
                display: "flex", alignItems: "center", gap: S.md, width: "100%", minHeight: 56, boxSizing: "border-box",
                padding: `${S.sm}px ${S.lg}px`, border: "none", borderTop: i > 0 ? `1px solid ${C.border}` : "none",
                background: isMe || isOpen ? C.surface : "transparent", boxShadow: isMe ? `inset 3px 0 0 ${C.accent}` : "none",
                color: "inherit", font: "inherit", textAlign: "left", cursor: Tag === "button" ? "pointer" : "default",
              }}>
              <span style={{ ...displayFont, width: 24, textAlign: "center", fontSize: top3 ? T.h - 2 : T.body, color: top3 ? [C.gold, C.silver, C.bronze][row.rank - 1] : C.text2, flexShrink: 0 }}>{row.rank}</span>
              <Avatar name={player?.name || "?"} color={player ? playerColor(people, player) : C.text2} size={top3 ? 40 : 34} isMe={isMe} photo={player?.photo} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: T.body + 1, fontWeight: top3 || isMe ? 800 : 600, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {player?.nick || "?"}{isMe && <span style={{ fontSize: T.meta, color: C.text2, fontWeight: 500 }}> {t("· tu")}</span>}
                </div>
                <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{row.rounds} {row.rounds === 1 ? t("ronda") : t("rondas")}</div>
              </div>
              <span style={{ ...displayFont, fontSize: top3 ? T.h + 2 : T.h - 2, color: top3 || isMe ? C.text1 : C.text2, minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{Math.round(row.points)}</span>
              {Tag === "button" && <ChevronDown size={18} color={C.text2} style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}
            </Tag>
          );
        })}
      </div>
      {champs.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: S.lg, padding: `${S.md}px ${S.lg}px` }}>
          <div style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: S.sm }}>{t("Campeões")}</div>
          {champs.map((c) => (
            <div key={c.k} style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: 32, fontSize: T.body - 1, color: C.text1 }}>
              <Trophy size={16} color={C.gold} style={{ flexShrink: 0 }} aria-hidden />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <strong>{c.s.champion_ids.map((id) => byId(id)?.nick || "?").join(" · ")}</strong>
                <span style={{ color: C.text2 }}> — {c.name} {c.k === "legacy" ? "" : seasonLabel(c.s)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
