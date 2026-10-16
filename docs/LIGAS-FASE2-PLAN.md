# PITCH Ligas — Fase 2 technical plan (persisted operational core)

**Author:** Cris (CTO) design pass · **Date:** 2026-10-16 · **Status:** proposal for review. Nothing here has been executed. The SQL is draft only.
**Inputs:** owner brief `PITCH-BRIEF-CLAUDE-TRES-FRENTES-E-LIGAS.md` (§2, §5, §8, §9, §10, §14, §15, §17, §18), owner feedback from 2026-10-16 (league-as-a-service, fans as first-class accounts, cards only in leagues), CLAUDE.md conventions, and the Rivals code that is already in production.
**Draft SQL:** `docs/ligas-draft-sql/01…08_*.sql` (plus `05b_match_formations.sql`), plus `check_01.sql` (PR L1) and `check_flow.sql` (end-to-end). These files are **not** in `supabase/migrations`, because CI applies that folder on merge.

---

## 0. TL;DR: the decisions

1. **A league is a tenant.** A third-party organization owns its competitions. PITCH does not operate leagues. It supplies the platform, the pilot gate and the admin approval. Isolation comes from `league_members`, whose roles are scoped to the league and optionally to one competition.
2. **One match table for both origins.** A league fixture is a `team_matches` row with `source_type = 'competition'`. `challenge_id` becomes nullable, and a CHECK keeps exactly one origin per row. The team page, the league page and the match page all show the same id.
3. **Status vocabularies are split by origin, enforced by CHECK.** A competition row can never be `confirmed`: it is `homologated`. Every Rivals aggregate (record, form, h2h, scouting, career) already filters on `confirmed`, so all of them stay friendly-only and none of those functions has to be rewritten. Triggers stop the Rivals RPCs from touching league rows.
4. **The core is an append-only event log** (`team_match_events`). Each event has a client-generated uuid, which makes it idempotent. Corrections and annulments are new rows that `supersede` an old one and must carry a reason. `unique(supersedes)` stops two people correcting the same event at once, so nothing is overwritten silently. `team_matches.seq` works as an optimistic version: lifecycle actions must quote it.
5. **Projections:**
   - Live and provisional numbers are computed on read.
   - Official numbers are a snapshot written atomically at homologation (`team_match_homologations` + `team_match_official_stats`, revisioned and immutable).
   - Standings and rankings are SQL functions over the current snapshots, the audited point adjustments and the published regulation.
   - No total is stored and no total is editable.
6. **The regulation is versioned jsonb with a strict allow-list.** A published version is immutable. Every homologation records the regulation version it applied. Unsupported rules and tiebreakers (`lots`, `h2h` outside the second position) are **refused**, never partially applied.
7. **The homologated squad is an immutable snapshot** (`competition_squad_versions/players`), separate from the live `team_members`. A team takes part with its existing Rivals identity and is never re-created per season.
8. **Permissions live in the data layer.** Tables get SELECT-only RLS policies. Every write is a `SECURITY DEFINER` RPC with explicit guards. `anon` has no table grants at all. Public pages go through RPCs with fixed, PII-free payloads. A private league answers `null` to anyone without membership or the `view_key`.
9. **Fans are ordinary accounts with no roles.** Following, the supported team, votes and preferences are all keyed by `my_player_id()`. League fantasy gets **new competition-scoped tables** in Fase 4 and does not generalize the group fantasy (§9).

---

## 1. Audit of the current system

### Reused as-is
| Asset | Reuse |
|---|---|
| `teams`, `team_members` (captain/vice), `team_invites`, `is_team_leader/member` (007000) | A team registers with its existing identity. "Team leader" in the matrix = `is_team_leader` (captain or vice). |
| `team_match_availability` + `set_match_availability` | League call-ups ("convocatória") work unchanged on a scheduled league match. |
| `team_match_lineup` + `set_match_lineup` | Reused. A trigger adds the league rule: the player must be in the homologated squad and not suspended. |
| `my_player_id()`, `is_admin()`, the `team_slugify()` pattern, the audit-log pattern, the `rivals:`/`league:` error-code convention | Same conventions throughout. |
| `src/lib/core/standings.js` (`roundRobinFixtures`, `computeTable`) | The client generates the fixtures with the shared core and the server **validates** them (`create_fixtures`). `computeTable` stays the live/demo preview. The official table is SQL (§3.10). |
| Check-script format (`supabase/tests/rivals_*_check.sql`) | Same harness: transaction, ROLLBACK, one row per check. |
| `ensureOwnPlayer` (`useCloud.js`) | A fan account is a `players` row with `group_id = null`, exactly like team-only players today. |

### Must change (all in draft 04)
- `team_matches`:
  - `challenge_id`, `agreed_version`, `kickoff_at`, `field_responsible` and `cost_split` become nullable. A CHECK keeps them required for challenge rows.
  - New columns: `source_type`, `competition_id`, `phase_id`, `group_id`, `round_id`, `replay_of_match_id`, `seq`, `status_reason`.
  - The match/result status CHECKs are widened, with an extra per-origin CHECK.
- The `team_matches select` policy and `can_see_match()` gain "can see the competition".
- New guard triggers on `team_matches` (UPDATE), `team_match_results` (INSERT), `team_match_player_stats` (INSERT/UPDATE), `team_match_lineup` and `teams.archived_at`.
- **Not changed:** all Rivals RPCs and aggregates, `games`, `attendances`, `matchdays`, `live_matchday`, the VAR tables and the group fantasy.

### Risks
| Risk | Mitigation |
|---|---|
| A Rivals function that scans `team_matches` with a filter other than `result_status='confirmed'` would count league rows. | Every aggregate audited filters on `confirmed`. The CHECK makes `confirmed` impossible on competition rows. `check_flow` asserts that `team_record(A).played = 0` after a homologated league win. Any new Rivals query must filter `source_type`; add this to the review checklist. |
| `rivals_on_team_archived` would cancel league fixtures. | `teams_league_archive_guard` (BEFORE trigger) refuses archiving while a registration is active. |
| `league_rpc_begin()` marks the transaction (a transaction-local GUC) so the guard trigger lets league RPCs through. If a Rivals RPC ran **in the same transaction** after a league RPC, the guard would also let it through. | PostgREST runs one RPC per transaction. The per-origin CHECK is a second layer: it caught exactly this case in `check_flow`. The function is not executable by `authenticated`. |
| Legacy unused tables `matches` / `match_events` / `mvp_votes` (migration 000000) | Name collision avoided: the new table is `team_match_events`. Dropping the legacy tables is a separate cleanup. |
| Volume: standings are computed on read. | Amateur scale (≤ a few hundred matches per competition) is trivial. A cache table can go behind the same RPC later without changing callers. |
| Realtime: `team_matches` is already in the publication. League rows now stream to anyone who can see the competition (RLS applies). | Intended. `team_match_events` is added to the publication for the live súmula. |
| A future migration that creates tables after 2026-10-30 needs explicit Data API grants. | Every draft table has explicit `revoke`/`grant` for anon, authenticated and service_role. |

---

## 2. Tenancy, entry point and onboarding (owner feedback #1)

- **Public entry is `/league`.** Today it is the lead-capture page, and `/pro` will redirect there. "Solicitar piloto" calls `request_league_access()`. The page says "pedido recebido", **never** "aprovado" (brief §5).
- **Pilot gate:** request (`pending`) → app admin `review_league_access(approve|reject)` → `create_league()` consumes **one** approved, unused request → the caller becomes `owner` → the league starts as `draft` + `private` → setup (competition, regulation, invites) → `set_league_status('active')` or opening registrations → public according to visibility.
- **Tenant boundary:** every league-side row hangs from `leagues.id`. All helpers (`has_league_role`, `is_league_manager(l, c)`, `is_competition_staff(c)`) resolve through `league_members` for the caller. An owner of league B gets `league:not_found` on anything in league A. This is tested in `check_01` §7.
- **Collaborators:** `owner` (exactly one, transferable to a manager), `manager` (league-wide or scoped to one competition), `scorer` (mesa) and `referee`.
  - Invites are single-use and carry the role, which the preview shows before acceptance. An invite never grants owner.
  - The owner invites managers. Managers invite scorers and referees.
- **League page routes:** proposed public paths are `/league/<league-slug>` and `/league/<league-slug>/<competition-slug>`, with an optional `?k=<view_key>` for private sharing. Also planned:
  - A path for the existing invite and VAR links.
  - Fixed copy for the B2B offer at `/league`; a league page is detected by the slug segment.
  - **Decided (2026-10-16, Vini):** league pages live at `/league/<slug>`; `/league` stays the B2B landing page.

---

## 3. Data model

### 3.1 Organization (draft 01)
`league_access_requests`, `leagues` (slug, identity, locality, `visibility` public|unlisted|private, `view_key`, `status` draft|active|archived), `league_members` (role and optional competition scope; at most one active owner), `league_invites`, `league_audit_log` (all league actions; also the notification seam, §7).

### 3.2 Seasons, categories, competitions (draft 02)
- `league_seasons`: "2026/27".
- `league_categories`: "Sénior", "Sub-17". The `youth` flag drives the minors rule in §5.4.
- `competitions` = one edition: league × season × category, with `modality`, `format`, `match_duration_min` and `structure`.
  - The structure CHECK already lists `groups|knockout|groups_knockout`, but `create_competition` **refuses** anything except `league` in Fase 2 (brief §9).
  - Status: `draft → registration_open ⇄ registration_closed → in_progress → finished → archived`.
  - Visibility can override the league's. `var_enabled` and `fantasy_enabled` are seams.

### 3.3 Versioned regulation (draft 02)
`competition_regulations(competition_id, version, rules jsonb, status draft|published, change_reason, published_by/at)`. There is one draft at a time, and published versions are immutable (trigger, which applies even to postgres). From v2 on, publishing requires a reason. `league_validate_rules()` fills defaults and refuses unknown keys.

| Key | Default | Supported values |
|---|---|---|
| `points` | 3/1/0 | win 0..10, draw 0..10, loss −5..5 |
| `tiebreakers` | `pts, gd, gf` | first must be `pts`; then any of `h2h` (only 2nd), `gd`, `gf`, `wins`, `ga_fewest`. **No `lots`**: absolute ties are flagged `tie_unresolved` and share the rank. |
| `walkover` | 3–0, loser_points 0 | scores 0..20; extra deduction for the absent team −10..0 |
| `assists` | `optional` | `optional` \| `none`. Assists are never automatic (brief §8). |
| `discipline` | red 1, second yellow 1, yellow threshold none | thresholds and suggested suspensions (§3.11) |
| `homologation.authority` | `[owner, manager]` | subset of owner, manager, referee. "manager" includes the owner. |
| `homologation.team_leaders_can_score` | false | true lets team leaders operate the súmula (brief §14 "só se explicitamente autorizado") |
| `dispute_window_hours` | 48 | 0..336 |
| `squad.min/max` | 5/25 | 1..60 |
| `mvp.official_by`, `mvp.fan_vote` | `[referee, manager]`, false | |

Not supported in Fase 2 (refused, and documented in the UI): penalty shootouts and their scoring, groups and knockout generation, and the `lots` / fair-play / disciplinary-points tiebreakers.

### 3.4 Registration and homologated squad (draft 03)
- `competition_registration_links`: token links, optionally aimed at one team.
- `competition_teams(competition_id, team_id)`:
  - Status: draft → submitted → homologated | rejected | withdrawn.
  - `registered_name/logo` are frozen at the first homologation, so history reads as it was.
  - `homologated_squad_version` points at the squad in force.
- `competition_squad_versions` + `competition_squad_players` (shirt number, captain flag):
  - Squad player rows are write-once; a change means a new version.
  - The manager approves or rejects each version.
  - A player can be homologated for **one team per competition**, checked under an advisory lock.
  - Leaving the live team does **not** drop the player from a homologated squad (brief §2). This is tested.
- First value signal: `decide_squad(approve)` (brief §5 "um time conclui a inscrição").

### 3.5 Phases, groups, rounds, fixtures (draft 04)
- `competition_phases` (Fase 2: one phase, kind `league`, optionally double-legged), `competition_groups` (schema only, for future structures) and `competition_rounds`.
- `create_fixtures(phase, fixtures[])` is one-shot and idempotent. It validates a **complete** round robin of the homologated teams: each pair exactly once (or once per direction), each team at most once per round, no unknown teams.
- Matches start `unscheduled` with a null kickoff, so registrations can open before the calendar exists (brief §5).

### 3.6 Match = `team_matches` (draft 04)
Competition lifecycle (`match_status`): `unscheduled → scheduled → live → finished`, with side states `postponed` (back to scheduled, **same id**), `cancelled` (terminal, never counts) and `abandoned` (decided later, §3.8).

`result_status` for competition rows: `none → provisional` (ended) `→ submitted` (súmula in review) `→ homologated`.

A dispute is a separate record, not a status: an official result keeps counting until a decision changes it.

**Alternative considered:** a separate `competition_matches` table, or a `matches` supertype that both origins reference. It was rejected for Fase 2:
- Results, lineup, availability and audit already foreign-key to `team_matches(id)` in production.
- A supertype refactor means rewriting about 30 Rivals RPCs and the client mappers.
- Two match tables would break "one match, one id" for a team that plays both friendlies and a league.

The cost of the chosen option is a wider row with per-origin nullable columns, which the CHECKs make safe.

### 3.7 The match event log (draft 05)
`team_match_events`:
- `id` is client-generated. Other columns: `match_id`, `seq`, `action add|correct|void`, `supersedes`, `type`, `team_id`, `player_id?`, `assist_player_id?`, `sub_in_player_id?`, `period`, `minute`, `added_minute`, `detail`, `reason`, `source live|sumula|correction`, `recorded_by`, `recorded_role`, `recorded_at`, `client_recorded_at`.
- `type` is one of goal | own_goal | yellow | second_yellow | red | sub | period. For goals, `team_id` is the **benefiting** team, the same convention as the shared core.

Rules:
- **Append-only.** No UPDATE/DELETE grant, and a trigger blocks them even for postgres.
- **Corrections.** A correction is a row with `action='correct'` that supersedes the old row. An annulment uses `action='void'`. Both need a non-empty reason (CHECK + RPC).
- **Effective log.** `team_match_events_effective` (a `security_invoker` view) holds the rows that are not void and not superseded.
- **Idempotency.** Re-sending the same `id` with the same content returns `duplicate: true`. The same `id` with different content raises `league:event_id_conflict`. An offline retry never doubles a goal.
- **Concurrency.**
  - Appends serialize on the match row lock and bump `seq`. Two operators' goals are both valid and commute.
  - Each event can have only one successor (`unique(supersedes)`), so the second simultaneous correction gets `league:stale_event`.
  - Lifecycle actions (start, end, submit, homologate, walkover, abandon) must pass `p_expected_seq`. A stale value raises `league:stale_seq`, so nobody homologates a log they have not seen.
  - The RPC also returns a non-blocking `possible_duplicate` hint: same type, team and player from another operator within 60s.
- **Data validity.**
  - An unknown scorer is allowed (`player_id` null).
  - An own goal counts for the benefiting team, and its author must be in the **opponent's** squad.
  - An assist must be a different player from the same squad, and is refused when the regulation says `assists: none`.
  - Cards and subs require a player.
  - Shootout goals are not accepted in Fase 2.
- **Who.** `league_operator_role(m)` resolves to the assigned referee or scorer, a competition owner or manager, or a team leader only when `team_leaders_can_score`. After submission, only the homologation authority can act, with a reason, through correct/void or `source='correction'`.
- **Cards are league-only (owner feedback #3).**
  - A trigger refuses any event on a non-competition match.
  - The group Matchday (`games.live_matchday` → `matchdays.summary` → `player_group_memberships`) never sees this table.
  - Rivals friendlies keep counts-only stats.
  - Tested: a yellow card on a friendly raises `league:events_competition_only`.

### 3.8 Provisional vs homologated, W.O., postponed, cancelled, abandoned (drafts 05–06)
| Situation | Semantics |
|---|---|
| Live / ended | Score computed from the log. `match_live().score.state` is `live` or `provisional`, and the UI must label it unofficial. |
| Submitted | `state = in_review`. Operators are locked out; only the authority can still act. |
| Homologated | `homologate_match(expected_seq)` writes revision *n* of `team_match_homologations` (kind `played`, score from the log, `event_seq`, `regulation_version`, author and role) plus the `team_match_official_stats` snapshot, in **one transaction**. `official_*_score` is set on the match. |
| Correction after homologation | Authority only, with a reason. The official result keeps standing (`pending_rehomologation = true`) until `homologate_match(reason)` writes revision *n+1* and supersedes the old one. Fantasy (Fase 4) consumes these revisions. |
| W.O. | `record_walkover(absent_team, reason)`: kind `walkover`, score from the regulation, the absent team also takes `walkover.loser_points`, no player stats. |
| Postponed | `set_match_off('postponed')`: same row, kickoff cleared, rescheduled later. Never counts while postponed. |
| Cancelled | `set_match_off('cancelled')`: terminal and excluded. Only allowed before any events exist; after that, use abandon. |
| Abandoned | `abandon_match` while live, then `decide_abandoned_match`: `keep_score` (homologate the log), `award` (imposed score, kind `awarded`), `annul` (kind `annulled`, excluded) or `replay` (a new match row with `replay_of_match_id` in the same round; the original is annulled). |

### 3.9 Disputes and point adjustments (draft 06)
- `team_match_disputes`: a team leader opens it with a reason and evidence (`[{kind: url|note|var_clip, ref}]`) while the match is in review, or within `dispute_window_hours` of the current homologation. There is one open dispute per team per match.
  - Deciding (`upheld` | `rejected`) requires the authority and a note. `withdrawn` is done by the opener.
  - Upholding changes nothing by itself: the authority corrects the log and re-homologates, which leaves a full audit trail.
  - Disputes are visible to staff and the two teams only.
- `competition_point_adjustments`: points (±50, never 0) with a mandatory reason. Revocable (the row is kept), public next to the table, never an edit of a total.

### 3.10 Standings and rankings (draft 06)
- `competition_standings(competition, key)` computes, from the **current homologations** of the competition (annulled excluded), the per-team J, W, D, L, GF, GA, GD, Pts. Points include walkover deductions and adjustments.
- `h2h` = points earned only against teams level on points, in one pass.
- The ordering follows the published tiebreakers. The dynamic ORDER BY is built only from allow-listed constants.
- Teams still level on every key share the rank and get `tie_unresolved = true`.
- The payload also returns `pending` (provisional or in-review matches, which are not counted), the adjustments and the regulation version.
- `competition_player_stats` covers appearances, goals, assists, own goals and cards, from the current snapshots only.
- **Parity:** the shared JS `computeTable` stays the live/demo preview. A follow-up test should feed the same fixture to both and compare (open item).

### 3.11 Discipline (draft 07)
- Homologation opens **pending** `competition_discipline_cases` through a statement-level trigger on the official stats: red, second yellow, and the n-th yellow-accumulation crossing, each with the suggested suspension from the regulation.
- Only `decide_discipline_case(confirm|waive, matches, reason)` or a manual case makes a suspension real. Pending cases never block (brief §9: no universal rule).
- "Served" is derived: homologated, non-annulled matches of the player's team after the source match.
- An active suspension blocks league lineups (`league:player_suspended`). Suspension lists are public with the competition.

### 3.12 Fans: supported team, follows, preferences (draft 08; owner feedback #2)
- **Account:** a fan signs up as "Adepto" (PT-BR "Torcedor", EN "Fan") through the normal auth flow. `ensureOwnPlayer` creates a `players` row with no group. Onboarding is: pick a league/competition, then the team they support. **No organization role is created.**
- `competition_supporters(competition, player, team)`: one supported team per competition. The team must be homologated there. Supporting also auto-follows the team and the competition.
- `follows(follower, entity_type team|player|competition|league, entity_id, notify)`: asymmetric following for **entities** (CLAUDE.md). Following a player is allowed for public athlete pages; bilateral friendship stays a group-side concept. `follow()` re-checks visibility, so following cannot probe a private league.
- `notification_preferences(player, topic, channel, enabled)`: topics match_reminder, match_live, result, schedule_change, call_up, decision, fan_vote, fantasy, announcement × channels push, email, whatsapp.
- `my_following()` feeds "Acompanhando" in the selector (brief §6), separate from "Minhas ligas".
- **RLS:** these rows are owner-only. Fans read public competition data **only through the public RPCs**, and private competitions return `null` without membership or the key.

### 3.13 Official MVP vs "Craque da torcida" (draft 08)
- `team_match_awards` (award `official_mvp`): decided by a role in `mvp.official_by`. It is revisioned, records its author, and a re-award requires a reason.
- `team_match_fan_vote_windows` + `team_match_fan_votes`:
  - A manager opens the window when `mvp.fan_vote` is on.
  - One vote per account per match, changeable until close. No self-vote.
  - Candidates are the players who appeared.
  - Results are hidden until close (`fan_vote_results`).
  - The fans' vote never feeds the official award or fantasy by default (brief §11, §13).

---

### 3.14 Persisted match formation, TacticsBoard (draft 05b, ships with L5)
Today `src/components/TacticsBoard.jsx` keeps `{formation: "3-3-1", slots: {"def-0": playerId, …}}` in each viewer's localStorage. Fase 2 persists one current formation per (match, team), in the **same shape**, so the client maps 1:1:
- `team_match_formations(match_id, team_id, version, formation, visibility team|published, status current|superseded, published_by, published_at)`, with one current row per (match, team).
- `team_match_formation_slots(formation_id, slot_key 'gk|def|mid|fwd-<n>', player_id)`, where a player appears at most once.
- `save_match_formation(match, team, formation, slots, visibility, base_version)`:
  - Who: a team leader (captain/vice), or the competition manager on a league match.
  - Optimistic: `base_version` must equal the current version, otherwise `league:stale_formation`, so captain and vice never overwrite each other.
  - Locked once the match is live.
  - Eligibility: an active member on a friendly; on a league match, in the homologated squad and, from L7 on, not suspended (via `league_player_eligible`).
- `match_formation(match, team)`: team members always see it; anyone who can see the match sees it once `published`. Display names only, youth rule applies.

It works for both origins (league and Rivals friendlies). It is organizational only and never feeds score, stats, standings or fantasy. The client keeps localStorage as an offline draft and saves on "Guardar" / "Publicar".

### 3.15 One PITCH identity for league players
League athletes **reuse the PITCH identity**: the same `players` row, FUT card, OVR, photo and profile, and the existing peer ratings (`?rate=` flow, `ratingsCount` gate). Nothing is re-created per league or per season. Squads, events, snapshots and votes all reference `players.id`.
- What the league adds is **context, not a new profile**: shirt number and squad role per registration, and official stats per competition and season.
- The athlete page shows group stats, friendlies (Rivals) and each competition **as separate, labelled sources**, never summed (brief §10).
- Public league payloads still project only the display name, the photo (unless youth), position and shirt number. OVR and attributes stay where they are shown today; exposing them on public league pages is a later product call.

## 4. Rivals bilateral confirmation vs league homologation

| | Rivals (challenge) | League (competition) |
|---|---|---|
| Who decides the result | Both captains: report → confirm/contest (no third party exists) | The **authority in the regulation** (owner/manager, optionally referee). Bilateral acceptance is not required (brief §8). |
| Input | Typed score + counts-only stats | Event log (score, stats and cards are all derived) |
| Statuses | `reported / disputed / confirmed` | `provisional / submitted / homologated` |
| The team's voice | Contest = counter-proposal | `open_dispute` (reason, evidence, window) → authority decision |
| Metrics | `team_record`, h2h, scouting, career (`confirmed` only) | `competition_standings`, `competition_player_stats` (`homologated` only) |

The two flows never mix:
- `team_match_results` and `team_match_player_stats` refuse competition rows.
- Direct `team_matches` updates outside league RPCs raise `league:managed_by_league`.
- The CHECK forbids `confirmed` on competition rows.

The team page shows "Amigáveis" (Rivals record) and "Competições" (per competition and season) as separate sections. They are never summed (brief §10).

---

## 5. RLS and the permission matrix

### 5.1 Matrix (brief §14) → enforcement
| Action | Fan | Athlete | Team leader | Scorer/referee (assigned) | Competition manager | Enforced by |
|---|---|---|---|---|---|---|
| View public content | ✔ (anon too) | ✔ | ✔ | ✔ | ✔ | public RPCs + `can_see_competition` |
| Follow / support / vote / fantasy | account + rules | same | same | same | same | `follow`, `set_supported_team`, `cast_fan_vote` (window, no self-vote) |
| Answer own call-up | ✘ | own team | as athlete | if athlete | if athlete | `set_match_availability` (Rivals, member of the team) |
| Manage squad / registration | ✘ | ✘ | own team, within deadline | ✘ | any time (scope) | `register_team`, `submit_squad` (deadline unless manager), `decide_squad` (manager) |
| Operate live súmula | ✘ | ✘ | only if `team_leaders_can_score` | assigned matches only | ✔ (scope) | `league_operator_role` in `record_match_event` / `set_match_phase` |
| Submit for review | ✘ | ✘ | ✘ | referee ✔, scorer ✘ | ✔ | `set_match_phase('submitted')` |
| Homologate / correct after submission | ✘ | ✘ | can **dispute** | referee only if in `homologation.authority` | per `homologation.authority` | `league_can_homologate`, `homologate_match`, `open_dispute` |
| Change regulation / calendar | ✘ | ✘ | can request (out of band) | ✘ | ✔ (scope) | `save_regulation_draft`, `publish_regulation`, `schedule_match`, `set_match_off` |
| Collaborators | ✘ | ✘ | ✘ | ✘ | owner: managers; manager: scorer/referee | `create_league_invite`, `remove_league_member` |

The "Jogador / Gestão" switch in the UI only changes the view. It grants nothing: every RPC re-derives the role from `league_members`, `team_members` and `team_match_officials`.

### 5.2 Isolation and URL guessing
- Tables have SELECT-only policies for `authenticated`. `anon` has **no table privilege** (the same posture as teams/Rivals).
- `leagues.view_key` and `competitions.view_key` are withheld through column-level grants. Only managers get them, via RPC.
- Private or draft leagues and competitions are not readable through the table by outsiders (the policy uses `can_see_league` / `can_see_competition`), and the public RPCs return `null`, indistinguishable from "not found", unless the caller is staff, a registered team's member, or presents the `view_key` (128-bit random).
- Unlisted = reachable by slug, never listed.
- Every RPC that takes an id re-checks that the id belongs to the caller's league or competition. `league:not_found` is used deliberately instead of "forbidden".

### 5.3 PII
- Every public payload builds athletes through `league_person_name()` (nick or first name), `photo_url`, position and shirt number.
- **Never** email, phone, age, nationality, attributes or registration internals.
- Tested: `check_01` and `check_flow` search the anon payloads for the seeded email and phone strings.
- Disputes, invites, the audit log and pending squads are not public.

### 5.4 Minors
- When the category is `youth = true`, public payloads (squads, timeline, rankings, discipline) show **initials only and no photo**.
- `players.age` is self-declared and is not used as a gate.
- **Decided (2026-10-16, Vini):** youth categories show initials only and no photo; consent with parents is handled by the league, not by PITCH. A stricter opt-in can come later without schema change.

---

## 6. RPC list (signatures and guards)

All of these are `SECURITY DEFINER`, `search_path = public`, and raise `league:<code>`. "Mgr(c)" means owner or manager of the league, league-wide or scoped to competition c. A "public" RPC is executable by anon and applies the visibility rule from §5.2.

| RPC | Who | Notes |
|---|---|---|
| `request_league_access(fields)` | signed-in | idempotent while pending |
| `review_league_access(request, approve\|reject, note)` | app admin | |
| `create_league(name, fields, client_ref)` | approved requester / admin | consumes the approval; caller becomes owner; draft + private |
| `update_league(league, fields)` · `set_league_status(league, status)` | Mgr / owner | visibility and status are owner-only |
| `create_league_invite(league, role, competition?)` · `league_invite_preview(token)` (public) · `accept_league_invite(token)` | owner→manager, Mgr→scorer/referee | single-use |
| `remove_league_member(member)` · `transfer_league_ownership(league, player)` · `my_leagues()` | | |
| `league_page(slug, key?)` | public | |
| `create_season` · `create_category` · `create_competition(league, fields, rules, client_ref)` | Mgr | structure `league` only |
| `save_regulation_draft(c, rules)` · `publish_regulation(c, version, reason)` · `set_competition_status(c, status)` | Mgr(c) | reason required from v2 |
| `competition_page(league_slug, comp_slug, key?)` | public | |
| `create_registration_link(c, team?)` · `registration_link_preview(token)` (public) · `register_team(token, team)` · `submit_squad(registration, players)` · `decide_squad(registration, version, approve\|reject, note)` · `withdraw_registration(registration, reason)` · `competition_teams_page(c, key?)` (public) | leader / Mgr(c) | |
| `create_phase(c, name, double_legged)` · `create_fixtures(phase, fixtures)` · `schedule_match(m, kickoff, venue, expected_seq?)` · `set_match_off(m, postponed\|cancelled, reason)` · `assign_official(m, player, role, assign)` · `competition_matches(c, round?, key?)` (public) | Mgr(c) | |
| `record_match_event(m, event)` · `set_match_phase(m, live\|finished\|submitted, expected_seq, note)` · `match_live(m, key?)` (public) · `match_event_history(m)` | operator / staff + teams | |
| `homologate_match(m, expected_seq, reason?)` · `record_walkover(m, absent_team, reason, expected_seq)` · `abandon_match(m, reason, expected_seq)` · `decide_abandoned_match(m, decision, payload, reason, expected_seq)` | authority | |
| `open_dispute(m, reason, evidence)` · `decide_dispute(d, upheld\|rejected\|withdrawn, note)` | leader / authority | |
| `adjust_points(c, team, points, reason)` · `revoke_point_adjustment(id, reason)` | Mgr(c) | |
| `competition_standings(c, key?)` · `competition_player_stats(c, key?)` · `competition_discipline(c, key?)` | public | |
| `decide_discipline_case(case, confirm\|waive, matches, reason)` · `open_discipline_case(...)` | Mgr(c) | |
| `set_supported_team(c, team)` · `follow(type, id, on, notify)` · `set_notification_preference(topic, channel, enabled)` · `my_following()` | any account | |
| `award_official_mvp(m, player, reason?)` · `open_fan_vote(m, hours)` · `cast_fan_vote(m, player)` · `fan_vote_results(m)` | per regulation / Mgr / any account | |

Internal helpers are executable by `service_role` only: `league_audit`, `league_rpc_begin`, `league_lock_match`, `league_operator_role`, `league_can_homologate`, `league_in_squad`, `league_match_score`, `league_write_homologation`, `league_team_results`, `league_suspensions`, `competition_rules`. RLS helpers are executable by `authenticated`: `has_league_role`, `is_league_manager`, `is_league_staff`, `can_see_league`, `can_see_competition`, `is_competition_staff`, `is_competition_participant`, `can_manage_registration`, `is_match_official`.

---

## 7. Edge Functions

**None are needed for the Fase 2 core.** All writes are RPCs, and no secret is involved. Planned seams:
- **`league-notify`** (Fase 3): a Database Webhook on `league_audit_log` INSERT, filtered on actions such as `match_scheduled`, `match_postponed`, `match_homologated`, `discipline_confirm`, `official_mvp` and `dispute_*`. It fans out to `follows` × `notification_preferences` (push via the existing VAPID setup in `supabase/PUSH-SETUP.md`, email, wa-bot). Secrets stay in the function.
- **Pilot request alert** to the admin: optional, reusing the existing email function.
- **OG cards** for match and standings pages: the same pattern as the Rivals OG (PR8).

---

## 8. VAR for league matches

Today `var_*` keys on `games(id)`, uses a text `match_id` into `live_matchday`, and authorizes operators as confirmed attendees of the group game. There is no league coupling at all.

**Minimal path (Fase 3, one PR):**
1. Add a nullable `team_match_id uuid references team_matches` to `var_games`, `var_sessions` and `var_goals`. A CHECK requires exactly one of `game_id` / `team_match_id`.
2. Add a new predicate `private.var_team_match_operator(match)` = assigned official, a competition manager, or (when `var_enabled` and the regulation allows) team leaders.
3. A trigger on `team_match_events` INSERT (type goal, action add) creates the `var_goals` row, mirroring `private.var_sync_goals`.
4. Clips link to evidence by id (`team_match_disputes.evidence[].kind = 'var_clip'`).

Fase 2 ships with `competitions.var_enabled = false` and no VAR UI on league matches, so nothing fakes capture or upload (brief §12). A clip is evidence, never a decision.

---

## 9. Fantasy decision (Fase 4)

**Decision: create new competition-scoped tables, `league_fantasy_*`. Do not generalize `fantasy_leagues/squads/scores`.**

| | Generalize group fantasy | New competition-scoped (chosen) |
|---|---|---|
| Unit of scoring | Group `matchdays` (one session, many drawn teams) | Competition round with a lock deadline |
| Inputs | `matchdays.summary` jsonb | `team_match_official_stats` per **homologation revision** (re-scoring diff on re-homologation) |
| Squad | `player_ids uuid[]`, no per-round lock | per-round lineup snapshot, prices, budget, positions |
| Risk | Migrating prod tables used by live groups every week | Zero impact on groups |
| Shared | | pure scoring and validation logic in `src/lib/core/` (like standings), one formula module |

Proposed shape, not drafted:
- `league_fantasy_editions(competition_id, rules jsonb versioned)`
- `league_fantasy_prices(edition, round, player, price)`
- `league_fantasy_entries(edition, player)`
- `league_fantasy_lineups(entry, round, players[], captain, locked_at)` (immutable after the lock)
- `league_fantasy_ledger(entry, round, homologation_id, points, reason)`: append-only, so a correction becomes a new ledger line.
- `league_fantasy_private_leagues` + members.

Athletes and fans use the same account, and an athlete may pick themselves if the rules allow. Fans participate per competition with no role.

---

## 10. Migration plan (small PRs, in order)

Filenames are real timestamps strictly greater than the latest applied (currently `20261014120000_rivals_results.sql`; assign at merge, see the `pitch-migration-naming` memory). Each PR ships its check script in `supabase/tests/` (transaction + ROLLBACK, one row per check, `ok = true`) plus the Rivals regression checks re-run.

| PR | Draft | Check script | Unlocks in the UI |
|---|---|---|---|
| **L1** league orgs | `01_league_orgs.sql` | `league_orgs_check.sql` ← `check_01.sql` (95 checks) | `/league` "Solicitar piloto" for real; admin approval; "Minhas ligas"; Gerir liga → Colaboradores; public league page |
| **L2** competitions + regulation | `02_…` | `league_competitions_check.sql`: validator refusals, immutability, transitions, visibility | Competition setup wizard, Regulamento page, competition public page |
| **L3** registrations + squads | `03_…` | `league_registrations_check.sql`: deadline, member-only squads, cross-team uniqueness, snapshot vs live roster | Inscrições + Elencos inscritos; the team-side "Inscrever equipa"; first value signal |
| **L4** match origin + fixtures | `04_…` | `league_fixtures_check.sql` **+ re-run all `rivals_*_check.sql`** | Jogos calendar per round, scheduling, officials assignment |
| **L5** event log + formations | `05_…`, `05b_match_formations.sql` | `league_events_check.sql`: idempotency, stale_event, stale_seq, squad rules, append-only, cards league-only; formation version/eligibility/visibility | Live súmula (Matchday on a league match), timeline, provisional state; TacticsBoard saved per match (team-only or published) for league matches **and** friendlies |
| **L6** homologation + standings | `06_…` | `league_homologation_check.sql`: snapshots, re-homologation, W.O., abandon decisions, disputes, adjustments, tie flags | Classificação oficial, Súmula/validação, contestação, artilharia |
| **L7** discipline | `07_…` | `league_discipline_check.sql` | Disciplina tab, suspensions, lineup eligibility |
| **L8** fans + awards (Fase 2b/3) | `08_…` | `league_fans_check.sql` | Adepto signup path, "Acompanhando", support a team, Craque oficial vs Craque da torcida |
| L9 (Fase 3) | VAR linkage + `league-notify` | | |
| L10 (Fase 4) | fantasy (§9) | | |

`check_flow.sql` (96 checks) exercises L1–L8 end to end and should be split across the per-PR scripts above.

Ordering notes:
- L3 redefines `can_see_competition` / `can_see_league` (from L2/L1), and L7 redefines `league_guard_lineup` (from L4). The drafts are written for that order. Re-applying them as a whole is idempotent, which was verified.
- League migrations must avoid the game-flow window only if they touch group tables, and they don't (`pitch-migration-any-day`).

**Fase 2 is not "functional" until the cycle is validated with users in distinct roles** (owner, manager, scorer, two team captains, a fan) on a pilot league (brief §17).

---

## 11. What was validated

- **PGlite 0.2.17 (Postgres 16 WASM, installed in the session scratchpad, not in the repo):** applied stubbed Supabase roles, auth, cron and publication, then the real migrations `004900_teams`, `007000_rivals_teams`, `20261013140000_rivals_challenges` and `20261014120000_rivals_results`, then drafts 01–08 (twice, for idempotency).
  - `check_01.sql`: **95/95 ok**.
  - `check_flow.sql`: **96/96 ok**. It covers registration → fixtures → live events → idempotent replay → stale correction → homologation → re-homologation → dispute → W.O. → adjustments → discipline/suspension → fans/votes/MVP → persisted formations → Rivals guards → cards league-only.
  - Existing `supabase/tests/rivals_results_check.sql`: **269/269 ok with all drafts applied**, so there is no Rivals regression in the exercised paths.
- **Not validated:**
  - `rivals_teams_check` / `rivals_challenges_check`: they need the group-game functions such as `magic_set_status`, which were not stubbed.
  - Real Supabase specifics: the PostgREST GET vs POST behaviour of `stable` RPCs, the Realtime RLS fan-out, and the pg_cron jobs.
  - Performance under load.
  - The JS ↔ SQL standings parity test.
- **Bugs the harness caught and fixed in the drafts:**
  - Temp-table reuse in `create_fixtures`.
  - A constraint name collision.
  - Owner not counted as "manager" for the MVP/homologation authority.
  - The re-homologation "nothing changed" detection.
  - A plpgsql variable/alias ambiguity.

---

## 12. Decided (2026-10-16, Vini)

These were the open questions. All six were answered as proposed, and the drafts already encode them.

| # | Decision | Where it is enforced |
|---|---|---|
| 1 | League pages live at `/league/<slug>` (and `/league/<slug>/<competition>`). `/league` stays the B2B landing page; `/pro` redirects to it. | Routing (app); `league_page(slug)` / `competition_page(...)` |
| 2 | The team page shows **Friendlies** and **Competitions** separately, with **no combined total**. | Rivals aggregates are challenge-only by CHECK (§4); league stats come only from `competition_*` RPCs |
| 3 | Default homologation authority = **owner + manager**. The referee only if a regulation adds it. | `league_validate_rules` default `homologation.authority = ["owner","manager"]` |
| 4 | Youth categories show **initials only, no photo**. Consent with parents is handled by the league. | `league_categories.youth` → every public payload (squads, timeline, rankings, discipline, formations) |
| 5 | Suspensions are **suggested, then confirmed by the manager**. No automatic confirmation. | `competition_discipline_cases` start `pending`; only `decide_discipline_case` / `open_discipline_case` make them real |
| 6 | **One league per approved pilot request.** | `create_league` consumes the request **and** the unique index `leagues_access_request_key` (draft 01, tested in `check_01`) |

No blocking questions remain for Fase 2. Fase 3/4 rules (fantasy formula, notification copy) will be raised when those PRs start.
