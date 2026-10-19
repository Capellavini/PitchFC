import { Trophy } from "lucide-react";
import { C, S, T, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { seasonLabel } from "../lib/fantasyCopy";

/** Minimal Pitch Manager trophies line on Perfil (the full trophy room
 *  is Phase B). trophies: [{ id, kind, rank (1–3), season: { kind, label } }]. */
export default function FantasyTrophiesLine({ trophies }) {
  const list = (trophies || []).filter((x) => x.rank >= 1 && x.rank <= 3).sort((a, b) => a.rank - b.rank);
  if (!list.length) return null;
  const titles = list.filter((x) => x.rank === 1).length;
  const podiums = list.length - titles;
  const name = (x) => {
    const k = x.kind || x.season?.kind;
    const comp = k === "month" ? t("Taça do Mês") : k === "season" ? t("Campeonato") : t("Temporada 1");
    return k === "legacy" ? comp : `${comp} ${seasonLabel(x.season || { kind: k })}`;
  };
  const summary = [
    titles ? `${titles} ${titles === 1 ? t("título") : t("títulos")}` : null,
    podiums ? `${podiums} ${podiums === 1 ? t("pódio") : t("pódios")}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: S.md, padding: `${S.md}px ${S.lg}px`, marginBottom: S.xl }}>
      <Trophy size={20} color={titles ? C.gold : C.silver} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.body, fontWeight: 800, color: C.text1 }}>Pitch Manager · {summary}</div>
        <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2, lineHeight: 1.5, overflowWrap: "anywhere" }}>
          {list.slice(0, 4).map((x) => `${x.rank === 1 ? "🏆" : `${x.rank}.º`} ${name(x)}`).join(" · ")}
        </div>
      </div>
    </div>
  );
}
