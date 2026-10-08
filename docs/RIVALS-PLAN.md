# PITCH Rivals (Teams & Challenges v1) — plano técnico

Audit + plan by Cris's planning agent, 2026-10-08 (main @ 247031d). Product spec and owner decisions: `docs/TEAMS-CHALLENGES-SPEC.md` (decisions block wins). Option B: the challenge match is its own entity; **no statement touches games / attendances / matchdays**.

## 0. Production issues found (fix first)
1. Legacy `TeamsSection` was visible to every cloud user with no flag → **fixed in PR0 (52adb40)**: now gated by `isEnabled("teams")`.
2. Migration 49 policy holes: `team_members insert` lets anyone add themselves to any team; `teams insert` only checks auth; `teams update` lets a captain set any `captain_id`; `useCloud.createTeam` auto-adds the whole group roster without consent. → closed by PR1 (all writes via RPCs).
3. `useCloud.load()` only fetches `myTeams` when status is `ready` (not `needsGroup`).
4. Nothing else (wa-bot, Edge Functions, Adjunto) references teams/team_members.

## 1. Audit verdicts (main vs old branch `worktree-agent-afcf9e49e011cab46` vs spec)
- **Team entity:** adapt branch columns (slug, secondary_color, home_venue, preferred_format, created_by) + `archived_at`, `updated_at`, `timezone`, `currency`.
- **Roles:** build `vice` (one captain + ≤1 vice, unique partial indexes). Membership history: `status active/left/removed` + `left_at` (no hard delete).
- **Team invite:** adapt → `team_invites` with expiry, revocation, uses; readable by leaders only; joining always gives role `player`.
- **Writes:** revoke direct insert/update/delete; SECURITY DEFINER RPCs only.
- **Create team from group:** drop roster auto-add; offer "share the invite link in the group".
- **Challenge proposal:** rebuild — one `team_challenges` row + immutable `team_challenge_versions` (branch's one-row-per-counter model rejected: stable id for links/FK, "accept current version" = integer check under row lock, diff n-1 vs n, history never rewritten).
- **Match:** discard all branch changes to games/attendances/matchdays; build `team_matches`.
- **Result:** rebuild with `team_match_results` revisions + audit log.
- **W-D-L:** SECURITY DEFINER read functions over the official score (not RLS-bypassing views).
- **New:** RSVP (`team_match_availability`), lineup (`team_match_lineup`), expiry (lazy + hourly pg_cron).
- **Pure logic/hook:** adapt branch `src/lib/teams.js` → `src/lib/rivals.js`; `src/hooks/useTeams.js` adapted (cloud + demo) and rewired to RPCs; remove team functions + `myTeams` from `useCloud.js`; delete `TeamsSection`.
- **UI:** adapt TeamPage, CreateTeamSheet, ChallengeCard, ChallengeSheet (→ composer), ResultSheet; rewrite hubs. Use main's `SegmentedControl`; adopt branch Sheet (+ Escape, focus, translated "Fechar"), FormField, FormPills, ColorSwatches, ScoreStepper, TeamBadge; theme `TEAM_COLORS`, `inkOn`, `inputStyle`.
- **i18n:** branch had none → `src/lib/rivalsCopy.js` via `registerStrings` (PT-PT / PT-BR "time" / EN). "PITCH Rivals" never translated.
- **Keep Rivals logic out of `src/lib/core/`** (bot doesn't need it).

## 2. Data model — migrations 007000 / 007100 / 007200 (+ a check script each)

### 007000_rivals_teams
- `teams` + `slug` (unique, backfilled), `secondary_color`, `home_venue`, `preferred_format` ('5v5'…'11v11'), `created_by`, `updated_at`, `archived_at`, `timezone` default 'Europe/Lisbon', `currency` ('EUR','BRL'); unique `(created_by, lower(name)) where archived_at is null` (double-tap guard). `captain_id` kept in sync by RPCs only.
- `team_members`: role ('captain','vice','player'), `status` ('active','left','removed'), `left_at`; unique partial captain/vice per team; index `(player_id, team_id) where active`; backfill captain rows.
- `team_invites`: token (unique), `created_by`, `expires_at` (default +14d), `revoked_at`, `max_uses`, `uses`; unique live link per team.
- `rivals_audit_log` (bigserial): team/challenge/match ids, actor, action, payload jsonb.
- Helpers: `team_role`, `is_team_member`, `is_team_leader`, `is_team_captain`, `can_manage_team`.
- RLS: teams select authenticated; team_members select (active / own / my team); invites select leaders; audit select members. **No write policies.** Revoke writes on teams/team_members from authenticated; new tables: select→authenticated, all→service_role, nothing→anon (anon only via preview RPCs).

### 007100_rivals_challenges
- `team_challenges`: challenger (not null), challenged (null only while a claimable is unclaimed), `mode` ('directed','claimable'; directed ⇒ challenged not null), `invite_token` unique, `status` ('pending','agreed','declined','cancelled','expired') = negotiation only, `current_version`, `turn_team_id`, `expires_at`, `pending_change_version`, `created_by`, `client_ref` (unique with created_by → idempotency), `decided_by_*`, `decided_at`, `reason ≤280`, `rematch_of_match_id`. Unique open proposal per team pair (least/greatest where pending). Indexes per team+status.
- `team_challenge_versions` PK (challenge_id, version): `kind` ('proposal','counter','change'), proposed_by team/player, `kickoff_at`, `timezone`, `format`, `duration_min` 20–180, venue name/address/url, `field_responsible` ('challenger','challenged'), `cost_cents`, `currency`, `cost_split` ('split','challenger','challenged','loser','none' — informational only), `note ≤280`.
- `team_matches`: `challenge_id` **unique** (one match per challenge), home/away, `agreed_version`, copied terms, `match_status` ('scheduled','cancelled','not_played','played'), `field_status` ('unconfirmed' default,'confirmed','unavailable') + note/by/at, `result_status` ('none','reported','disputed','confirmed'), `official_home_score`/`official_away_score`, `confirmed_revision`, `result_confirmed_at`, cancel/not-played fields.
- RLS select: members of either team (+admin); unclaimed claimable only challenger members (others via token preview RPC).
- Expiry: lazy in every RPC + hourly `expire_rivals()` pg_cron ('pitch-rivals-expire', '15 * * * *'); never touches results. Default deadline `least(now()+72h, kickoff_at-2h)`.

### 007200_rivals_results
- `team_match_results`: revision (unique per match), `kind` ('report','counter','correction'), scores 0–99, reported_by team/player, `status` ('proposed','confirmed','disputed','superseded','withdrawn'), responded_by/at, note; unique open proposal per match; unique confirmed per match.
- `team_match_availability` (convocatória) PK (match_id, player_id): team_id, status ('yes','no','maybe'); visible only to that team.
- `team_match_lineup` PK (match_id, player_id): team_id, set_by/at.
- **Metrics derived, never stored** (official score written in the same txn as confirm/correct): `team_record(team)` → played, W/D/L, GF/GA/GD, form last 5, streak, biggest win, clean sheets, cancellations (late <24h separate), not_played (none count as losses); `team_head_to_head(team, opp)` → record, last result, `confronto_n`; `team_player_stats(team)` → appearances (lineup on confirmed matches) + member since; `team_profile(slug)` (anon: name/badge/city/colours/member count/record/form, no roster); `my_team_career()`. Goals/assists per team match deferred to the Matchday-engine phase.

## 3. RPCs (SECURITY DEFINER, search_path=public; revoke from public/anon, grant authenticated; previews also anon; errors `rivals:<code>`; `select … for update` + audit row on every transition)
- **Teams:** `create_team`, `update_team` (allow-list; name captain-only; slug never changes), `archive_team` (captain; blocked with scheduled match; cancels pending challenges), `create_team_invite` / `revoke_team_invite` (leaders), `team_invite_preview(token)` (anon), `accept_team_invite(token)` (role player only, idempotent), `set_member_role` (captain; vice/player), `transfer_captaincy`, `remove_team_member` (vice can't remove captain/vice), `leave_team` (captain must transfer unless last member → archive).
- **Challenges:** `create_challenge(from, to|null, terms, client_ref)` (leader; kickoff ≥1h ahead; 1 open per pair; ≤10 pending per team), `get_challenge_invite(token)` (anon; + eligible teams when logged in), `respond_challenge(id, version, accept|decline, as_team)` (turn-team leader; stale_version; proposer can't accept own; claim under lock; accept → `agreed` + insert match, field unconfirmed; idempotent), `counter_challenge(id, base_version, terms, as_team)` (no_changes guard; flips turn; resets expiry), `cancel_challenge(id, reason)` (never a loss), `propose_match_change` / `respond_match_change` (terms change after agreement; kickoff/venue change resets field status), `set_field_status` (field_responsible team's leader).
- **Results:** `set_match_availability` (member, before kickoff, upsert), `set_match_lineup` (leader, after kickoff), `report_match_result` (leader, after kickoff), `confirm_match_result(match, revision)` (the OTHER team; correction supersedes previous), `contest_match_result` (non-reporter; new counter revision; same score rejected), `propose_result_correction`, `withdraw_result_proposal`, `mark_match_not_played` (informational; no-show not counted in v1), `create_rematch` (step 4), reads, `expire_rivals()` (cron only). Nothing ever auto-confirms; dispute >7 days or ≥4 revisions → "Precisas de ajuda? Fala connosco".

## 4. App
- `src/lib/rivals.js` (challengeView buckets/next action, diffTerms, record/form/streak mirror for demo, rematchDraft, formatKickoff via Intl+tz, link parse/build, teamFeedItems, demo seed); `src/lib/pendingIntent.js` (localStorage `pitch.v2.pendingIntent`, 7d; also persisted in signup user_metadata as tjoin_token/desafio_token).
- `src/hooks/useTeams.js`: cloud when status ready|needsGroup; myTeams, challenges, matches, pendingActions, actions 1:1 with RPCs returning {data}|{error}; realtime (250ms debounce); demo mode with simulated rival captain.
- Components: RivalsHub (team switcher only if >1 team), TeamPage, TeamEmptyState, CreateTeamSheet, TeamEditSheet, TeamRoster, TeamInviteSheet, TeamPublicPage, TeamRecordStrip, ChallengesInbox (Recebidos·Enviados·Histórico chips), ChallengeCard, ChallengeComposer (new/counter/change/rematch), ChallengeDetail + VersionDiff ("mudou" label + icon), FieldStatusBadge, MatchDetail, AvailabilityRSVP (radiogroup Vou/Não vou/Talvez), AvailabilityList (+ wa.me nudge), ResultSheet, ResultDisputeView, LineupPicker (prefilled from "yes"), HeadToHead, TeamMatchdayCard, TeamInvitePage (?tjoin), ChallengeInvitePage (?desafio); primitives Sheet/FormField/FormPills/ColorSwatches/ScoreStepper/TeamBadge.
- **Roles on team page:** member = header, next match + own RSVP, pending challenges read-only, W-D-L/form, results + head-to-head "Confronto #N", roster, share, leave. Captain/vice add Desafiar, respond/counter/cancel, invites, roster mgmt, RSVP list, field status, results, lineup. Captain only: rename, set vice, transfer, archive.
- **Team-first entry:** read tjoin/desafio tokens (like joinToken) → logged out: TeamInvitePage before LandingPage → signup keeps intent → skip AuthLanding + JoinGroup → quick OnboardingPlayer → createPlayerProfile → acceptInvite → noGroup opt-in → Competir on that team. `noGroup = needsGroup && (optIn || myTeams.length || pendingIntent)` (wait for teams loading).
- **Team-only user per tab:** Home = team feed items with team chip (next match pinned with inline RSVP, results, leader actions); Jogar = non-blocking NoGroupState + "os jogos da tua equipa estão em Competir"; Matchday = TeamMatchdayCard on team match day (no live engine); Competir = Rivals main (Rankings hidden without group); Perfil = PITCH ID with team career (`my_team_career`).
- **Opening tab:** team-only → Competir. Group+team: group live matchday → Jogar (group RSVP pending) → Competir (team match today / team RSVP unanswered ≤48h / leader action) → Home.
- **IA:** keep Competir segments Rankings · Equipa · Desafios (flags map 1:1); "PITCH Rivals" as section brand/empty state; no global selector; team switcher inside Rivals; team match day also surfaced as a light card in Matchday.
- **Deep links:** `?team=<slug>` (public page / my team / "Desafiar esta equipa"), `?tjoin=<token>`, `?desafio=<token>` (leader → detail with "responder como"; no team → create team then back; plain member → read-only "pede ao teu capitão"; expired/used/cancelled states). Add to `seo.js` TOKEN_PARAMS (noindex). One URL format: `https://pitch-fc.com/?desafio=<token>` (the `/rivals` LP only links into the app).
- **Flags:** visible if `isEnabled('teams')` OR user has a team OR Rivals intent OR `?rivals=1` opt-in (pilot captains); `challenges` requires `teams`; flags are UI-only.
- A11y: Sheet dialog semantics, text+icon states, 44px, aria-live, ScoreStepper aria-labels; 320/375/430px.

## 5. Share / OG previews
Vercel rewrite of `/?desafio|tjoin|team` → `api/og-rivals.js` (edge): fetch `/index.html`, call the anon preview RPC, replace og/twitter tags ("Os X desafiam-te · 7x7 · sáb 18 out"), `s-maxage=300`, fall back to the untouched HTML on any error. Static `public/brand/og-rivals.jpg` in v1.

## 6. Tests
SQL: `supabase/tests/rivals_{teams,challenges,results}_check.sql` (begin/rollback, one `ok` row per check, fixtures Ana/Vasco/Paulo/Bruno/Carla/Zé/anon) covering spec §12 incl. grants matrix, no direct writes, invite expiry/revoke, captaincy invariants, stale_version, idempotent accept + unique match, claim race guard, field unconfirmed after accept, cancel ≠ loss, provisional result excluded, reporter can't confirm own, contest/correction revisions + audit, RSVP visibility, appearances only on confirmed, expiry, **regression: games/attendances/matchdays policy hash unchanged** + group RSVP via magic_set_status still works. Manual concurrency script for true double-accept. JS: `src/lib/rivals.test.js`, `src/lib/pendingIntent.test.js` (add to root `npm test` list).

## 7. Build order (migrations Mon–Wed only; run the check script right after each applies)
- **PR0** ✅ gate TeamsSection (52adb40). Owner: `select count(*) from teams; select count(*) from team_members;`
- **PR1** 007000 + teams check.
- **PR2** rivals.js, useTeams (teams), primitives, RivalsHub, TeamPage, CreateTeamSheet, invite/roster sheets, ?team/?tjoin, rivalsCopy; delete TeamsSection + useCloud team fns.
- **PR3** team-first entry + no-group navigation (gating, opening tab, NoGroupState/Home/Perfil, pending intent, signUp metadata).
- **PR4** 007100 + challenges check. **PR5** challenges UI (inbox, composer, detail+diff, cancel, field status, ChallengeInvitePage, claimable).
- **PR6** 007200 (results, RSVP, lineup, metric fns, cron) + check. **PR7** match UI (RSVP, availability, report/confirm/contest/correct, lineup, record/form/H2H, Home feed, TeamMatchdayCard, Perfil career).
- **PR8** OG function + rewrites + image + translated WhatsApp messages. **PR9 (step 4)** rematch, share cards, milestones.
- Rollout: flags off for regular users; pilot captains via `?rivals=1`; demo-mode run first, then a real match; watch `rivals_audit_log`; global flags on only after one match concluded with no divergence, together with the `/rivals` LP launch.

## Risks
Legacy mig-49 rosters added without consent (decide keep vs reset); one player in both teams of a match (block or warn); BR timezone/currency; realtime channel count; helper-function RLS cost (indexed); anon preview RPC exposure (122-bit tokens, limited fields); challenge spam (≤10 pending); URL coordination with the `/rivals` LP.

## Open questions for the owner
1. Support contact for unresolved disputes ("Fala connosco"): WhatsApp number or email?
2. Default response deadline: min(72h, kickoff − 2h)?
3. Legacy teams (if any exist): keep auto-added members active, or reset to captain-only + re-invite?
4. Market for v1: Portugal only (EUR, Lisbon) or Brazil too (BRL, São Paulo) from the pilot?
