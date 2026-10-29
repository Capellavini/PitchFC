import { useEffect, useState } from "react";
import { ChevronRight, Shield, Trophy } from "lucide-react";
import { C, S, T, BRAND, cardStyle, displayFont } from "../../theme";
import { t } from "../../lib/i18n";
import { rolesApi } from "../../lib/leagueRolesApi";
import { homeEntries } from "../../lib/leagueRoles";
import KeepyUppyLoader from "../KeepyUppyLoader";
import LeagueWorkspaceApp from "./LeagueWorkspaceApp";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

/** Where a signed-in person lands for leagues: their own league (as Gestor) and/or the leagues they belong
 *  to as captain or athlete. One entry opens straight away; several are listed. A person who only runs
 *  their own league (the usual case) goes to it with no extra step.
 *  `ownerFallback`: this is the league account's home, so with no memberships it is the Gestor app. */
export default function LeagueMyLeagues({ user, ownerFallback = false }) {
  const [res, setRes] = useState({ phase: "loading" });
  useEffect(() => {
    let alive = true;
    Promise.all([rolesApi.myLeagues(), rolesApi.version()]).then(([m, v]) => {
      if (!alive) return;
      // A failed lookup must never lock an owner out of their own league: treat it as "no memberships".
      setRes({ phase: "ready", memberships: m.error ? [] : (m.data || []), owner: !v.error && typeof v.data === "number" });
    });
    return () => { alive = false; };
  }, [user?.id]);

  const entries = res.phase === "ready" ? homeEntries({ owner: res.owner, memberships: res.memberships }) : [];
  const single = res.phase === "ready" && entries.length === 1 ? entries[0] : null;
  useEffect(() => { if (single) window.location.replace(single.href); }, [single]);

  if (res.phase === "ready" && ownerFallback && !res.memberships.length) return <LeagueWorkspaceApp user={user} />;
  if (res.phase === "loading" || single) {
    return <div role="status" style={{ minHeight: "100vh", background: C.bg, display: "grid", placeItems: "center" }}><KeepyUppyLoader /></div>;
  }
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: FONT, padding: `${S.xl}px ${S.lg}px`, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 430, margin: "0 auto" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 28, display: "block", marginBottom: S.sm }} />
        <div style={{ ...displayFont, fontSize: 16, letterSpacing: "0.14em", color: C.accent }}>LIGAS</div>
        <h1 style={{ margin: `${S.lg}px 0 ${S.md}px`, fontSize: T.title, fontWeight: 900, lineHeight: 1.15 }}>{t("As minhas ligas")}</h1>
        {!entries.length && (
          <div style={{ ...cardStyle, color: C.text2, lineHeight: 1.5 }}>
            {t("Ainda não pertences a nenhuma liga. Quando o gestor da tua liga te enviar um convite, abre a ligação que ele te mandar.")}
          </div>
        )}
        <div style={{ display: "grid", gap: S.sm }}>
          {entries.map((e) => (
            <a key={e.key} href={e.href} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: S.md, minHeight: 64, color: C.text1, textDecoration: "none" }}>
              {e.kind === "owner" ? <Trophy size={22} color={C.accent} aria-hidden /> : <Shield size={22} color={C.accent} aria-hidden />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 900, fontSize: T.cardTitle, overflowWrap: "anywhere" }}>{t(e.title)}</span>
                <span style={{ display: "block", color: C.text2, fontSize: T.meta }}>{t(e.detail.split(" · ")[0])}{e.detail.includes(" · ") ? ` · ${e.detail.split(" · ").slice(1).join(" · ")}` : ""}</span>
              </span>
              <ChevronRight size={18} color={C.text2} aria-hidden />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
