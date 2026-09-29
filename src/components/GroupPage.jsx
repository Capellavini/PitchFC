import { useState } from "react";
import { Trophy } from "lucide-react";
import { t } from "../lib/i18n";
import BackHeader from "./BackHeader";
import SegmentedControl from "./SegmentedControl";
import ComingSoon from "./ComingSoon";

/**
 * Group page — pushed from Jogar → Grupos (not a tab). Segmented
 * sub-views Plantel · Histórico · Fantasy · Definições (organizer only).
 * Pitch Manager (Fantasy) lives HERE, per group — not in Competir.
 * Every sub-view arrives as an already-wired node from PitchApp; when
 * `fantasy` is null (no account, e.g. local demo) a placeholder shows.
 * `initialView` accepts the legacy GrupoTab ids ("squad" | "stats").
 */
export default function GroupPage({ onBack, groupName, subtitle, headerRight, initialView = "squad", isOrganizer, plantel, stats, fantasy, settings }) {
  const [view, setView] = useState(initialView === "settings" && !isOrganizer ? "squad" : initialView);
  const options = [
    { id: "squad", label: "Plantel" },
    { id: "stats", label: "Histórico" }, // matchday history/records; season rankings live in Competir
    { id: "fantasy", label: "Fantasy" },
    ...(isOrganizer && settings ? [{ id: "settings", label: "Definições" }] : []),
  ];
  const current = options.some((o) => o.id === view) ? view : "squad";

  return (
    <div style={{ padding: "0 16px 24px" }}>
      <BackHeader onBack={onBack} title={groupName} subtitle={subtitle} right={headerRight} />
      <SegmentedControl options={options} value={current} onChange={setView} />
      {current === "squad" && plantel}
      {current === "stats" && stats}
      {current === "fantasy" && (fantasy
        ? <div style={{ margin: "0 -16px" }}>{fantasy}</div>
        : <ComingSoon Icon={Trophy} title="Pitch Manager"
            body={t("Monta a tua equipa de fantasia com os jogadores do grupo e pontua com os jogos reais. Cria conta para jogar.")} />)}
      {current === "settings" && settings}
    </div>
  );
}
