import { Shield } from "lucide-react";
import { t } from "../lib/i18n";
import ComingSoon from "./ComingSoon";

/** Competir → Equipas. PLACEHOLDER — to be replaced by the real Teams
 *  hub (brief §8: create/join team, badge, V-E-D, plantel, próximos
 *  jogos). Rendered only when the `teams` flag is on (admins today);
 *  everyone else gets the plain "Em breve" card from CompetirTab. */
export default function TeamsPanel() {
  return (
    <ComingSoon Icon={Shield} preview
      title={t("A tua equipa")}
      body={t("Cria a tua equipa, com emblema, plantel e capitão, e acompanha vitórias, empates e derrotas.")} />
  );
}
