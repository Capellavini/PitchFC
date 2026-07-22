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
import { useEffect, useState } from "react";
import { C, BRAND } from "./theme";
import { INITIAL_GROUP, INITIAL_MATERIAL, INITIAL_POSTS, DEFAULT_SETTINGS, POSITIONS, HISTORY, INITIAL_BOOKINGS, CLUB_EVENTS, OPEN_MATCHES } from "./data";
import { usePersistentState, clearAppStorage } from "./lib/storage";
import { ADMIN_EMAILS } from "./lib/supabase";
import { nextGameDateLabel, nextGameDate, fmtEUR, decodePayload, averageAttrs, fmtDayMonth, isoDay, playerColor, relativeTime, splitWaitlist, confirmationWindow, WEEKDAYS_PT, fileToDataUrl } from "./lib/helpers";
import { t, setLang } from "./lib/i18n";
import { useCloud } from "./hooks/useCloud";
import { registerServiceWorker, subscribeToPush } from "./lib/push";
import LandingPage from "./components/LandingPage";
import AuthForm from "./components/AuthForm";
import ResetPassword from "./components/ResetPassword";
import JoinGroup from "./components/JoinGroup";
import RatePlayer from "./components/RatePlayer";
import MagicConfirm from "./components/MagicConfirm";
import LeaguePage from "./components/LeaguePage";
import AuthLanding from "./components/AuthLanding";
import OnboardingPlayer from "./components/OnboardingPlayer";
import OnboardingOrganizer from "./components/OnboardingOrganizer";
import BottomNav from "./components/BottomNav";
import JogoTab from "./components/JogoTab";
import ClubeTab from "./components/ClubeTab";
import SocialTab from "./components/SocialTab";
import StatsTab from "./components/StatsTab";
import GrupoTab from "./components/GrupoTab";
import FantasyTab from "./components/FantasyTab";
import PerfilTab from "./components/PerfilTab";
import AdminPanel from "./components/AdminPanel";
import NoGroupState from "./components/NoGroupState";
import BtnPrimary from "./components/BtnPrimary";

const APP_FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";
const DEFAULT_ATTRS = { rit: 70, rem: 70, pas: 70, dri: 70, def: 70, fis: 70 };

// Team draw supports 2–6 teams; each gets a colour and an editable name.
const TEAM_PALETTE = ["#C8FF00", "#4895FF", "#FF9F0A", "#A78BFA", "#FF6B9D", "#2DD4BF"];
const TEAM_NAMES = ["Coletes", "Sem coletes", "Equipa 3", "Equipa 4", "Equipa 5", "Equipa 6"];

// Stable positive integer from a uuid, so cloud players slot into the
// local features that assume numeric ids (teams, matchday, posts…).
const hashId = (uuid) => {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (h * 31 + uuid.charCodeAt(i)) >>> 0;
  return h;
};

export default function PitchApp() {
  const [session, setSession]   = usePersistentState("session", { role: null, onboarded: false });
  const [settings, setSettings] = usePersistentState("settings", DEFAULT_SETTINGS);
  const [group, setGroup]       = usePersistentState("group", INITIAL_GROUP);
  const [material, setMaterial] = usePersistentState("material", INITIAL_MATERIAL);
  const [posts, setPosts]       = usePersistentState("posts", INITIAL_POSTS);
  const [teamsRaw, setTeams]    = usePersistentState("teams", null);
  const [peerRatings, setPeerRatings] = usePersistentState("peerRatings", []);
  const [mvpVote, setMvpVote]   = usePersistentState("mvpVote", { open: true, votes: { 1: null, 2: null, 3: null } });
  const [history, setHistory]   = usePersistentState("history", HISTORY);
  const [matchday, setMatchday] = usePersistentState("matchday", null);
  const [lastMatchday, setLastMatchday] = usePersistentState("lastMatchday", null);
  const [bookings, setBookings] = usePersistentState("bookings", INITIAL_BOOKINGS);
  const [events, setEvents]     = usePersistentState("events", CLUB_EVENTS);
  const [openMatches, setOpenMatches] = usePersistentState("openMatches", OPEN_MATCHES);
  const [ownPublished, setOwnPublished] = usePersistentState("ownPublished", false);
  const [eventStatus, setEventStatus] = usePersistentState("eventStatus", {}); // cloud RSVP, local
  const [lang, setLangState]    = usePersistentState("lang", "pt");
  const [tab, setTab]           = useState("jogo");
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [statMode, setStatMode] = useState("goals");
  const [viewPlayerId, setViewPlayerId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [noGroupOptIn, setNoGroupOptIn] = usePersistentState("noGroupOptIn", false);

  // Mirror the persisted language into the i18n module before anything
  // renders, so every t() call below sees the current choice.
  setLang(lang);
  const changeLang = (l) => { setLang(l); setLangState(l); };

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

  // ?join=<token>: attach the logged-in user to that group.
  const joinParam = new URLSearchParams(window.location.search).get("join");
  useEffect(() => {
    if (!joinParam || !cloud.user) return;
    cloud.joinGroupByToken(joinParam).finally(() => {
      window.history.replaceState({}, "", window.location.pathname);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinParam, cloud.user]);

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
          position: p.position, foot: p.foot, attrs: p.attrs ?? DEFAULT_ATTRS,
          isOrganizerPlayer: p.is_organizer, isAssistant: p.is_assistant,
          isGuest: !p.user_id,
          magicToken: p.magic_token,
          status: att?.status ?? "pending", paid: att?.paid ?? false,
          respondedAt: att?.responded_at ?? null,
          isMe: cloud.myPlayer?.id === p.id,
          // Season stats now live on the cloud player row (shared ranking).
          goals: p.goals || 0, assists: p.assists || 0, mvps: p.mvps || 0,
          gamesPlayed: p.games_played || 0, wins: p.wins || 0, cleanSheets: p.clean_sheets || 0,
        };
      })
    : group;

  const groupSettings = cloudMode
    ? {
        groupName: cloud.groupRow.name, venue: cloud.groupRow.venue,
        weekday: cloud.groupRow.weekday, time: cloud.groupRow.game_time,
        monthlyPrice: cloud.groupRow.monthly_price_cents / 100, maxPlayers: cloud.groupRow.max_players,
        recurring: cloud.groupRow.recurring ?? true,
        openWeekday: cloud.groupRow.open_weekday ?? 1, openTime: cloud.groupRow.open_time ?? "17:00",
      }
    : noGroup
      ? { groupName: "", venue: "", weekday: 6, time: "20:00", monthlyPrice: 0, maxPlayers: 0, recurring: false, openWeekday: 1, openTime: "17:00" }
      : settings;

  const saveSettings = (form) => {
    if (cloudMode) {
      cloud.updateGroupRow({
        name: form.groupName, venue: form.venue, weekday: form.weekday, game_time: form.time,
        monthly_price_cents: Math.round(form.monthlyPrice * 100), max_players: form.maxPlayers,
        recurring: form.recurring, open_weekday: form.openWeekday, open_time: form.openTime,
      });
    } else {
      setSettings(form);
    }
  };

  // Organizer adjusts how many players this game needs (default 10).
  const setSpots = (n) => {
    const v = Math.max(2, Math.min(22, n));
    if (cloudMode) cloud.setSpots(v);
    else setSettings((s) => ({ ...s, maxPlayers: v }));
  };

  const me = baseGroup.find((p) => p.isMe);
  const gameId = cloud.game?.id;

  // Teams: array of { id, name, color, players:[playerId] }. Old saves
  // used a { a:[], b:[] } object — ignore those (force a fresh draw).
  const teams = Array.isArray(teamsRaw) ? teamsRaw : null;
  useEffect(() => {
    if (teamsRaw && !Array.isArray(teamsRaw)) setTeams(null);
    if (matchday?.matches?.some((m) => m.homeId === undefined)) setMatchday(null);
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
        avgAttrs: rows.length ? averageAttrs(rows.map((r) => r.attrs)) : null,
        raters: rows.map((r) => ({ id: r.rater_id, nick: baseGroup.find((x) => x.uuid === r.rater_id)?.nick || r.rater_name || "?" })),
        myRatingAttrs: rows.find((r) => r.rater_id === me?.uuid)?.attrs ?? null,
      };
    }
    if (p.isMe) {
      return {
        count: peerRatings.length,
        avgAttrs: peerRatings.length ? averageAttrs(peerRatings.map((r) => r.a)) : null,
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

  // The "next game" as the UI consumes it.
  const game = {
    ...groupSettings,
    label: groupSettings.groupName,
    date: nextGameDateLabel(groupSettings.weekday),
    spots: groupSettings.maxPlayers,
    priceEach: groupSettings.maxPlayers > 0 ? groupSettings.monthlyPrice / groupSettings.maxPlayers : 0,
    // Real kickoff timestamp — prefer the cloud game's own scheduled_at
    // (it may have been shifted for this one week) over the recurring
    // weekday/time pattern. Used to lock the Fantasy squad 8h before kickoff.
    kickoffAt: cloud.game?.scheduled_at ? new Date(cloud.game.scheduled_at) : nextGameDate(groupSettings.weekday, groupSettings.time),
  };

  // Recurring confirmation window (derived): before the weekly open moment,
  // confirmations are closed for everyone.
  const confWin = groupSettings.recurring
    ? confirmationWindow(groupSettings.weekday, groupSettings.time, groupSettings.openWeekday ?? 1, groupSettings.openTime ?? "17:00")
    : { isOpen: true };
  const opensAtLabel = groupSettings.recurring
    ? `${t(WEEKDAYS_PT[groupSettings.openWeekday ?? 1])} ${t("às")} ${groupSettings.openTime ?? "17:00"}`
    : null;

  const togglePaid = (id) => {
    const player = baseGroup.find((p) => p.id === id);
    if (cloudMode) cloud.setPaid(!player.paid, player.uuid, gameId);
    else setGroup((g) => g.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));
  };

  const payMine = () => {
    if (cloudMode && me) cloud.setPaid(true, me.uuid, gameId);
    else setGroup((g) => g.map((p) => (p.isMe ? { ...p, paid: true } : p)));
  };

  const toggleMyStatus = (newStatus) => {
    if (cloudMode && me) {
      cloud.setMyStatus(newStatus, me.uuid, gameId);
      if (newStatus !== "confirmed" && me.paid) cloud.setPaid(false, me.uuid, gameId);
    } else {
      setGroup((g) => g.map((p) => (p.isMe ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false, respondedAt: newStatus === "confirmed" ? new Date().toISOString() : p.respondedAt } : p)));
    }
    setTeams(null); // roster changed → invalidate draw
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
    setTeams(null);
  };

  // Organizer permanently removes a guest (no-account) player.
  const removeGuestPlayer = (playerId, nick) => {
    const player = baseGroup.find((p) => p.id === playerId);
    if (!player) return;
    if (!window.confirm(`${t("Apagar")} ${nick}${t("? Esta ação não pode ser desfeita — o jogador sai do grupo e perde o histórico.")}`)) return;
    if (cloudMode) cloud.adminDeletePlayer(player.uuid).then(() => cloud.refetch());
    else setGroup((g) => g.filter((p) => p.id !== playerId));
    setTeams(null);
  };

  const clearTeams = () => setTeams(null);

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

  // Position-balanced team draw into N (2–6) teams: shuffle, order by
  // position, then snake-deal across teams so each gets a fair spread.
  const drawTeams = (numTeams = 2) => {
    const n = Math.max(2, Math.min(6, numTeams));
    // Only those actually playing get drawn — the waiting line sits out.
    const { playing } = splitWaitlist(baseGroup.filter((p) => p.status === "confirmed"), groupSettings.maxPlayers);
    const shuffled = [...playing].sort(() => Math.random() - 0.5);
    const order = POSITIONS.flatMap((pos) => shuffled.filter((p) => p.position === pos));
    const newTeams = Array.from({ length: n }, (_, i) => ({
      id: `t${i + 1}`, name: TEAM_NAMES[i], color: TEAM_PALETTE[i], players: [],
    }));
    order.forEach((p, idx) => {
      const round = Math.floor(idx / n);
      const slot = idx % n;
      const ti = round % 2 === 0 ? slot : n - 1 - slot; // snake
      newTeams[ti].players.push(p.id);
    });
    setTeams(newTeams);
  };

  const renameTeam = (teamId, name) =>
    setTeams((ts) => (Array.isArray(ts) ? ts.map((t) => (t.id === teamId ? { ...t, name } : t)) : ts));

  // Manually move a player to another team (remove everywhere, add to target).
  const movePlayer = (playerId, toTeamId) =>
    setTeams((ts) => (Array.isArray(ts)
      ? ts.map((t) => ({ ...t, players: t.id === toTeamId ? [...t.players.filter((id) => id !== playerId), playerId] : t.players.filter((id) => id !== playerId) }))
      : ts));

  // Organizer adds a guest player (no account). Overall optional → uniform attrs.
  const addManualPlayer = ({ name, position, overall }) => {
    const clean = name.trim();
    if (!clean) return;
    const o = overall ? Math.max(40, Math.min(99, overall)) : 65;
    const attrs = { rit: o, rem: o, pas: o, dri: o, def: o, fis: o };
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
  const startMatchday = (mode = "avulsa") => {
    if (!teams || teams.length < 2) return;
    setMatchday({ startedAt: Date.now(), mode, matches: [{ id: Date.now(), n: 1, homeId: teams[0].id, awayId: teams[1].id, homeGkId: defaultGkFor(teams[0].id), awayGkId: defaultGkFor(teams[1].id), events: [] }] });
  };
  const addMatch = (homeId, awayId) =>
    setMatchday((md) => ({ ...md, matches: [...md.matches, { id: Date.now(), n: md.matches.length + 1, homeId, awayId, homeGkId: defaultGkFor(homeId), awayGkId: defaultGkFor(awayId), events: [] }] }));
  const addGoal = (matchId, event) =>
    setMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: [...m.events, event] } : m)) }));
  const setGoalkeeper = (matchId, side, playerId) =>
    setMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, [side]: playerId } : m)) }));

  const endMatchday = () => {
    if (!matchday) return;
    if (!window.confirm(t("Terminar o dia de jogo? As stats entram para a época e abre a votação MVP."))) return;

    const stats = {};
    const bump = (id, key) => {
      if (!id) return;
      stats[id] = stats[id] ?? { goals: 0, assists: 0, cleanSheets: 0, wins: 0 };
      stats[id][key] += 1;
    };
    matchday.matches.forEach((m) => m.events.forEach((e) => { bump(e.scorerId, "goals"); bump(e.assistId, "assists"); }));

    const teamsById = Object.fromEntries((teams || []).map((t) => [t.id, t]));
    const teamResults = (teams || []).map((t) => ({ id: t.id, name: t.name, color: t.color, wins: 0 }));
    const winsById = Object.fromEntries(teamResults.map((t) => [t.id, t]));
    const mdMatches = [];
    let totalGoals = 0;

    matchday.matches.forEach((m) => {
      const hg = m.events.filter((e) => e.teamId === m.homeId).length;
      const ag = m.events.filter((e) => e.teamId === m.awayId).length;
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
      mdMatches.push({ n: m.n, homeName: home?.name ?? "—", awayName: away?.name ?? "—", homeGoals: hg, awayGoals: ag });
    });

    // Waitlisted players didn't play — only the playing XI gets stats.
    const { playing } = splitWaitlist(baseGroup.filter((p) => p.status === "confirmed"), groupSettings.maxPlayers);
    const playingIds = new Set(playing.map((p) => p.id));
    const confirmed = playing;
    const date = fmtDayMonth(isoDay(0));
    const keyOf = (p) => (cloudMode ? p.uuid : p.id);

    // Display-ready per-player lines (who did what today), sorted.
    const lines = Object.entries(stats)
      .map(([lid, s]) => {
        const p = baseGroup.find((x) => x.id === Number(lid));
        return p ? { key: keyOf(p), nick: p.nick, photo: p.photo, isMe: p.isMe, color: playerColor(baseGroup, p), goals: s.goals, assists: s.assists, cleanSheets: s.cleanSheets } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.goals * 2 + b.assists) - (a.goals * 2 + a.assists));
    const candidates = confirmed.map((p) => ({ key: keyOf(p), nick: p.nick, position: p.position }));
    const summary = { teamResults: teamResults.map(({ id, ...r }) => r), matches: mdMatches, lines, candidates };

    if (cloudMode) {
      // Bump season totals on each player row + record the matchday;
      // MVP voting opens in the cloud for everyone.
      const statsByUuid = {};
      baseGroup.forEach((p) => {
        const s = stats[p.id];
        const played = playingIds.has(p.id);
        if (!s && !played) return;
        statsByUuid[p.uuid] = { goals: s?.goals ?? 0, assists: s?.assists ?? 0, cleanSheets: s?.cleanSheets ?? 0, wins: s?.wins ?? 0, played };
      });
      cloud.commitMatchday({ statsByUuid, summary, totalGoals, mode: matchday.mode, nGames: matchday.matches.length });
    } else {
      setGroup((g) => g.map((p) => {
        const s = stats[p.id];
        const played = playingIds.has(p.id);
        if (!s && !played) return p;
        return { ...p, goals: p.goals + (s?.goals ?? 0), assists: p.assists + (s?.assists ?? 0), gamesPlayed: p.gamesPlayed + (played ? 1 : 0), wins: (p.wins || 0) + (s?.wins ?? 0) };
      }));
      setHistory((h) => [{ id: Date.now(), date, confirmed: confirmed.length, result: `${totalGoals}⚽`, allPaid: confirmed.every((p) => p.paid), mvpId: null, games: matchday.matches.length }, ...h]);
      setLastMatchday({ date, mode: matchday.mode, ...summary });
      setMvpVote({ open: true, votes: { 1: null, 2: null, 3: null } });
    }
    setMatchday(null);
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

  const openProfile = (id) => { setViewPlayerId(id); setTab("perfil"); };
  const backToMe = () => setViewPlayerId(null);

  // ── Session / auth gating ──────────────────────────────
  const logout = () => {
    if (cloudMode || cloud.user) cloud.signOut();
    setSession({ role: null, onboarded: false });
    setAuthOpen(false);
    setPendingRole(null);
    setNoGroupOptIn(false);
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
    return shell(<MagicConfirm token={confirmParam.trim()} />);
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

  // Default profile from the signed-up account's metadata.
  const meta = cloud.user?.user_metadata || {};
  const profileDefaults = {
    name: meta.name || "", nick: (meta.name || "").split(" ")[0] || "",
    phone: meta.phone || "", age: 25, nationality: "🇵🇹 Portugal", club: "FC Porto",
    position: "Médio", foot: "Direito", attrs: { ...DEFAULT_ATTRS },
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
          <img src={BRAND.logo} alt="PITCH Club" style={{ height: 30 }} />
          <div style={{ fontSize: 13, color: C.text2 }}>{t("A ligar ao clube…")}</div>
        </div>
      );
    }

    if (cloud.status === "anon") {
      if (!authOpen) return <LandingPage onEnter={() => setAuthOpen(true)} lang={lang} onLang={changeLang} />;
      return shell(<AuthForm onSignUp={cloud.signUp} onSignIn={cloud.signIn} onResetPassword={cloud.resetPassword} onBack={() => setAuthOpen(false)} />);
    }

    if (cloud.status === "needsProfile") {
      if (!pendingRole) {
        return shell(<AuthLanding onPick={setPendingRole} onBack={logout} isAdmin={cloud.isAdmin} onOpenAdmin={() => setAdminOpen(true)} />);
      }
      if (pendingRole === "player") {
        return shell(
          <OnboardingPlayer
            me={profileDefaults}
            onBack={() => setPendingRole(null)}
            onDone={(form) => cloud.createPlayerProfile(form)}
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
      return shell(<AuthLanding onPick={handlePickRole} onBack={() => setAuthOpen(false)} />);
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
        onBack={() => setEditingGroup(false)}
        onDone={(form) => { saveSettings(form); setEditingGroup(false); }}
      />
    );
  }

  const isOrganizer = cloudMode ? Boolean(me?.isOrganizerPlayer) : session.role === "organizer";
  const inviteUrl = cloudMode && cloud.groupRow?.invite_token
    ? `${window.location.origin}?join=${cloud.groupRow.invite_token}`
    : null;

  // ── Normalized views for Stats/MVP (shared between cloud & local) ──
  const nickByKey = (key) => baseGroup.find((p) => (cloudMode ? p.uuid : p.id) === key)?.nick;

  // Points per ballot slot when tallying the local-demo top-3 (mirrors
  // MVP_BALLOT_POINTS in useCloud.js — kept in sync manually since local
  // demo has no shared module for it).
  const MVP_BALLOT_POINTS = { 1: 3, 2: 2, 3: 1 };

  let lastMatchdayView = null, historyView = [], mvp = null;
  if (cloudMode) {
    const rows = cloud.matchdays;
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
    lastMatchdayView = lastMatchday;
    historyView = history.map((g) => ({ ...g, mvpNick: g.mvpId ? baseGroup.find((p) => p.id === g.mvpId)?.nick : null }));
    if (lastMatchday) {
      mvp = {
        open: mvpVote.open,
        candidates: lastMatchday.candidates ?? [],
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
      posts,
      friendIds: [], friends: [], requests: [], sentPending: [], candidates: [],
      friendshipIdOf: () => null,
      onCreatePost: (post) => setPosts((ps) => [{ id: Date.now(), author: { id: meLocal?.id, nick: meLocal?.nick, name: meLocal?.name, photo: meLocal?.photo, groupId: "local" }, mine: true, time: "agora", type: post.type, text: post.body, media: post.media_url, likes: [], liked: false, comments: [] }, ...ps]),
      onDeletePost: (id) => setPosts((ps) => ps.filter((p) => p.id !== id)),
      onToggleLike: (id, liked) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, liked: !liked, likes: liked ? p.likes.filter((x) => x !== meLocal?.id) : [...p.likes, meLocal?.id] } : p))),
      onAddComment: (id, body) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: [...p.comments, { id: Date.now(), nick: meLocal?.nick, photo: meLocal?.photo, text: body }] } : p))),
      onSendFriend: () => {}, onRespondFriend: () => {}, onRemoveFriend: () => {},
    };
  }

  // ── Main app ───────────────────────────────────────────
  return shell(
    <>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 0" }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ height: 24 }} />
      </div>
      <div style={{ paddingBottom: 80 }}>
        {tab === "jogo" && (noGroup ? (
          <NoGroupState onJoinGroup={() => setNoGroupOptIn(false)} />
        ) : (
          <JogoTab
            group={displayGroup} game={game}
            togglePaid={togglePaid} toggleMyStatus={toggleMyStatus} payMine={payMine}
            material={material} toggleMaterial={toggleMaterial} assignMaterial={assignMaterial} addMaterial={addMaterial}
            teams={teams} drawTeams={drawTeams} onClearTeams={clearTeams} renameTeam={renameTeam} movePlayer={movePlayer} canManageTeams={canManageTeams} onSetPlayerStatus={setPlayerStatus}
            matchdayProps={{ matchday, onStart: startMatchday, onAddMatch: addMatch, onGoal: addGoal, onSetGoalkeeper: setGoalkeeper, onEnd: endMatchday }}
            lastMatchday={lastMatchdayView}
            inviteUrl={inviteUrl} canManageGame={isOrganizer} onSetSpots={setSpots}
            onReschedule={(weekday, time) => saveSettings({ ...groupSettings, weekday, time })}
            confirmOpen={confWin.isOpen} opensAtLabel={opensAtLabel}
          />
        ))}
        {tab === "clube" && cloud.isAdmin && (
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
        )}
        {tab === "social" && <SocialTab social={social} />}
        {tab === "stats" && (
          <StatsTab group={displayGroup} history={historyView} lastMatchday={lastMatchdayView} mvp={mvp} statMode={statMode} setStatMode={setStatMode} />
        )}
        {tab === "grupo" && (noGroup
          ? <NoGroupState onJoinGroup={() => setNoGroupOptIn(false)} />
          : <GrupoTab group={displayGroup} game={game} openProfile={openProfile} cloudMode={cloudMode} inviteUrl={inviteUrl} isOrganizer={isOrganizer} onToggleAssistant={cloud.toggleAssistant} onAddManualPlayer={addManualPlayer} onSetPlayerStatus={setPlayerStatus} onRemoveGuestPlayer={removeGuestPlayer} canManageTeams={canManageTeams} />)}
        {tab === "fantasy" && cloud.canSeeFantasy && (
          <FantasyTab
            group={displayGroup} me={me} canManageTeams={canManageTeams} kickoffAt={game.kickoffAt}
            fantasyLeague={cloud.fantasyLeague} fantasySquads={cloud.fantasySquads} fantasyScores={cloud.fantasyScores}
            matchdays={cloud.matchdays}
            onCreateLeague={cloud.createFantasyLeague} onSaveSquad={cloud.saveFantasySquad} onSaveFormation={cloud.saveFantasyFormation}
          />
        )}
        {tab === "perfil" && (
          <PerfilTab
            key={viewPlayerId ?? "me"}
            group={displayGroup} viewPlayerId={viewPlayerId}
            updateProfile={updateProfile} backToMe={backToMe} resetDemo={resetDemo}
            isOrganizer={isOrganizer} onEditGroup={() => setEditingGroup(true)} logout={logout}
            addPeerRating={addPeerRating} cloudMode={cloudMode} onSubmitRating={cloudMode ? cloud.submitRating : null}
            isAdmin={cloud.isAdmin} onOpenAdmin={() => setAdminOpen(true)}
            uploadMedia={uploadMedia}
            enablePush={cloudAuthed ? enablePush : null}
            security={cloud.user ? {
              email: cloud.user.email,
              updatePassword: cloud.updatePassword,
              updateEmail: cloud.updateEmail,
              signOutEverywhere,
            } : null}
            lang={lang} onLang={changeLang}
          />
        )}
      </div>

      <BottomNav tab={tab} showClube={cloud.isAdmin} showFantasy={cloud.canSeeFantasy} onSelect={(id) => { setTab(id); if (id === "perfil") setViewPlayerId(null); }} />
    </>
  );
}
