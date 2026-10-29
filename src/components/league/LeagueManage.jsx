import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import SegmentedControl from "../SegmentedControl";
import LeagueManageOverview from "./LeagueManageOverview";
import LeagueManageRegistrations from "./LeagueManageRegistrations";
import LeagueManageCalendar from "./LeagueManageCalendar";
import LeagueManageReports from "./LeagueManageReports";
import LeagueDiscipline from "./LeagueDiscipline";
import LeagueRegulation from "./LeagueRegulation";
import LeagueManageSetup from "./LeagueManageSetup";
import LeagueManageAccess from "./LeagueManageAccess";
import LeagueManagePage from "./LeagueManagePage";

const SECTIONS = [
  { id: "setup", label: "Liga e módulos" },
  { id: "overview", label: "Competições" },
  { id: "registrations", label: "Inscrições" },
  { id: "page", label: "Página" },
  { id: "access", label: "Acessos" },
  { id: "calendar", label: "Calendário" },
  { id: "reports", label: "Fichas de jogo" },
  { id: "discipline", label: "Disciplina" },
  { id: "regulation", label: "Regulamento" },
];

/** "Gerir liga" — the Gestor's operation area, separate from the follow
 *  navigation (no bottom nav here). Opening a match still goes to the
 *  shared match page, where the Gestor's controls appear. */
export default function LeagueManage({ ctx, section = "overview", onSection }) {
  const openMatch = (id) => ctx.open({ kind: "match", id });
  // Accesses (captain / athlete invites) exist only on a real account's league, not in the demo.
  const hasAccess = Boolean(ctx.live && ctx.store?.roles);
  // The league's own page (avisos, what it shows, sign-ups) exists only on a real account's league.
  const sections = SECTIONS.filter((s) => (s.id === "access" ? hasAccess : s.id === "page" ? Boolean(ctx.live) : true));
  return (
    <div>
      <SegmentedControl options={sections} value={section} onChange={onSection} />
      {section === "page" && ctx.live && <LeagueManagePage ctx={ctx} />}
      {section === "access" && hasAccess && <LeagueManageAccess ctx={ctx} />}
      {section === "setup" && <LeagueManageSetup ctx={ctx} />}
      {section === "overview" && <LeagueManageOverview ctx={ctx} onSection={onSection} openMatch={openMatch} />}
      {section === "registrations" && <LeagueManageRegistrations ctx={ctx} />}
      {section === "calendar" && <LeagueManageCalendar ctx={ctx} openMatch={openMatch} />}
      {section === "reports" && <LeagueManageReports ctx={ctx} openMatch={openMatch} />}
      {section === "discipline" && <LeagueDiscipline discipline={ctx.derived.discipline} onPlayer={(id) => ctx.open({ kind: "player", id })} />}
      {section === "regulation" && <><LeagueRegulation /><div style={{ marginTop: S.md, fontSize: T.meta, color: C.text2 }}>{t("Edição do regulamento e versões chegam na Fase 2.")}</div></>}
    </div>
  );
}
