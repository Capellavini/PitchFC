import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import { setLeagueMeta } from "../../lib/seo";
import { leaguePagePath } from "../../lib/leagueLanding";
import LeagueContextApp from "./LeagueContextApp";
import LeagueLanding from "./landing/LeagueLanding";

const page = { minHeight: "100vh", background: C.bg, color: C.text2, padding: S.xl, display: "grid", placeItems: "center", textAlign: "center", fontSize: T.body };
// The public app is read-only and keeps to the follower side of the league: no Pitch Manager, no fan vote.
const PUBLIC_OFF = { fantasy: false, fan_vote: false };

/** /leagues/<slug> — the league's own page (what its Gestor chose to publish);
 *  /leagues/<slug>/app — the same league as the follower app, on a read-only copy. */
export default function LeaguePublicPage({ slug, view = "page" }) {
  const [res, setRes] = useState({ phase: "loading" });
  useEffect(() => {
    let alive = true;
    supabase.rpc("league_workspace_public", { p_slug: slug }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setRes({ phase: "error" });
      else if (!data) setRes({ phase: "missing" });
      else setRes({ phase: "ready", data });
    }, () => alive && setRes({ phase: "error" }));
    return () => { alive = false; };
  }, [slug]);

  // The tab and the search result say the league's own name, not PITCH's.
  const name = res.data?.name || "";
  const city = res.data?.state?.data?.league?.city || "";
  useEffect(() => { if (name) setLeagueMeta({ name, city, path: leaguePagePath(slug), indexable: view === "page" }); }, [name, city, slug, view]);

  const appRaw = useMemo(() => {
    const s = res.data?.state;
    return s ? { ...s, modules: { ...(s.modules || {}), ...PUBLIC_OFF } } : null;
  }, [res.data]);
  const store = useMemo(() => ({ raw: appRaw, setRaw() {}, readOnly: true, sync: "public" }), [appRaw]);

  if (res.phase === "loading") return <div role="status" style={page}>{t("A abrir a liga…")}</div>;
  if (res.phase === "missing") return <div role="alert" style={page}>{t("Esta liga não existe ou ainda não está publicada.")}</div>;
  if (res.phase === "error") return <div role="alert" style={page}>{t("Não conseguimos abrir a liga. Tenta outra vez daqui a pouco.")}</div>;
  if (view === "app") return <LeagueContextApp store={store} />;
  return <LeagueLanding slug={slug} raw={res.data.state} updatedAt={res.data.updated_at} />;
}
