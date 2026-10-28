import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { C, S, T } from "../../theme";
import { t } from "../../lib/i18n";
import LeagueContextApp from "./LeagueContextApp";

const page = { minHeight: "100vh", background: C.bg, color: C.text2, padding: S.xl, display: "grid", placeItems: "center", textAlign: "center", fontSize: T.body };
// Public pages are read-only and keep to the follower side of the league: no Fantasy, no fan vote.
const PUBLIC_OFF = { fantasy: false, fan_vote: false };

/** /l/<slug> — the league's public page (what its Gestor chose to publish).
 *  The same follower screens as the app, on a read-only copy. */
export default function LeaguePublicPage({ slug }) {
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
  const raw = useMemo(() => {
    const s = res.data?.state;
    return s ? { ...s, modules: { ...(s.modules || {}), ...PUBLIC_OFF } } : null;
  }, [res.data]);
  const store = useMemo(() => ({ raw, setRaw() {}, readOnly: true, sync: "public" }), [raw]);
  if (res.phase === "loading") return <div role="status" style={page}>{t("A abrir a liga…")}</div>;
  if (res.phase === "missing") return <div role="alert" style={page}>{t("Esta liga não existe ou ainda não está publicada.")}</div>;
  if (res.phase === "error") return <div role="alert" style={page}>{t("Não conseguimos abrir a liga. Tenta outra vez daqui a pouco.")}</div>;
  return <LeagueContextApp store={store} />;
}
