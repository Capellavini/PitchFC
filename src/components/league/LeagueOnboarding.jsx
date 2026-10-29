import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, FileSpreadsheet, Sparkles, Upload } from "lucide-react";
import { C, R, S, T, TOUCH, BRAND, cardStyle, displayFont, inputStyle } from "../../theme";
import { t, getLang } from "../../lib/i18n";
import { tf } from "../../lib/leagueCopy";
import { adjuntoName } from "../../lib/leagueAdjunto";
import {
  setLeagueInfo, setLeagueBrand, addCompetition, finishOnboarding, generateFixtures, setTeamCompetitions,
} from "../../lib/leagueSetup";
import { importTeams, importCalendar, importRoster } from "../../lib/leagueImport";
import { readTableFile } from "../../lib/leagueTable";
import { logoFromFile, onColor } from "../../lib/leagueBrand";
import { seasonLabel, parseCompetitionLines, parseTeamLines, IMPORT_REASON } from "../../lib/leagueGuidedStart";
import BtnPrimary from "../BtnPrimary";
import BtnGhost from "../BtnGhost";
import LeagueField from "./LeagueField";

const ORDER = ["league", "logo", "competitions", "teams", "players", "calendar", "done"];
const TABLE_ERROR = {
  too_large: "O ficheiro é demasiado grande (máximo 5 MB).",
  old_excel: "Este é um Excel antigo (.xls). Guarda-o como .xlsx ou CSV e carrega outra vez.",
  unsupported: "Usa um ficheiro Excel (.xlsx) ou CSV.",
  unreadable: "Não consegui ler o ficheiro. Confirma que não está protegido por palavra-passe.",
};
const nextSaturday = () => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** The first thing a new league account sees: the Adjunto asks, the league
 *  builds itself from the answers. One flow — name, logo, competitions,
 *  teams, squads, calendar — and nothing leaves the screen until it ends.
 *  Every answer is saved as it is given; "Saltar" hands the rest to Gerir. */
export default function LeagueOnboarding({ ctx }) {
  const { state, act, notify } = ctx;
  const name = adjuntoName(getLang());
  const d = state.data;
  const stepNow = !d.league.name ? "league" : (ORDER.includes(state.setup?.step) ? state.setup.step : "logo");
  const index = ORDER.indexOf(stepNow);
  const goTo = (step) => act.setup((s) => ({ ...s, setup: { ...(s.setup || {}), step } }));
  const next = () => goTo(ORDER[Math.min(ORDER.length - 1, index + 1)]);
  const back = () => goTo(ORDER[Math.max(1, index - 1)]);
  const top = useRef(null);
  useEffect(() => { top.current?.scrollIntoView?.({ block: "start" }); }, [stepNow]);
  const props = { ctx, state, act, notify, next, name };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text1 }}>
      <div ref={top} style={{ maxWidth: 680, margin: "0 auto", padding: `${S.lg}px ${S.lg}px ${S.xxl * 2}px`, boxSizing: "border-box" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md, minHeight: 44, marginBottom: S.lg }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: S.sm }}>
            {index > 1 && stepNow !== "done" && <button type="button" onClick={back} aria-label={t("Voltar")} style={{ width: TOUCH.min, height: TOUCH.min, display: "grid", placeItems: "center", background: "none", border: "none", color: C.text2, cursor: "pointer" }}><ArrowLeft size={20} aria-hidden /></button>}
            <img src={BRAND.logo} alt="PITCH" style={{ height: 18 }} />
            <span style={{ ...displayFont, fontSize: T.meta, letterSpacing: "0.12em", color: C.accent }}>LIGAS</span>
          </span>
          {stepNow !== "done" && (
            <button type="button" onClick={() => act.setup(finishOnboarding)} style={{ minHeight: TOUCH.min, background: "none", border: "none", color: C.text2, fontSize: T.meta, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
              {t("Saltar e configurar depois")}
            </button>
          )}
        </header>
        {stepNow !== "done" && (
          <div aria-label={tf(t("Passo {n} de {m}"), { n: index + 1, m: ORDER.length - 1 })} style={{ display: "flex", gap: 4, marginBottom: S.xl }}>
            {ORDER.slice(0, -1).map((id, i) => <span key={id} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= index ? C.accent : C.border }} />)}
          </div>
        )}
        {stepNow === "league" && <StepLeague {...props} />}
        {stepNow === "logo" && <StepLogo {...props} />}
        {stepNow === "competitions" && <StepCompetitions {...props} />}
        {stepNow === "teams" && <StepTeams {...props} />}
        {stepNow === "players" && <StepPlayers {...props} />}
        {stepNow === "calendar" && <StepCalendar {...props} />}
        {stepNow === "done" && <StepDone {...props} />}
      </div>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────
function Say({ name, children }) {
  return (
    <div style={{ display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: S.lg }}>
      <span aria-hidden style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 999, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "grid", placeItems: "center" }}><Sparkles size={18} color={C.accent} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: T.h, lineHeight: 1.4, fontWeight: 700 }}>{children}</div>
      </div>
    </div>
  );
}
const Card = ({ children, style }) => <div style={{ ...cardStyle, display: "grid", gap: S.md, ...style }}>{children}</div>;
const Actions = ({ children }) => <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;

/** A button that opens the file chooser; the chosen file goes to `onFile`. */
function FilePick({ accept, label, Icon = Upload, onFile, ghost = true }) {
  const ref = useRef(null);
  const Btn = ghost ? BtnGhost : BtnPrimary;
  return (
    <>
      <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      <Btn onClick={() => ref.current?.click()}><span style={{ display: "inline-flex", alignItems: "center", gap: S.sm }}><Icon size={16} aria-hidden />{label}</span></Btn>
    </>
  );
}

/** What a spreadsheet import found, before anything is saved. */
function Preview({ title, lines, skipped, onConfirm, onCancel, confirmLabel }) {
  return (
    <Card style={{ borderColor: C.accentBorder }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      {lines.length > 0 && <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{lines.slice(0, 12).join(" · ")}{lines.length > 12 ? ` … +${lines.length - 12}` : ""}</div>}
      {skipped.length > 0 && (
        <div style={{ fontSize: T.meta, color: C.orange, lineHeight: 1.5 }}>
          {t("Linhas que vão ficar de fora:")} {skipped.slice(0, 6).map((s) => `${tf(t("linha {n}"), { n: s.line })} (${t(IMPORT_REASON[s.reason] || IMPORT_REASON.invalid)})`).join(" · ")}{skipped.length > 6 ? ` … +${skipped.length - 6}` : ""}
        </div>
      )}
      <Actions><BtnPrimary onClick={onConfirm}>{confirmLabel}</BtnPrimary><BtnGhost onClick={onCancel}>{t("Cancelar")}</BtnGhost></Actions>
    </Card>
  );
}

/** Reads a file into rows or tells the Gestor why not. */
async function rowsOf(file, notify) {
  const r = await readTableFile(file);
  if (r.error) { notify(t(TABLE_ERROR[r.error] || TABLE_ERROR.unreadable), "error"); return null; }
  if (!r.rows.length) { notify(t("O ficheiro está vazio."), "error"); return null; }
  return r.rows;
}

// ── Steps ────────────────────────────────────────────────
function StepLeague({ name, act, next, state }) {
  const [league, setLeague] = useState(state.data.league.name || "");
  const [city, setCity] = useState(state.data.league.city || "");
  const submit = (e) => {
    e.preventDefault();
    const r = act.setup((s) => setLeagueInfo(s, { name: league, city }));
    if (r.ok) next();
  };
  return (
    <form onSubmit={submit}>
      <Say name={name}>{tf(t("Bem-vindo ao PITCH Ligas. Sou o teu {name}: vou montar contigo a tua liga, passo a passo, e no fim fica tudo pronto a usar. Como se chama a liga ou a associação?"), { name: name.toLowerCase() })}</Say>
      <Card>
        <LeagueField label={t("Nome da liga")}><input autoFocus value={league} onChange={(e) => setLeague(e.target.value)} maxLength={60} style={inputStyle()} autoComplete="off" /></LeagueField>
        <LeagueField label={t("Cidade ou zona onde jogam")}><input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} style={inputStyle()} autoComplete="off" /></LeagueField>
        <div><BtnPrimary type="submit" disabled={league.trim().length < 2}>{t("Continuar")}</BtnPrimary></div>
      </Card>
    </form>
  );
}

function StepLogo({ name, state, act, notify, next }) {
  const lg = state.data.league;
  const [draft, setDraft] = useState(lg.logo ? { dataUrl: lg.logo, color: lg.color || null } : null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    setBusy(true);
    const r = await logoFromFile(file);
    setBusy(false);
    if (r.error) { notify(t(r.error === "unsupported" ? "Usa uma imagem PNG, JPG ou WebP." : r.error === "too_large" ? "A imagem é demasiado grande." : "Não consegui ler essa imagem."), "error"); return; }
    setDraft(r);
  };
  const save = () => { if (draft) act.setup((s) => setLeagueBrand(s, { logo: draft.dataUrl, color: draft.color || undefined })); next(); };
  return (
    <div>
      <Say name={name}>{tf(t("Boa, {liga}. Tens o logótipo? Carrega-o e eu tiro dele a cor da liga."), { liga: lg.name })}</Say>
      <Card>
        {draft ? (
          <div style={{ display: "flex", gap: S.lg, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 88, height: 88, borderRadius: R.control, background: C.surface, border: `2px solid ${draft.color || C.border}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
              <img src={draft.dataUrl} alt={t("Logótipo da liga")} style={{ maxWidth: "100%", maxHeight: "100%" }} />
            </span>
            <div style={{ display: "grid", gap: S.sm }}>
              <label style={{ display: "flex", alignItems: "center", gap: S.sm, fontSize: T.meta, fontWeight: 700, color: C.text2 }}>
                {t("Cor da liga")}
                <input type="color" value={draft.color || "#C8FF00"} onChange={(e) => setDraft({ ...draft, color: e.target.value.toUpperCase() })} style={{ width: 44, height: 36, border: `1px solid ${C.border}`, borderRadius: 8, background: "none", padding: 0 }} />
                <span style={{ background: draft.color || C.accent, color: onColor(draft.color || C.accent), borderRadius: 999, padding: "2px 10px", fontSize: T.min, fontWeight: 800 }}>{draft.color || "#C8FF00"}</span>
              </label>
              <div style={{ fontSize: T.meta, color: C.text2 }}>{draft.color ? t("Cor tirada do logótipo. Podes mudá-la.") : t("O logótipo não tem uma cor dominante; escolhe a que quiseres.")}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("PNG, JPG ou WebP. Partilha apenas um logótipo que tenhas autorização para usar.")}</div>
        )}
        <Actions>
          <FilePick accept="image/png,image/jpeg,image/webp" label={busy ? t("A ler…") : draft ? t("Trocar logótipo") : t("Carregar logótipo")} onFile={pick} ghost={Boolean(draft)} />
          {draft ? <BtnPrimary onClick={save}>{t("Continuar")}</BtnPrimary> : <BtnGhost onClick={next}>{t("Ainda não tenho")}</BtnGhost>}
        </Actions>
      </Card>
    </div>
  );
}

function StepCompetitions({ name, state, act, next }) {
  const [text, setText] = useState("");
  const [season, setSeason] = useState(() => seasonLabel());
  const [legs, setLegs] = useState(1);
  const existing = state.data.competitions;
  const list = parseCompetitionLines(text);
  const submit = (e) => {
    e.preventDefault();
    const fresh = list.filter((c) => !existing.some((x) => x.name.toLowerCase() === c.name.toLowerCase()));
    if (!fresh.length) { if (existing.length) next(); return; }
    const r = act.setup((s) => fresh.reduce((acc, c) => addCompetition(acc, { name: c.name, kind: c.kind, legs, season }), s));
    if (r.ok) next();
  };
  return (
    <form onSubmit={submit}>
      <Say name={name}>{t("Que competições vais organizar? Escreve uma por linha — por exemplo 1.ª Divisão, 2.ª Divisão, Taça. Eu percebo quais são taças.")}</Say>
      <Card>
        {existing.length > 0 && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("Já tens:")} <strong style={{ color: C.text1 }}>{existing.map((c) => c.name).join(" · ")}</strong></div>}
        <LeagueField label={existing.length ? t("Adicionar mais (opcional)") : t("Competições")}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={600} placeholder={"1.ª Divisão\n2.ª Divisão\nTaça da Associação"} style={{ ...inputStyle(), resize: "vertical", minHeight: 110, fontFamily: "inherit" }} />
        </LeagueField>
        {list.length > 0 && <div style={{ fontSize: T.meta, color: C.text2 }}>{list.map((c) => `${c.name} (${c.kind === "cup" ? t("taça") : t("campeonato")})`).join(" · ")}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.md }}>
          <LeagueField label={t("Época")}><input value={season} onChange={(e) => setSeason(e.target.value)} maxLength={20} style={inputStyle()} /></LeagueField>
          <LeagueField label={t("Os campeonatos jogam")}>
            <select value={legs} onChange={(e) => setLegs(Number(e.target.value))} style={inputStyle()}>
              <option value={1}>{t("Uma volta")}</option><option value={2}>{t("Ida e volta")}</option><option value={3}>{t("Três voltas")}</option>
            </select>
          </LeagueField>
        </div>
        <div><BtnPrimary type="submit" disabled={!list.length && !existing.length}>{t("Continuar")}</BtnPrimary></div>
      </Card>
    </form>
  );
}

function StepTeams({ name, state, act, notify, next }) {
  const comps = state.data.competitions;
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(null);
  const comp = comps[i] || comps[comps.length - 1];
  if (!comp) return <Say name={name}>{t("Primeiro cria uma competição.")}</Say>;
  const inComp = (state.data.teams || []).filter((tm) => (comp.teamIds || []).includes(tm.id));
  const elsewhere = state.data.teams.filter((tm) => !(comp.teamIds || []).includes(tm.id));
  const run = (rows) => importTeams(state, { competitionId: comp.id, rows });
  const apply = (rows) => { const r = act.setup((s) => importTeams(s, { competitionId: comp.id, rows }).state); if (r.ok || r.same) { setText(""); setPending(null); } };
  const advance = () => { if (i + 1 < comps.length) { setI(i + 1); setText(""); setPending(null); } else next(); };
  const onFile = async (file) => {
    const rows = await rowsOf(file, notify);
    if (!rows) return;
    const r = run(rows);
    setPending({ rows, added: r.added, entered: r.entered, skipped: r.skipped });
  };
  const useAll = () => act.setup((s) => elsewhere.reduce((acc, tm) => setTeamCompetitions(acc, tm.id, [...acc.data.competitions.filter((c) => (c.teamIds || []).includes(tm.id)).map((c) => c.id), comp.id]), s));
  return (
    <div>
      <Say name={name}>{tf(t("Que equipas jogam na {comp}? Cola os nomes, um por linha, ou carrega o Excel."), { comp: comp.name })}</Say>
      <div style={{ fontSize: T.meta, color: C.text2, margin: `-${S.sm}px 0 ${S.md}px 52px` }}>{tf(t("Competição {n} de {m}"), { n: Math.min(i + 1, comps.length), m: comps.length })}</div>
      <Card>
        {inComp.length > 0 && <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.6 }}><Check size={14} color={C.green} aria-hidden style={{ verticalAlign: "-2px" }} /> {tf(t("{n} equipas:"), { n: inComp.length })} <strong style={{ color: C.text1 }}>{inComp.map((x) => x.name).join(" · ")}</strong></div>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={4000} aria-label={t("Equipas, uma por linha")} placeholder={"Anta FC\nParamos\nSilvalde"} style={{ ...inputStyle(), resize: "vertical", minHeight: 120, fontFamily: "inherit" }} />
        <Actions>
          <BtnPrimary disabled={!parseTeamLines(text).length} onClick={() => apply(parseTeamLines(text))}>{t("Adicionar equipas")}</BtnPrimary>
          <FilePick accept=".xlsx,.csv,.tsv,.txt" Icon={FileSpreadsheet} label={t("Carregar Excel / CSV")} onFile={onFile} />
          {elsewhere.length > 0 && <BtnGhost onClick={useAll}>{tf(t("Usar as {n} já inscritas"), { n: elsewhere.length })}</BtnGhost>}
        </Actions>
      </Card>
      {pending && (
        <div style={{ marginTop: S.md }}>
          <Preview title={tf(t("{n} equipas no ficheiro"), { n: pending.added.length + pending.entered.length })} lines={[...pending.added, ...pending.entered]} skipped={pending.skipped}
            confirmLabel={t("Adicionar")} onConfirm={() => apply(pending.rows)} onCancel={() => setPending(null)} />
        </div>
      )}
      <div style={{ marginTop: S.lg }}><BtnPrimary onClick={advance} disabled={inComp.length < 2 && comp.kind !== "cup"}>{i + 1 < comps.length ? t("Próxima competição") : t("Continuar")}</BtnPrimary>
        {inComp.length < 2 && <span style={{ marginLeft: S.md, fontSize: T.meta, color: C.text2 }}>{t("Precisa de pelo menos 2 equipas.")}</span>}
        <BtnGhost onClick={advance} style={{ marginLeft: S.sm }}>{t("Saltar")}</BtnGhost></div>
    </div>
  );
}

function StepPlayers({ name, state, act, notify, next }) {
  const [pending, setPending] = useState(null);
  const n = state.data.players.length;
  const onFile = async (file) => {
    const rows = await rowsOf(file, notify);
    if (!rows) return;
    const r = importRoster(state, { rows });
    setPending({ rows, added: r.added, skipped: r.skipped });
  };
  return (
    <div>
      <Say name={name}>{t("Tens os plantéis? Carrega um Excel com as colunas Equipa, Nome, Número e Posição — ou salta e adiciona equipa a equipa mais tarde.")}</Say>
      <Card>
        {n > 0 && <div style={{ fontSize: T.meta, color: C.text2 }}><Check size={14} color={C.green} aria-hidden style={{ verticalAlign: "-2px" }} /> {tf(t("{n} atletas na liga."), { n })}</div>}
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("As equipas têm de existir já (passo anterior). Atletas menores ficam só com iniciais nas páginas públicas.")}</div>
        <Actions>
          <FilePick accept=".xlsx,.csv,.tsv,.txt" Icon={FileSpreadsheet} label={t("Carregar plantéis")} onFile={onFile} ghost={false} />
          <BtnGhost onClick={next}>{n > 0 ? t("Continuar") : t("Saltar")}</BtnGhost>
        </Actions>
      </Card>
      {pending && (
        <div style={{ marginTop: S.md }}>
          <Preview title={tf(t("{n} atletas prontos a entrar"), { n: pending.added })} lines={[]} skipped={pending.skipped} confirmLabel={t("Adicionar atletas")}
            onConfirm={() => { const r = act.setup((s) => importRoster(s, { rows: pending.rows }).state, tf(t("{n} atletas adicionados."), { n: pending.added })); if (r.ok) setPending(null); }} onCancel={() => setPending(null)} />
        </div>
      )}
    </div>
  );
}

function StepCalendar({ name, state, act, notify, next }) {
  const comps = state.data.competitions;
  const [i, setI] = useState(0);
  const [start, setStart] = useState(nextSaturday);
  const [times, setTimes] = useState("15:00");
  const [every, setEvery] = useState(7);
  const [pending, setPending] = useState(null);
  const comp = comps[i] || comps[comps.length - 1];
  if (!comp) return null;
  const games = state.matches.filter((m) => m.competitionId === comp.id).length;
  const canAuto = comp.kind !== "cup" && (comp.teamIds || []).length >= 2 && games === 0;
  const advance = () => { if (i + 1 < comps.length) { setI(i + 1); setPending(null); } else next(); };
  const onFile = async (file) => {
    const rows = await rowsOf(file, notify);
    if (!rows) return;
    const r = importCalendar(state, { competitionId: comp.id, rows });
    setPending({ rows, added: r.added, skipped: r.skipped, created: r.created });
  };
  const generate = () => {
    const slots = times.split(/[,\s]+/).filter(Boolean);
    const r = act.setup((s) => generateFixtures(s, { competitionId: comp.id, startDate: start, times: slots, everyDays: every }), t("Calendário gerado."));
    if (r.ok) advance();
  };
  return (
    <div>
      <Say name={name}>{tf(t("Falta o calendário da {comp}. Carrega o teu (Excel ou CSV) ou deixa-me gerar as jornadas."), { comp: comp.name })}</Say>
      <div style={{ fontSize: T.meta, color: C.text2, margin: `-${S.sm}px 0 ${S.md}px 52px` }}>{tf(t("Competição {n} de {m}"), { n: Math.min(i + 1, comps.length), m: comps.length })}</div>
      <Card>
        {games > 0 && <div style={{ fontSize: T.meta, color: C.text2 }}><Check size={14} color={C.green} aria-hidden style={{ verticalAlign: "-2px" }} /> {tf(t("{n} jogos no calendário."), { n: games })}</div>}
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("O ficheiro precisa das colunas Data, Hora, Casa e Fora (e, se quiseres, Jornada e Local). As equipas que não existirem são criadas.")}</div>
        <Actions><FilePick accept=".xlsx,.csv,.tsv,.txt" Icon={FileSpreadsheet} label={t("Carregar calendário")} onFile={onFile} ghost={false} /></Actions>
        {canAuto && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.md, display: "grid", gap: S.md }}>
            <div style={{ fontWeight: 800 }}>{t("Ou gera o calendário automático")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: S.md }}>
              <LeagueField label={t("Primeira jornada")}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle()} /></LeagueField>
              <LeagueField label={t("Horas dos jogos")} hint={t("Separadas por vírgula.")}><input value={times} onChange={(e) => setTimes(e.target.value)} placeholder="15:00, 17:00" style={inputStyle()} /></LeagueField>
              <LeagueField label={t("Uma jornada a cada")}><select value={every} onChange={(e) => setEvery(Number(e.target.value))} style={inputStyle()}><option value={7}>{t("7 dias")}</option><option value={14}>{t("14 dias")}</option><option value={1}>{t("1 dia")}</option></select></LeagueField>
            </div>
            <div><BtnGhost onClick={generate}>{t("Gerar jornadas")}</BtnGhost></div>
          </div>
        )}
        {comp.kind === "cup" && <div style={{ fontSize: T.meta, color: C.text2 }}>{t("As taças também podem ser montadas jogo a jogo em Gerir.")}</div>}
      </Card>
      {pending && (
        <div style={{ marginTop: S.md }}>
          <Preview title={tf(t("{n} jogos prontos a entrar"), { n: pending.added })} lines={pending.created.length ? [`${t("Equipas novas:")} ${pending.created.join(", ")}`] : []} skipped={pending.skipped}
            confirmLabel={t("Adicionar jogos")} onCancel={() => setPending(null)}
            onConfirm={() => { const r = act.setup((s) => importCalendar(s, { competitionId: comp.id, rows: pending.rows }).state, tf(t("{n} jogos adicionados."), { n: pending.added })); if (r.ok) { setPending(null); advance(); } }} />
        </div>
      )}
      <div style={{ marginTop: S.lg }}><BtnGhost onClick={advance}>{games > 0 ? t("Continuar") : t("Fazer depois")}</BtnGhost></div>
    </div>
  );
}

function StepDone({ name, state, act, ctx }) {
  const d = state.data;
  const todo = [
    !d.players.length && t("Adicionar os plantéis (Gerir → Inscrições)."),
    !state.matches.length && t("Montar o calendário (Gerir → Calendário)."),
    !d.league.logo && t("Pôr o logótipo da liga (Gerir → Liga)."),
  ].filter(Boolean);
  const finish = () => { const r = act.setup(finishOnboarding); if (r.ok) ctx.goTab("inicio"); };
  return (
    <div>
      <Say name={name}>{tf(t("Está pronta. {liga} tem {c} competições, {t} equipas, {a} atletas e {j} jogos."), { liga: d.league.name, c: d.competitions.length, t: d.teams.length, a: d.players.length, j: state.matches.length })}</Say>
      <Card>
        {todo.length > 0 && (
          <div>
            <div style={{ fontWeight: 800, marginBottom: S.xs }}>{t("Para mais tarde")}</div>
            <ul style={{ margin: 0, paddingLeft: S.lg, color: C.text2, fontSize: T.body, lineHeight: 1.7 }}>{todo.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t("Podes mudar tudo em Gerir e pedir ajuda ao Adjunto a qualquer momento.")}</div>
        <div><BtnPrimary onClick={finish}>{t("Abrir o Painel")}</BtnPrimary></div>
      </Card>
    </div>
  );
}

