import { useEffect, useRef, useState } from "react";
import { Check, Paperclip, Send, Sparkles, X, TriangleAlert } from "lucide-react";
import { C, R, S, T, TOUCH, cardStyle, inputStyle } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { LEAGUE, teamById } from "../../lib/leagueDemo";
import { leagueToday, roundRecapText } from "../../lib/leagueToday";
import { adjuntoName } from "../../lib/leagueAdjunto";
import { adjuntoReply, adjuntoBrief, ADJUNTO_SUGGESTIONS } from "../../lib/leagueAdjuntoGuide";
import { prepareBatch, adjuntoContext, OPEN_SCREENS } from "../../lib/leagueAdjuntoActions";
import { chatHistory } from "../../lib/leagueAdjuntoFiles";
import { askAdjunto, readAttachment } from "../../lib/leagueAdjuntoClient";
import { recapShareUrl } from "../../lib/leagueShare";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import Chip from "../Chip";
import AdjuntoText from "./AdjuntoText";

const CONSENT_KEY = "pitch.v2.adjuntoConsent";
const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; } };
const FILE_ERROR = { unsupported: "Este tipo de ficheiro não dá. Usa PDF, JPG, PNG, WebP, CSV ou TXT (exporta o Excel para CSV).", too_big: "O ficheiro é grande demais. O limite são 2,4 MB (texto: 40 000 caracteres).", read_failed: "Não consegui ler o ficheiro." };

/** O Adjunto da Liga, dentro da app: um chat. O Gestor escreve frases livres ou
 *  anexa documentos (calendário, plantéis, regulamento, fichas) e o Adjunto
 *  responde com texto, abre o passo certo ou prepara PROPOSTAS (equipas,
 *  plantéis, calendário, mudanças de jogo, comunicados) que só entram na liga
 *  depois de o Gestor confirmar. Sem IA ativa, volta às respostas guiadas. */
export default function LeagueAdjunto({ ctx, ask = askAdjunto }) {
  const { state, derived, open, notify, scope, act, adjuntoLog, setAdjuntoLog } = ctx;
  const today = leagueToday(state, derived, { scope });
  const name = adjuntoName(getLang());
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState("unknown"); // "unknown" | "on" | "off"
  const [consent, setConsent] = useState(readConsent);
  const [needConsent, setNeedConsent] = useState(false);
  const end = useRef(null);
  const picker = useRef(null);
  const brief = adjuntoBrief(today);
  const messages = adjuntoLog.length ? adjuntoLog : [{ role: "assistant", text: brief.text, actions: brief.actions }];
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest" }); }, [adjuntoLog.length, busy]);

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
    if (id === "setup") return open({ kind: "manage", section: "setup" });
    if (id === "registrations") return open({ kind: "manage", section: "registrations" });
    if (id === "recap") {
      const s = today.sections.find((x) => x.done);
      if (!s) return notify(t("Ainda não há jornada fechada."), "error");
      const label = s.roundName ? t(s.roundName) : tf(t("Jornada {n}"), { n: s.round });
      const body = roundRecapText({ round: s.round, matches: state.matches, scores: derived.scores, teamById, leagueName: LEAGUE.name, competitionId: s.competition.id, label });
      try { window.open(recapShareUrl(body), "_blank", "noopener"); } catch { notify(t("Não foi possível abrir o WhatsApp."), "error"); }
    }
    return undefined;
  };

  const append = (...entries) => setAdjuntoLog((log) => [...(log.length ? log : [messages[0]]), ...entries]);

  const pickFiles = async (list) => {
    for (const file of Array.from(list || [])) {
      if (files.length >= 3) { notify(t("No máximo 3 documentos por mensagem."), "error"); break; }
      try {
        const { attachment, masked } = await readAttachment(file);
        setFiles((cur) => [...cur, { id: `${Date.now()}-${cur.length}`, attachment, masked }]);
      } catch (e) { notify(t(FILE_ERROR[e.message] || FILE_ERROR.read_failed), "error"); }
    }
  };
  const onAttach = () => { if (!consent) { setNeedConsent(true); return; } picker.current?.click(); };
  const acceptConsent = () => { try { localStorage.setItem(CONSENT_KEY, "1"); } catch { /* private mode */ } setConsent(true); setNeedConsent(false); picker.current?.click(); };

  const guided = (q, note) => {
    const reply = adjuntoReply(q, today, { names: Object.fromEntries(today.sections.map((s) => [s.competition.id, t(s.competition.short)])) });
    append({ role: "assistant", text: note ? `${reply.text}\n\n${note}` : reply.text, actions: reply.actions });
  };

  const send = async (value) => {
    const q = String(value ?? text).trim();
    if ((!q && !files.length) || busy) return;
    const attachments = files.map((f) => f.attachment);
    const question = q || t("Lê o documento e diz-me o que encontras.");
    const names = attachments.map((a) => a.name);
    append({ role: "user", text: question, files: names });
    setText(""); setFiles([]);
    if (ai === "off") { guided(question, attachments.length ? t("Para ler documentos preciso da IA ativa.") : null); return; }
    setBusy(true);
    const r = await ask({ messages: [...chatHistory(adjuntoLog), { role: "user", text: question.slice(0, 1500) }], attachments, context: adjuntoContext(state) });
    setBusy(false);
    if (r.ok) {
      setAi("on");
      const { text: reply, proposals, open: screens, truncated } = r.reply;
      append({
        role: "assistant", text: (reply || (proposals.length ? t("Preparei isto para confirmares.") : "")) + (truncated ? `\n\n${t("A resposta ficou cortada. Pede-me o resto em partes mais pequenas.")}` : ""),
        actions: (screens || []).map((id) => ({ id, label: OPEN_SCREENS[id] })),
        proposal: proposals.length ? { id: `p${Date.now()}`, items: proposals, status: "pending" } : undefined,
      });
      return;
    }
    if (["offline", "auth", "disabled"].includes(r.code)) setAi("off");
    if (r.code === "limit" || r.code === "refusal" || r.code === "empty" || r.code === "invalid") { append({ role: "assistant", text: t(r.message), error: true }); return; }
    guided(question, `${t(r.message)} ${t("Respondo com o que sei da liga.")}`);
  };

  const settle = (proposalId, patch) => setAdjuntoLog((log) => log.map((m) => (m.proposal?.id === proposalId ? { ...m, proposal: { ...m.proposal, ...patch } } : m)));
  const applyProposal = (p) => {
    const result = prepareBatch(state, p.items);
    if (!result.applied) { notify(t("Nada disto se pode aplicar agora."), "error"); return; }
    act.setup((s) => prepareBatch(s, p.items).state, tf(t("Aplicado: {n} alterações."), { n: result.applied }));
    settle(p.id, { status: "applied", applied: result.applied, failed: result.failed });
  };

  const showSuggestions = adjuntoLog.length === 0;
  const empty = !state.data.teams.length;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
        {!ctx.wide && <><Sparkles size={20} color={C.accent} aria-hidden /><h2 style={{ margin: 0, fontSize: T.h }}>{name}</h2></>}
        {ai === "on" && <Chip variant="green">{t("IA ativa")}</Chip>}
        {ai === "off" && <Chip variant="orange">{t("Modo guiado")}</Chip>}
      </div>
      <p style={{ color: C.text2, fontSize: T.meta, lineHeight: 1.5, margin: `0 0 ${S.lg}px` }}>
        {t("Escreve o que precisas ou anexa um documento (calendário, plantéis, regulamento). Preparo as alterações e tu confirmas. Não homologo, não decido sanções e não envio mensagens: isso é contigo.")}
      </p>

      <div role="log" aria-live="polite" aria-label={tf(t("Conversa com o {name}"), { name })} style={{ display: "flex", flexDirection: "column", gap: S.sm, marginBottom: S.lg }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            ...cardStyle, alignSelf: m.role === "user" ? "flex-end" : "stretch", maxWidth: m.role === "user" ? "85%" : "100%",
            background: m.role === "user" ? C.accentDim : C.card, borderLeft: m.role === "assistant" ? `3px solid ${m.error ? C.orange : C.accent}` : undefined,
          }}>
            <AdjuntoText text={m.text} />
            {m.files?.length > 0 && (
              <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginTop: S.sm }}>
                {m.files.map((f, k) => <Chip key={k} Icon={Paperclip}>{f}</Chip>)}
              </div>
            )}
            {m.proposal && <ProposalCard proposal={m.proposal} state={state} onApply={() => applyProposal(m.proposal)} onDismiss={() => settle(m.proposal.id, { status: "dismissed" })} />}
            {m.actions?.length > 0 && (
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
                {m.actions.map((a, k) => (k === 0 && !m.proposal
                  ? <BtnPrimary key={a.id} onClick={() => run(a.id)}>{t(a.label)}</BtnPrimary>
                  : <BtnGhost key={a.id} onClick={() => run(a.id)}>{t(a.label)}</BtnGhost>))}
              </div>
            )}
          </div>
        ))}
        {busy && <div role="status" style={{ ...cardStyle, borderLeft: `3px solid ${C.accent}`, color: C.text2, fontSize: T.meta }}>{t("A pensar…")}</div>}
        <div ref={end} />
      </div>

      {showSuggestions && (
        <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.lg }}>
          {(empty ? ["Quero montar a liga a partir de um documento", ...ADJUNTO_SUGGESTIONS.slice(0, 1)] : ADJUNTO_SUGGESTIONS).map((q) => (
            <button key={q} type="button" onClick={() => send(t(q))} style={{
              minHeight: TOUCH.min, padding: `0 ${S.md}px`, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent",
              color: C.text1, fontSize: T.meta, fontWeight: 600, cursor: "pointer",
            }}>{t(q)}</button>
          ))}
        </div>
      )}

      {needConsent && (
        <div role="alert" style={{ ...cardStyle, marginBottom: S.md, borderLeft: `3px solid ${C.orange}` }}>
          <div style={{ display: "flex", gap: S.sm, alignItems: "flex-start" }}>
            <TriangleAlert size={18} color={C.orange} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: T.meta, lineHeight: 1.5 }}>
              {t("Os documentos e as mensagens são enviados à Anthropic, que fornece a IA do Adjunto, só para os ler e responder. Antes disso removo emails, telefones e números de licença do texto. Em imagens e PDFs não consigo remover: não anexes documentos com dados pessoais que não precises de partilhar.")}
              <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
                <BtnPrimary onClick={acceptConsent}>{t("Percebi, escolher ficheiro")}</BtnPrimary>
                <BtnGhost onClick={() => setNeedConsent(false)}>{t("Agora não")}</BtnGhost>
              </div>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: "flex", gap: S.xs, flexWrap: "wrap", marginBottom: S.sm }}>
          {files.map((f) => (
            <Chip key={f.id} Icon={Paperclip} onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))} title={t("Remover")}>
              {f.attachment.name}{f.masked ? ` · ${tf(t("{n} dados privados removidos"), { n: f.masked })}` : ""} <X size={12} aria-hidden style={{ marginLeft: 4 }} />
            </Chip>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: S.sm, alignItems: "flex-end" }}>
        <input ref={picker} type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.tsv,.txt,application/pdf,image/jpeg,image/png,image/webp,text/csv,text/plain"
          onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
        <BtnGhost type="button" onClick={onAttach} aria-label={t("Anexar documento")} disabled={busy}><Paperclip size={16} aria-hidden /></BtnGhost>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={2} disabled={busy}
          aria-label={tf(t("Mensagem para o {name}"), { name })}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("Ex.: muda o Alfa–Beta para sábado às 16h · cria a equipa Gama FC · anexa o calendário")}
          style={{ ...inputStyle(), flex: 1, borderRadius: R.control, resize: "vertical", minHeight: 56, lineHeight: 1.4 }} />
        <BtnPrimary type="submit" disabled={busy || (!text.trim() && !files.length)} aria-label={t("Enviar")}><Send size={16} aria-hidden /></BtnPrimary>
      </form>
      <p style={{ color: C.text2, fontSize: T.meta, margin: `${S.sm}px 0 0` }}>{t("Texto de documentos: emails, telefones e licenças são removidos antes do envio. Nada muda na liga sem a tua confirmação.")}</p>
    </div>
  );
}

/** What the Adjunto wants to change, line by line, against the league as it is now. */
function ProposalCard({ proposal, state, onApply, onDismiss }) {
  const pending = proposal.status === "pending";
  const batch = pending ? prepareBatch(state, proposal.items) : null;
  const rows = batch ? batch.items : null;
  return (
    <div style={{ marginTop: S.md, border: `1px solid ${C.border}`, borderRadius: R.control, background: C.surface, padding: S.md }}>
      <div style={{ fontSize: T.meta, fontWeight: 800, color: C.text2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: S.sm }}>
        {proposal.status === "applied" ? t("Aplicado") : proposal.status === "dismissed" ? t("Descartado") : t("Proposta para confirmares")}
      </div>
      {pending ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: S.xs }}>
          {rows.map((r, i) => (
            <li key={i} style={{ display: "flex", gap: S.sm, alignItems: "flex-start", fontSize: T.body, lineHeight: 1.4 }}>
              {r.ok ? <Check size={16} color={C.green} aria-label={t("Pode aplicar-se")} style={{ flexShrink: 0, marginTop: 3 }} /> : <X size={16} color={C.red} aria-label={t("Não se pode aplicar")} style={{ flexShrink: 0, marginTop: 3 }} />}
              <span style={{ color: r.ok ? C.text1 : C.text2 }}>{r.line}{!r.ok && <span style={{ display: "block", fontSize: T.meta, color: C.red }}>{t(r.error)}</span>}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: T.body, color: C.text2 }}>
          {proposal.status === "applied" ? tf(t("{n} alterações na liga."), { n: proposal.applied }) + (proposal.failed ? ` ${tf(t("{n} não se aplicaram."), { n: proposal.failed })}` : "") : t("Nada foi alterado.")}
        </div>
      )}
      {pending && (
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.md }}>
          <BtnPrimary onClick={onApply} disabled={!batch.applied}>{tf(t("Aplicar {n}"), { n: batch.applied })}</BtnPrimary>
          <BtnGhost onClick={onDismiss}>{t("Descartar")}</BtnGhost>
        </div>
      )}
    </div>
  );
}
