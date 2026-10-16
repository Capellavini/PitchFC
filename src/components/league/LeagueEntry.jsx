import { useState } from "react";
import { Heart, Shirt, Flag, ClipboardCheck, ChevronRight, Trophy } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { LG, tf } from "../../lib/leagueCopy";
import { LEAGUE, COMPETITION, TEAMS, ROLE_ACCOUNTS, teamById } from "../../lib/leagueDemo";
import BackHeader from "../BackHeader";
import RivalsCrest from "../RivalsCrest";

/**
 * How you come into a league (demo). "Sou adepto" is first-class:
 * pick the league → pick the team you support → land in the league
 * context with that team highlighted — no organization, no team to
 * create. The other paths are demo roles (athlete / captain / manager)
 * attached to a fictitious account. `startAt="fan"` (from /league's
 * "Sou adepto" or the app's role pick) skips the first step.
 */
export default function LeagueEntry({ startAt = "choose", onEnter }) {
  const [step, setStep] = useState(startAt === "fan" ? "league" : "choose");
  const card = (Icon, title, sub, onClick, accent) => (
    <button type="button" onClick={onClick} style={{ ...cardStyle, width: "100%", minHeight: TOUCH.button + 16, display: "flex", alignItems: "center", gap: S.md, cursor: "pointer", textAlign: "left", color: C.text1, marginBottom: S.sm, borderColor: accent ? C.accentBorder : C.border }}>
      <span style={{ width: 44, height: 44, borderRadius: R.control, background: accent ? C.accentDim : C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={20} color={accent ? C.accent : C.text2} aria-hidden /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: T.cardTitle, fontWeight: 800 }}>{title}</span>
        <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2, lineHeight: 1.4 }}>{sub}</span>
      </span>
      <ChevronRight size={18} color={C.text2} aria-hidden />
    </button>
  );

  if (step === "league") {
    return (
      <div>
        <BackHeader title={t("Escolhe a liga")} subtitle={t("Sou adepto · passo 1 de 2")} onBack={() => setStep("choose")} />
        {card(Trophy, LEAGUE.name, `${COMPETITION.name} · ${t(COMPETITION.category)} · ${t("demonstração")}`, () => setStep("team"), true)}
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Outras ligas aparecem aqui quando as suas organizações aderirem ao PITCH.")}</div>
      </div>
    );
  }
  if (step === "team") {
    return (
      <div>
        <BackHeader title={t("De que equipa és?")} subtitle={t("Sou adepto · passo 2 de 2")} onBack={() => setStep("league")} />
        <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.md, lineHeight: 1.5 }}>{t("Vais ver primeiro os jogos e resultados dela. Podes seguir outras equipas e atletas depois.")}</div>
        <div role="list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: S.sm }}>
          {TEAMS.map((tm) => (
            <button key={tm.id} role="listitem" type="button" onClick={() => onEnter({ role: "fan", supportTeamId: tm.id })}
              style={{ ...cardStyle, minHeight: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: S.sm, cursor: "pointer", color: C.text1, textAlign: "center" }}>
              <RivalsCrest initials={tm.short.slice(0, 2)} color={tm.color} size={40} />
              <span style={{ fontSize: T.body, fontWeight: 800, overflowWrap: "anywhere" }}>{tm.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  const team = teamById[ROLE_ACCOUNTS.athlete.teamId].name;
  return (
    <div>
      <div style={{ ...displayFont, fontSize: T.h + 4, margin: `${S.md}px 0 ${S.xs}px` }}>{t("Como queres entrar nesta liga?")}</div>
      <div style={{ fontSize: T.body, color: C.text2, marginBottom: S.lg, lineHeight: 1.5 }}>{t("O PITCH é o serviço digital de ligas amadoras que já existem. Esta é uma liga fictícia para veres como funciona.")}</div>
      {card(Heart, t(LG.fanEntry), t("Escolhe a tua equipa, acompanha jogos, vota no craque da torcida e joga o Fantasy. Sem criar nada."), () => setStep("league"), true)}
      {card(Shirt, t("Jogo nesta liga"), tf(t("Atleta do {team} (conta de demonstração)."), { team }), () => onEnter({ role: "athlete" }))}
      {card(Flag, t("Sou capitão de uma equipa"), tf(t("Capitão do {team}: convocatória e contestação (demo)."), { team }), () => onEnter({ role: "captain" }))}
      {card(ClipboardCheck, t("Organizo esta liga"), t("Gestor: súmulas, homologação, calendário e disciplina (demo)."), () => onEnter({ role: "manager" }))}
      <div style={{ fontSize: T.meta, color: C.orange, marginTop: S.md, lineHeight: 1.5 }}>{t(LG.demoData)}</div>
    </div>
  );
}
