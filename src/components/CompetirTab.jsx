import { useState } from "react";
import { Shield, Swords, Trophy } from "lucide-react";
import { C, cardStyle } from "../theme";
import { t } from "../lib/i18n";
import { isEnabled } from "../lib/flags";
import PageHeader from "./PageHeader";
import SegmentedControl from "./SegmentedControl";
import ComingSoon from "./ComingSoon";
import TeamsPanel from "./TeamsPanel";
import ChallengesPanel from "./ChallengesPanel";
import FantasyTab from "./FantasyTab";

const SUBS = [
  { id: "equipas",     label: "Equipas" },
  { id: "desafios",    label: "Desafios" },
  { id: "competicoes", label: "Competições" },
];

/** Competir — "contra quem jogamos / em que competimos?" (brief §8).
 *  Equipas | Desafios | Competições. Stats and League (plantel) left
 *  this tab: they're the group's page now (Jogar → Grupos). Competições
 *  holds what was "Manager" (Pitch Manager / Fantasy), unchanged.
 *  Equipas/Desafios are flag-gated placeholders (`teams`/`challenges`)
 *  — TeamsPanel/ChallengesPanel are the files to replace. */
export default function CompetirTab({ isAdmin, showManager, managerProps }) {
  const [sub, setSub] = useState("competicoes");
  const teamsOn = isEnabled("teams", { isAdmin });
  const challengesOn = isEnabled("challenges", { isAdmin });

  return (
    <div>
      <div style={{ padding: "0 16px" }}>
        <PageHeader title={t("Competir")} />
        <SegmentedControl options={SUBS} value={sub} onChange={setSub} />

        {sub === "equipas" && (teamsOn ? <TeamsPanel /> : (
          <ComingSoon Icon={Shield} title={t("Equipas")}
            body={t("Monta a tua equipa fixa, com plantel, capitão e historial de vitórias.")} />
        ))}
        {sub === "desafios" && (challengesOn ? <ChallengesPanel /> : (
          <ComingSoon Icon={Swords} title={t("Desafios")}
            body={t("Desafia outras equipas para um jogo e fica com o resultado no historial das duas.")} />
        ))}
        {sub === "competicoes" && !showManager && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Trophy size={19} color={C.gold} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>PITCH League</div>
                <div style={{ fontSize: 12, color: C.text2 }}>{t("Ligas e torneios entre equipas, com tabela, jornadas e Pitch Manager.")}</div>
              </div>
            </div>
            <a href="/league" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, borderRadius: 12, border: `1px solid ${C.border}`, color: C.text1, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              {t("Saber mais")}
            </a>
          </div>
        )}
      </div>
      {sub === "competicoes" && showManager && <FantasyTab {...managerProps} />}
    </div>
  );
}
