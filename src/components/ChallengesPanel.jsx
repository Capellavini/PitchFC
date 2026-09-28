import { Swords } from "lucide-react";
import { t } from "../lib/i18n";
import ComingSoon from "./ComingSoon";

/** Competir → Desafios. PLACEHOLDER — to be replaced by the real
 *  Challenges inbox (brief §8: recebidos / enviados / concluídos;
 *  aceitar / contrapropor / recusar → cria um Match normal). Rendered
 *  only when the `challenges` flag is on (admins today). */
export default function ChallengesPanel() {
  return (
    <ComingSoon Icon={Swords} preview
      title={t("Desafios entre equipas")}
      body={t("Desafia outra equipa para um jogo: formato, data, campo e divisão do custo. O resultado conta para as duas.")} />
  );
}
