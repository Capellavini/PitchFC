import { Home, CalendarDays, ListOrdered, Gamepad2, Menu, ClipboardCheck, Settings2, Sparkles, Shield, User } from "lucide-react";
import { LG } from "./leagueCopy";
import { modOn } from "./leagueDemo.js";

// Followers (fan · athlete · captain): exactly 5 destinations (brief §6).
export const FOLLOW_NAV = [
  { id: "inicio", Icon: Home, label: LG.navHome },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "fantasy", Icon: Gamepad2, label: LG.navFantasy },
  { id: "mais", Icon: Menu, label: LG.navMore },
];

// Captain and athlete live in their team: Equipa (what needs them) · Jogos ·
// Classificação · Eu (own card) · Mais. Fantasy is a follower module and sits
// in Mais for them, so the bar stays about the team.
export const TEAM_NAV = [
  { id: "inicio", Icon: Shield, label: "Equipa" },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "eu", Icon: User, label: "Eu" },
  { id: "mais", Icon: Menu, label: LG.navMore },
];

/** Phone-bar destinations for a demo role. */
/** A destination that belongs to an optional module only shows while it is on. */
const gated = (list) => list.filter((n) => (n.id !== "fantasy" || modOn("fantasy")) && (n.id !== "adjunto" || modOn("adjunto")));
export const navFor = (role) => gated(role === "manager" ? MANAGER_NAV.filter((n) => n.phone !== false) : role === "captain" || role === "athlete" ? TEAM_NAV : FOLLOW_NAV);

/** Computer sidebar destinations: the Gestor lists "Mais" too; everyone else
 *  has the same five as on the phone. */
export const deskNavFor = (role) => (role === "manager" ? gated(MANAGER_NAV) : navFor(role));

/** Page title of a tab for a role (computer header). */
export const tabTitle = (role, tab) => {
  if (tab === "inicio") return role === "manager" ? "Painel" : role === "captain" || role === "athlete" ? "Equipa" : "Início";
  return { jogos: "Jogos", classificacao: "Classificação", gerir: "Gerir", mais: "Mais", fantasy: "Fantasy", eu: "Eu" }[tab] || "Painel";
};

// The Gestor works the league. Fantasy is a follower module (switched on per
// competition) and stays out of the way. The phone bar keeps 5 slots, so
// "Mais" lives in the header there and only the desktop sidebar lists it.
// `adjunto` labels come from adjuntoName(lang) at render time.
export const MANAGER_NAV = [
  { id: "inicio", Icon: ClipboardCheck, label: "Painel" },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "adjunto", Icon: Sparkles, label: null },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "gerir", Icon: Settings2, label: "Gerir" },
  { id: "mais", Icon: Menu, label: LG.navMore, phone: false },
];
