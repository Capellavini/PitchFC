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
import { nextGameDateLabel, fmtEUR } from "./lib/helpers";
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
  const [mvpVote, setMvpVote]   = usePersistentState("mvpVote", { open: true, votedFor: null });
  const [tab, setTab]           = useState("jogo");
  const [statMode, setStatMode] = useState("goals");
  const [viewPlayerId, setViewPlayerId] = useState(null);
  const [editingGroup, setEditingGroup] = useState(false);

  const me = group.find((p) => p.isMe);

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

  const updateProfile = (form) =>
    setGroup((g) => g.map((p) => (p.isMe ? { ...p, ...form } : p)));

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

  const logout = () => setSession({ role: null, onboarded: false });

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

  // ── Auth gate ──────────────────────────────────────────
  if (!session.role) {
    return shell(<AuthLanding onPick={(role) => setSession({ role, onboarded: false })} />);
  }

  if (!session.onboarded) {
    return shell(
      session.role === "player" ? (
        <OnboardingPlayer
          me={me}
          onBack={logout}
          onDone={(form) => { updateProfile(form); setSession((s) => ({ ...s, onboarded: true })); }}
        />
      ) : (
        <OnboardingOrganizer
          settings={settings}
          onBack={logout}
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
            group={group}
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
        {tab === "social" && <SocialTab group={group} posts={posts} setPosts={setPosts} meId={me.id} />}
        {tab === "stats" && (
          <StatsTab group={group} mvpVote={mvpVote} setMvpVote={setMvpVote} statMode={statMode} setStatMode={setStatMode} />
        )}
        {tab === "grupo" && <GrupoTab group={group} game={game} openProfile={openProfile} />}
        {tab === "perfil" && (
          <PerfilTab
            key={viewPlayerId ?? "me"}
            group={group}
            viewPlayerId={viewPlayerId}
            updateProfile={updateProfile}
            backToMe={backToMe}
            resetDemo={resetDemo}
            isOrganizer={session.role === "organizer"}
            onEditGroup={() => setEditingGroup(true)}
            logout={logout}
          />
        )}
      </div>

      <BottomNav tab={tab} onSelect={(id) => { setTab(id); if (id === "perfil") setViewPlayerId(null); }} />
    </>
  );
}
