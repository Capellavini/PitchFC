import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LEAGUE, teamById } from "../../lib/leagueDemo";
import { leagueToday, roundRecapText } from "../../lib/leagueToday";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { adjuntoReply, adjuntoBrief, ADJUNTO_SUGGESTIONS } from "../../lib/leagueAdjuntoGuide";
import { recapShareUrl } from "../../lib/leagueShare";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import AdjuntoText from "./AdjuntoText";

/** O Adjunto da Liga, dentro da app: pergunta o que falta fechar, quem está
 *  suspenso, se há conflitos — e abre o passo certo. Demo guiada: as
 *  respostas vêm do estado da liga (sem IA) e nada é escrito nem enviado
 *  sem o Gestor confirmar. */
export default function LeagueAdjunto({ ctx }) {
  const { state, derived, open, notify, scope, adjuntoLog, setAdjuntoLog } = ctx;
  const today = leagueToday(state, derived, { scope });
  const name = adjuntoName(getLang());
  const [text, setText] = useState("");
  const end = useRef(null);
  const brief = adjuntoBrief(today);
  const messages = adjuntoLog.length ? adjuntoLog : [{ role: "assistant", text: brief.text, actions: brief.actions }];
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest" }); }, [adjuntoLog.length]);

  const firstOf = (kind) => today.items.find((i) => i.kind === kind);
  const run = (id) => {
    const go = (it) => it && open({ kind: "match", id: it.matchId || it.matchIds?.[0] });
    if (id === "homologate") return go(firstOf("homologate"));
    if (id === "live") return go(firstOf("live"));
    if (id === "contest") return go(firstOf("contest"));
    if (id === "lineups") return go(firstOf("lineup"));
    if (id === "calendar") return open({ kind: "manage", section: "calendar" });
    if (id === "discipline") return open({ kind: "manage", section: "discipline" });
    if (id === "reports") return open({ kind: "manage", section: "reports" });
    if (id === "recap") {
      const s = today.sections.find((x) => x.done);
      if (!s) return notify(t("Ainda não há jornada fechada."), "error");
      const label = s.roundName ? t(s.roundName) : tf(t("Jornada {n}"), { n: s.round });
      const body = roundRecapText({ round: s.round, matches: state.matches, scores: derived.scores, teamById, leagueName: LEAGUE.name, competitionId: s.competition.id, label });
      try { window.open(recapShareUrl(body), "_blank", "noopener"); } catch { notify(t("Não foi possível abrir o WhatsApp."), "error"); }
    }
    return undefined;
  };

  const send = (value) => {
    const q = String(value ?? text).trim();
    if (!q) return;
    const reply = adjuntoReply(q, today, { names: Object.fromEntries(today.sections.map((s) => [s.competition.id, t(s.competition.short)])) });
    setAdjuntoLog([...(adjuntoLog.length ? adjuntoLog : [messages[0]]), { role: "user", text: q }, { role: "assistant", text: reply.text, actions: reply.actions }]);
    setText("");
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
        {!ctx.wide && <><Sparkles size={20} color={C.accent} aria-hidden /><h2 style={{ margin: 0, fontSize: T.h }}>{name}</h2></>}
        <Chip variant="orange">{t("Demonstração guiada")}</Chip>
      </div>
      <p style={{ color: C.text2, fontSize: T.meta, lineHeight: 1.5, margin: `0 0 ${S.lg}px` }}>
        {t("Responde com os dados da liga e abre o passo certo. Não homologa, não decide sanções e não envia mensagens: isso é contigo.")}
      </p>

      <div role="log" aria-live="polite" aria-label={tf(t("Conversa com o {name}"), { name })} style={{ display: "flex", flexDirection: "column", gap: S.sm, marginBottom: S.lg }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            ...cardStyle, alignSelf: m.role === "user" ? "flex-end" : "stretch", maxWidth: m.role === "user" ? "85%" : "100%",
            background: m.role === "user" ? C.accentDim : C.card, borderLeft: m.role === "assistant" ? `3px solid ${C.accent}` : undefined,
          }}>
            <AdjuntoText text={m.text} />
            {m.actions?.length > 0 && (
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
                {m.actions.map((a, k) => (k === 0
                  ? <BtnPrimary key={a.id} onClick={() => run(a.id)}>{t(a.label)}</BtnPrimary>
                  : <BtnGhost key={a.id} onClick={() => run(a.id)}>{t(a.label)}</BtnGhost>))}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {adjuntoLog.length === 0 && (
        <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.lg }}>
          {ADJUNTO_SUGGESTIONS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} style={{
              minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent",
              color: C.text1, fontSize: T.meta, fontWeight: 600, cursor: "pointer",
            }}>{t(q)}</button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: S.sm }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} aria-label={tf(t("Mensagem para o {name}"), { name })}
          placeholder={t("Pergunta sobre a jornada, suspensões, calendário…")} style={{ ...inputStyle(), flex: 1, borderRadius: R.control }} />
        <BtnPrimary type="submit" disabled={!text.trim()} aria-label={t("Enviar")}><Send size={16} aria-hidden /></BtnPrimary>
      </form>
    </div>
  );
}
