import { useState } from "react";
import { ChevronDown, Users, Shield, Trophy, Eye, Check } from "lucide-react";
import { C, R, S, T, TOUCH } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, ROLE_LABEL } from "../../lib/leagueCopy";
import { LEAGUE, teamById } from "../../lib/leagueDemo";
import Sheet from "../Sheet";

/**
 * Context switcher (brief §6): Meus grupos / Minhas equipas / Minhas ligas
 * / Acompanhando. The league you FOLLOW as a fan sits under
 * "Acompanhando" (no management link implied); a league where you have a
 * demo role (athlete / captain / manager) sits under "Minhas ligas".
 * Groups/teams come from the app (local demo session); choosing one goes
 * back to the app at "/". Only rendered as a switcher when there's more
 * than one context — otherwise it's a plain context label.
 */
export default function LeagueContextSwitcher({ contexts = {}, role, supportTeamId }) {
  const [open, setOpen] = useState(false);
  const groups = contexts.groups || [];
  const teams = contexts.teams || [];
  const isFan = role === "fan";
  const total = groups.length + teams.length + 1;
  const label = `${t("Liga")} · ${LEAGUE.name}`;
  const pill = { display: "inline-flex", alignItems: "center", gap: S.xs, minHeight: TOUCH.min, maxWidth: "100%", padding: `0 ${S.md}px`, borderRadius: R.pill, border: `1px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: T.meta, fontWeight: 800 };
  if (total < 2) return <span style={{ ...pill, minHeight: 32 }}><Trophy size={14} aria-hidden /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span></span>;

  const go = () => { window.location.href = "/"; };
  const row = (Icon, name, sub, onClick, active) => (
    <button key={name + sub} type="button" onClick={onClick} aria-current={active ? "true" : undefined}
      style={{ width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, background: active ? C.accentDim : "transparent", border: "none", borderBottom: `1px solid ${C.border}`, color: C.text1, cursor: "pointer", textAlign: "left", padding: `0 ${S.sm}px` }}>
      <Icon size={18} color={active ? C.accent : C.text2} aria-hidden />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {sub && <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{sub}</span>}
      </span>
      {active && <Check size={16} color={C.accent} aria-hidden />}
    </button>
  );
  const heading = (s) => <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, letterSpacing: "0.06em", textTransform: "uppercase", margin: `${S.md}px 0 ${S.xs}px` }}>{t(s)}</div>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" style={{ ...pill, cursor: "pointer" }}>
        <Trophy size={14} aria-hidden /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span> <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <Sheet title={t("Mudar de contexto")} onClose={() => setOpen(false)}>
          {groups.length > 0 && <>{heading("Meus grupos")}{groups.map((g) => row(Users, g.name, t("Grupo"), go))}</>}
          {teams.length > 0 && <>{heading("Minhas equipas")}{teams.map((tm) => row(Shield, tm.name, t(LG.team), go))}</>}
          {!isFan && <>{heading("Minhas ligas")}{row(Trophy, LEAGUE.name, `${t(ROLE_LABEL[role])} · ${t("demo")}`, () => setOpen(false), true)}</>}
          {isFan && <>{heading("Acompanhando")}{row(Eye, LEAGUE.name, `${t(LG.roleFan)} · ${teamById[supportTeamId]?.name || ""}`, () => setOpen(false), true)}</>}
        </Sheet>
      )}
    </>
  );
}
