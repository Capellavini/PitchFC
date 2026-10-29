import { useMemo, useState } from "react";
import { C, S, T } from "../../../theme";
import { getLang, t } from "../../../lib/i18n";
import { normalizeLeagueState, deriveLeague, fmtDateTime, LEAGUE } from "../../../lib/leagueDemo";
import { onDarkText, validColor } from "../../../lib/leagueBrand";
import { landingModel, pageSettings } from "../../../lib/leagueLanding";
import SegmentedControl from "../../SegmentedControl";
import LandingHero from "./LandingHero";
import LandingSection from "./LandingSection";
import LandingNotices from "./LandingNotices";
import LandingRounds from "./LandingRounds";
import LandingScorers from "./LandingScorers";
import LandingTeams from "./LandingTeams";
import LandingSignup from "./LandingSignup";
import LeagueStandingsTable from "../LeagueStandingsTable";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif"; // same as the league app

/**
 * The league's own page (/leagues/<slug>): what the league published, in the league's colours —
 * avisos, the calendar round by round, the table, the top scorers, the teams and the fans' sign-up
 * for the Pitch Manager. Read-only, no account, on the same sanitized copy the public app uses.
 *
 * Props: slug · raw (the league state the server gave the public) · updatedAt (ISO).
 */
export default function LeagueLanding({ slug, raw, updatedAt }) {
  const state = useMemo(() => normalizeLeagueState(raw), [raw]); // also installs the league registry the shared pieces read
  const derived = useMemo(() => deriveLeague(state), [state]);
  const model = useMemo(() => landingModel(state, derived), [state, derived]);
  const league = state.data.league;
  const settings = pageSettings(league);
  const brand = validColor(league.color) || C.accent;
  const ink = onDarkText(brand);
  const lang = getLang();

  const [picked, setPicked] = useState(null);
  const comp = model.competitions.find((c) => c.id === picked) || model.competitions.find((c) => c.kind === "league") || model.competitions[0] || null;
  const hasTable = comp && comp.kind === "league" && comp.table.length > 0;
  const showScorers = settings.scorers && comp && comp.kind === "league";
  const nav = [
    model.notices.length > 0 && ["avisos", t("Avisos")],
    comp && ["jornadas", t("Jornadas")],
    hasTable && ["classificacao", t("Classificação")],
    showScorers && ["artilheiros", t("Artilheiros")],
    settings.teams && model.teams.length > 0 && ["equipas", t("Equipas")],
    settings.signup && ["pitch-manager", t("Pitch Manager")],
  ].filter(Boolean);

  return (
    <div style={{ background: C.bg, color: C.text1, minHeight: "100vh", fontFamily: FONT, overflowX: "hidden" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: `${S.lg}px ${S.lg}px ${S.xxl}px`, boxSizing: "border-box" }}>
        <LandingHero slug={slug} league={LEAGUE} settings={settings} model={model} brand={brand} ink={ink} />

        {nav.length > 1 && (
          <nav aria-label={t("Nesta página")} style={{ display: "flex", gap: S.sm, overflowX: "auto", scrollbarWidth: "none", marginBottom: S.xl }}>
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`} style={{ flexShrink: 0, minHeight: 44, display: "inline-flex", alignItems: "center", padding: `0 ${S.md}px`, borderRadius: 999, border: `1px solid ${C.border}`, color: C.text1, fontSize: T.body, fontWeight: 700, textDecoration: "none" }}>{label}</a>
            ))}
          </nav>
        )}

        {model.empty && (
          <div role="status" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: S.xl, color: C.text2, fontSize: T.body, lineHeight: 1.5, marginBottom: S.xl }}>
            {t("A liga está a preparar a época. Volta em breve para veres o calendário, os resultados e a classificação.")}
          </div>
        )}

        {model.notices.length > 0 && (
          <LandingSection id="avisos" title={t("Avisos da liga")} brand={ink}>
            <LandingNotices notices={model.notices} brand={brand} ink={ink} lang={lang} />
          </LandingSection>
        )}

        {comp && (
          <>
            {model.competitions.length > 1 && (
              <SegmentedControl value={comp.id} onChange={setPicked} options={model.competitions.map((c) => ({ id: c.id, label: c.short }))} />
            )}
            <LandingSection id="jornadas" title={t("Jornadas")} hint={comp.sponsor ? `${comp.name} · ${comp.sponsor}` : comp.name} brand={ink}>
              <LandingRounds comp={comp} lang={lang} />
            </LandingSection>

            <div style={{ display: "grid", gridTemplateColumns: hasTable && showScorers ? "repeat(auto-fit, minmax(340px, 1fr))" : "1fr", gap: `0 ${S.xxl}px`, alignItems: "start" }}>
              {hasTable && (
                <LandingSection id="classificacao" title={t("Classificação")} hint={t("Classificação oficial · só jogos homologados")} brand={ink}>
                  <LeagueStandingsTable rows={comp.table} />
                </LandingSection>
              )}
              {showScorers && (
                <LandingSection id="artilheiros" title={t("Artilheiros")} brand={ink}>
                  <LandingScorers comp={comp} />
                </LandingSection>
              )}
            </div>
          </>
        )}

        {settings.teams && model.teams.length > 0 && (
          <LandingSection id="equipas" title={t("Equipas")} brand={ink}>
            <LandingTeams teams={model.teams} />
          </LandingSection>
        )}

        {settings.signup && (
          <LandingSection id="pitch-manager" title={t("Pitch Manager da liga")} hint={t("O jogo de adeptos com os atletas reais desta liga.")} brand={ink}>
            <div style={{ maxWidth: 560 }}>
              <LandingSignup slug={slug} leagueName={league.name} teams={model.teams} brand={brand} ink={ink} />
            </div>
          </LandingSection>
        )}

        <footer style={{ borderTop: `1px solid ${C.border}`, paddingTop: S.lg, display: "flex", justifyContent: "space-between", gap: S.md, flexWrap: "wrap", alignItems: "center", fontSize: T.meta, color: C.text2 }}>
          <span>{updatedAt ? `${t("Atualizado a")} ${fmtDateTime(updatedAt, lang)}` : ""}</span>
          <span>
            {t("Página criada com")}{" "}
            <a href="/league" style={{ color: ink, fontWeight: 800, textDecoration: "none" }}>PITCH</a>
            {" · "}<a href="/privacidade" style={{ color: C.text2 }}>{t("Privacidade")}</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
