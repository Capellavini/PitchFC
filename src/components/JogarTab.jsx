import { t } from "../lib/i18n";
import PageHeader from "./PageHeader";
import SegmentedControl from "./SegmentedControl";

const VIEWS = [
  { id: "jogos",  label: "Jogos" },
  { id: "grupos", label: "Grupos" },
];

/** Jogar — "onde / quando vou jogar?" (brief §6). Shell only: a
 *  Jogos | Grupos segmented control; the screens themselves are passed
 *  in already wired by PitchApp (JogoTab + optional Encontrar jogo for
 *  Jogos; GrupoTab with the group's Stats for Grupos). `view` is lifted
 *  so Home's next-action cards can deep-link straight into a segment.
 *  `headerRight` is the group switcher — group context is chosen here,
 *  where it matters, not in a global header. */
export default function JogarTab({ view, onViewChange, headerRight, jogos, findGame, grupos }) {
  return (
    <div>
      <div style={{ padding: "0 16px" }}>
        <PageHeader title={t("Jogar")} right={headerRight} />
        <SegmentedControl options={VIEWS} value={view} onChange={onViewChange} style={{ marginBottom: 0 }} />
      </div>
      {view === "jogos" ? (
        <>
          {jogos}
          {findGame && <div style={{ padding: "0 16px" }}>{findGame}</div>}
        </>
      ) : (
        <div style={{ padding: "16px 16px 0" }}>{grupos}</div>
      )}
    </div>
  );
}
