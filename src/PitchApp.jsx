/**
 * PITCH — Weekly Game Organizer
 * ─────────────────────────────────────────────────────────
 * Core problem: 15 friends, 10 spots, every Saturday.
 * Replace the WhatsApp chaos: confirmations, payments,
 * stats, MVP voting, team draw, equipment.
 *
 * State lives here (lifted to the root) and persists to
 * localStorage. See CLAUDE.md for the backend plan (Supabase) —
 * when it lands, these handlers become the thin data layer's
 * mutation calls, and the local "session" is replaced by
 * magic-link auth.
 */
import { useEffect, useState } from "react";
import { C, BRAND } from "./theme";
import { INITIAL_GROUP, INITIAL_MATERIAL, INITIAL_POSTS, DEFAULT_SETTINGS, POSITIONS, HISTORY, INITIAL_BOOKINGS, CLUB_EVENTS, OPEN_MATCHES } from "./data";
import { usePersistentState, clearAppStorage } from "./lib/storage";
import { nextGameDateLabel, fmtEUR, decodePayload, blendAttrs, fmtDayMonth, isoDay } from "./lib/helpers";
import { useCloudGroup } from "./hooks/useCloudGroup";
import LandingPage from "./components/LandingPage";
import PickPlayer from "./components/PickPlayer";
import RatePlayer from "./components/RatePlayer";
import AuthLanding from "./components/AuthLanding";
import OnboardingPlayer from "./components/OnboardingPlayer";
import OnboardingOrganizer from "./components/OnboardingOrganizer";
import BottomNav from "./components/BottomNav";
import JogoTab from "./components/JogoTab";
import ClubeTab from "./components/ClubeTab";
import SocialTab from "./components/SocialTab";
import StatsTab from "./components/StatsTab";
import GrupoTab from "./components/GrupoTab";
import PerfilTab from "./components/PerfilTab";

const APP_FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

// Season totals stay device-local until the matchday PR moves them to
// the cloud; seeded with the demo numbers, keyed by legacy player id.
const SEASON_EXTRAS = Object.fromEntries(
  INITIAL_GROUP.map((p) => [p.id, { goals: p.goals, assists: p.assists, mvps: p.mvps, gamesPlayed: p.gamesPlayed }])
);

// Seed uuids encode the prototype's numeric id in the last segment.
const legacyId = (uuid) => parseInt(uuid.slice(-12), 10);

export default function PitchApp() {
  const [session, setSession]   = usePersistentState("session", { role: null, onboarded: false });
  const [settings, setSettings] = usePersistentState("settings", DEFAULT_SETTINGS);
  const [group, setGroup]       = usePersistentState("group", INITIAL_GROUP);
  const [material, setMaterial] = usePersistentState("material", INITIAL_MATERIAL);
  const [posts, setPosts]       = usePersistentState("posts", INITIAL_POSTS);
  const [teams, setTeams]       = usePersistentState("teams", null);
  const [peerRatings, setPeerRatings] = usePersistentState("peerRatings", []);
  const [mvpVote, setMvpVote]   = usePersistentState("mvpVote", { open: true, votedFor: null });
  const [history, setHistory]   = usePersistentState("history", HISTORY);
  const [matchday, setMatchday] = usePersistentState("matchday", null);
  const [lastMatchday, setLastMatchday] = usePersistentState("lastMatchday", null);
  const [bookings, setBookings] = usePersistentState("bookings", INITIAL_BOOKINGS);
  const [events, setEvents]     = usePersistentState("events", CLUB_EVENTS);
  const [openMatches, setOpenMatches] = usePersistentState("openMatches", OPEN_MATCHES);
  const [ownPublished, setOwnPublished] = usePersistentState("ownPublished", false);
  const [identity, setIdentity] = usePersistentState("identity", null); // { uuid, token }
  const [extras, setExtras]     = usePersistentState("extras", SEASON_EXTRAS);
  const [tab, setTab]           = useState("jogo");
  const [authOpen, setAuthOpen] = useState(false);
  const [statMode, setStatMode] = useState("goals");
  const [viewPlayerId, setViewPlayerId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);

  // ── Cloud sync (PR 1: roster + settings + attendances) ──
  const cloud = useCloudGroup();
  const cloudMode = cloud.status === "ready";

  // Cloud rows → the app's player shape. Numeric legacy ids keep all
  // local features (posts, teams, material…) working unchanged.
  const baseGroup = cloudMode
    ? cloud.players.map((p) => {
        const att = cloud.attendances.find((a) => a.player_id === p.id);
        const id = legacyId(p.id);
        const ex = extras[id] ?? { goals: 0, assists: 0, mvps: 0, gamesPlayed: 0 };
        return {
          id, uuid: p.id, name: p.name, nick: p.nick, email: p.email, phone: p.phone,
          photo: p.photo_url, age: p.age, nationality: p.nationality, club: p.club,
          position: p.position, foot: p.foot, attrs: p.attrs,
          isOrganizerPlayer: p.is_organizer, magicToken: p.magic_token,
          status: att?.status ?? "pending", paid: att?.paid ?? false,
          isMe: identity?.uuid === p.id, ...ex,
        };
      })
    : group;

  const groupSettings = cloudMode
    ? {
        groupName: cloud.groupRow.name, venue: cloud.groupRow.venue,
        weekday: cloud.groupRow.weekday, time: cloud.groupRow.game_time,
        monthlyPrice: cloud.groupRow.monthly_price_cents / 100, maxPlayers: cloud.groupRow.max_players,
      }
    : settings;

  const saveSettings = (form) => {
    if (cloudMode) {
      cloud.updateGroupRow({
        name: form.groupName, venue: form.venue, weekday: form.weekday, game_time: form.time,
        monthly_price_cents: Math.round(form.monthlyPrice * 100), max_players: form.maxPlayers,
      });
    } else {
      setSettings(form);
    }
  };

  const me = baseGroup.find((p) => p.isMe);

  // Magic link (?p=token): identifies this device as that player.
  const pToken = new URLSearchParams(window.location.search).get("p");
  useEffect(() => {
    if (!pToken || cloud.status !== "ready") return;
    const pl = cloud.players.find((x) => x.magic_token === pToken);
    if (pl) {
      setIdentity({ uuid: pl.id, token: pToken });
      setSession({ role: pl.is_organizer ? "organizer" : "player", onboarded: true });
    }
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pToken, cloud.status]);

  // Card attrs shown everywhere = 50/50 blend of self-assessment and
  // friends' ratings; selfAttrs keeps the editable original.
  const displayGroup = baseGroup.map((p) =>
    p.isMe && peerRatings.length
      ? { ...p, attrs: blendAttrs(p.attrs, peerRatings.map((r) => r.a)), selfAttrs: p.attrs }
      : p
  );

  const addPeerRating = (codeStr) => {
    const rating = decodePayload(codeStr);
    if (!rating?.a || typeof rating.a.rit !== "number") return false;
    setPeerRatings((prev) => [...prev, rating]);
    return true;
  };

  // The "next game" as the UI consumes it — derived from organizer settings.
  const game = {
    ...groupSettings,
    label: groupSettings.groupName,
    date: nextGameDateLabel(groupSettings.weekday),
    spots: groupSettings.maxPlayers,
    priceEach: groupSettings.maxPlayers > 0 ? groupSettings.monthlyPrice / groupSettings.maxPlayers : 0,
  };

  const togglePaid = (id) => {
    const player = baseGroup.find((p) => p.id === id);
    if (cloudMode) cloud.setPaid(player.uuid, !player.paid);
    else setGroup((g) => g.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));
  };

  const payMine = () => {
    if (cloudMode && me) cloud.setPaid(me.uuid, true);
    else setGroup((g) => g.map((p) => (p.isMe ? { ...p, paid: true } : p)));
  };

  const toggleMyStatus = (newStatus) => {
    if (cloudMode && me) {
      cloud.setMyStatus(me.uuid, newStatus);
      if (newStatus !== "confirmed" && me.paid) cloud.setPaid(me.uuid, false);
    } else {
      setGroup((g) => g.map((p) => (p.isMe ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false } : p)));
    }
    setTeams(null); // roster changed → invalidate draw
  };

  const toggleMaterial = (id) =>
    setMaterial((m) => m.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  const assignMaterial = (id, playerId) =>
    setMaterial((m) => m.map((x) => (x.id === id ? { ...x, assignedTo: playerId } : x)));

  const addMaterial = (item) =>
    setMaterial((m) => [...m, { id: Date.now(), item, assignedTo: null, done: false }]);

  const updateProfile = (form) => {
    const { selfAttrs: _ignored, ...rest } = form; // display-only field
    if (cloudMode && me) {
      cloud.updatePlayer(me.uuid, {
        name: rest.name, nick: rest.nick, email: rest.email, phone: rest.phone,
        age: rest.age, nationality: rest.nationality, club: rest.club,
        position: rest.position, foot: rest.foot, attrs: rest.attrs,
        photo_url: rest.photo ?? null,
      });
    } else {
      setGroup((g) => g.map((p) => (p.isMe ? { ...p, ...rest } : p)));
    }
  };

  // Position-balanced team draw: shuffle, group by position,
  // alternate assignment so each team gets a spread. Stores ids
  // so the roster stays the single source of truth.
  const drawTeams = () => {
    const confirmed = baseGroup.filter((p) => p.status === "confirmed");
    const shuffled = [...confirmed].sort(() => Math.random() - 0.5);
    const byPos = POSITIONS.flatMap((pos) => shuffled.filter((p) => p.position === pos));
    const a = [], b = [];
    byPos.forEach((p, i) => (i % 2 === 0 ? a : b).push(p.id));
    setTeams({ a, b });
  };

  // ── Live matchday ──────────────────────────────────────
  const startMatchday = () =>
    setMatchday({ startedAt: Date.now(), matches: [{ id: Date.now(), n: 1, events: [] }] });

  const addMatch = () =>
    setMatchday((md) => ({ ...md, matches: [...md.matches, { id: Date.now(), n: md.matches.length + 1, events: [] }] }));

  const addGoal = (matchId, event) =>
    setMatchday((md) => ({ ...md, matches: md.matches.map((m) => (m.id === matchId ? { ...m, events: [...m.events, event] } : m)) }));

  /** Close the matchday: per-player stats (goals/assists + clean sheets
   *  for GR/Defesa), season totals, history entry, MVP vote opens. */
  const endMatchday = () => {
    if (!matchday) return;
    if (!window.confirm("Terminar o dia de jogo? As stats entram para a época e abre a votação MVP.")) return;

    const stats = {};
    const bump = (id, key) => {
      if (!id) return;
      stats[id] = stats[id] ?? { goals: 0, assists: 0, cleanSheets: 0 };
      stats[id][key] += 1;
    };
    matchday.matches.forEach((m) => m.events.forEach((e) => { bump(e.scorerId, "goals"); bump(e.assistId, "assists"); }));

    let totalA = 0, totalB = 0;
    matchday.matches.forEach((m) => {
      const ga = m.events.filter((e) => e.team === "a").length;
      const gb = m.events.filter((e) => e.team === "b").length;
      totalA += ga; totalB += gb;
      const awardCleanSheet = (ids) => ids.forEach((id) => {
        const p = baseGroup.find((x) => x.id === id);
        if (p && (p.position === "Guarda-redes" || p.position === "Defesa")) bump(id, "cleanSheets");
      });
      if (teams) {
        if (gb === 0) awardCleanSheet(teams.a);
        if (ga === 0) awardCleanSheet(teams.b);
      }
    });

    const confirmed = baseGroup.filter((p) => p.status === "confirmed");
    if (cloudMode) {
      setExtras((ex) => {
        const out = { ...ex };
        baseGroup.forEach((p) => {
          const s = stats[p.id];
          const played = p.status === "confirmed";
          if (!s && !played) return;
          const cur = out[p.id] ?? { goals: 0, assists: 0, mvps: 0, gamesPlayed: 0 };
          out[p.id] = { ...cur, goals: cur.goals + (s?.goals ?? 0), assists: cur.assists + (s?.assists ?? 0), gamesPlayed: cur.gamesPlayed + (played ? 1 : 0) };
        });
        return out;
      });
    } else {
      setGroup((g) => g.map((p) => {
        const s = stats[p.id];
        const played = p.status === "confirmed";
        if (!s && !played) return p;
        return { ...p, goals: p.goals + (s?.goals ?? 0), assists: p.assists + (s?.assists ?? 0), gamesPlayed: p.gamesPlayed + (played ? 1 : 0) };
      }));
    }

    const date = fmtDayMonth(isoDay(0));
    setHistory((h) => [{
      id: Date.now(), date, confirmed: confirmed.length, result: `${totalA}–${totalB}`,
      allPaid: confirmed.every((p) => p.paid), mvpId: null, games: matchday.matches.length,
    }, ...h]);
    setLastMatchday({
      date,
      matches: matchday.matches.map((m) => ({
        n: m.n,
        scoreA: m.events.filter((e) => e.team === "a").length,
        scoreB: m.events.filter((e) => e.team === "b").length,
      })),
      playerStats: stats,
      playerIds: confirmed.map((p) => p.id),
    });
    setMvpVote({ open: true, votedFor: null });
    setMatchday(null);
  };

  // ── Club: bookings, events, open matches ───────────────
  const toggleBooking = (court, date, hour) =>
    setBookings((bs) => {
      const mine = bs.find((b) => b.court === court && b.date === date && b.hour === hour && b.mine);
      if (mine) return bs.filter((b) => b !== mine);
      return [...bs, { id: Date.now(), court, date, hour, groupName: groupSettings.groupName, mine: true }];
    });

  const rsvpEvent = (id, cancel = false) =>
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, myStatus: cancel ? null : "going" } : e)));

  const payEvent = (id) =>
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, myStatus: "paid" } : e)));

  const joinOpenMatch = (id) =>
    setOpenMatches((ms) => ms.map((m) => (m.id === id && m.spotsLeft > 0 ? { ...m, spotsLeft: m.spotsLeft - 1, joined: true } : m)));

  const openProfile = (id) => { setViewPlayerId(id); setTab("perfil"); };
  const backToMe = () => setViewPlayerId(null);

  // Back to the marketing page on logout; back from onboarding only
  // returns to the role pick.
  const logout = () => { setSession({ role: null, onboarded: false }); setAuthOpen(false); setIdentity(null); };
  const backToRolePick = () => setSession({ role: null, onboarded: false });

  // Cloud mode: profiles already exist, so picking a role claims an
  // identity instead of creating a profile.
  const handlePickRole = (role) => {
    if (cloudMode && role === "organizer") {
      const org = baseGroup.find((p) => p.isOrganizerPlayer);
      if (org) setIdentity({ uuid: org.uuid, token: org.magicToken });
      setSession({ role, onboarded: true });
      return;
    }
    setSession({ role, onboarded: false });
  };

  const claimPlayer = (id) => {
    const pl = baseGroup.find((p) => p.id === id);
    if (!pl) return;
    setIdentity({ uuid: pl.uuid, token: pl.magicToken });
    setSession({ role: pl.isOrganizerPlayer ? "organizer" : "player", onboarded: true });
  };

  const resetDemo = () => {
    if (window.confirm("Repor os dados de demonstração? As alterações locais serão perdidas.")) {
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
    // '+' in base64 arrives as a space after URL decoding — restore it.
    return shell(<RatePlayer payload={rateParam.replace(/ /g, "+")} />);
  }

  // Cloud sync in flight — short splash before any gate decisions
  if (cloud.status === "loading") {
    return shell(
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ height: 30 }} />
        <div style={{ fontSize: 13, color: C.text2 }}>A ligar ao clube…</div>
      </div>
    );
  }

  // ── Marketing page → auth gate ─────────────────────────
  if (!session.role) {
    if (!authOpen) return <LandingPage onEnter={() => setAuthOpen(true)} />;
    return shell(<AuthLanding onPick={handlePickRole} onBack={() => setAuthOpen(false)} />);
  }

  if (!session.onboarded || (cloudMode && !me)) {
    return shell(
      cloudMode ? (
        <PickPlayer players={baseGroup} groupName={groupSettings.groupName} onPick={claimPlayer} onBack={backToRolePick} />
      ) : session.role === "player" ? (
        <OnboardingPlayer
          me={me}
          onBack={backToRolePick}
          onDone={(form) => { updateProfile(form); setSession((s) => ({ ...s, onboarded: true })); }}
        />
      ) : (
        <OnboardingOrganizer
          settings={settings}
          onBack={backToRolePick}
          onDone={(form) => { setSettings(form); setSession((s) => ({ ...s, onboarded: true })); }}
        />
      )
    );
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

  // ── Main app ───────────────────────────────────────────
  return shell(
    <>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px 0" }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ height: 24 }} />
      </div>
      <div style={{ paddingBottom: 80 }}>
        {tab === "jogo" && (
          <JogoTab
            group={displayGroup}
            game={game}
            togglePaid={togglePaid}
            toggleMyStatus={toggleMyStatus}
            payMine={payMine}
            material={material}
            toggleMaterial={toggleMaterial}
            assignMaterial={assignMaterial}
            addMaterial={addMaterial}
            teams={teams}
            drawTeams={drawTeams}
            matchdayProps={{ matchday, onStart: startMatchday, onAddMatch: addMatch, onGoal: addGoal, onEnd: endMatchday }}
          />
        )}
        {tab === "clube" && (
          <ClubeTab
            bookings={bookings}
            toggleBooking={toggleBooking}
            events={events}
            rsvpEvent={rsvpEvent}
            payEvent={payEvent}
            openMatches={openMatches}
            joinOpenMatch={joinOpenMatch}
            ownOpenSpots={Math.max(0, game.spots - baseGroup.filter((p) => p.status === "confirmed").length)}
            ownPublished={ownPublished}
            publishOwnGame={() => setOwnPublished((v) => !v)}
            game={game}
          />
        )}
        {tab === "social" && <SocialTab group={displayGroup} posts={posts} setPosts={setPosts} meId={me.id} />}
        {tab === "stats" && (
          <StatsTab group={displayGroup} history={history} lastMatchday={lastMatchday} mvpVote={mvpVote} setMvpVote={setMvpVote} statMode={statMode} setStatMode={setStatMode} />
        )}
        {tab === "grupo" && <GrupoTab group={displayGroup} game={game} openProfile={openProfile} cloudMode={cloudMode} />}
        {tab === "perfil" && (
          <PerfilTab
            key={viewPlayerId ?? "me"}
            group={displayGroup}
            viewPlayerId={viewPlayerId}
            updateProfile={updateProfile}
            backToMe={backToMe}
            resetDemo={resetDemo}
            isOrganizer={session.role === "organizer"}
            onEditGroup={() => setEditingGroup(true)}
            logout={logout}
            peerRatings={peerRatings}
            addPeerRating={addPeerRating}
          />
        )}
      </div>

      <BottomNav tab={tab} onSelect={(id) => { setTab(id); if (id === "perfil") setViewPlayerId(null); }} />
    </>
  );
}
