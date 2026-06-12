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
import { useState } from "react";
import { C, BRAND } from "./theme";
import { INITIAL_GROUP, INITIAL_MATERIAL, INITIAL_POSTS, DEFAULT_SETTINGS, POSITIONS } from "./data";
import { usePersistentState, clearAppStorage } from "./lib/storage";
import { nextGameDateLabel, fmtEUR, decodePayload, blendAttrs } from "./lib/helpers";
import LandingPage from "./components/LandingPage";
import RatePlayer from "./components/RatePlayer";
import AuthLanding from "./components/AuthLanding";
import OnboardingPlayer from "./components/OnboardingPlayer";
import OnboardingOrganizer from "./components/OnboardingOrganizer";
import BottomNav from "./components/BottomNav";
import JogoTab from "./components/JogoTab";
import SocialTab from "./components/SocialTab";
import StatsTab from "./components/StatsTab";
import GrupoTab from "./components/GrupoTab";
import PerfilTab from "./components/PerfilTab";

const APP_FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

export default function PitchApp() {
  const [session, setSession]   = usePersistentState("session", { role: null, onboarded: false });
  const [settings, setSettings] = usePersistentState("settings", DEFAULT_SETTINGS);
  const [group, setGroup]       = usePersistentState("group", INITIAL_GROUP);
  const [material, setMaterial] = usePersistentState("material", INITIAL_MATERIAL);
  const [posts, setPosts]       = usePersistentState("posts", INITIAL_POSTS);
  const [teams, setTeams]       = usePersistentState("teams", null);
  const [peerRatings, setPeerRatings] = usePersistentState("peerRatings", []);
  const [mvpVote, setMvpVote]   = usePersistentState("mvpVote", { open: true, votedFor: null });
  const [tab, setTab]           = useState("jogo");
  const [authOpen, setAuthOpen] = useState(false);
  const [statMode, setStatMode] = useState("goals");
  const [viewPlayerId, setViewPlayerId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);

  const me = group.find((p) => p.isMe);

  // Card attrs shown everywhere = 50/50 blend of self-assessment and
  // friends' ratings; selfAttrs keeps the editable original.
  const displayGroup = group.map((p) =>
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
    ...settings,
    label: settings.groupName,
    date: nextGameDateLabel(settings.weekday),
    spots: settings.maxPlayers,
    priceEach: settings.maxPlayers > 0 ? settings.monthlyPrice / settings.maxPlayers : 0,
  };

  const togglePaid = (id) =>
    setGroup((g) => g.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)));

  const payMine = () =>
    setGroup((g) => g.map((p) => (p.isMe ? { ...p, paid: true } : p)));

  const toggleMyStatus = (newStatus) => {
    setGroup((g) => g.map((p) => (p.isMe ? { ...p, status: newStatus, paid: newStatus === "confirmed" ? p.paid : false } : p)));
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
    setGroup((g) => g.map((p) => (p.isMe ? { ...p, ...rest } : p)));
  };

  // Position-balanced team draw: shuffle, group by position,
  // alternate assignment so each team gets a spread. Stores ids
  // so the roster stays the single source of truth.
  const drawTeams = () => {
    const confirmed = group.filter((p) => p.status === "confirmed");
    const shuffled = [...confirmed].sort(() => Math.random() - 0.5);
    const byPos = POSITIONS.flatMap((pos) => shuffled.filter((p) => p.position === pos));
    const a = [], b = [];
    byPos.forEach((p, i) => (i % 2 === 0 ? a : b).push(p.id));
    setTeams({ a, b });
  };

  const openProfile = (id) => { setViewPlayerId(id); setTab("perfil"); };
  const backToMe = () => setViewPlayerId(null);

  // Back to the marketing page on logout; back from onboarding only
  // returns to the role pick.
  const logout = () => { setSession({ role: null, onboarded: false }); setAuthOpen(false); };
  const backToRolePick = () => setSession({ role: null, onboarded: false });

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

  // ── Marketing page → auth gate ─────────────────────────
  if (!session.role) {
    if (!authOpen) return <LandingPage onEnter={() => setAuthOpen(true)} />;
    return shell(<AuthLanding onPick={(role) => setSession({ role, onboarded: false })} onBack={() => setAuthOpen(false)} />);
  }

  if (!session.onboarded) {
    return shell(
      session.role === "player" ? (
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
        settings={settings}
        onBack={() => setEditingGroup(false)}
        onDone={(form) => { setSettings(form); setEditingGroup(false); }}
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
          />
        )}
        {tab === "social" && <SocialTab group={displayGroup} posts={posts} setPosts={setPosts} meId={me.id} />}
        {tab === "stats" && (
          <StatsTab group={displayGroup} mvpVote={mvpVote} setMvpVote={setMvpVote} statMode={statMode} setStatMode={setStatMode} />
        )}
        {tab === "grupo" && <GrupoTab group={displayGroup} game={game} openProfile={openProfile} />}
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
