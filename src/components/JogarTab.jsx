import { useState, useEffect } from "react";
import { t, tCtx } from "../lib/i18n";
import PageHeader from "./PageHeader";
import SegmentedControl from "./SegmentedControl";

/** Jogar — "onde / quando vou jogar?" (spec §2). Shell only: a
 *  Jogos | Grupos segmented control plus the two PUSHED screens of this
 *  tab — Game Detail (from a game card) and the Group page (from the
 *  groups list). Neither is a tab: they replace the tab body and bring
 *  their own back button. Content comes from PitchApp as render
 *  functions so it stays wired to the root state:
 *   - renderJogos({ openDetail })          the Jogos list
 *   - renderDetail({ onBack })             Game Detail
 *   - renderGroups({ openGroup })          the "my groups" list
 *   - renderGroupPage({ onBack })          the Group page
 *  `view` is lifted so Home's next-action cards can deep-link into a
 *  segment; bumping `groupEntryN` (Home → "votar MVP" etc.) opens the
 *  group page straight away. `headerRight` is the group switcher. */
// Last deep-link bump already honoured — module scope so it survives
// the tab unmounting (JogarTab remounts on every visit to the tab).
let seenEntryN = 0;

export default function JogarTab({ view, onViewChange, headerRight, groupEntryN = 0, renderJogos, renderDetail, renderGroups, renderGroupPage }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(groupEntryN > seenEntryN);

  // Deep link from Home → open the group page on the requested sub-view.
  useEffect(() => {
    if (groupEntryN > seenEntryN) { seenEntryN = groupEntryN; setGroupOpen(true); }
  }, [groupEntryN]);

  const top = () => { try { window.scrollTo(0, 0); } catch { /* ignore */ } };

  if (view === "jogos" && detailOpen) {
    return renderDetail({ onBack: () => { setDetailOpen(false); top(); } });
  }
  if (view === "grupos" && groupOpen) {
    return renderGroupPage({ onBack: () => { setGroupOpen(false); top(); } });
  }

  const views = [
    { id: "jogos",  label: tCtx("jogar", "Jogos") },
    { id: "grupos", label: "Grupos" },
  ];

  return (
    <div>
      <div style={{ padding: "0 16px" }}>
        <PageHeader title={t("Jogar")} right={headerRight} />
        <SegmentedControl options={views} value={view} onChange={onViewChange} />
      </div>
      {view === "jogos"
        ? renderJogos({ openDetail: () => { setDetailOpen(true); top(); } })
        : renderGroups({ openGroup: () => { setGroupOpen(true); top(); } })}
    </div>
  );
}
