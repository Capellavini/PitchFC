import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Gavel, Radio, ShieldAlert, Share2, Sparkles, Users } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LEAGUE, teamById, playerById, competitionById, modOn } from "../../lib/leagueDemo";
import { leagueToday, roundRecapText } from "../../lib/leagueToday";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { adjuntoBrief } from "../../lib/leagueAdjuntoGuide";
import { recapShareUrl } from "../../lib/leagueShare";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import LeagueMatchRow from "./LeagueMatchRow";
import AdjuntoText from "./AdjuntoText";
import LeagueSetupChecklist from "./LeagueSetupChecklist";

// One entry per kind of work: icon, tone (a C token) and the call to action.
const KINDS = {
  contest:    { Icon: Gavel,          tone: C.red,    cta: "Decidir" },
  homologate: { Icon: ClipboardCheck, tone: C.orange, cta: "Conferir" },
  live:       { Icon: Radio,          tone: C.accent, cta: "Abrir" },
  suspended:  { Icon: ShieldAlert,    tone: C.red,    cta: "Ver" },
  lineup:     { Icon: Users,          tone: C.orange, cta: "Ver" },
  conflict:   { Icon: CalendarClock,  tone: C.orange, cta: "Ver" },
};

const matchName = (m) => `${teamById[m.homeId].name} – ${teamById[m.awayId].name}`;
const sectionTitle = (s) => (s.roundName ? t(s.roundName) : tf(t("Jornada {n}"), { n: s.round }));

/** "Hoje" — the Gestor's work queue across every competition of the league.
 *  Each card is one thing that needs a decision, with a single way in;
 *  nothing here writes. On a computer it is two columns: what needs you on
 *  the left, where each competition stands on the right. */
export default function LeagueToday({ ctx }) {
  const { state, derived, lang, open, notify, scope, setScope, wide, goTab } = ctx;
  const today = leagueToday(state, derived, { scope });
  const byId = Object.fromEntries(state.matches.map((m) => [m.id, m]));
  const openMatch = (id) => open({ kind: "match", id });
  const multi = today.sections.length > 1;
  const brief = adjuntoBrief(today);
  const name = adjuntoName(getLang());

  const describe = (it) => {
    const m = byId[it.matchId || it.matchIds?.[0]];
    switch (it.kind) {
      case "contest": return { title: t("Decidir contestação"), sub: [matchName(m), it.reason].filter(Boolean).join(" · "), go: () => openMatch(m.id) };
      case "homologate": {
        const s = derived.scores[m.id];
        return { title: t("Resultado por homologar"), sub: `${teamById[m.homeId].name} ${s.home}–${s.away} ${teamById[m.awayId].name}`, go: () => openMatch(m.id) };
      }
      case "live": return { title: t("Jogo a decorrer"), sub: matchName(m), go: () => openMatch(m.id) };
      case "suspended": return { title: t("Atleta suspenso na convocatória"), sub: `${playerById[it.playerId].name} · ${teamById[it.teamId].name}`, go: () => openMatch(m.id) };
      case "lineup": return { title: t("Convocatória em falta"), sub: `${teamById[it.teamId].name} · ${matchName(m)}`, go: () => openMatch(m.id) };
      default: return { title: t("Conflito de calendário"), sub: [it.text, it.matchIds.map((id) => matchName(byId[id])).join(" / ")].join(" · "), go: () => open({ kind: "manage", section: "calendar" }) };
    }
  };

  const shareRecap = (s) => {
    const text = roundRecapText({ round: s.round, matches: state.matches, scores: derived.scores, teamById, leagueName: LEAGUE.name, competitionId: s.competition.id, label: sectionTitle(s) });
    try { window.open(recapShareUrl(text), "_blank", "noopener"); } catch { notify(t("Não foi possível abrir o WhatsApp."), "error"); }
  };

  const queue = (
    <div>
      <LeagueSetupChecklist ctx={ctx} />
      {modOn("adjunto") && <div style={{ ...cardStyle, marginBottom: S.xl, borderLeft: `3px solid ${C.accent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.sm }}>
          <Sparkles size={18} color={C.accent} aria-hidden />
          <span style={{ fontSize: T.meta, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: C.accent }}>{name}</span>
        </div>
        <div style={{ marginBottom: S.md }}><AdjuntoText text={brief.summary} /></div>
        <BtnGhost tone="accent" onClick={() => goTab("adjunto")}>{tf(t("Falar com o {name}"), { name })}</BtnGhost>
      </div>}

      <SectionLabel>{today.items.length ? tf(t("Precisa de ti · {n}"), { n: today.items.length }) : t("Precisa de ti")}</SectionLabel>
      {today.items.length === 0 && state.matches.length > 0 && (
        <div style={{ ...cardStyle, display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
          <CheckCircle2 size={20} color={C.green} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t("Tudo em dia")}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{today.done ? t("As jornadas estão fechadas. Podes partilhar o resumo.") : t("Não há nada à espera de decisão.")}</div>
          </div>
        </div>
      )}
      {today.items.map((it) => {
        const k = KINDS[it.kind];
        const d = describe(it);
        return (
          <button key={it.key} type="button" onClick={d.go} style={{
            width: "100%", minHeight: TOUCH.button, display: "flex", alignItems: "center", gap: S.md, textAlign: "left", cursor: "pointer",
            background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${k.tone}`, borderRadius: R.card, color: C.text1,
            padding: `${S.md}px`, marginBottom: S.sm, boxSizing: "border-box",
          }}>
            <k.Icon size={20} color={k.tone} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap" }}>
                <span style={{ fontSize: T.body, fontWeight: 800 }}>{d.title}</span>
                {multi && scope === "all" && <Chip>{t(competitionById[it.competitionId].short)}</Chip>}
              </span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>{d.sub}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: T.meta, fontWeight: 800, color: k.tone, flexShrink: 0 }}>{t(k.cta)}<ChevronRight size={16} aria-hidden /></span>
          </button>
        );
      })}
      {today.items.some((i) => i.kind === "conflict") && (
        <div style={{ display: "flex", gap: S.sm, color: C.text2, fontSize: T.meta, marginTop: S.sm }}>
          <AlertTriangle size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          {t("O calendário trata cada local como um campo. Se houver vários campos, usa nomes distintos.")}
        </div>
      )}
    </div>
  );

  const standing = (
    <div>
      <SectionLabel>{t("Competições")}</SectionLabel>
      {today.sections.map((s) => {
        const pct = s.total ? Math.round((s.official / s.total) * 100) : 0;
        const roundMatches = state.matches.filter((m) => (m.competitionId || s.competition.id) === s.competition.id && m.round === s.round);
        return (
          <div key={s.competition.id} style={{ ...cardStyle, marginBottom: S.lg }}>
            <button type="button" onClick={() => setScope(s.competition.id)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
              <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t(s.competition.short)} · {sectionTitle(s)}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, margin: `${S.xs}px 0 ${S.sm}px` }}>
                <span style={{ ...displayFont, fontSize: 36, lineHeight: 1, color: s.done ? C.green : C.text1 }}>{s.official}</span>
                <span style={{ fontSize: T.body, color: C.text2 }}>{tf(t("de {n} jogos com resultado oficial"), { n: s.total })}</span>
              </div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={s.total} aria-valuenow={s.official} aria-label={t("Jogos com resultado oficial")}
                style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden", marginBottom: S.md }}>
                <div style={{ width: `${pct}%`, height: "100%", background: s.done ? C.green : C.accent }} />
              </div>
            </button>
            {s.done && <BtnPrimary block onClick={() => shareRecap(s)} style={{ marginBottom: S.md }}><Share2 size={16} aria-hidden /> {t("Partilhar resumo no WhatsApp")}</BtnPrimary>}
            {roundMatches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} />)}
          </div>
        );
      })}
    </div>
  );

  return wide ? (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: S.xxl, alignItems: "start" }}>{queue}{standing}</div>
  ) : (
    <div>{queue}<div style={{ marginTop: S.xl }}>{standing}</div></div>
  );
}
