/**
 * PITCH — Weekly Game Organizer
 * ─────────────────────────────────────────────────────────
 * Core problem: 15 friends, 10 spots, every Saturday.
 * Replace the WhatsApp chaos: confirmations, payments,
 * stats, MVP voting, team draw, equipment.
 *
 * Two runtime modes:
 *  - Cloud (Supabase keys present): real accounts, groups created
 *    from scratch, invite links, admin events, realtime slot grid.
 *  - Local demo (no keys): the original localStorage prototype.
 */
import { useEffect, useRef, useState } from "react";
import { C, BRAND, TOUCH } from "./theme";
import { INITIAL_GROUP, INITIAL_MATERIAL, DEFAULT_SETTINGS, INITIAL_BOOKINGS, CLUB_EVENTS, OPEN_MATCHES } from "./data";
import { hashId } from "./lib/core/ids.js";
import { drawTeams as drawTeamsCore, balanceTeams as balanceTeamsCore } from "./lib/core/teamDraw.js";
import { DEMO_MATCHDAYS, DEMO_HISTORY, DEMO_POSTS, DEMO_FANTASY, DEMO_PEER_RATINGS } from "./lib/demoSeed";
import { computeRoundPoints, fantasyPrice, nextPricesPaid, DEFAULT_FANTASY_WEIGHTS } from "./lib/fantasy";
import { usePersistentState, clearAppStorage } from "./lib/storage";
import { ADMIN_EMAILS } from "./lib/supabase";
import { nextGameDateLabel, nextGameDate, fmtEUR, decodePayload, averageAttrs, fmtDayMonth, fmtFullDay, isoDay, toIsoDay, fromIso, dateTimeFromIso, playerColor, relativeTime, splitWaitlist, confirmationWindow, WEEKDAYS_PT, fileToDataUrl, defaultAttrsFor, lisbonTimeLabel } from "./lib/helpers";
import { t, setLang, detectLang } from "./lib/i18n";
import { trackEvent } from "./lib/analytics";
import { getThemeMode, setThemeMode } from "./lib/themeMode";
import { playoffState } from "./lib/matchdayLive";
import { roundRobinFixtures, buildKnockoutRound1, nextKnockoutRound, matchWinner, computeStandings } from "./lib/tournament";
import { useCloud } from "./hooks/useCloud";
import { registerServiceWorker, subscribeToPush } from "./lib/push";
import LandingPage from "./components/LandingPage";
import AuthForm from "./components/AuthForm";
import ResetPassword from "./components/ResetPassword";
import JoinGroup from "./components/JoinGroup";
import RatePlayer from "./components/RatePlayer";
import MagicConfirm from "./components/MagicConfirm";
import LeaguePage from "./components/LeaguePage";
import RivalsPage from "./components/RivalsPage";
import AdminDashboardPage from "./components/admin/AdminDashboardPage";
import RoadmapPage from "./components/RoadmapPage";
import PitchDeckPage from "./components/PitchDeckPage";
import PitchProPage from "./components/PitchProPage";
import LegalPage from "./components/LegalPage";
import PricingPage from "./components/PricingPage";
import AuthLanding from "./components/AuthLanding";
import FirstRunTour from "./components/FirstRunTour";
import OnboardingPlayer from "./components/OnboardingPlayer";
import OnboardingOrganizer from "./components/OnboardingOrganizer";
import BottomNav from "./components/BottomNav";
import TopBar from "./components/TopBar";
import GroupSwitcher from "./components/GroupSwitcher";
import HomeTab from "./components/HomeTab";
import JogarTab from "./components/JogarTab";
import CompetirTab from "./components/CompetirTab";
import JogoTab from "./components/JogoTab";
import GrupoTab from "./components/GrupoTab";
import FindGamePlaceholder from "./components/FindGamePlaceholder";
// Jogar tab (redesign v1): pushed Game Detail + Group page screens.
import GameDetail from "./components/GameDetail";
import GroupPage from "./components/GroupPage";
import GroupsList from "./components/GroupsList";
import GroupRecords from "./components/GroupRecords";
import GroupSettings from "./components/GroupSettings";
import FantasyTab from "./components/FantasyTab";
import MatchdayTab from "./components/MatchdayTab";
import MatchdayCold from "./components/MatchdayCold";
import NextActionCard from "./components/NextActionCard";
import ClubeTab from "./components/ClubeTab";
import SocialTab from "./components/SocialTab";
import PerfilTab from "./components/PerfilTab";
import SettingsScreen from "./components/SettingsScreen";
import WhatsNewSheet from "./components/WhatsNewSheet";
import AdminPanel from "./components/AdminPanel";
import NoGroupState from "./components/NoGroupState";
import BtnPrimary from "./components/BtnPrimary";
import { CalendarCheck, CreditCard, Star, ArrowLeft, Bell } from "lucide-react";
import Avatar from "./components/Avatar";
import KeepyUppyLoader from "./components/KeepyUppyLoader";
import { isEnabled } from "./lib/flags";

const APP_FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

// 5-tab IA (2026-09-28): home · jogar · matchday · competir · perfil.
// Any caller still using a pre-redesign id lands on its new home instead
// of a blank screen (Social → Home feed, Jogo → Jogar, Compete →
// Competir, Clube → Perfil's settings where the admin entry lives).
const TAB_IDS = ["home", "jogar", "matchday", "competir", "perfil"];
const LEGACY_TABS = { jogo: "jogar", social: "home", compete: "competir", stats: "jogar", grupo: "jogar", fantasy: "competir", clube: "perfil" };
const normalizeTab = (id) => (TAB_IDS.includes(id) ? id : LEGACY_TABS[id] ?? "home");

export default function PitchApp() {
  const [session, setSession]   = usePersistentState("session", { role: null, onboarded: false });
  const [settings, setSettings] = usePersistentState("settings", DEFAULT_SETTINGS);
  const [group, setGroup]       = usePersistentState("group", INITIAL_GROUP);
  const [material, setMaterial] = usePersistentState("material", INITIAL_MATERIAL);
  const [posts, setPosts]       = usePersistentState("posts", DEMO_POSTS);
  // teamsRaw/matchdayLocal: local-demo-only storage. In cloud mode the
  // real source of truth is cloud.game.teams / cloud.game.live_matchday
  // (synced via Supabase so every device sees the same draw/scores) —
  // see the `teams`/`matchday` derived consts and updateTeams/updateMatchday
  // below, which pick whichever source applies.
  const [teamsRaw, setTeamsLocal] = usePersistentState("teams", null);
  const [teamsConfirmedLocal, setTeamsConfirmedLocal] = usePersistentState("teamsConfirmed", false);
  const [peerRatings, setPeerRatings] = usePersistentState("peerRatings", DEMO_PEER_RATINGS);
  const [mvpVote, setMvpVote]   = usePersistentState("mvpVote", { open: true, votes: { 1: null, 2: null, 3: null } });
  // Only matchdays the user ran in THIS browser. The dated demo seed
  // (lib/demoSeed DEMO_HISTORY / DEMO_MATCHDAYS) is never persisted — it's
  // appended live in the views below so its dates always roll with today.
  const [history, setHistory]   = usePersistentState("history", []);
  // Local demo seed version. v1 (redesign): dated matchdays + demo posts.
  // Browsers that ran an older demo keep their persisted "history"/"posts"
  // — the effect below drops ONLY the untouched old static seed (5 rows
  // starting "7 Jun") and fills an empty feed / empty ratings with the new
  // seed; anything the user created locally is left alone. "Repor demo"
  // always gets the new seed.
  const [demoSeedV, setDemoSeedV] = usePersistentState("demoSeed", 0);
  // Pitch Manager in local demo: my own squad is editable and persisted.
  const [demoFantasySquad, setDemoFantasySquad] = usePersistentState("demoFantasySquad", DEMO_FANTASY.mySquad);
  const [matchdayLocal, setMatchdayLocal] = usePersistentState("matchday", null);
  const [lastMatchday, setLastMatchday] = usePersistentState("lastMatchday", null);
  const [bookings, setBookings] = usePersistentState("bookings", INITIAL_BOOKINGS);
  const [events, setEvents]     = usePersistentState("events", CLUB_EVENTS);
  const [openMatches, setOpenMatches] = usePersistentState("openMatches", OPEN_MATCHES);
  const [ownPublished, setOwnPublished] = usePersistentState("ownPublished", false);
  const [eventStatus, setEventStatus] = usePersistentState("eventStatus", {}); // cloud RSVP, local
  const [lang, setLangState]    = usePersistentState("lang", detectLang());
  const [themeMode, setThemeModeState] = useState(getThemeMode());
  // Opening tab is CONTEXTUAL (redesign spec §1): null until decided —
  // see `openingTab` / the freeze effect below the confirmation window.
  // Every explicit navigation goes through setTab, so once the user moves
  // the opening logic never overrides them.
  const [tabState, setTabRaw]   = useState(null);
  const setTab = (id) => setTabRaw(normalizeTab(id));
  // Jogar's segment (Jogos | Grupos) is lifted so Home's next-action
  // cards can deep-link into it; `grupoEntry` re-mounts GrupoTab on a
  // specific sub-view (e.g. "stats" = the group's Histórico).
  const [jogarView, setJogarView] = useState("jogos");
  const [grupoEntry, setGrupoEntry] = useState({ view: "squad", n: 0 });
  // Perfil → ⚙: null (profile) | "main" (settings) | "clube" (admin Clube).
  const [settingsView, setSettingsView] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  // Invite-code choice made in the pre-group step of a fresh signup (no
  // player row yet) — a pasted+validated token string, or the sentinel
  // "skip" for "ainda não tenho grupo". Only used when there's no ?join=
  // link (that case has its own token — see joinToken below). See the
  // needsProfile/player gating further down for how these two paths
  // converge on the same quick onboarding card.
  const [manualJoinChoice, setManualJoinChoice] = useState(null);
  const [viewPlayerId, setViewPlayerId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [noGroupOptIn, setNoGroupOptIn] = usePersistentState("noGroupOptIn", false);
  // One-time orientation overlay (see FirstRunTour) — shown once per
  // browser the first time gating resolves into the main app, then never
  // again. Bumping the "_v1" suffix would re-show it to everyone (e.g. a
  // future redesign), same convention as the "v2." storage prefix above.
  const [tourSeen, setTourSeen] = usePersistentState("tourSeen_v1", false);
  // One-time "Novidades" sheet for the 7→5 tab change — only for people
  // who already knew the old layout (tourSeen). A brand-new user gets the
  // (updated) tour instead, which also marks this as seen.
  const [whatsNewSeen, setWhatsNewSeen] = usePersistentState("whatsNew_nav5_v1", false);
  // TopBar bell reopens the same "Novidades" sheet on demand.
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // Mirror the persisted language into the i18n module before anything
  // renders, so every t() call below sees the current choice.
  setLang(lang);
  const changeLang = (l) => { setLang(l); setLangState(l); };
  const changeTheme = (m) => { setThemeMode(m); setThemeModeState(m); };

  // ── Cloud (PR 2: auth + groups + invites + events) ─────
  const cloud = useCloud();
  const localMode = cloud.status === "off" || cloud.status === "failed";
  const cloudMode = cloud.status === "ready";
  // Logged-in player who chose to explore without joining a group yet.
  const noGroup = cloud.status === "needsGroup" && noGroupOptIn;
  const cloudAuthed = cloudMode || noGroup; // user-level cloud features

  // Media upload: Supabase Storage when logged in (incl. during onboarding),
  // base64 fallback in local-demo. Used for social posts and profile photos.
  const uploadMedia = cloud.user
    ? (file) => cloud.uploadMedia(file)
    : async (file) => ({ url: await fileToDataUrl(file) });

  // Register the push/PWA service worker once.
  useEffect(() => { registerServiceWorker(); }, []);

  // Opt in to push notifications: subscribe in the browser, then store it.
  const enablePush = async () => {
    const sub = await subscribeToPush();
    if (sub.error) return sub;
    return cloud.savePushSubscription(sub);
  };

  // ?join=<token>: attach the logged-in user to that group. Captured once
  // into state (not re-read from the URL each render) so it survives the
  // replaceState below and stays available for the quick onboarding card
  // when the account is brand new — see the effect and the needsProfile
  // gating further down.
  const [joinToken, setJoinToken] = useState(() => new URLSearchParams(window.location.search).get("join"));
  // Token already handed to joinGroupByToken — this effect re-runs on every
  // new cloud.myPlayer/cloud.user object (each refetch, incl. the one the
  // join itself triggers), so without this it would re-issue the join
  // until the .finally below lands.
  const autoJoinedTokenRef = useRef(null);
  useEffect(() => {
    if (!joinToken || !cloud.user) return;
    if (cloud.myPlayer) {
      if (autoJoinedTokenRef.current === joinToken) return;
      autoJoinedTokenRef.current = joinToken;
      // Existing card, just accepting/switching a group via the link —
      // no onboarding card involved, safe to join immediately (matches
      // the pre-existing behaviour for returning players).
      cloud.joinGroupByToken(joinToken).finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
        setJoinToken(null);
      });
    } else {
      // Brand-new account (no player row yet): strip the token from the
      // URL now (so it doesn't leak into e.g. a shared screenshot and
      // this effect doesn't refire), but keep it in state — the join
      // itself happens once the quick onboarding card is submitted
      // (joinGroupWithProfile), never with a placeholder card.
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinToken, cloud.user, cloud.myPlayer]);

  // Arriving via an invite link only ever means "join as a player" —
  // skip the organizer/player role picker (AuthLanding) that a cold
  // signup still needs.
  useEffect(() => {
    if (joinToken && cloud.status === "needsProfile" && !pendingRole) setPendingRole("player");
  }, [joinToken, cloud.status, pendingRole]);

  // ?admin=1: reliable deep link to the owner panel. Consumed once into
  // state; the panel itself explains access if the viewer isn't an admin.
  const adminParam = new URLSearchParams(window.location.search).get("admin");
  useEffect(() => {
    if (!adminParam) return;
    setAdminOpen(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, [adminParam]);

  // Cloud rows → the app's player shape. With no group joined there's no
  // roster, so we surface just the player's own card (keeps Perfil/Stats working).
  const cloudRoster = cloudMode ? cloud.players : (noGroup && cloud.myPlayer ? [cloud.myPlayer] : null);
  const baseGroup = cloudRoster
    ? cloudRoster.map((p) => {
        const att = cloud.attendances.find((a) => a.player_id === p.id);
        const id = hashId(p.id);
        return {
          id, uuid: p.id, name: p.name, nick: p.nick, email: p.email, phone: p.phone,
          photo: p.photo_url, age: p.age, nationality: p.nationality, club: p.club,
          position: p.position, foot: p.foot, attrs: p.attrs ?? defaultAttrsFor(p.position),
          isOrganizerPlayer: p.is_organizer, isAssistant: p.is_assistant,
          isGuest: !p.user_id, injured: p.injured,
          playerType: p.player_type || "mensalista",
          magicToken: p.magic_token,
          status: att?.status ?? "pending", paid: att?.paid ?? false,
          respondedAt: att?.responded_at ?? null,
          priorityLocked: att?.priority_locked ?? false,
          isMe: cloud.myPlayer?.id === p.id,
          // Season stats now live on the cloud player row (shared ranking).
          goals: p.goals || 0, assists: p.assists || 0, mvps: p.mvps || 0,
          gamesPlayed: p.games_played || 0, wins: p.wins || 0, cleanSheets: p.clean_sheets || 0,
          epicSaves: p.epic_saves || 0,
        };
      })
    : group;

  const groupSettings = cloudMode
    ? {
        groupName: cloud.groupRow.name, venue: cloud.groupRow.venue, city: cloud.groupRow.city ?? "",
        weekday: cloud.groupRow.weekday, time: cloud.groupRow.game_time,
        monthlyPrice: cloud.groupRow.monthly_price_cents / 100, maxPlayers: cloud.groupRow.max_players,
        recurring: cloud.groupRow.recurring ?? true,
        openWeekday: cloud.groupRow.open_weekday ?? 1, openTime: cloud.groupRow.open_time ?? "17:00",
      }
    : noGroup
      ? { groupName: "", venue: "", city: "", weekday: 6, time: "20:00", monthlyPrice: 0, maxPlayers: 0, recurring: false, openWeekday: 1, openTime: "17:00" }
      : settings;

  // `scheduledAtIso`: an explicit kickoff timestamp for the *next*
  // occurrence, when the caller picked a real calendar date (e.g. the
  // "Alterar" flow) rather than just editing the weekday/time pattern —
  // otherwise the game row falls back to "next occurrence of weekday".
  const saveSettings = (form, scheduledAtIso) => {
    if (cloudMode) {
      cloud.updateGroupRow({
        name: form.groupName, venue: form.venue, city: form.city, weekday: form.weekday, game_time: form.time,
        monthly_price_cents: Math.round(form.monthlyPrice * 100), max_players: form.maxPlayers,
        recurring: form.recurring, open_weekday: form.openWeekday, open_time: form.openTime,
      }, scheduledAtIso);
    } else {
      // Local demo has no separate "games" row — stash the pinned date
      // (if any) alongside the weekday/time pattern; only touch it when
      // the caller actually provided one, so a general settings edit
      // doesn't silently clear an earlier pin.
      setSettings(scheduledAtIso !== undefined ? { ...form, scheduledAt: scheduledAtIso } : form);
    }
  };

  // Organizer picks an exact calendar date for the next game (not just a
  // weekday) — essential for a far-off or one-off date like "13/09",
  // which "próximo sábado"-style weekday picking can't express.
  const rescheduleGame = (dateIso, time) => {
    const weekday = fromIso(dateIso).getDay();
    saveSettings({ ...groupSettings, weekday, time }, dateTimeFromIso(dateIso, time).toISOString());
  };

  // Organizer adjusts how many players this game needs (default 10).
  const setSpots = (n) => {
    const v = Math.max(2, Math.min(35, n));
    if (cloudMode) cloud.setSpots(v);
    else setSettings((s) => ({ ...s, maxPlayers: v }));
  };

  const me = baseGroup.find((p) => p.isMe);
  const gameId = cloud.game?.id;

  // Teams: array of { id, name, color, players:[playerId] }. Old saves
  // used a { a:[], b:[] } object — ignore those (force a fresh draw).
  // Cloud mode reads/writes the draw on the group's game row (synced to
  // every device); local demo keeps its own localStorage copy.
  const teams = cloudMode
    ? (Array.isArray(cloud.game?.teams) ? cloud.game.teams : null)
    : (Array.isArray(teamsRaw) ? teamsRaw : null);
  // Draw/clear invalidate an earlier confirmation (players shouldn't see a
  // stale lineup); renaming/moving a player doesn't (small edits after
  // confirming just flow through live) — see drawTeams/clearTeams below.
  const updateTeams = (updater, { resetConfirmed = false, drawnBy = false } = {}) => {
    const next = typeof updater === "function" ? updater(teams) : updater;
    if (cloudMode) cloud.updateGameTeams(next, { resetConfirmed, drawnBy });
    else { setTeamsLocal(next); if (resetConfirmed) setTeamsConfirmedLocal(false); }
  };

  // Teams stay a private draft until the organizer taps "Confirmar
  // equipas" — only then do players see the lineup on their Matchday tab.
  const teamsConfirmed = Boolean(teams) && (cloudMode ? Boolean(cloud.game?.teams_confirmed) : teamsConfirmedLocal);
  const confirmTeams = () => { if (cloudMode) cloud.confirmGameTeams(); else setTeamsConfirmedLocal(true); };

  // With more than one organizer/assistant able to draw or confirm, show
  // who did it — avoids "did I already draw these?" confusion.
  const teamsSetByName = cloudMode && cloud.game?.teams_set_by
    ? baseGroup.find((p) => p.uuid === cloud.game.teams_set_by)?.nick ?? null
    : null;
  const teamsConfirmedByName = cloudMode && cloud.game?.teams_confirmed_by
    ? baseGroup.find((p) => p.uuid === cloud.game.teams_confirmed_by)?.nick ?? null
    : null;

  // Live matchday scoring: same idea — synced via cloud.game.live_matchday
  // so a player watching sees the organizer's scores update live, instead
  // of each device holding its own disconnected copy.
  const matchday = cloudMode ? (cloud.game?.live_matchday ?? null) : matchdayLocal;
  const updateMatchday = (updater) => {
    const next = typeof updater === "function" ? updater(matchday) : updater;
    if (cloudMode) cloud.updateGameLiveMatchday(next);
    else setMatchdayLocal(next);
  };

  useEffect(() => {
    if (teamsRaw && !Array.isArray(teamsRaw)) setTeamsLocal(null);
    if (matchdayLocal?.matches?.some((m) => m.homeId === undefined)) setMatchdayLocal(null);
    if (demoSeedV < 1) {
      const oldStaticSeed = history.length === 5 && history[0]?.id === 1 && history[0]?.date === "7 Jun";
      if (oldStaticSeed) setHistory([]);
      if (posts.length === 0) setPosts(DEMO_POSTS);
      if (peerRatings.length === 0) setPeerRatings(DEMO_PEER_RATINGS);
      setDemoSeedV(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ratings: no self-assessment anymore — a player's card is purely the
  // average of what teammates rate them, gated to 3+ ratings so a fresh
  // card can't be "unlocked" by a single opinion (or your own).
  // Cloud: any group member can rate any teammate, everyone's ratings
  // fetched together. Local demo: only "me" has a rating mechanism (the
  // WhatsApp-link + code-paste flow) — other seed players stay as-is.
  const ratingsFor = (p) => {
    if (cloudMode) {
      const rows = (cloud.ratings || []).filter((r) => r.player_id === p.uuid);
      return {
        count: rows.length,
        avgAttrs: rows.length ? averageAttrs(rows.map((r) => r.attrs), p.position) : null,
        raters: rows.map((r) => ({ id: r.rater_id, nick: baseGroup.find((x) => x.uuid === r.rater_id)?.nick || r.rater_name || "?" })),
        myRatingAttrs: rows.find((r) => r.rater_id === me?.uuid)?.attrs ?? null,
      };
    }
    if (p.isMe) {
      return {
        count: peerRatings.length,
        avgAttrs: peerRatings.length ? averageAttrs(peerRatings.map((r) => r.a), p.position) : null,
        raters: peerRatings.map((r) => ({ id: null, nick: r.from || "Anónimo" })),
        myRatingAttrs: null,
      };
    }
    return null; // no gating info → renders unlocked, as before
  };

  const displayGroup = baseGroup.map((p) => {
    const info = ratingsFor(p);
    if (!info) return p;
    return {
      ...p,
      ratingsCount: info.count,
      raters: info.raters,
      myRatingAttrs: info.myRatingAttrs,
      attrs: info.count >= 3 ? info.avgAttrs : p.attrs,
    };
  });

  const addPeerRating = (codeStr) => {
    const rating = decodePayload(codeStr);
    if (!rating?.a || typeof rating.a.rit !== "number") return false;
    setPeerRatings((prev) => [...prev, rating]);
    return true;
  };

  // A brand-new cloud group can skip picking a day/time at onboarding
  // ("Ainda não sei o dia/hora") — no games row exists yet. Only cloud
  // mode can be in this state; local demo always ships with a game.
  const noGameScheduled = cloudMode && !cloud.game;

  // Real kickoff timestamp — prefer the cloud game's own scheduled_at (it
  // may have been pinned to an exact date, possibly weeks out, rather than
  // just "next occurrence of the weekday pattern"). Used both for the
  // header label below and to lock the Fantasy squad 8h before kickoff.
  const kickoffAt = cloud.game?.scheduled_at
    ? new Date(cloud.game.scheduled_at)
    : groupSettings.scheduledAt
      ? new Date(groupSettings.scheduledAt)
      : nextGameDate(groupSettings.weekday, groupSettings.time);

  // The "next game" as the UI consumes it.
  const game = {
    ...groupSettings,
    id: gameId,
    label: groupSettings.groupName,
    date: fmtFullDay(toIsoDay(kickoffAt)),
    spots: groupSettings.maxPlayers,
    priceEach: groupSettings.maxPlayers > 0 ? groupSettings.monthlyPrice / groupSettings.maxPlayers : 0,
    kickoffAt,
    noGameScheduled,
  };

  // Recurring confirmation window (derived): before the weekly open moment,
  // confirmations are closed for everyone.
  const confWin = groupSettings.recurring
    ? confirmationWindow(groupSettings.weekday, groupSettings.time, groupSettings.openWeekday ?? 1, groupSettings.openTime ?? "17:00")
    : { isOpen: true };
  const opensAtLabel = groupSettings.recurring
    ? `${t(WEEKDAYS_PT[groupSettings.openWeekday ?? 1])} ${t("às")} ${groupSettings.openTime ?? "17:00"}`
    : null;

  // ── Contextual opening tab (redesign spec §1) ──────────
  // matchday if a matchday is live → jogar if this week's game awaits MY
  // answer → otherwise home. Same inputs as `needsResponse`/`matchdayHot`
  // further down (those live after the early returns, so they can't feed
  // a hook). Until decided, `tab` falls back to the live computation so
  // the first painted frame is already the right tab (no flash); the
  // effect then FREEZES it the first time the main app's data is ready
  // (local: onboarded session; cloud: status ready / no-group explore),
  // so a matchday going live later never yanks the user away.
  const appDataReady = (localMode && Boolean(session.role && session.onboarded)) || cloudMode || noGroup;
  const hasGameThisWeek = !noGroup && !noGameScheduled
    && kickoffAt.getTime() - Date.now() < 7 * 24 * 3600 * 1000
    && kickoffAt.getTime() - Date.now() > -3 * 3600 * 1000;
  const awaitingMyAnswer = hasGameThisWeek && confWin.isOpen && me?.status === "pending";
  const openingTab = !noGroup && matchday ? "matchday" : awaitingMyAnswer ? "jogar" : "home";
  const tab = tabState ?? openingTab;
  // Home's "Votar MVP" on a game day lands in Competir with the ballot
  // already expanded; any other visit shows it as a one-line card.
  const [competirBallot, setCompetirBallot] = useState(false);
  useEffect(() => { if (tab !== "competir") setCompetirBallot(false); }, [tab]);
  useEffect(() => {
    if (tabState === null && appDataReady) setTabRaw(openingTab);
  }, [tabState, appDataReady, openingTab]);
  // Which of the five tabs people actually use (analytics, consent-gated).
  useEffect(() => { if (tabState !== null) trackEvent("tab_view", { tab: tabState }); }, [tabState]);

  const togglePaid = (id) => {
    const player = baseGroup.find((p) => p.id === id);
    if (cloudMode) cloud.setPaid(!player.paid, player.uuid, gameId);
    else setGroup((g) => g.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));
  };

  const payMine = () => {
    if (cloudMode && me) cloud.setPaid(true, me.uuid, gameId);
    else setGroup((g) => g.map((p) => (p.isMe ? { ...p, paid: true } : p)));
  };

  // Team draws are sticky on purpose — they used to auto-clear on any
  // status change ("roster changed → invalidate draw"), which was fine
  // when a draw was disposable local-only state, but now that it's a
  // shared draft the whole group reads, wiping it every time literally
  // anyone confirms/declines (routine, all week long) silently destroyed
  // the organizer's work. Redraw/"Limpar sorteio" are the explicit way
  // to discard it now.
  // Leaving the game frees just that one slot in whatever team they were
  // drawn into, instead of the organizer having to redraw/"Limpar sorteio"
  // over one person leaving — Matchday's "jogadores sem equipa" section
  // picks up the gap so it can be filled by hand.
  const releaseFromTeams = (playerId) => {
    if (Array.isArray(teams)) updateTeams((ts) => ts.map((tm) => ({ ...tm, players: tm.players.filter((id) => id !== playerId) })));
  };

  const toggleMyStatus = (newStatus) => {
    if (cloudMode && me) {
      cloud.setMyStatus(newStatus, me.uuid, gameId);
      if (newStatus !== "confirmed" && me.paid) cloud.setPaid(false, me.uuid, gameId);
    } else {
      setGroup((g) => g.map((p) => (p.isMe ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false, respondedAt: newStatus === "confirmed" ? new Date().toISOString() : p.respondedAt } : p)));
    }
    if (newStatus !== "confirmed" && me) releaseFromTeams(me.id);
  };

  // Organizer/assistant sets any player's status directly — guests have
  // no account to self-serve with, and this also lets the organizer
  // confirm/remove a registered player who answered outside the app
  // (WhatsApp, in person) instead of waiting for them to tap it themselves.
  const setPlayerStatus = (playerId, newStatus) => {
    const player = baseGroup.find((p) => p.id === playerId);
    if (!player) return;
    if (cloudMode) cloud.setMyStatus(newStatus, player.uuid, gameId);
    else setGroup((g) => g.map((p) => (p.id === playerId ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false, respondedAt: newStatus === "confirmed" ? new Date().toISOString() : p.respondedAt } : p)));
    if (newStatus !== "confirmed") releaseFromTeams(playerId);
  };

  // Organizer permanently removes a guest (no-account) player.
  const removeGuestPlayer = (playerId, nick) => {
    const player = baseGroup.find((p) => p.id === playerId);
    if (!player) return;
    if (!window.confirm(`${t("Apagar")} ${nick}${t("? Esta ação não pode ser desfeita — o jogador sai do grupo e perde o histórico.")}`)) return;
    if (cloudMode) cloud.adminDeletePlayer(player.uuid).then(() => cloud.refetch());
    else setGroup((g) => g.filter((p) => p.id !== playerId));
  };

  // Organizer removes a real member — soft: they keep their account/stats
  // and can rejoin later via a fresh invite, unlike removeGuestPlayer above.
  const removeMember = async (playerId, nick) => {
    const player = baseGroup.find((p) => p.id === playerId);
    if (!player) return;
    if (!window.confirm(`${t("Remover")} ${nick}${t(" do grupo? Pode voltar a entrar com um novo convite.")}`)) return;
    if (cloudMode) {
      const res = await cloud.removeMember(player.uuid, cloud.groupRow.id);
      if (res?.error) window.alert(res.error);
    } else setGroup((g) => g.filter((p) => p.id !== playerId));
  };

  // Banir — stronger than removeMember: also blocks rejoining. The typed
  // "type their nick to confirm" step lives in PerfilTab itself, so no
  // second native confirm() here.
  const banMember = async (playerId) => {
    const player = baseGroup.find((p) => p.id === playerId);
    if (!player) return {};
    if (cloudMode) return await cloud.banMember(player.uuid, cloud.groupRow.id);
    setGroup((g) => g.filter((p) => p.id !== playerId));
    return {};
  };
  const unbanMember = async (playerId) => {
    if (cloudMode) return await cloud.unbanMember(playerId, cloud.groupRow.id);
    return {};
  };

  const clearTeams = () => updateTeams(null, { resetConfirmed: true, drawnBy: true });

  const toggleMaterial = (id) =>
    setMaterial((m) => m.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const assignMaterial = (id, playerId) =>
    setMaterial((m) => m.map((x) => (x.id === id ? { ...x, assignedTo: playerId } : x)));
  const addMaterial = (item) =>
    setMaterial((m) => [...m, { id: Date.now(), item, assignedTo: null, done: false }]);

  const updateProfile = (form) => {
    // Strip the derived rating fields (and attrs, no longer self-editable
    // — only peer ratings set them) so they never get written back as if
    // they were real profile data.
    const { ratingsCount: _rc, raters: _rt, myRatingAttrs: _mra, attrs: _attrs, ...rest } = form;
    if (cloudMode && me) {
      cloud.updatePlayer(me.uuid, {
        name: rest.name, nick: rest.nick, email: rest.email, phone: rest.phone,
        age: rest.age, nationality: rest.nationality, club: rest.club,
        position: rest.position, foot: rest.foot,
        photo_url: rest.photo ?? null,
      });
    } else {
      setGroup((g) => g.map((p) => (p.isMe ? { ...p, ...rest } : p)));
    }
  };

  const toggleInjured = (value) => {
    if (cloudMode && me) cloud.updatePlayer(me.uuid, { injured: value });
    else setGroup((g) => g.map((p) => (p.isMe ? { ...p, injured: value } : p)));
  };

  // OVR-balanced team draw into N (2–6) teams (shared core, also used by
  // the WhatsApp bot): position snake by OVR, then same-position swaps
  // while they shrink the gap between the strongest and weakest team.
  const drawTeams = (numTeams = 2) => {
    // Only those actually playing get drawn — the waiting line sits out.
    const { playing } = splitWaitlist(baseGroup.filter((p) => p.status === "confirmed"), groupSettings.maxPlayers);
    updateTeams(drawTeamsCore(playing, numTeams, { balance: "ovr" }), { resetConfirmed: true, drawnBy: true });
  };

  // "Equilibrar equipas": keeps the current teams (names, sizes, colours)
  // and evens out their average OVR with same-position swaps — for after
  // manual edits. A captain who gets swapped to another team loses the armband.
  const balanceCurrentTeams = () =>
    updateTeams((ts) => {
      if (!Array.isArray(ts) || ts.length < 2) return ts;
      const balanced = balanceTeamsCore(ts, (id) => baseGroup.find((p) => p.id === id));
      return balanced.map((t) => {
        if (t.captainId == null || t.players.includes(t.captainId)) return t;
        const { captainId: _old, ...rest } = t;
        return rest;
      });
    });

  const renameTeam = (teamId, name) =>
    updateTeams((ts) => (Array.isArray(ts) ? ts.map((t) => (t.id === teamId ? { ...t, name } : t)) : ts));

  // Manually move a player to another team (remove everywhere, add to target).
  // A captain who changes team loses the armband.
  const movePlayer = (playerId, toTeamId) =>
    updateTeams((ts) => (Array.isArray(ts)
      ? ts.map((t) => {
          const moved = t.players.includes(playerId) && t.id !== toTeamId;
          const next = { ...t, players: t.id === toTeamId ? [...t.players.filter((id) => id !== playerId), playerId] : t.players.filter((id) => id !== playerId) };
          if (moved && t.captainId === playerId) delete next.captainId;
          return next;
        })
      : ts));

  // Optional per-team captain (shown under the team name on the live score).
  const setTeamCaptain = (teamId, playerId) =>
    updateTeams((ts) => (Array.isArray(ts)
      ? ts.map((t) => {
          if (t.id !== teamId) return t;
          const { captainId: _old, ...rest } = t;
          return playerId == null ? rest : { ...rest, captainId: playerId };
        })
      : ts));

  // Organizer adds a guest player (no account). Overall optional → uniform attrs.
  const addManualPlayer = ({ name, position, overall }) => {
    const clean = name.trim();
    if (!clean) return;
    const o = overall ? Math.max(40, Math.min(99, overall)) : 65;
    const keys = Object.keys(defaultAttrsFor(position));
    const attrs = Object.fromEntries(keys.map((k) => [k, o]));
    const nick = clean.split(/\s+/)[0] || clean;
    if (cloudMode) {
      cloud.addManualPlayer({ name: clean, nick, position, attrs });
    } else {
      setGroup((g) => [...g, { id: Date.now(), name: clean, nick, position, foot: "Direito", attrs, isGuest: true, status: "confirmed", paid: false, goals: 0, assists: 0, mvps: 0, gamesPlayed: 0, wins: 0 }]);
    }
  };

  // ── Live matchday (still local) ────────────────────────
  // People rotate as goalkeeper match to match, so it's never assumed
  // from the fixed `position` field — only used to pre-fill an obvious
  // single candidate; the organizer can always override per match.
  const defaultGkFor = (teamId) => {
    const team = teams?.find((x) => x.id === teamId);
    const gks = (team?.players || []).map((id) => baseGroup.find((p) => p.id === id)).filter((p) => p?.position === "Guarda-redes");
    return gks.length === 1 ? gks[0].id : null;
  };
  // "Personalizado": generates every group-stage fixture upfront (round-
  // robin, single or double-legged) instead of the organizer creating
  // one match at a time.
  const startMatchday = (mode = "avulsa", config) => {
    if (!teams || teams.length < 2) return;
    if (mode === "personalizado" && config) {
      const teamIds = teams.map((tm) => tm.id);
      const fixtures = roundRobinFixtures(teamIds, config.confrontos === "idaEVolta");
      const matches = fixtures.map((f, i) => ({
        id: Date.now() + i, n: i + 1, homeId: f.homeId, awayId: f.awayId,
        homeGkId: defaultGkFor(f.homeId), awayGkId: defaultGkFor(f.awayId),
        events: [], stage: "grupo",
      }));
      updateMatchday({ startedAt: Date.now(), mode, config, matches });
    } else {
      updateMatchday({ startedAt: Date.now(), mode, matches: [{ id: Date.now(), n: 1, homeId: teams[0].id, awayId: teams[1].id, homeGkId: defaultGkFor(teams[0].id), awayGkId: defaultGkFor(teams[1].id), events: [] }] });
    }
  };
  // Personalizado: the organizer can crown a champion by hand (e.g. a
  // format without a play-off); null undoes it.
  const setChampion = (teamId) =>
    updateMatchday((md) => {
      if (!md) return md;
      const { championId: _old, ...rest } = md;
      return teamId == null ? rest : { ...rest, championId: teamId };
    });
  const addMatch = (homeId, awayId) =>
    updateMatchday((md) => ({ ...md, matches: [...md.matches, { id: Date.now(), n: md.matches.length + 1, homeId, awayId, homeGkId: defaultGkFor(homeId), awayGkId: defaultGkFor(awayId), events: [] }] }));
  const addGoal = (matchId, event) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: [...m.events, event] } : m)) }));
  const addEpicSave = (matchId, { teamId, playerId }) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: [...m.events, { teamId, type: "epicSave", playerId }] } : m)) }));
  // Undo a misclicked goal/assist/save — safe any time before "Terminar
  // dia": season stats are only computed from `events` at that point, so
  // there's nothing elsewhere to reconcile.
  const removeMatchEvent = (matchId, eventIndex) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: m.events.filter((_, i) => i !== eventIndex) } : m)) }));
  const setGoalkeeper = (matchId, side, playerId) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, [side]: playerId } : m)) }));
  const setPenaltyWinner = (matchId, teamId) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, penaltyWinnerId: teamId } : m)) }));
  // Explicit lock-in of a fixture's result — distinct from just entering a
  // score, and what drives the Fixtures tab's collapse-on-conclude UI.
  const setMatchConcluded = (matchId, concluded) =>
    updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, concluded } : m)) }));
  // Per-match substitution: swaps who's selectable as scorer/assist/GK for
  // ONE match only — doesn't touch the permanent team draw or any other
  // match. `inId` can belong to any team currently in the draw (a
  // temporary "loan" for this game). Re-subbing the same outgoing player
  // replaces their previous incoming sub instead of stacking.
  const substitutePlayer = (matchId, teamId, outId, inId) =>
    updateMatchday((md) => ({
      ...md,
      matches: md.matches.map((m) => (m.id !== matchId ? m : {
        ...m,
        subs: [...(m.subs || []).filter((s) => !(s.teamId === teamId && s.outId === outId)), { teamId, outId, inId }],
      })),
    }));
  const revertSubstitution = (matchId, teamId, outId) =>
    updateMatchday((md) => ({
      ...md,
      matches: md.matches.map((m) => (m.id !== matchId ? m : { ...m, subs: (m.subs || []).filter((s) => !(s.teamId === teamId && s.outId === outId)) })),
    }));

  // Group stage → play-off (Personalizado only). Seeds the first
  // knockout round from group standings the first time; subsequent
  // clicks progress from the last playoff round's winners. No-ops
  // (silently) if the current round isn't fully decided yet, or if a
  // champion has already been reached.
  const advancePlayoff = () => {
    updateMatchday((md) => {
      if (!md || md.mode !== "personalizado" || !md.config?.faseFinal) return md;
      const goalsOf = (m, teamId) => m.events.filter((e) => e.teamId === teamId && e.type !== "epicSave").length;
      const playoffRoundNums = md.matches.filter((m) => m.stage === "playoff").map((m) => m.round);
      const currentRound = playoffRoundNums.length ? Math.max(...playoffRoundNums) : 0;
      let pairs, round;
      if (currentRound === 0) {
        const groupMatches = md.matches.filter((m) => m.stage === "grupo");
        const standings = computeStandings(teams.map((tm) => tm.id), groupMatches);
        const qualifiers = standings.slice(0, md.config.finalistas).map((s) => s.id);
        pairs = buildKnockoutRound1(qualifiers, md.config.byePrimeiro);
        round = 1;
      } else {
        const roundMatches = md.matches.filter((m) => m.stage === "playoff" && m.round === currentRound);
        const winners = roundMatches.map((m) => (m.isBye ? m.homeId : matchWinner(m, goalsOf(m, m.homeId), goalsOf(m, m.awayId))));
        if (winners.some((w) => !w) || winners.length <= 1) return md;
        pairs = nextKnockoutRound(winners);
        round = currentRound + 1;
      }
      let n = md.matches.length;
      const newMatches = pairs.map(([home, away]) => {
        n++;
        return away === null
          ? { id: Date.now() + n, n, homeId: home, awayId: null, events: [], stage: "playoff", round, isBye: true }
          : { id: Date.now() + n, n, homeId: home, awayId: away, homeGkId: defaultGkFor(home), awayGkId: defaultGkFor(away), events: [], stage: "playoff", round, isBye: false, penaltyWinnerId: null };
      });
      return { ...md, matches: [...md.matches, ...newMatches] };
    });
  };

  const endMatchday = async () => {
    if (!matchday) return;
    if (!window.confirm(t("Terminar o dia de jogo? As stats entram para a época e abre a votação MVP."))) return;

    const stats = {};
    const bump = (id, key) => {
      if (!id) return;
      stats[id] = stats[id] ?? { goals: 0, assists: 0, cleanSheets: 0, wins: 0, epicSaves: 0 };
      stats[id][key] += 1;
    };
    matchday.matches.forEach((m) => m.events.forEach((e) => {
      // Own goals count on the scoreboard (teamId is already the team that
      // benefits) but never bump the player's personal goals tally.
      if (e.type === "epicSave") bump(e.playerId, "epicSaves");
      else if (!e.ownGoal) { bump(e.scorerId, "goals"); bump(e.assistId, "assists"); }
    }));

    const teamsById = Object.fromEntries((teams || []).map((t) => [t.id, t]));
    const keyOf = (p) => (cloudMode ? p.uuid : p.id);
    // Roster snapshot per team (season-stable keys) — lets the Stats tab's
    // player-comparison feature compute "played together" chemistry later.
    // Historical matchdays from before this field existed just won't have
    // it (`t.players` reads undefined there), which the comparison feature
    // treats as "no data yet" rather than erroring.
    const teamResults = (teams || []).map((t) => ({
      id: t.id, name: t.name, color: t.color, wins: 0,
      players: (t.players || []).map((pid) => keyOf(baseGroup.find((x) => x.id === pid))).filter(Boolean),
    }));
    const winsById = Object.fromEntries(teamResults.map((t) => [t.id, t]));
    const mdMatches = [];
    let totalGoals = 0;

    matchday.matches.forEach((m) => {
      const hg = m.events.filter((e) => e.teamId === m.homeId && e.type !== "epicSave").length;
      const ag = m.events.filter((e) => e.teamId === m.awayId && e.type !== "epicSave").length;
      const home = teamsById[m.homeId], away = teamsById[m.awayId];
      totalGoals += hg + ag;
      // Clean sheet for the keeper follows who was actually picked as GR
      // for this match (rotates), not the fixed `position` field; outfield
      // defenders still get it by position as before.
      const awardCleanSheet = (team, conceded, gkId) => {
        if (conceded !== 0 || !team) return;
        if (gkId) bump(gkId, "cleanSheets");
        team.players.forEach((id) => {
          if (id === gkId) return;
          const p = baseGroup.find((x) => x.id === id);
          if (p && p.position === "Defesa") bump(id, "cleanSheets");
        });
      };
      awardCleanSheet(home, ag, m.homeGkId);
      awardCleanSheet(away, hg, m.awayGkId);
      const winId = hg > ag ? m.homeId : ag > hg ? m.awayId : null;
      if (winId) {
        if (winsById[winId]) winsById[winId].wins += 1;
        (teamsById[winId]?.players || []).forEach((id) => bump(id, "wins"));
      }
      // Per-match breakdown (who scored/assisted in THIS game, not just the
      // night's total) — feeds the post-match share card, which shows each
      // game's score alongside what the player themself did in it.
      const matchStats = {};
      const bumpMatch = (id, key) => {
        if (!id) return;
        matchStats[id] = matchStats[id] ?? { goals: 0, assists: 0 };
        matchStats[id][key] += 1;
      };
      m.events.forEach((e) => { if (!e.ownGoal) { bumpMatch(e.scorerId, "goals"); bumpMatch(e.assistId, "assists"); } });
      const matchLines = Object.entries(matchStats).map(([pid, s]) => {
        const p = baseGroup.find((x) => x.id === Number(pid));
        return p ? { key: keyOf(p), goals: s.goals, assists: s.assists } : null;
      }).filter(Boolean);
      // Full per-game record (who scored/assisted, own goals, saves, in order,
      // plus the keepers) so a finished game can be opened again later, like
      // during the live day. Matchdays saved before this field just have
      // `lines` and the UI falls back to that.
      const keyOfId = (id) => { const p = id == null ? null : baseGroup.find((x) => x.id === id); return p ? keyOf(p) : null; };
      const gameEvents = m.events.map((e) => ({
        side: e.teamId === m.homeId ? "h" : "a",
        type: e.type === "epicSave" ? "save" : e.ownGoal ? "og" : "goal",
        by: keyOfId(e.type === "epicSave" ? e.playerId : e.scorerId),
        ...(e.type !== "epicSave" && e.assistId ? { ast: keyOfId(e.assistId) } : {}),
        ...(e.minute != null ? { min: e.minute } : {}),
      }));
      mdMatches.push({
        n: m.n, homeName: home?.name ?? "—", awayName: away?.name ?? "—", homeGoals: hg, awayGoals: ag, lines: matchLines,
        events: gameEvents, homeGk: keyOfId(m.homeGkId), awayGk: keyOfId(m.awayGkId),
      });
    });

    // Waitlisted players didn't play — only the playing XI gets stats.
    const { playing } = splitWaitlist(baseGroup.filter((p) => p.status === "confirmed"), groupSettings.maxPlayers);
    const playingIds = new Set(playing.map((p) => p.id));
    const confirmed = playing;
    const date = fmtDayMonth(isoDay(0));

    // Display-ready per-player lines (who did what today), sorted.
    const lines = Object.entries(stats)
      .map(([lid, s]) => {
        const p = baseGroup.find((x) => x.id === Number(lid));
        return p ? { key: keyOf(p), nick: p.nick, name: p.name, photo: p.photo, isMe: p.isMe, color: playerColor(baseGroup, p), goals: s.goals, assists: s.assists, cleanSheets: s.cleanSheets, epicSaves: s.epicSaves, wins: s.wins } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists));
    const candidates = confirmed.map((p) => ({ key: keyOf(p), nick: p.nick, position: p.position }));
    const championId = matchday.mode === "personalizado" ? (matchday.championId ?? playoffState(matchday).champion) : null;
    const championName = championId ? teamsById[championId]?.name : null;
    const summary = { teamResults: teamResults.map(({ id, ...r }) => r), matches: mdMatches, lines, candidates, ...(championName ? { champion: championName } : {}) };

    if (cloudMode) {
      // Bump season totals on each player row + record the matchday;
      // MVP voting opens in the cloud for everyone.
      const statsByUuid = {};
      baseGroup.forEach((p) => {
        const s = stats[p.id];
        const played = playingIds.has(p.id);
        if (!s && !played) return;
        statsByUuid[p.uuid] = { goals: s?.goals ?? 0, assists: s?.assists ?? 0, cleanSheets: s?.cleanSheets ?? 0, wins: s?.wins ?? 0, epicSaves: s?.epicSaves ?? 0, played };
      });
      const res = await cloud.commitMatchday({ statsByUuid, summary, totalGoals, mode: matchday.mode, nGames: matchday.matches.length });
      if (res?.fantasyError) {
        window.alert(t("As stats da época foram gravadas, mas a pontuação da Fantasy falhou para este dia. Vai a Manager e usa \"Sincronizar\" para recuperar esta ronda.") + `\n\n(${res.fantasyError})`);
      }
    } else {
      setGroup((g) => g.map((p) => {
        const s = stats[p.id];
        const played = playingIds.has(p.id);
        if (!s && !played) return p;
        return { ...p, goals: p.goals + (s?.goals ?? 0), assists: p.assists + (s?.assists ?? 0), gamesPlayed: p.gamesPlayed + (played ? 1 : 0), wins: (p.wins || 0) + (s?.wins ?? 0) };
      }));
      setHistory((h) => [{ id: Date.now(), date, playedOn: isoDay(0), confirmed: confirmed.length, result: `${totalGoals}⚽`, allPaid: confirmed.every((p) => p.paid), mvpId: null, games: matchday.matches.length }, ...h]);
      setLastMatchday({ date, playedOn: isoDay(0), mode: matchday.mode, ...summary });
      setMvpVote({ open: true, votes: { 1: null, 2: null, 3: null } });
      setMatchdayLocal(null);
    }
    // Cloud mode: cloud.commitMatchday already clears games.live_matchday
    // server-side (and refetch() picks that up) — no local mirror to reset.
  };

  // Abandon a matchday started by mistake (wrong teams, wrong mode…).
  // Safe to do any time before "Terminar dia": season stats are only
  // written there, so discarding the live matchday here touches nothing
  // already saved — it just clears games.live_matchday / matchdayLocal
  // back to null so the organizer sees the "Começar dia de jogo" screen
  // again. Team draw is untouched (use "Limpar sorteio" for that).
  const cancelMatchday = () => {
    if (!matchday) return;
    if (!window.confirm(t("Cancelar o dia de jogo em curso? Todos os golos e resultados registados até agora são apagados. As stats da época não são afetadas — ainda não foram gravadas.")))
      return;
    updateMatchday(null);
  };

  // League → Records: delete an already-finished matchday (cloud only —
  // local demo has no per-round breakdown saved to reverse cleanly).
  // deleteMatchday reverses exactly what that day added to season totals.
  const deleteMatchdayRecord = async (matchdayId, dateLabel) => {
    if (!cloudMode) return;
    if (!window.confirm(`${t("Apagar o dia de jogo de")} ${dateLabel}? ${t("As stats desse dia são retiradas da época de cada jogador. Esta ação não pode ser desfeita.")}`))
      return;
    const res = await cloud.deleteMatchday(matchdayId);
    if (res?.error) window.alert(res.error);
  };

  // ── Club: events + bookings ────────────────────────────
  const cloudEvents = cloudAuthed
    ? cloud.events.map((e) => ({
        id: e.id, emoji: e.emoji, title: e.title, date: e.day, time: e.event_time,
        desc: e.description, kind: e.kind, price: (e.price_cents || 0) / 100,
        going: e.going ?? 0, myStatus: eventStatus[e.id] ?? null,
      }))
    : events;

  const cloudBookings = cloudAuthed
    ? cloud.bookings.map((b) => ({
        id: b.id, court: b.court, date: b.day, hour: b.hour,
        groupName: b.groups?.name ?? "Reservado", mine: b.group_id === cloud.groupRow?.id,
      }))
    : bookings;

  const toggleBooking = (court, date, hour) => {
    if (cloudMode) {
      const mine = cloud.bookings.find((b) => b.court === court && b.day === date && b.hour === hour && b.group_id === cloud.groupRow?.id);
      if (mine) cloud.removeBooking(mine.id);
      else cloud.addBooking(court, date, hour);
    } else {
      setBookings((bs) => {
        const mine = bs.find((b) => b.court === court && b.date === date && b.hour === hour && b.mine);
        if (mine) return bs.filter((b) => b !== mine);
        return [...bs, { id: Date.now(), court, date, hour, groupName: groupSettings.groupName, mine: true }];
      });
    }
  };

  const rsvpEvent = (id, cancel = false) => {
    if (cloudAuthed) setEventStatus((s) => ({ ...s, [id]: cancel ? null : "going" }));
    else setEvents((es) => es.map((e) => (e.id === id ? { ...e, myStatus: cancel ? null : "going" } : e)));
  };
  const payEvent = (id) => {
    if (cloudAuthed) setEventStatus((s) => ({ ...s, [id]: "paid" }));
    else setEvents((es) => es.map((e) => (e.id === id ? { ...e, myStatus: "paid" } : e)));
  };

  const joinOpenMatch = (id) =>
    setOpenMatches((ms) => ms.map((m) => (m.id === id && m.spotsLeft > 0 ? { ...m, spotsLeft: m.spotsLeft - 1, joined: true } : m)));

  const openProfile = (id) => { setViewPlayerId(id); setSettingsView(null); setTab("perfil"); };
  const backToMe = () => setViewPlayerId(null);

  // ── Session / auth gating ──────────────────────────────
  const logout = () => {
    if (cloudMode || cloud.user) cloud.signOut();
    setSession({ role: null, onboarded: false });
    setAuthOpen(false);
    setPendingRole(null);
    setNoGroupOptIn(false);
    setManualJoinChoice(null);
    setJoinToken(null);
    setTabRaw(null); // next login re-runs the contextual opening tab
  };
  const backToRolePick = () => setSession({ role: null, onboarded: false });

  // Global sign-out (all devices): Supabase revokes every session; the
  // auth listener then drops this one — just reset the local shell state.
  const signOutEverywhere = async () => {
    const res = await cloud.signOutEverywhere();
    if (!res?.error) {
      setSession({ role: null, onboarded: false });
      setAuthOpen(false);
      setPendingRole(null);
      setNoGroupOptIn(false);
      setManualJoinChoice(null);
      setJoinToken(null);
    }
    return res;
  };

  // Local-demo role pick (no Supabase).
  const handlePickRole = (role) => setSession({ role, onboarded: false });

  const resetDemo = () => {
    if (window.confirm(t("Repor os dados de demonstração? As alterações locais serão perdidas."))) {
      clearAppStorage();
      window.location.reload();
    }
  };

  const shell = (children) => (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", color: C.text1, fontFamily: APP_FONT }}>
      {children}
    </div>
  );

  // ── "Rate me" link (?rate=payload) — no login needed ───
  const rateParam = new URLSearchParams(window.location.search).get("rate");
  if (rateParam) {
    return shell(<RatePlayer payload={rateParam.replace(/ /g, "+")} />);
  }

  // ── Magic-link confirmation (?confirm=<magic_token>) — no login ───
  const confirmParam = new URLSearchParams(window.location.search).get("confirm");
  if (confirmParam) {
    const gameParam = new URLSearchParams(window.location.search).get("game");
    return shell(<MagicConfirm token={confirmParam.trim()} gameId={gameParam ? gameParam.trim() : null} />);
  }

  // ── Password recovery: landed from the reset email → set a new one ───
  if (cloud.recovery) {
    return shell(<ResetPassword onSubmit={cloud.updatePassword} onCancel={cloud.clearRecovery} />);
  }

  // ── PITCH League MVP marketing page (path /league) — full width, no shell ───
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/league") {
    return <LeaguePage onEnterApp={() => { window.location.href = "/"; }} />;
  }

  // ── PITCH Rivals (Teams & Challenges) early-access landing (path /rivals,
  // alias /desafios) — full width, no shell, public, works logged-out. ───
  if (path === "/rivals" || path === "/desafios") {
    return <RivalsPage />;
  }

  // ── Desktop admin dashboard (path /admin) — full width, no shell, own
  // auth gate (same cloud.isAdmin check as the in-app mobile panel). ───
  if (path === "/admin") {
    return <AdminDashboardPage cloud={cloud} localMode={localMode} />;
  }

  // ── Business plan / roadmap (path /roadmap) — full width, no shell,
  // admin-only (financial projections, not meant to be discoverable). ───
  if (path === "/roadmap") {
    return <RoadmapPage cloud={cloud} localMode={localMode} />;
  }

  // ── Pitch deck (path /pitch-deck) — full width, no shell, public
  // (meant to be shared by link with investors). ──────────────────────
  if (path === "/pitch-deck") {
    return <PitchDeckPage />;
  }

  // ── PITCH Pro (path /pro) — clickable demo of a Pro competition
  // (standalone, seed data only — no real backend/tenancy yet). Public,
  // same call as /league and /pitch-deck: needs to open with just a link
  // for a meeting, no login friction. ─────────────────────────────────
  if (path === "/pro") {
    return <PitchProPage />;
  }

  // ── Pricing (path /pricing) — full width, no shell, public. Knows who is
  // logged in and which groups they organize so "Upgrade group" can ask
  // WHICH group; checkout itself is a stub until billing exists. ───────
  if (path === "/pricing") {
    const managedGroups = cloudMode
      ? (cloud.myGroups ?? []).filter((m) => !m.banned && (m.role === "organizer" || m.role === "assistant"))
          .map((m) => ({ id: m.group_id, name: m.groups?.name || "—" }))
      : [];
    return <PricingPage user={cloudAuthed ? cloud.user : null} managedGroups={managedGroups} lang={lang} onLang={changeLang} />;
  }

  // ── Legal pages (paths /privacidade, /termos) — full width, no shell,
  // public. Static content, see LegalPage.jsx. ────────────────────────
  if (path === "/privacidade") {
    return <LegalPage type="privacy" />;
  }
  if (path === "/termos") {
    return <LegalPage type="terms" />;
  }

  // Default profile from the signed-up account's metadata.
  const meta = cloud.user?.user_metadata || {};
  const profileDefaults = {
    name: meta.name || "", nick: (meta.name || "").split(" ")[0] || "",
    phone: meta.phone || "", age: 25, nationality: "🇵🇹 Portugal", club: "FC Porto",
    position: "Médio", foot: "Direito", attrs: { ...defaultAttrsFor("Médio") },
  };

  // Owner-only admin overview of every group. Reachable from ANY logged-in
  // state and via the ?admin=1 deep link. If the viewer isn't an admin, it
  // says exactly why (demo mode / not logged in / wrong email) instead of
  // silently showing nothing.
  if (adminOpen) {
    if (cloud.isAdmin) {
      return shell(
        <AdminPanel
          fetchAdminData={cloud.fetchAdminData}
          actions={{
            updateGroup: cloud.adminUpdateGroup,
            deleteGroup: cloud.adminDeleteGroup,
            updatePlayer: cloud.adminUpdatePlayer,
            deletePlayer: cloud.adminDeletePlayer,
          }}
          isFantasyAdmin={cloud.isFantasyAdmin}
          fetchFantasyAdminData={cloud.fetchFantasyAdminData}
          onBack={() => setAdminOpen(false)}
        />
      );
    }
    const reason = localMode
      ? (cloud.status === "off"
          ? "A app está em modo demonstração (sem chaves Supabase). O painel de admin precisa de modo cloud."
          : "A ligação à cloud falhou — a app caiu para modo demonstração. Verifica o Supabase/base de dados. O painel precisa de modo cloud.")
      : !cloud.user
        ? "Não há sessão iniciada. Inicia sessão com a conta de administrador."
        : `Sessão iniciada como ${cloud.user.email}, que não é uma conta de administrador.`;
    return shell(
      <div style={{ padding: "32px 20px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>Painel de administrador</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{reason}</div>
        <div style={{ fontSize: 11, color: C.text3, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, lineHeight: 1.7 }}>
          modo: <b style={{ color: C.text1 }}>{localMode ? "demo" : "cloud"}</b> · estado: <b style={{ color: C.text1 }}>{cloud.status}</b><br />
          sessão: <b style={{ color: C.text1 }}>{cloud.user?.email || "—"}</b><br />
          contas admin: <b style={{ color: C.text1 }}>{ADMIN_EMAILS.join(", ")}</b>
        </div>
        {!localMode && !cloud.user && (
          <BtnPrimary onClick={() => { setAdminOpen(false); setAuthOpen(true); }} style={{ width: "100%" }}>Iniciar sessão</BtnPrimary>
        )}
        <button onClick={() => setAdminOpen(false)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 12, padding: 11, fontSize: 13, color: C.text2, cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }

  // ═══ CLOUD MODE GATING ═════════════════════════════════
  if (!localMode) {
    if (cloud.status === "loading") {
      return shell(
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <img src={BRAND.logo} alt="PITCH App" style={{ height: 30 }} />
          <KeepyUppyLoader />
          <div style={{ fontSize: 13, color: C.text2 }}>{t("A ligar ao clube…")}</div>
        </div>
      );
    }

    if (cloud.status === "anon") {
      if (!authOpen) return <LandingPage onEnter={() => setAuthOpen(true)} lang={lang} onLang={changeLang} />;
      return shell(<AuthForm onSignUp={cloud.signUp} onSignIn={cloud.signIn} onResetPassword={cloud.resetPassword} onBack={() => setAuthOpen(false)} lang={lang} onLang={changeLang} />);
    }

    if (cloud.status === "needsProfile") {
      if (!pendingRole) {
        return shell(<AuthLanding onPick={setPendingRole} onBack={logout} isAdmin={cloud.isAdmin} onOpenAdmin={() => setAdminOpen(true)} />);
      }
      if (pendingRole === "player") {
        // Unified group-join sequence: resolve the group FIRST (either
        // already vinculado via the ?join= link, or by pasting a code /
        // explicitly skipping here), THEN show the quick cartão — never
        // the other way round, which used to make a cold signup fill in
        // a full profile before ever being asked which group they're in.
        const needsLinkStep = !joinToken && manualJoinChoice === null;
        if (needsLinkStep) {
          return shell(
            <JoinGroup
              onJoin={async (code) => {
                const res = await cloud.resolveInviteToken(code);
                if (res.error) return res;
                setManualJoinChoice(code);
                return {};
              }}
              onSkip={() => setManualJoinChoice("skip")}
              onLogout={logout}
              isAdmin={cloud.isAdmin}
              onOpenAdmin={() => setAdminOpen(true)}
            />
          );
        }
        const effectiveToken = joinToken || (manualJoinChoice !== "skip" ? manualJoinChoice : null);
        return shell(
          <OnboardingPlayer
            quick
            me={profileDefaults}
            onBack={() => { setPendingRole(null); setManualJoinChoice(null); }}
            onDone={async (form) => {
              const res = await cloud.joinGroupWithProfile(effectiveToken, form);
              setJoinToken(null);
              // No group attached (explicit "ainda não tenho grupo", or a
              // token that went stale between the pre-step check and now)
              // — skip straight to exploring the app instead of bouncing
              // back into the needsGroup JoinGroup screen a second time.
              if (!effectiveToken || res?.error) setNoGroupOptIn(true);
            }}
            uploadMedia={uploadMedia}
          />
        );
      }
      return shell(
        <OnboardingOrganizer
          settings={DEFAULT_SETTINGS}
          onBack={() => setPendingRole(null)}
          onDone={(form) => cloud.createGroupAsOrganizer(form, { ...profileDefaults, name: profileDefaults.name || cloud.user.email, nick: profileDefaults.nick || "Eu" })}
        />
      );
    }

    if (cloud.status === "needsGroup" && !noGroupOptIn) {
      return shell(<JoinGroup onJoin={cloud.joinGroupByToken} onLogout={logout} onSkip={() => setNoGroupOptIn(true)} isAdmin={cloud.isAdmin} onOpenAdmin={() => setAdminOpen(true)} />);
    }
    // status 'ready' → fall through to the app
  } else {
    // ═══ LOCAL DEMO GATING ═══════════════════════════════
    if (!session.role) {
      if (!authOpen) return <LandingPage onEnter={() => setAuthOpen(true)} lang={lang} onLang={changeLang} />;
      return shell(<AuthLanding onPick={handlePickRole} onBack={() => setAuthOpen(false)} isDemo />);
    }
    if (!session.onboarded) {
      return shell(
        session.role === "player" ? (
          <OnboardingPlayer me={me} onBack={backToRolePick} uploadMedia={uploadMedia}
            onDone={(form) => { updateProfile(form); setSession((s) => ({ ...s, onboarded: true })); }} />
        ) : (
          <OnboardingOrganizer settings={settings} onBack={backToRolePick}
            onDone={(form) => { setSettings(form); setSession((s) => ({ ...s, onboarded: true })); }} />
        )
      );
    }
  }

  // Organizer re-editing group settings from the profile tab
  if (editingGroup) {
    return shell(
      <OnboardingOrganizer
        settings={groupSettings}
        isEditing
        onBack={() => setEditingGroup(false)}
        onDone={(form) => { saveSettings(form); setEditingGroup(false); }}
        hasGame={cloudMode && Boolean(cloud.game)}
        onCancelGame={cloudMode ? cloud.cancelGame : null}
      />
    );
  }

  // A player with no group yet starting their own from the Perfil tab —
  // reuses their existing player row, doesn't sign up again. Only reachable
  // while noGroup (see the button's gating in PerfilTab): someone already
  // in a group can't get here, so there's no group to leave/switch from.
  if (creatingGroup) {
    return shell(
      <OnboardingOrganizer
        settings={DEFAULT_SETTINGS}
        onBack={() => setCreatingGroup(false)}
        onDone={async (form) => {
          await cloud.becomeOrganizer(form);
          setCreatingGroup(false);
        }}
      />
    );
  }

  const isOrganizer = cloudMode ? Boolean(me?.isOrganizerPlayer) : session.role === "organizer";
  const inviteUrl = cloudMode && cloud.groupRow?.invite_token
    ? `${window.location.origin}?join=${cloud.groupRow.invite_token}`
    : null;
  // Second link: joining through it marks the new player as an avulso
  // (waitlist by default) instead of a mensalista — see joinGroupByToken.
  const inviteUrlAvulso = cloudMode && cloud.groupRow?.invite_token_avulso
    ? `${window.location.origin}?join=${cloud.groupRow.invite_token_avulso}`
    : null;

  // ── Normalized views for Stats/MVP (shared between cloud & local) ──
  const nickByKey = (key) => baseGroup.find((p) => (cloudMode ? p.uuid : p.id) === key)?.nick;

  // Points per ballot slot when tallying the local-demo top-3 (mirrors
  // MVP_BALLOT_POINTS in useCloud.js — kept in sync manually since local
  // demo has no shared module for it).
  const MVP_BALLOT_POINTS = { 1: 3, 2: 2, 3: 1 };

  let lastMatchdayView = null, historyView = [], matchdaySummariesView = [], recordsView = [], mvp = null;
  let localDays = []; // local demo only — newest first, see the else-branch below
  if (cloudMode) {
    const rows = cloud.matchdays;
    // Raw per-day team results (name/color/goals) for the Stats tab's
    // "melhor ataque/defesa num dia" records — teams are redrawn fresh
    // every matchday (no persistent team identity to sum a season total
    // over), so this stays a per-day record list, not a season table.
    matchdaySummariesView = rows.map((r) => ({ date: fmtDayMonth(r.played_on), summary: r.summary }));
    // League → Records: full per-day detail (games/stats/MVP), expandable,
    // deletable by the organizer.
    recordsView = rows.map((r) => ({
      id: r.id, date: fmtDayMonth(r.played_on), playedOn: r.played_on, nGames: r.n_games, totalGoals: r.total_goals, mode: r.mode,
      mvpOpen: r.mvp_open, mvpNick: r.mvp_id ? nickByKey(r.mvp_id) : null,
      runnerUpNick: r.runner_up_id ? nickByKey(r.runner_up_id) : null, thirdNick: r.third_id ? nickByKey(r.third_id) : null,
      summary: r.summary,
    }));
    const last = rows[0];
    if (last) {
      lastMatchdayView = { date: fmtDayMonth(last.played_on), mode: last.mode, ...(last.summary || {}) };
      const tally = {};
      cloud.mvpVotes.forEach((v) => { tally[v.voted_for_id] = (tally[v.voted_for_id] || 0) + (MVP_BALLOT_POINTS[v.rank] || 0); });
      const myVotes = { 1: null, 2: null, 3: null };
      cloud.mvpVotes.filter((v) => v.voter_id === cloud.myPlayer?.id).forEach((v) => { myVotes[v.rank] = v.voted_for_id; });
      mvp = {
        open: last.mvp_open,
        candidates: last.summary?.candidates ?? [],
        myVotes,
        tally,
        podium: !last.mvp_open ? {
          first: last.mvp_id ? nickByKey(last.mvp_id) : null,
          second: last.runner_up_id ? nickByKey(last.runner_up_id) : null,
          third: last.third_id ? nickByKey(last.third_id) : null,
        } : null,
        canClose: isOrganizer,
        onVote: (rank, key) => cloud.castMvpVote(last.id, key, rank),
        onClear: (rank) => cloud.clearMvpVote(last.id, rank),
        onClose: () => cloud.closeMvp(last.id),
      };
    }
    historyView = rows.map((r) => ({
      id: r.id, date: fmtDayMonth(r.played_on), result: `${r.total_goals}⚽`,
      confirmed: r.summary?.candidates?.length ?? 0, games: r.n_games,
      mvpNick: r.mvp_id ? nickByKey(r.mvp_id) : null,
    }));
  } else {
    // Local demo: the user's own last matchday (if they ran one here) on
    // top of the dated demo seed (lib/demoSeed — weekly games going back
    // ~2 months from today). The newest seed night stands in as "last
    // matchday" until the user plays one, with its MVP vote open.
    const seedLatest = DEMO_MATCHDAYS[0];
    const effLast = lastMatchday ? { ...lastMatchday, date: lastMatchday.playedOn ? fmtDayMonth(lastMatchday.playedOn) : lastMatchday.date } : (seedLatest
      ? { date: fmtDayMonth(seedLatest.playedOn), playedOn: seedLatest.playedOn, mode: seedLatest.mode, ...seedLatest.summary }
      : null);
    const localMvpKey = !mvpVote.open ? mvpVote.votes[1] : null;
    localDays = [
      ...(lastMatchday ? [{ id: "local-last", playedOn: lastMatchday.playedOn ?? null, date: effLast.date, mode: lastMatchday.mode, summary: lastMatchday, mvpKey: localMvpKey }] : []),
      ...DEMO_MATCHDAYS.map((d, i) => ({
        id: d.id, playedOn: d.playedOn, date: fmtDayMonth(d.playedOn), mode: d.mode, summary: d.summary,
        mvpKey: i === 0 && !lastMatchday ? localMvpKey : d.mvpKey,
      })),
    ];
    recordsView = localDays.map((d, i) => ({
      id: d.id, date: d.date, playedOn: d.playedOn, mode: d.mode,
      nGames: (d.summary.matches || []).length,
      totalGoals: (d.summary.matches || []).reduce((s, m) => s + (m.homeGoals || 0) + (m.awayGoals || 0), 0),
      mvpOpen: i === 0 && mvpVote.open, mvpNick: d.mvpKey != null ? nickByKey(d.mvpKey) : null,
      runnerUpNick: null, thirdNick: null,
      summary: d.summary,
    }));
    matchdaySummariesView = localDays.map((d) => ({ date: d.date, summary: d.summary }));
    lastMatchdayView = effLast;
    // User-run rows first, then the live demo seed rows (the newest seed
    // row's MVP comes from the local vote while it stands in as "last").
    const userHistory = history.filter((g) => !String(g.id).startsWith("demo-"));
    const seedHistory = DEMO_HISTORY.map((g, i) => (i === 0 && !lastMatchday ? { ...g, mvpId: localMvpKey } : g));
    historyView = [...userHistory, ...seedHistory].map((g) => ({ ...g, date: g.playedOn ? fmtDayMonth(g.playedOn) : g.date, mvpNick: g.mvpId ? baseGroup.find((p) => p.id === g.mvpId)?.nick : null }));
    if (effLast) {
      mvp = {
        open: mvpVote.open,
        candidates: effLast.candidates ?? [],
        myVotes: mvpVote.votes,
        tally: null,
        podium: !mvpVote.open ? {
          first: mvpVote.votes[1] ? baseGroup.find((p) => p.id === mvpVote.votes[1])?.nick : null,
          second: mvpVote.votes[2] ? baseGroup.find((p) => p.id === mvpVote.votes[2])?.nick : null,
          third: mvpVote.votes[3] ? baseGroup.find((p) => p.id === mvpVote.votes[3])?.nick : null,
        } : null,
        canClose: true,
        onVote: (rank, key) => setMvpVote((v) => ({ ...v, votes: { ...v.votes, [rank]: v.votes[rank] === key ? null : key } })),
        onClear: (rank) => setMvpVote((v) => ({ ...v, votes: { ...v.votes, [rank]: null } })),
        onClose: () => {
          const winner = mvpVote.votes[1];
          if (winner) {
            setGroup((g) => g.map((p) => (p.id === winner ? { ...p, mvps: (p.mvps || 0) + 1 } : p)));
            setHistory((h) => h.map((item, i) => (i === 0 ? { ...item, mvpId: winner } : item)));
          }
          setMvpVote((v) => ({ ...v, open: false }));
        },
      };
    }
  }

  // Only the organizer (or an assistant they appointed) draws/renames.
  const canManageTeams = cloudMode ? Boolean(me?.isOrganizerPlayer || me?.isAssistant) : session.role === "organizer";

  // ── Cross-group home feed: "my" recent activity + next game across
  //    every group I'm in, not just whichever one is currently active
  //    (see useCloud.js's crossGroupGames/crossGroupMatchdays — those
  //    two queries deliberately exclude the active group since it's
  //    already covered by `game`/cloud.matchdays above). Local demo has
  //    no multi-group concept, so this stays empty there. ──
  let homeFeedView = [], nextGameAcrossGroups = null, personalRecords = null, attendanceStreak = 0, recentPerformance = null;
  if (cloudMode) {
    const myKey = me?.uuid;
    const allMatchdays = [
      ...cloud.matchdays.map((r) => ({ ...r, groupName: game.groupName })),
      ...cloud.crossGroupMatchdays.map((r) => ({ ...r, groupName: r.groups?.name })),
    ].sort((a, b) => (b.played_on || "").localeCompare(a.played_on || "") || (b.created_at || "").localeCompare(a.created_at || ""));

    // Current streak: consecutive matchdays (most recent first, across
    // every group) this player has a line in — stops at the first one
    // they sat out (or never joined).
    for (const md of allMatchdays) {
      if (!(md.summary?.lines || []).some((l) => l.key === myKey)) break;
      attendanceStreak += 1;
    }

    // Kudos already given per (matchday, recipient) — a Map keyed by
    // "matchdayId:playerId" so the feed below can attach count + whether
    // I've already reacted, without a second pass over matchdayKudos.
    const kudosByLine = new Map();
    cloud.matchdayKudos.forEach((k) => {
      const key = `${k.matchday_id}:${k.to_player_id}`;
      kudosByLine.set(key, [...(kudosByLine.get(key) || []), k.from_player_id]);
    });

    const myLines = allMatchdays
      .map((r) => {
        const line = (r.summary?.lines || []).find((l) => l.key === myKey);
        if (!line) return null;
        const givers = kudosByLine.get(`${r.id}:${myKey}`) || [];
        return {
          id: r.id, date: fmtDayMonth(r.played_on), groupName: r.groupName,
          goals: line.goals || 0, assists: line.assists || 0, cleanSheets: line.cleanSheets || 0, mvp: r.mvp_id === myKey,
          kudosCount: givers.length, kudosGivenByMe: givers.includes(myKey),
        };
      })
      .filter(Boolean);
    homeFeedView = myLines.slice(0, 8);

    // Records within the fetched window (last ~12 active-group + ~20
    // cross-group matchdays — not a true lifetime total, see the "últimas
    // jornadas" note in the UI). Cheap to compute, no extra query.
    if (myLines.length) {
      const bestNight = [...myLines].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
      personalRecords = {
        bestNight,
        totalGoals: myLines.reduce((s, l) => s + l.goals, 0),
        totalAssists: myLines.reduce((s, l) => s + l.assists, 0),
        mvps: myLines.filter((l) => l.mvp).length,
        gamesInWindow: myLines.length,
      };
    }

    // The "just played" share banner on Home — the player's single most
    // recent performance, still carrying the raw matchday row (not just
    // the slim feed-item shape) so PostMatchCardModal can render the real
    // share card for it, same as the Stats tab's "Gerar o meu card"
    // already does for the active group — just no longer limited to it.
    if (myLines[0]) {
      const recentLine = myLines[0];
      const row = allMatchdays.find((r) => r.id === recentLine.id);
      recentPerformance = {
        ...recentLine,
        isRecord: Boolean(personalRecords && personalRecords.bestNight.id === recentLine.id && recentLine.goals + recentLine.assists > 0),
        matchdayForCard: row ? { date: recentLine.date, mode: row.mode, ...(row.summary || {}) } : null,
      };
    }

    const otherUpcoming = cloud.crossGroupGames
      .map((g) => ({ groupName: g.groups?.name, scheduledAt: new Date(g.scheduled_at), venue: g.venue }))
      .filter((g) => g.scheduledAt >= new Date());
    const candidates = noGameScheduled ? otherUpcoming : [{ groupName: game.groupName, scheduledAt: game.kickoffAt, venue: game.venue }, ...otherUpcoming];
    const soonest = candidates.sort((a, b) => a.scheduledAt - b.scheduledAt)[0] ?? null;
    nextGameAcrossGroups = soonest ? {
      groupName: soonest.groupName, venue: soonest.venue,
      dateLabel: fmtFullDay(toIsoDay(soonest.scheduledAt)),
      timeLabel: lisbonTimeLabel(soonest.scheduledAt),
    } : null;
  } else if (localMode && me) {
    // Local demo: same streak / records as cloud, from the seeded days.
    const played = (d) => (d.summary?.candidates || []).some((c) => c.key === me.id) || (d.summary?.lines || []).some((l) => l.key === me.id);
    for (const d of localDays) {
      if (!played(d)) break;
      attendanceStreak += 1;
    }
    const myLines = localDays.filter(played).map((d) => {
      const line = (d.summary?.lines || []).find((l) => l.key === me.id) || {};
      return { id: d.id, date: d.date, goals: line.goals || 0, assists: line.assists || 0, mvp: d.mvpKey === me.id };
    });
    if (myLines.length) {
      personalRecords = {
        bestNight: [...myLines].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0],
        totalGoals: myLines.reduce((s, l) => s + l.goals, 0),
        totalAssists: myLines.reduce((s, l) => s + l.assists, 0),
        mvps: myLines.filter((l) => l.mvp).length,
        gamesInWindow: myLines.length,
      };
    }
  }

  // ── Achievements: normalized per-matchday detail (cloud keeps the full
  // season, local demo only keeps this level of detail for the day just
  // played) — feeds AchievementsSection in PerfilTab. `key` matches keyOf()
  // from endMatchday (uuid in cloud, numeric id in local).
  const achievementMatchdays = cloudMode
    ? cloud.matchdays.map((r) => ({ matches: r.summary?.matches ?? [], nightLines: r.summary?.lines ?? [], mvpKey: r.mvp_id ?? null }))
    : localDays.map((d) => ({ matches: d.summary?.matches ?? [], nightLines: d.summary?.lines ?? [], mvpKey: d.mvpKey ?? null }));

  // ── Social: normalized for SocialTab (cloud or local) ──
  let social;
  if (cloudAuthed) {
    const myUuid = cloud.myPlayer?.id;
    const accepted = cloud.friendships.filter((f) => f.status === "accepted");
    const friendIds = accepted.map((f) => (f.requester_id === myUuid ? f.addressee_id : f.requester_id));
    const relatedIds = new Set(cloud.friendships.map((f) => (f.requester_id === myUuid ? f.addressee_id : f.requester_id)));
    const pAll = (id) => cloud.allPlayers.find((x) => x.id === id);
    social = {
      meId: myUuid, myGroupId: cloud.groupRow?.id,
      posts: cloud.posts.map((p) => ({
        id: p.id,
        author: { id: p.author?.id, nick: p.author?.nick, name: p.author?.name, photo: p.author?.photo_url, groupId: p.author?.group_id },
        mine: p.author?.id === myUuid,
        time: relativeTime(p.created_at), type: p.type, text: p.body, media: p.media_url,
        likes: (p.post_likes || []).map((l) => l.player_id),
        liked: (p.post_likes || []).some((l) => l.player_id === myUuid),
        comments: (p.post_comments || []).map((c) => ({ id: c.id, nick: c.author?.nick, photo: c.author?.photo_url, text: c.body })),
      })),
      friendIds,
      friends: friendIds.map(pAll).filter(Boolean),
      requests: cloud.friendships.filter((f) => f.status === "pending" && f.addressee_id === myUuid)
        .map((f) => ({ id: f.id, player: pAll(f.requester_id) })).filter((r) => r.player),
      sentPending: cloud.friendships.filter((f) => f.status === "pending" && f.requester_id === myUuid).map((f) => f.addressee_id),
      candidates: cloud.allPlayers.filter((x) => x.id !== myUuid && !relatedIds.has(x.id)),
      friendshipIdOf: (otherId) => accepted.find((f) => f.requester_id === otherId || f.addressee_id === otherId)?.id,
      uploadMedia,
      onCreatePost: (post) => cloud.createPost(post),
      onDeletePost: (id) => cloud.deletePost(id),
      onToggleLike: (id, liked) => cloud.toggleLike(id, liked),
      onAddComment: (id, body) => cloud.addComment(id, body),
      onSendFriend: (id) => cloud.sendFriendRequest(id),
      onRespondFriend: (id, accept) => cloud.respondFriend(id, accept),
      onRemoveFriend: (id) => cloud.removeFriend(id),
    };
  } else {
    const meLocal = baseGroup.find((p) => p.isMe);
    social = {
      meId: meLocal?.id, myGroupId: "local",
      uploadMedia,
      // Demo seed posts carry createdAt → live relative label ("há 20 h").
      posts: posts.map((p) => (p.createdAt ? { ...p, time: relativeTime(p.createdAt) } : p)),
      friendIds: [], friends: [], requests: [], sentPending: [], candidates: [],
      friendshipIdOf: () => null,
      onCreatePost: (post) => setPosts((ps) => [{ id: Date.now(), author: { id: meLocal?.id, nick: meLocal?.nick, name: meLocal?.name, photo: meLocal?.photo, groupId: "local" }, mine: true, time: "agora", type: post.type, text: post.body, media: post.media_url, likes: [], liked: false, comments: [] }, ...ps]),
      onDeletePost: (id) => setPosts((ps) => ps.filter((p) => p.id !== id)),
      onToggleLike: (id, liked) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, liked: !liked, likes: liked ? p.likes.filter((x) => x !== meLocal?.id) : [...p.likes, meLocal?.id] } : p))),
      onAddComment: (id, body) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: [...p.comments, { id: Date.now(), nick: meLocal?.nick, photo: meLocal?.photo, text: body }] } : p))),
      onSendFriend: () => {}, onRespondFriend: () => {}, onRemoveFriend: () => {},
    };
  }

  // ── 5-tab IA: derived "what needs me?" state ───────────
  // Shared by Home's next-action cards, Matchday's pre-match prompt and
  // the Matchday nav button's hot/cold state.
  const hasGameContext = !noGroup && !noGameScheduled;
  const needsResponse = hasGameContext && confWin.isOpen && me?.status === "pending";
  const isGameDay = hasGameContext && toIsoDay(kickoffAt) === toIsoDay(new Date());
  const matchdayHot = Boolean(matchday) || isGameDay || needsResponse;
  const spotsTaken = splitWaitlist(baseGroup.filter((p) => p.status === "confirmed"), game.spots).playing;
  const iAmPlaying = Boolean(me) && spotsTaken.some((p) => p.id === me.id);
  const myMvpKey = me ? (cloudMode ? me.uuid : me.id) : null;
  const canVoteMvp = Boolean(mvp?.open) && (mvp.candidates || []).some((c) => c.key === myMvpKey) && !mvp.myVotes?.[1];

  const confirmAction = needsResponse ? {
    id: "confirm", Icon: CalendarCheck,
    eyebrow: t("CONFIRMA A TUA PRESENÇA"),
    title: game.groupName,
    subtitle: `${game.date} · ${game.time}${game.venue ? ` · ${game.venue}` : ""}`,
    primaryLabel: spotsTaken.length < game.spots ? t("Estou dentro!") : t("Entrar na lista de espera"),
    onPrimary: () => toggleMyStatus("confirmed"),
    secondaryLabel: t("Não posso"),
    onSecondary: () => toggleMyStatus("declined"),
    prompt: spotsTaken.length < game.spots ? t("Vais jogar?") : t("Jogo cheio — entra na lista de espera e entras se alguém desistir."),
  } : null;

  const goToGroupView = (view) => {
    setJogarView("grupos");
    setGrupoEntry((g) => ({ view, n: g.n + 1 }));
    setTab("jogar");
  };

  const nextActions = [
    confirmAction,
    hasGameContext && iAmPlaying && !me.paid && game.priceEach > 0 ? {
      id: "pay", Icon: CreditCard,
      eyebrow: t("PAGAMENTO EM FALTA"),
      title: `${fmtEUR(game.priceEach)} · ${game.groupName}`,
      subtitle: `${game.date} · ${game.time}`,
      primaryLabel: `${t("Pagar")} · MB Way`,
      onPrimary: payMine,
      owes: fmtEUR(game.priceEach),
    } : null,
    canVoteMvp ? {
      id: "mvp", Icon: Star,
      eyebrow: t("VOTAÇÃO MVP ABERTA"),
      title: t("Quem foram os 3 melhores em campo?"),
      subtitle: lastMatchdayView?.date ? `${game.groupName} · ${lastMatchdayView.date}` : game.groupName,
      primaryLabel: t("Votar MVP"),
      // MatchdayMvpVote lives in Matchday's after-state (shown while the
      // vote is open and there's no new game today). On a game day Matchday
      // shows the new game instead, so the open ballot is reached in Competir.
      onPrimary: () => { if (isGameDay) { setCompetirBallot(true); selectTab("competir"); } else selectTab("matchday"); },
    } : null,
  ].filter(Boolean);

  // Home's quiet "próximo jogo" line. Cloud has the real cross-group
  // answer; local demo (single group) falls back to the active game.
  const homeNextGame = nextGameAcrossGroups ?? (localMode && hasGameContext ? {
    groupName: game.groupName, venue: game.venue, dateLabel: game.date, timeLabel: game.time,
  } : null);

  const groupSwitcher = !noGroup ? (
    <GroupSwitcher
      currentName={game.groupName}
      activeGroupId={cloudMode ? cloud.groupRow?.id : null}
      myGroups={cloudMode ? cloud.myGroups : []}
      onSwitchGroup={cloudMode ? cloud.switchActiveGroup : null}
    />
  ) : null;

  const totalGamesPlayed = historyView.reduce((s, h) => s + (h.games || 1), 0);

  // ── Pitch Manager (Fantasy) in local demo ──────────────
  // FantasyTab is keyed by player uuid; demo players get String(id) as
  // uuid (and the seed lines the same keys) so the real component runs
  // unchanged on a mock league: me + 5 rivals, rounds = seeded matchdays
  // since the league started, my squad editable + persisted locally.
  // Trades need other real managers → unavailable in the demo.
  let demoFantasyProps = null;
  if (localMode && me) {
    const fk = (id) => String(id);
    const fGroup = displayGroup.map((p) => ({ ...p, uuid: fk(p.id) }));
    const startsAt = new Date(Date.now() - DEMO_FANTASY.startsWeeksAgo * 7 * 24 * 3600 * 1000 - 3600 * 1000).toISOString();
    const fMatchdays = localDays.map((d) => ({
      id: d.id,
      created_at: d.playedOn ? new Date(`${d.playedOn}T21:00:00`).toISOString() : new Date().toISOString(),
      summary: { ...d.summary, lines: (d.summary?.lines || []).map((l) => ({ ...l, key: fk(l.key) })) },
    }));
    const rounds = fMatchdays.filter((md) => md.created_at >= startsAt);
    const basePaid = (ids) => Object.fromEntries(ids.map((id) => [id, DEFAULT_FANTASY_WEIGHTS.priceBase]));
    const myIds = (demoFantasySquad.player_ids || []).map(fk);
    const squads = [
      { participant_id: fk(me.id), player_ids: myIds, captain_id: demoFantasySquad.captain_id != null ? fk(demoFantasySquad.captain_id) : null,
        reserve_ids: (demoFantasySquad.reserve_ids || []).map(fk), prices_paid: demoFantasySquad.prices_paid || basePaid(myIds), budget_adjustment: 30 },
      ...DEMO_FANTASY.rivals.filter((r) => r.participant !== me.id).map((r) => ({
        participant_id: fk(r.participant), player_ids: r.player_ids.map(fk), captain_id: fk(r.captain_id),
        reserve_ids: [], prices_paid: basePaid(r.player_ids.map(fk)), budget_adjustment: 0,
      })),
    ];
    const scores = rounds.flatMap((md) => squads.map((s) => ({
      participant_id: s.participant_id, matchday_id: md.id,
      points: computeRoundPoints(s.player_ids, s.captain_id, md.summary.lines, DEFAULT_FANTASY_WEIGHTS, s.reserve_ids),
    })));
    const unavailable = async () => ({ error: t("Indisponível na demonstração.") });
    demoFantasyProps = {
      group: fGroup, me: fGroup.find((p) => p.isMe),
      fantasyLeague: { id: "demo-league", name: "Pitch Manager", budget: DEMO_FANTASY.budget, squad_size: DEMO_FANTASY.squadSize, duration_months: 2, starts_at: startsAt, created_at: startsAt },
      fantasySquads: squads, fantasyScores: scores, fantasyTradeOffers: [], matchdays: fMatchdays,
      onCreateLeague: unavailable, onCreateTradeOffer: unavailable, onCancelTradeOffer: unavailable, onRespondTradeOffer: unavailable,
      onSyncFantasy: null,
      onSaveSquad: async (_leagueId, playerIds, captainId, reserveIds) => {
        const ids = [...new Set(playerIds)];
        setDemoFantasySquad((prev) => ({
          player_ids: ids, captain_id: captainId, reserve_ids: reserveIds || [],
          prices_paid: nextPricesPaid(prev.prices_paid || basePaid((prev.player_ids || []).map(fk)), ids, (id) => fantasyPrice(id, rounds)),
        }));
        return {};
      },
    };
  }

  // Matchday: organizers (and assistants) ALWAYS get the full controls;
  // a regular player gets them when it's hot or the lineup is out,
  // otherwise the cold countdown + last recap.
  const matchdayCold = !matchdayHot && !isOrganizer && !canManageTeams && !teamsConfirmed;

  const selectTab = (id) => {
    setTab(id);
    if (id === "perfil") { setViewPlayerId(null); setSettingsView(null); }
  };

  // ── Main app ───────────────────────────────────────────
  return shell(
    <>
      {!tourSeen && <FirstRunTour onDone={() => { setTourSeen(true); setWhatsNewSeen(true); }} />}
      {tourSeen && (!whatsNewSeen || whatsNewOpen) && <WhatsNewSheet onDone={() => { setWhatsNewSeen(true); setWhatsNewOpen(false); }} />}
      {/* App header — logo left; bell (Novidades, red dot while unseen) + my avatar (→ Perfil) right. */}
      <TopBar onLogoClick={() => selectTab("home")}
        actions={[{ Icon: Bell, label: t("Novidades"), onClick: () => setWhatsNewOpen(true), badge: !whatsNewSeen }]}
        right={me ? (
          <button type="button" onClick={() => selectTab("perfil")} aria-label={t("O meu perfil")} title={t("O meu perfil")}
            style={{ width: TOUCH.min, height: TOUCH.min, borderRadius: "50%", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Avatar name={me.name || me.nick} photo={me.photo} color={playerColor(baseGroup, me)} size={32} isMe />
          </button>
        ) : null} />
      <div style={{ paddingBottom: 96 }}>
        {tab === "home" && (
          // Home (redesign v1): one next action + last-result recap + single
          // activity feed built from matchdays + social posts (SocialTab no
          // longer rendered here). resultPending = kickoff passed <36h ago,
          // nothing live and no matchday recorded today (organizer/assistant).
          <HomeTab
            me={me} group={displayGroup} myKey={myMvpKey}
            nextGame={homeNextGame} nextActions={nextActions}
            slots={hasGameContext ? {
              spots: game.spots, groupName: game.groupName, myStatus: me?.status,
              date: game.date, time: game.time, venue: game.venue,
              waitlist: Math.max(0, baseGroup.filter((p) => p.status === "confirmed").length - spotsTaken.length),
              // Same shape JogoTab feeds the shared SlotGrid (photo, nick, paid, injured).
              taken: spotsTaken.map((p) => ({ ...p, name: p.name || p.nick, color: playerColor(baseGroup, p) })),
            } : null}
            liveMatchday={Boolean(matchday)}
            resultPending={canManageTeams && hasGameContext && !matchday && kickoffAt <= new Date() && Date.now() - kickoffAt.getTime() < 36 * 3600 * 1000 && lastMatchdayView?.date !== fmtDayMonth(isoDay(0))}
            onOpenJogar={() => { setJogarView("jogos"); selectTab("jogar"); }}
            onOpenMatchday={() => selectTab("matchday")}
            onOpenCompetir={() => selectTab("competir")}
            feedMatchdays={cloudMode ? [
              ...cloud.matchdays.map((r) => ({ ...r, groupName: game.groupName })),
              ...cloud.crossGroupMatchdays.map((r) => ({ ...r, groupName: r.groups?.name })),
            ] : null}
            localHistory={cloudMode ? null : { days: localDays, history: historyView, groupName: game.groupName }}
            social={social}
            postTs={cloudAuthed ? Object.fromEntries(cloud.posts.map((p) => [p.id, p.created_at])) : null}
            myGroupIds={cloudAuthed ? [cloud.groupRow?.id, ...cloud.myGroups.map((m) => m.group_id)].filter(Boolean) : ["local"]}
            friendsEnabled={cloudAuthed}
            kudos={cloudMode ? cloud.matchdayKudos : null}
            onToggleKudos={cloudMode ? (matchdayId, toKey, given) => cloud.toggleKudos(matchdayId, toKey, given) : null}
            attendanceStreak={attendanceStreak}
            groupName={game.groupName} lastMatchdayForWorkout={lastMatchdayView}
            peerRatings={cloudMode ? cloud.ratings : null}
            onCardGenerated={cloudMode ? cloud.logCardGenerated : undefined}
          />
        )}
        {tab === "jogar" && (
          // Jogar (redesign v1): Jogos | Grupos + pushed Game Detail and
          // Group page (Plantel · Stats · Fantasy · Definições). Render
          // functions keep every screen wired to root state.
          <JogarTab
            view={jogarView} onViewChange={setJogarView}
            headerRight={groupSwitcher}
            groupEntryN={grupoEntry.n}
            renderJogos={({ openDetail }) => noGroup ? (
              <NoGroupState onJoinGroup={() => setNoGroupOptIn(false)} />
            ) : (
              <JogoTab
                group={displayGroup} game={game}
                toggleMyStatus={toggleMyStatus} payMine={payMine}
                inviteUrl={inviteUrl} canManageGame={isOrganizer} onSetSpots={setSpots}
                onReschedule={rescheduleGame}
                onScheduleGame={cloudMode ? (dateIso, time) => cloud.scheduleNextGame(dateIso, time) : undefined}
                confirmOpen={confWin.isOpen} opensAtLabel={opensAtLabel}
                onOpenDetail={openDetail}
                upcoming={cloudMode ? cloud.crossGroupGames
                  .filter((g) => new Date(g.scheduled_at) >= new Date())
                  .map((g) => {
                    const d = new Date(g.scheduled_at);
                    return {
                      id: g.id, groupName: g.groups?.name, venue: g.venue,
                      dateLabel: fmtFullDay(toIsoDay(d)),
                      timeLabel: lisbonTimeLabel(d),
                      onOpen: cloud.switchActiveGroup ? () => cloud.switchActiveGroup(g.group_id) : undefined,
                    };
                  }) : []}
                findGame={isEnabled("openGames", { isAdmin: cloud.isAdmin }) ? <FindGamePlaceholder /> : null}
                pastGames={historyView}
                onOpenHistory={() => goToGroupView("stats")}
              />
            )}
            renderDetail={({ onBack }) => (
              <GameDetail
                group={displayGroup} game={game} gameId={gameId} onBack={onBack}
                togglePaid={togglePaid} payMine={payMine}
                canManageTeams={canManageTeams} canManageGame={isOrganizer} onSetPlayerStatus={setPlayerStatus}
                inviteUrl={inviteUrl}
                material={material} onToggleMaterial={toggleMaterial} onAssignMaterial={assignMaterial} onAddMaterial={addMaterial}
              />
            )}
            renderGroups={({ openGroup }) => noGroup ? (
              <NoGroupState onJoinGroup={() => setNoGroupOptIn(false)} />
            ) : (
              <GroupsList
                groups={cloudMode && cloud.myGroups?.filter((m) => !m.banned).length
                  ? cloud.myGroups.filter((m) => !m.banned).map((m) => ({
                      id: m.group_id, name: m.groups?.name, active: m.group_id === cloud.groupRow?.id,
                      meta: [m.role === "organizer" ? t("Organizador") : m.role === "assistant" ? t("Auxiliar") : t("Membro"), m.groups?.venue].filter(Boolean).join(" · "),
                    }))
                  : [{ id: "current", name: game.groupName, active: true, meta: `${displayGroup.length} ${t("jogadores")}${game.venue ? ` · ${game.venue}` : ""}` }]}
                onOpen={async (g) => {
                  if (!g.active && cloudMode) {
                    const res = await cloud.switchActiveGroup(g.id);
                    if (res?.error) return res;
                  }
                  openGroup();
                  return null;
                }}
              />
            )}
            renderGroupPage={({ onBack }) => (
              <GroupPage
                key={grupoEntry.n}
                onBack={onBack} initialView={grupoEntry.view}
                groupName={game.groupName}
                subtitle={`${displayGroup.length} ${t("jogadores")}${game.venue ? ` · ${game.venue}` : ""}`}
                isOrganizer={isOrganizer}
                plantel={
                  <GrupoTab
                    group={displayGroup} game={game} openProfile={openProfile} cloudMode={cloudMode}
                    inviteUrl={inviteUrl} isOrganizer={isOrganizer}
                    onToggleAssistant={cloud.toggleAssistant}
                    onSetPlayerType={(playerId, type) => cloud.updatePlayer(playerId, { player_type: type })}
                    onSetAttendanceLock={(playerId, locked) => cloud.setAttendanceLock(locked, playerId, gameId)}
                    onAddManualPlayer={addManualPlayer} onSetPlayerStatus={setPlayerStatus}
                    onRemoveGuestPlayer={removeGuestPlayer} onRemoveMember={removeMember}
                    canManageTeams={canManageTeams}
                    totalGames={totalGamesPlayed}
                    myTeams={cloudMode ? cloud.myTeams : []} myPlayerId={me?.uuid}
                    onCreateTeam={cloudMode && isEnabled("teams", { isAdmin: cloud.isAdmin }) ? cloud.createTeam : undefined} onFetchTeam={cloudMode ? cloud.fetchTeam : undefined}
                    onAddTeamMember={cloudMode ? cloud.addTeamMember : undefined} onRemoveTeamMember={cloudMode ? cloud.removeTeamMember : undefined}
                  />
                }
                stats={<GroupRecords records={recordsView} canDelete={isOrganizer && cloudMode} onDeleteMatchday={deleteMatchdayRecord} />}
                fantasy={cloud.canSeeFantasy ? (
                  <FantasyTab group={displayGroup} me={me} isOrganizer={isOrganizer} kickoffAt={game.kickoffAt}
                    fantasyLeague={cloud.fantasyLeague} fantasySquads={cloud.fantasySquads} fantasyScores={cloud.fantasyScores}
                    fantasyTradeOffers={cloud.fantasyTradeOffers} matchdays={cloud.matchdays}
                    onCreateLeague={cloud.createFantasyLeague} onSaveSquad={cloud.saveFantasySquad}
                    onCreateTradeOffer={cloud.createTradeOffer} onCancelTradeOffer={cloud.cancelTradeOffer}
                    onRespondTradeOffer={cloud.respondTradeOffer} onSyncFantasy={cloud.syncFantasyScores} />
                ) : demoFantasyProps ? (
                  <FantasyTab {...demoFantasyProps} isOrganizer={isOrganizer} kickoffAt={game.kickoffAt} />
                ) : null}
                settings={
                  <GroupSettings game={game} onEditGroup={() => setEditingGroup(true)}
                    inviteUrl={inviteUrl} inviteUrlAvulso={inviteUrlAvulso}
                    bannedMembers={cloudMode ? cloud.bannedMembers : []} onUnbanMember={unbanMember} />
                }
              />
            )}
          />
        )}
        {tab === "matchday" && (noGroup ? (
          <NoGroupState onJoinGroup={() => setNoGroupOptIn(false)} />
        ) : (
          <MatchdayTab
            group={displayGroup} game={game}
            teams={teams} drawTeams={drawTeams} onClearTeams={clearTeams} renameTeam={renameTeam} movePlayer={movePlayer} setTeamCaptain={setTeamCaptain} balanceTeams={balanceCurrentTeams} canManageTeams={canManageTeams}
            teamsConfirmed={teamsConfirmed} onConfirmTeams={confirmTeams}
            teamsSetByName={teamsSetByName} teamsConfirmedByName={teamsConfirmedByName}
            matchdayProps={{ matchday, onStart: startMatchday, onAddMatch: addMatch, onGoal: addGoal, onEpicSave: addEpicSave, onRemoveEvent: removeMatchEvent, onSetGoalkeeper: setGoalkeeper, onSetMatchConcluded: setMatchConcluded, onEnd: endMatchday, onCancel: cancelMatchday, onAdvancePlayoff: advancePlayoff, onSetChampion: setChampion, onSetPenaltyWinner: setPenaltyWinner, onSubstitute: substitutePlayer, onRevertSub: revertSubstitution,
              // Redesign (Matchday "Assistência" button): patch one logged event in place
              // (e.g. attach an assist to an existing goal) — keeps its position/minute,
              // unlike remove + re-add. Same updateMatchday path as the other handlers.
              onUpdateEvent: (matchId, eventIndex, patch) =>
                updateMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: m.events.map((e, i) => (i === eventIndex ? { ...e, ...patch } : e)) } : m)) })) }}
            prompt={confirmAction ? <NextActionCard {...confirmAction} /> : null}
            coldView={matchdayCold ? <MatchdayCold game={game} lastMatchday={lastMatchdayView} /> : null}
            mvp={mvp} lastMatchday={lastMatchdayView} onCardGenerated={cloudMode ? cloud.logCardGenerated : undefined}
            social={social}
          />
        ))}
        {tab === "competir" && (
          <CompetirTab
            isAdmin={cloud.isAdmin}
            group={displayGroup} history={historyView} matchdaySummaries={matchdaySummariesView} lastMatchday={lastMatchdayView} mvp={mvp}
            social={social} groupName={game.groupName}
            postDates={cloudMode ? Object.fromEntries(cloud.posts.map((p) => [p.id, p.created_at])) : null}
            groupPicker={cloudMode && (cloud.myGroups?.length ?? 0) > 1 ? groupSwitcher : null}
            openBallot={competirBallot}
          />
        )}
        {tab === "perfil" && settingsView === "clube" && cloud.isAdmin && (
          <div>
            <div style={{ padding: "12px 16px 0" }}>
              <button onClick={() => setSettingsView("main")} aria-label={t("Voltar")}
                style={{ width: 44, height: 44, marginLeft: -10, background: "none", border: "none", color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowLeft size={20} />
              </button>
            </div>
            <ClubeTab
              bookings={cloudBookings} toggleBooking={toggleBooking}
              events={cloudEvents} rsvpEvent={rsvpEvent} payEvent={payEvent}
              openMatches={openMatches} joinOpenMatch={joinOpenMatch}
              ownOpenSpots={Math.max(0, game.spots - baseGroup.filter((p) => p.status === "confirmed").length)}
              ownPublished={ownPublished} publishOwnGame={() => setOwnPublished((v) => !v)}
              game={game}
              isAdmin={cloud.isAdmin}
              onCreateEvent={cloud.createEvent}
              onDeleteEvent={cloud.deleteEvent}
            />
          </div>
        )}
        {tab === "perfil" && (settingsView === "main" || (settingsView === "clube" && !cloud.isAdmin)) && me && (
          <SettingsScreen
            player={me}
            onBack={() => setSettingsView(null)}
            isOrganizer={isOrganizer} onEditGroup={() => setEditingGroup(true)}
            onCreateGroup={noGroup ? () => setCreatingGroup(true) : null}
            lang={lang} onLang={changeLang}
            themeMode={themeMode} onThemeMode={changeTheme}
            enablePush={cloudAuthed ? enablePush : null}
            security={cloud.user ? {
              email: cloud.user.email,
              updatePassword: cloud.updatePassword,
              updateEmail: cloud.updateEmail,
              signOutEverywhere,
            } : null}
            isAdmin={cloud.isAdmin} onOpenAdmin={() => setAdminOpen(true)} onOpenClube={() => setSettingsView("clube")}
            logout={logout} resetDemo={resetDemo}
          />
        )}
        {tab === "perfil" && !settingsView && (
          <PerfilTab
            key={viewPlayerId ?? "me"}
            group={displayGroup} viewPlayerId={viewPlayerId}
            updateProfile={updateProfile} backToMe={backToMe}
            isOrganizer={isOrganizer}
            addPeerRating={addPeerRating} cloudMode={cloudMode} onSubmitRating={cloudMode ? cloud.submitRating : null}
            uploadMedia={uploadMedia} onToggleInjured={toggleInjured}
            achievementMatchdays={achievementMatchdays}
            totalGames={totalGamesPlayed}
            records={recordsView}
            onBanMember={banMember}
            onOpenSettings={() => setSettingsView("main")}
            personalRecords={personalRecords} attendanceStreak={attendanceStreak}
            // Perfil redesign: hero meta (city · group), "Grupos e equipas"
            // rows, and local demo's last matchday for form/records.
            groupName={game.groupName} city={groupSettings.city}
            myGroups={cloudMode ? cloud.myGroups : []} activeGroupId={cloudMode ? cloud.groupRow?.id : null}
            myTeams={cloudMode ? cloud.myTeams : []}
            localMatchday={cloudMode ? null : lastMatchdayView}
          />
        )}
      </div>

      <BottomNav tab={tab} matchdayHot={matchdayHot} onSelect={selectTab} />
    </>
  );
}

