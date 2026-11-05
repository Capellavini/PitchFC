import {communityRoute} from './leagueCommunity.js';
import { supabase } from "./supabase";
import { LEAGUE_ENTRY_PATH } from "./leagueAccount";

/** Ends the Supabase session of a PITCH Ligas account and lands on the sign-in
 *  page. A full navigation (not a router push) so no workspace state from the
 *  previous account stays in memory. Never throws: a failed network call must
 *  not trap someone in an account. */
export async function signOutLeague(destination = LEAGUE_ENTRY_PATH) {
  try { await supabase?.auth.signOut(); } catch { /* the local session is dropped below anyway */ }
  try { window.location.replace(typeof destination === "string" && communityRoute(destination)?.view === "entrar" ? destination : LEAGUE_ENTRY_PATH); } catch { /* no window (tests) */ }
}
