import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Gavel, Radio, ShieldAlert, Share2, Users } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LEAGUE, teamById, playerById } from "../../lib/leagueDemo";
import { leagueToday, roundRecapText } from "../../lib/leagueToday";
import SectionLabel from "../SectionLabel";
import BtnPrimary from "../BtnPrimary";
import LeagueMatchRow from "./LeagueMatchRow";

// One entry per kind of work: icon, tone (a C token) and the copy builder.
const KINDS = {
  contest:    { Icon: Gavel,         tone: C.red,    cta: "Decidir" },
  homologate: { Icon: ClipboardCheck, tone: C.orange, cta: "Conferir" },
  live:       { Icon: Radio,         tone: C.accent, cta: "Abrir" },
  suspended:  { Icon: ShieldAlert,   tone: C.red,    cta: "Ver" },
  lineup:     { Icon: Users,         tone: C.orange, cta: "Ver" },
  conflict:   { Icon: CalendarClock, tone: C.orange, cta: "Ver" },
};

const matchName = (m) => `${teamById[m.homeId].name} – ${teamById[m.awayId].name}`;

/** "Hoje" — the Gestor's work queue for the current round. Each card is one
 *  thing that needs a decision, with a single way in; nothing here writes. */
export default function LeagueToday({ ctx }) {
  const { state, derived, lang, open, notify } = ctx;
  const today = leagueToday(state, derived);
  const byId = Object.fromEntries(state.matches.map((m) => [m.id, m]));
  const openMatch = (id) => open({ kind: "match", id });

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

  const shareRecap = () => {
    const text = roundRecapText({ round: today.round, matches: state.matches, scores: derived.scores, teamById, leagueName: LEAGUE.name });
    try {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch { notify(t("Não foi possível abrir o WhatsApp."), "error"); }
  };

  const roundMatches = state.matches.filter((m) => m.round === today.round);
  const pct = today.total ? Math.round((today.official / today.total) * 100) : 0;

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: S.xl }}>
        <div style={{ fontSize: T.meta, color: C.text2, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tf(t("Jornada {n}"), { n: today.round })}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: S.sm, margin: `${S.xs}px 0 ${S.sm}px` }}>
          <span style={{ ...displayFont, fontSize: 40, lineHeight: 1, color: today.done ? C.green : C.text1 }}>{today.official}</span>
          <span style={{ fontSize: T.body, color: C.text2 }}>{tf(t("de {n} jogos com resultado oficial"), { n: today.total })}</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={today.total} aria-valuenow={today.official} aria-label={t("Jogos com resultado oficial")}
          style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: today.done ? C.green : C.accent }} />
        </div>
      </div>

      <SectionLabel>{today.items.length ? tf(t("Precisa de ti · {n}"), { n: today.items.length }) : t("Precisa de ti")}</SectionLabel>
      {today.items.length === 0 && (
        <div style={{ ...cardStyle, display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
          <CheckCircle2 size={20} color={C.green} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: T.cardTitle, fontWeight: 800 }}>{t("Tudo em dia")}</div>
            <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{today.done ? t("A jornada está fechada. Podes partilhar o resumo.") : t("Não há nada à espera de decisão.")}</div>
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
              <span style={{ display: "block", fontSize: T.body, fontWeight: 800 }}>{d.title}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>{d.sub}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: T.meta, fontWeight: 800, color: k.tone, flexShrink: 0 }}>{t(k.cta)}<ChevronRight size={16} aria-hidden /></span>
          </button>
        );
      })}

      {today.done && (
        <div style={{ ...cardStyle, marginTop: S.lg, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ fontSize: T.cardTitle, fontWeight: 800, marginBottom: S.xs }}>{tf(t("Jornada {n} fechada"), { n: today.round })}</div>
          <div style={{ fontSize: T.meta, color: C.text2, marginBottom: S.md }}>{t("O resumo leva só resultados oficiais. Revê o texto no WhatsApp antes de enviar.")}</div>
          <BtnPrimary block onClick={shareRecap}><Share2 size={16} aria-hidden /> {t("Partilhar resumo no WhatsApp")}</BtnPrimary>
        </div>
      )}

      <SectionLabel style={{ marginTop: S.xl }}>{tf(t("Jornada {n}"), { n: today.round })} · {t("jogos")}</SectionLabel>
      {roundMatches.map((m) => <LeagueMatchRow key={m.id} match={m} score={derived.scores[m.id]} lang={lang} onOpen={openMatch} />)}
      {today.items.some((i) => i.kind === "conflict") && (
        <div style={{ display: "flex", gap: S.sm, color: C.text2, fontSize: T.meta, marginTop: S.sm }}>
          <AlertTriangle size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          {t("O calendário trata cada local como um campo. Se houver vários campos, usa nomes distintos.")}
        </div>
      )}
    </div>
  );
}
