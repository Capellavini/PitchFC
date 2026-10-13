import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { C, R, S, T, TOUCH } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import { MARKETS } from "../lib/rivals";
import SegmentedControl from "./SegmentedControl";
import TeamEmptyState from "./TeamEmptyState";
import TeamSwitcher from "./TeamSwitcher";
import TeamPage from "./TeamPage";
import TeamDirectory from "./TeamDirectory";
import TeamPublicPage from "./TeamPublicPage";
import CreateTeamSheet from "./CreateTeamSheet";
import BtnGhost from "./BtnGhost";

/**
 * PITCH Rivals inside Competir → Equipa. Two views: "A minha equipa"
 * (team page, or the empty state) and "Descobrir" (team directory).
 * The team switcher only appears with >1 team. Someone else's team
 * (directory, ?team=<slug>) opens as a pushed public page.
 *
 * `focus` = { teamId?, slug?, n } — deep links / Home / Perfil ask the hub
 * to show a team; bump `n` to re-apply. `notice` = one-off message (e.g.
 * an invite that failed after signup), dismissible.
 * EXTENSION POINT (PR5): `onChallenge(team)` arms every "Desafiar".
 * `challenges` (rendered node, optional) adds a "Desafios" segment — the
 * team-mode Equipa tab uses it (A minha equipa · Desafios · Descobrir).
 * `focus.view` ("team" | "challenges" | "discover") switches segment.
 */
export default function RivalsHub({ teams, market = MARKETS.PT, focus, notice, onDismissNotice, onChallenge, challenges = null }) {
  const mine = teams.myTeams;
  const [view, setView] = useState("team");
  const [selectedId, setSelectedId] = useState(null);
  const [publicSlug, setPublicSlug] = useState(null);
  const [creating, setCreating] = useState(false);
  // { teamId, n } — open that team's invite sheet (after create / Home CTA).
  const [inviteFor, setInviteFor] = useState({ teamId: null, n: 0 });
  const askInvite = (teamId) => setInviteFor((p) => ({ teamId, n: p.n + 1 }));

  useEffect(() => {
    if (!focus) return;
    if (focus.view && !focus.teamId && !focus.slug) { setView(focus.view === "challenges" && !challenges ? "team" : focus.view); setPublicSlug(null); }
    if (focus.teamId) { setSelectedId(focus.teamId); setView("team"); setPublicSlug(null); }
    if (focus.teamId && focus.invite) askInvite(focus.teamId);
    if (focus.slug) {
      const own = mine.find((tm) => tm.slug === focus.slug);
      if (own) { setSelectedId(own.id); setView("team"); setPublicSlug(null); } else setPublicSlug(focus.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n]);

  const current = mine.find((tm) => tm.id === selectedId) || mine[0] || null;
  const home = current ? { country: current.country, city: current.city, region: current.region } : { country: market.country };

  const openSlug = (slug) => {
    const own = mine.find((tm) => tm.slug === slug);
    if (own) { setSelectedId(own.id); setView("team"); } else setPublicSlug(slug);
  };

  if (publicSlug) {
    return (
      <TeamPublicPage teams={teams} slug={publicSlug} onBack={() => setPublicSlug(null)} onChallenge={onChallenge}
        onOpenMine={(id) => { setPublicSlug(null); setSelectedId(id); setView("team"); }} />
    );
  }

  return (
    <div>
      {notice && (
        <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: S.sm, background: C.orangeDim, border: `1px solid ${C.orange}55`, borderRadius: R.control, padding: `${S.sm}px ${S.xs}px ${S.sm}px ${S.md}px`, marginBottom: S.lg, fontSize: T.meta + 1, color: C.text1, lineHeight: 1.5 }}>
          <span style={{ flex: 1, paddingTop: S.sm }}>{notice}</span>
          <button type="button" onClick={onDismissNotice} aria-label={t(RC.close)}
            style={{ width: TOUCH.min, height: TOUCH.min, flexShrink: 0, background: "none", border: "none", color: C.text2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>
      )}

      <SegmentedControl value={view} onChange={setView}
        options={[{ id: "team", label: RC.myTeam }, ...(challenges ? [{ id: "challenges", label: RC.segChallenges }] : []), { id: "discover", label: RC.segDiscover }]} />

      {view === "challenges" && challenges ? challenges : view === "discover" ? (
        <TeamDirectory teams={teams} home={home} onOpenTeam={openSlug} onChallenge={current ? onChallenge : undefined} />
      ) : teams.loading && !mine.length ? (
        <div aria-busy="true" style={{ fontSize: T.body, color: C.text2, padding: `${S.lg}px 0` }}>{t(RC.loading)}</div>
      ) : !current ? (
        <TeamEmptyState onCreate={() => setCreating(true)}
          onJoin={async (token) => {
            const r = await teams.acceptInvite(token);
            if (!r.error) setSelectedId(r.data.teamId);
            return r;
          }} />
      ) : (
        <>
          {mine.length > 1 && <TeamSwitcher teams={mine} value={current.id} onChange={setSelectedId} onNew={() => setCreating(true)} />}
          <TeamPage key={current.id} teams={teams} teamId={current.id} onChallenge={onChallenge ? () => onChallenge(null, current) : undefined}
            inviteSignal={inviteFor.teamId === current.id ? inviteFor.n : 0}
            onLeft={() => setSelectedId(null)} />
          {mine.length === 1 && (
            <BtnGhost block onClick={() => setCreating(true)} style={{ marginBottom: S.xl }}><Plus size={16} /> {t(RC.newTeam)}</BtnGhost>
          )}
        </>
      )}

      {creating && (
        <CreateTeamSheet teams={teams} market={MARKETS[home.country] || market}
          defaults={{ city: current?.city, region: current?.region }}
          onClose={() => setCreating(false)}
          onCreated={(teamId) => { setCreating(false); setSelectedId(teamId); setView("team"); askInvite(teamId); }} />
      )}
    </div>
  );
}
