import { MapPin, Radio } from "lucide-react";
import { C, R, S, T, TOUCH, displayFont } from "../../../theme";
import { t } from "../../../lib/i18n";
import { onColor } from "../../../lib/leagueBrand";
import { leagueAppPath } from "../../../lib/leagueLanding";
import LeagueMark from "../LeagueMark";
import LandingTeamMark from "./LandingTeamMark";

const stat = (n, label) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ ...displayFont, fontSize: 26, lineHeight: 1 }}>{n}</div>
    <div style={{ fontSize: T.meta, color: C.text2, marginTop: 2 }}>{label}</div>
  </div>
);

const cta = (brand, ink) => ({ minHeight: TOUCH.button, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: `0 ${S.lg}px`, borderRadius: R.control, background: brand, color: onColor(brand), border: `1px solid ${ink}`, fontWeight: 800, fontSize: T.body, textDecoration: "none", boxSizing: "border-box" });
const ghost = { minHeight: TOUCH.button, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: `0 ${S.lg}px`, borderRadius: R.control, border: `1px solid ${C.border}`, color: C.text1, fontWeight: 700, fontSize: T.body, textDecoration: "none" };

/** The top of the league page: the league's mark and name, its welcome text, a few numbers, the
 *  games on right now and the way in. Wears the league colour. */
export default function LandingHero({ slug, league, settings, model, brand, ink }) {
  const played = model.competitions.reduce((n, c) => n + c.played, 0);
  const total = model.competitions.reduce((n, c) => n + c.total, 0);
  const subtitle = [league.fullName && league.fullName !== league.name ? league.fullName : null].filter(Boolean)[0];
  return (
    <header style={{ background: `linear-gradient(135deg, ${brand}30 0%, ${C.surface} 62%)`, border: `1px solid ${brand}66`, borderRadius: R.card, padding: S.lg, marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.lg, flexWrap: "wrap" }}>
        <LeagueMark size={76} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ ...displayFont, margin: 0, fontSize: T.title, lineHeight: 1.1, overflowWrap: "anywhere" }}>{league.name}</h1>
          {subtitle && <div style={{ fontSize: T.body, color: C.text2, marginTop: 2, overflowWrap: "anywhere" }}>{subtitle}</div>}
          <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.sm, alignItems: "center" }}>
            {league.city && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: T.meta, color: ink, fontWeight: 700 }}><MapPin size={14} aria-hidden /> {league.city}</span>}
            {model.competitions.map((c) => (
              <span key={c.id} style={{ fontSize: T.meta, fontWeight: 700, color: C.text1, border: `1px solid ${C.border}`, borderRadius: R.pill, padding: "2px 10px" }}>{c.short}{c.season ? ` · ${c.season}` : ""}</span>
            ))}
          </div>
        </div>
      </div>
      {settings.intro && <p style={{ margin: `${S.md}px 0 0`, fontSize: T.body, lineHeight: 1.55, color: C.text1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{settings.intro}</p>}

      {(model.teams.length > 0 || total > 0) && (
        <div style={{ display: "flex", gap: S.xl, flexWrap: "wrap", margin: `${S.lg}px 0 0` }}>
          {model.teams.length > 0 && stat(model.teams.length, t("equipas"))}
          {total > 0 && stat(`${played}/${total}`, t("jogos disputados"))}
        </div>
      )}

      {model.live.length > 0 && (
        <div role="status" style={{ marginTop: S.lg, display: "grid", gap: S.xs }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: S.xs, fontSize: T.meta, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}><Radio size={14} aria-hidden /> {t("A decorrer agora")}</div>
          {model.live.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: S.sm, background: C.card, border: `1px solid ${C.accentBorder}`, borderRadius: R.control, padding: `${S.sm}px ${S.md}px` }}>
              <LandingTeamMark team={m.home} size={22} />
              <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700, overflowWrap: "anywhere" }}>{m.home?.name} – {m.away?.name}</span>
              <span style={{ ...displayFont, fontSize: 20 }}>{m.score ? `${m.score.home}–${m.score.away}` : "vs"}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginTop: S.lg }}>
        {model.competitions.length > 0 && <a href="#jornadas" style={cta(brand, ink)}>{t("Ver jornadas")}</a>}
        {settings.signup && <a href="#pitch-manager" style={ghost}>{t("Jogar o Pitch Manager")}</a>}
        <a href={leagueAppPath(slug)} style={ghost}>{t("Abrir a app da liga")}</a>
      </div>
    </header>
  );
}
