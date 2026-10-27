import { Home, CalendarDays, ListOrdered, Gamepad2, Menu, ClipboardCheck, Settings2, Sparkles } from "lucide-react";
import { LG } from "./leagueCopy";

// Followers (fan · athlete · captain): exactly 5 destinations (brief §6).
export const FOLLOW_NAV = [
  { id: "inicio", Icon: Home, label: LG.navHome },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "fantasy", Icon: Gamepad2, label: LG.navFantasy },
  { id: "mais", Icon: Menu, label: LG.navMore },
];

// The Gestor works the league. Fantasy is a follower module (switched on per
// competition) and stays out of the way. The phone bar keeps 5 slots, so
// "Mais" lives in the header there and only the desktop sidebar lists it.
// `adjunto` labels come from adjuntoName(lang) at render time.
export const MANAGER_NAV = [
  { id: "inicio", Icon: ClipboardCheck, label: "Hoje" },
  { id: "jogos", Icon: CalendarDays, label: LG.navMatches },
  { id: "adjunto", Icon: Sparkles, label: null },
  { id: "classificacao", Icon: ListOrdered, label: LG.navTable },
  { id: "gerir", Icon: Settings2, label: "Gerir" },
  { id: "mais", Icon: Menu, label: LG.navMore, phone: false },
];
