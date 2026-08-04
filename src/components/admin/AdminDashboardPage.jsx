import { useEffect, useState } from "react";
import { LayoutDashboard, Users2, UsersRound, Target, Trophy, Map, LogOut, RefreshCw } from "lucide-react";
import { C, BRAND, displayFont } from "../../theme";
import AdminOverviewTab from "./AdminOverviewTab";
import AdminGroupsTab from "./AdminGroupsTab";
import AdminUsersTab from "./AdminUsersTab";
import AdminMvpTab from "./AdminMvpTab";
import AdminFantasyTab from "./AdminFantasyTab";
import AdminRoadmapTab from "./AdminRoadmapTab";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";
const NAV = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "mvp", label: "MVP", icon: Target },
  { id: "groups", label: "Grupos", icon: Users2 },
  { id: "users", label: "Utilizadores", icon: UsersRound },
  { id: "fantasy", label: "Pitch Manager", icon: Trophy },
  { id: "roadmap", label: "Roadmap", icon: Map },
];

/** Standalone desktop admin dashboard at /admin — separate from the
 *  mobile-shell AdminPanel reachable from inside the app. Same Supabase
 *  session/admin gate (cloud.isAdmin), just not squeezed into the 430px
 *  phone shell: a real sidebar + tables, meant to grow into the group's
 *  metrics/control-panel home (usage %, players per group, etc). */
export default function AdminDashboardPage({ cloud, localMode }) {
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ email: "", password: "" });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [snapshot, setSnapshot] = useState({ loading: true, error: null, groups: [], players: [], games: [], attendances: [], matchdays: [] });
  const [leads, setLeads] = useState({ loading: true, error: null, rows: [] });
  const [fantasy, setFantasy] = useState({ loading: true, error: null, leagues: [], squads: [], players: [] });
  const [cards, setCards] = useState({ loading: true, error: null, rows: [] });
  const [roadmap, setRoadmap] = useState({ loading: true, error: null, data: null });

  const canLoad = Boolean(cloud.user) && cloud.isAdmin;

  const loadSnapshot = async () => {
    setSnapshot((s) => ({ ...s, loading: true }));
    const data = await cloud.fetchAdminData();
    setSnapshot({ loading: false, error: data.error ?? null, groups: data.groups ?? [], players: data.players ?? [], games: data.games ?? [], attendances: data.attendances ?? [], matchdays: data.matchdays ?? [] });
  };
  const loadLeads = async () => {
    setLeads((s) => ({ ...s, loading: true }));
    const data = await cloud.fetchLeads();
    setLeads({ loading: false, error: data.error ?? null, rows: data.leads ?? [] });
  };
  const loadFantasy = async () => {
    setFantasy((s) => ({ ...s, loading: true }));
    const data = await cloud.fetchFantasyAdminData();
    setFantasy({ loading: false, error: data.error ?? null, leagues: data.leagues ?? [], squads: data.squads ?? [], players: data.players ?? [] });
  };
  const loadCards = async () => {
    setCards((s) => ({ ...s, loading: true }));
    const data = await cloud.fetchCardGenerations();
    setCards({ loading: false, error: data.error ?? null, rows: data.rows ?? [] });
  };
  const loadRoadmap = async () => {
    setRoadmap((s) => ({ ...s, loading: true }));
    const res = await cloud.fetchRoadmapContent();
    setRoadmap({ loading: false, error: res.error ?? null, data: res.data ?? null });
  };
  const refetchAll = () => { loadSnapshot(); loadLeads(); loadFantasy(); loadCards(); loadRoadmap(); };

  useEffect(() => {
    if (canLoad) refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const page = (children) => (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text1, fontFamily: FONT }}>
      {children}
    </div>
  );

  const centeredMessage = (title, body, action) => page(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 26, marginBottom: 24 }} />
        <div style={{ ...displayFont, fontSize: 20, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: action ? 20 : 0 }}>{body}</div>
        {action}
      </div>
    </div>
  );

  if (localMode) {
    return centeredMessage("Painel de administrador", "A app está em modo demonstração (sem chaves Supabase configuradas). O painel precisa de ligação à cloud.");
  }
  if (cloud.status === "loading") {
    return centeredMessage("A ligar…", "A verificar sessão.");
  }
  if (!cloud.user) {
    const submit = async (e) => {
      e.preventDefault();
      setAuthBusy(true); setAuthError(null);
      const res = await cloud.signIn(form.email.trim(), form.password);
      setAuthBusy(false);
      if (res?.error) setAuthError(res.error);
    };
    return page(
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 340 }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 26, marginBottom: 24, display: "block", marginLeft: "auto", marginRight: "auto" }} />
          <div style={{ ...displayFont, fontSize: 20, textAlign: "center", marginBottom: 4 }}>Painel de administrador</div>
          <div style={{ fontSize: 12, color: C.text2, textAlign: "center", marginBottom: 24 }}>Inicia sessão com a tua conta de administrador.</div>
          <div style={{ marginBottom: 12 }}>
            <input type="email" required placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="password" required placeholder="Palavra-passe" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: C.text1, outline: "none" }} />
          </div>
          {authError && <div style={{ fontSize: 12, color: C.red, marginBottom: 12 }}>{authError}</div>}
          <button type="submit" disabled={authBusy} style={{ width: "100%", background: C.accent, color: C.bg, border: "none", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 800, cursor: authBusy ? "default" : "pointer", opacity: authBusy ? 0.6 : 1 }}>
            {authBusy ? "A entrar…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }
  if (!cloud.isAdmin) {
    return centeredMessage(
      "Sem acesso",
      `Sessão iniciada como ${cloud.user.email}, que não é uma conta de administrador.`,
      <button onClick={cloud.signOut} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 18px", fontSize: 13, color: C.text2, cursor: "pointer" }}>
        Sair
      </button>
    );
  }

  const tabProps = { cloud, snapshot, leads, fantasy, cards, roadmap, refetchGroups: loadSnapshot, refetchLeads: loadLeads, refetchRoadmap: loadRoadmap };

  return page(
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: "24px 16px", display: "flex", flexDirection: "column" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 24, marginBottom: 28, marginLeft: 4 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                background: active ? C.accentDim : "transparent", color: active ? C.accent : C.text2,
                border: `1px solid ${active ? C.accentBorder : "transparent"}`, borderRadius: 10,
                padding: "10px 12px", fontSize: 13, fontWeight: active ? 800 : 600, cursor: "pointer",
              }}>
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 14 }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cloud.user.email}</div>
          <button onClick={cloud.signOut} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: C.text2, fontSize: 12, cursor: "pointer", padding: 0 }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px 36px", maxWidth: 1180 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ ...displayFont, fontSize: 24 }}>{NAV.find((n) => n.id === tab)?.label}</div>
          <button onClick={refetchAll} title="Atualizar" style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: C.text2, cursor: "pointer" }}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {tab === "overview" && <AdminOverviewTab {...tabProps} />}
        {tab === "mvp" && <AdminMvpTab {...tabProps} />}
        {tab === "groups" && <AdminGroupsTab {...tabProps} />}
        {tab === "users" && <AdminUsersTab {...tabProps} />}
        {tab === "fantasy" && <AdminFantasyTab {...tabProps} />}
        {tab === "roadmap" && <AdminRoadmapTab {...tabProps} />}
      </div>
    </div>
  );
}
