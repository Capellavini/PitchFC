import { Search } from "lucide-react";
import { t } from "../lib/i18n";
import SectionLabel from "./SectionLabel";
import ComingSoon from "./ComingSoon";

/** Jogar → Jogos → "Encontrar jogo". PLACEHOLDER, no backend — to be
 *  replaced by the real Open Games list (brief §6: formato, zona, hora,
 *  preço, vagas, fiabilidade → Entrar). Only rendered when the
 *  `openGames` flag is on (admins today): no empty marketplaces. */
export default function FindGamePlaceholder() {
  return (
    <div style={{ marginTop: 8 }}>
      <SectionLabel>{t("ENCONTRAR JOGO")}</SectionLabel>
      <ComingSoon Icon={Search} preview
        title={t("Jogos abertos perto de ti")}
        body={t("Grupos com vagas livres para hoje e esta semana — entra num jogo com um toque.")} />
    </div>
  );
}
