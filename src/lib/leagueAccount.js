// PITCH Ligas accounts. An account created from the league entry
// (/league/entrar) carries `pitch_product: "league"` in its Supabase
// user_metadata and only ever sees the league product: weekly groups, Rivals
// and the player home are not reachable from it. The marker is a presentation
// and routing rule; what the account may DO is still decided by league roles
// and RLS on the server. Pure.

export const LEAGUE_ENTRY_PATH = "/league/entrar";
export const LEAGUE_HOME_PATH = "/league/minhas";

/** user_metadata written at sign-up on /league/entrar. */
export const LEAGUE_ACCOUNT_META = Object.freeze({ pitch_product: "league", pitch_context_mode: "league_only" });

export const isLeagueAccount = (user) => user?.user_metadata?.pitch_product === "league";

// Paths a league account may stay on: the league product, public league pages (/l/<slug>) and the legal pages.
const STAYS = [/^\/league(\/|$)/, /^\/l\/[a-z0-9-]+$/, /^\/l\/convite\/[a-f0-9]{40}$/, /^\/privacidade$/, /^\/termos$/];

/** Where a league account must be sent from `pathname`, or null when it may stay. */
export function leagueAccountRedirect(user, pathname) {
  if (!isLeagueAccount(user)) return null;
  const path = String(pathname || "/").replace(/\/+$/, "") || "/";
  return STAYS.some((re) => re.test(path)) ? null : LEAGUE_HOME_PATH;
}

/** Sign-up metadata for the league entry: the marker, the display name and
 *  the language. Never carries a group invite or a Rivals intent. */
export function leagueSignUpMeta(meta = {}) {
  const { name, phone, lang, lang_chosen } = meta;
  return { ...(name ? { name } : {}), ...(phone ? { phone } : {}), ...(lang ? { lang } : {}), ...(lang_chosen ? { lang_chosen } : {}), ...LEAGUE_ACCOUNT_META };
}

/** The minimal player row a league account needs (RPCs resolve "me" through
 *  players.user_id); no group, no card, no position attributes. */
export function leagueProfileForm(user) {
  const name = String(user?.user_metadata?.name || user?.email?.split("@")[0] || "Organizador").trim();
  return { name, nick: name.split(/\s+/)[0].slice(0, 20) || "Liga", position: "Médio", foot: "Direito", age: null, nationality: null, club: null, attrs: null, photo: null };
}
