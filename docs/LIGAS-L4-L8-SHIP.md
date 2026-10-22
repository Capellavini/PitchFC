# PITCH Ligas — L4–L8 ship notes (backend contract for the UI)

**Status:** v3 (UI contract gaps closed: adjustment ids, team sheets in match_page, league id in competition_page), final for this branch (`feat/ligas-l4-l8`), 2026-10-22. Validated in PGlite (see §5). Nothing applied to production; the migrations reach prod only through the repo and CI on merge.

All RPCs are `supabase.rpc(name, {p_…})`. Errors arrive as Postgres exceptions whose message starts with `league:<code>` (the same convention as L1–L3). Every write RPC is `SECURITY DEFINER` and re-derives the caller's role. The "Jogador / Gestão" UI switch grants nothing.

---

## 1. Drafts vs. production: what this branch ships

| Plan PR | Draft | Already in prod before this branch | Shipped here |
|---|---|---|---|
| **L4** fixtures | `04_team_matches_origin_fixtures.sql` | **All of it**, verbatim plus comments, in `20261016155300_league_match_origin.sql`. That covers phases, groups, rounds, the `team_matches` origin columns and CHECKs, the guards, officials, `create_phase`, `create_fixtures`, `schedule_match`, `set_match_off`, `assign_official` and `competition_matches`. | `20261022110000_league_fixtures_console.sql`: the staff console (`competition_matches_staff`) and `league_collaborators`, both missing for the Gestão UI, plus `competition_page` redefined to return the league id. |
| **L5** events | `05_match_events.sql` | **All of it**, in `20261016155400_league_match_events.sql`: the event log, `record_match_event`, `set_match_phase`, `match_live` and `match_event_history`. | — |
| **L5** formations | `05b_match_formations.sql` | nothing | `20261022110100_league_match_formations.sql`: all of 05b, plus `set_league_lineup` (the mesa's team sheet) and futsal-safe slot validation. |
| **L6** | `06_homologation_standings.sql` | nothing | `20261022110200_league_homologation_standings.sql`: all of 06 (with one trigger bug fixed), plus `competition_rankings` and `competition_disputes`. |
| **L7** | `07_discipline.sql` | nothing | `20261022110300_league_discipline.sql`: all of 07, plus `list_discipline_cases`, a past-match exception in the lineup guard, and squad validation on manual cases. |
| **L8** | `08_fans_awards_follows.sql` | §1/§3/§4: supporters, follows, notification prefs, `set_supported_team`, `follow`, `set_notification_preference` and `my_following`, in `20261016155500_league_fans_follows.sql`. | `20261022110400_league_awards_match_page.sql`: §2/§5/§6 (official MVP and the fans' vote), youth initials in the vote results, and **`match_page`**. |

Out of scope, not touched: L9 (VAR linkage, `league-notify`) and L10 (league fantasy).

### Changes to objects that were already shipped
- `league_guard_lineup()` (the trigger function on `team_match_lineup`) is **redefined in L7**, as the plan intended. It adds `league:player_suspended`, but only for matches that are not finished yet (unscheduled, scheduled, postponed or live). Its effect on Rivals rows is unchanged: it returns early for `source_type <> 'competition'`.
- `competition_page(text, text, text)` (shipped in 155100) is **redefined in L4** with the identical body plus additive keys `league_id` (top level) and `league.id`. Signature, visibility rule and grants are unchanged.
- No other shipped function, table, policy or grant is altered. No Rivals RPC is changed.

### Futsal / 5-a-side (AFPCE pilot)
No structural change was needed. `competitions.modality` already allows `futsal` and `format` already allows `5v5`. `match_duration_min` accepts 20–180, so 40 works, and the regulation validator accepts squad min 5 and a yellow threshold of 3.
- **Starting five:** `save_match_formation` now caps the placed slots at the players per side of the match format (`5v5` gives 5) and allows at most one `gk-*` slot. A futsal formation is the outfield split, e.g. `"2-1-1"` (TacticsBoard computes `[def, mid, fwd]` for 4 outfield players).
- **Team sheet:** the whole sheet, starters plus bench, goes into `set_league_lineup` (up to 30). Everyone on the sheet appears in the official stats.
- **Rolling substitutions:** use `sub` events (`player_id` out, `sub_in_player_id` in), repeated as often as needed. The same player may go off and come back. Subs are informational and never limit anything.
- **Not modelled, by design:** accumulated team fouls, timeouts, the flying goalkeeper and shootouts. The drafts don't model them, and shootouts are refused in Fase 2.
- Tested end to end in `ligas_l5_check` and `ligas_l7_check`: squads of 6 (a squad below the minimum of 5 is refused), a sheet of 5+1, a formation of 5 (6 refused, two GKs refused), rolling subs, a second yellow, the referee submits, the owner homologates, a discipline case, standings and rankings.

---

## 2. RPC contract

Notation:
- `→` is the jsonb return.
- **anon** means callable without login (public pages). Every other RPC needs `authenticated`.
- `seq` is `team_matches.seq`. Lifecycle RPCs take `p_expected_seq` and raise `league:stale_seq` if it is stale. Re-read the match and retry.

### 2.1 Fixtures and calendar (L4)
| RPC | Who | Returns / notes |
|---|---|---|
| `create_phase(p_competition_id uuid, p_name text='Fase regular', p_double_legged bool=false)` | Mgr(c) | `{phase_id, ordinal, created}`. Idempotent: one phase per competition. |
| `create_fixtures(p_phase_id uuid, p_fixtures jsonb)` | Mgr(c) | `p_fixtures = [{round:int, home_team_id, away_team_id}]` from `roundRobinFixtures`. → `{created, matches}`. It must be a complete round robin of the homologated teams (`league:invalid_fixtures`, detail says why). Sending the identical set again gives `created:false`; a different set gives `league:fixtures_exist`. Matches start `unscheduled`. |
| `schedule_match(p_match_id uuid, p_kickoff_at timestamptz, p_venue jsonb='{}', p_expected_seq int=null)` | Mgr(c) | `p_venue = {name, address, url}`. Works from unscheduled, scheduled or postponed. → `{match_id, match_status:'scheduled', seq}` |
| `set_match_off(p_match_id uuid, p_status 'postponed'\|'cancelled', p_reason text)` | Mgr(c) | Reason required. Postponed keeps the id and clears the kickoff; reschedule it with `schedule_match`. Cancelled is terminal. Neither works once the match is live (use abandon, §2.4). → `{match_id, match_status, seq}` |
| `assign_official(p_match_id uuid, p_player_id uuid, p_role 'scorer'\|'referee', p_assign bool=true)` | Mgr(c) | The player must be an active collaborator with that role, or owner/manager (`league:not_a_collaborator`). → `{assigned}` |
| `league_collaborators(p_league_id uuid, p_competition_id uuid=null)` **new** | Mgr(league or c) | `{items:[{member_id, player_id, name, role, competition_id, since}]}`. Use it for the officials picker. Pass `member_id` to `remove_league_member`. |
| `competition_matches_staff(p_competition_id uuid, p_round int=null)` **new** | competition staff (incl. scorer/referee) | `{is_manager, items:[{id, phase_id, round_id, round, round_name, home{id,name,logo_url}, away{…}, kickoff_at, timezone, venue_name, venue_address, venue_url, match_status, result_status, seq, status_reason, replay_of_match_id, home_score, away_score (homologated only), officials:[{player_id,name,role}]}]}` |
| `competition_page(p_league_slug text, p_competition_slug text, p_key text=null)` **changed** | **anon** | As shipped, plus `league_id` and `league.id`. Use them for `league_collaborators(league_id, competition_id)`. |
| `competition_matches(p_competition_id uuid, p_round int=null, p_key text=null)` | **anon** | Public calendar: `{items:[{id, round, round_name, home{id,name,slug,logo_url}, away{…}, kickoff_at, timezone, venue_name, match_status, result_status, home_score, away_score}]}`. Scores appear only once homologated. No seq or officials. |

`match_status` for league rows is `unscheduled | scheduled | live | finished | postponed | cancelled | abandoned`. `result_status` is `none | provisional | submitted | homologated`.

### 2.2 Live súmula (L5, shipped core + team sheet)
| RPC | Who | Returns / notes |
|---|---|---|
| `set_league_lineup(p_match_id uuid, p_team_id uuid, p_player_ids uuid[])` **new** | operator (assigned scorer/referee, owner/manager; team leaders only if `team_leaders_can_score`). After submission: the homologation authority. | Replaces that team's sheet and bumps seq. Allowed while scheduled, live, finished or abandoned. → `{match_id, team_id, count, seq}`. Errors: `player_not_in_squad`, `player_suspended` (L7), `invalid_lineup`, `invalid_team`, `not_operator`. The captain can still use the Rivals `set_match_lineup(p_match_id, p_player_ids)` before kickoff (scheduled only). |
| `set_match_phase(p_match_id uuid, p_phase 'live'\|'finished'\|'submitted', p_expected_seq int, p_note text=null)` | live/finished: operator. submitted: referee, owner or manager. | `live` is refused if kickoff is more than 2h away (`league:too_early`). `finished` sets result `provisional`; `submitted` sends the súmula to review. → `{match_id, match_status, result_status, seq}` |
| `record_match_event(p_match_id uuid, p_event jsonb)` | operator while live/finished. After submission: authority only, with `reason`. | `p_event = {id (client uuid v4), action?:'add'\|'correct'\|'void', supersedes?, type:'goal'\|'own_goal'\|'yellow'\|'second_yellow'\|'red'\|'sub'\|'period', team_id (goal/own_goal: the BENEFITING team), player_id?, assist_player_id?, sub_in_player_id?, period?:'1H'\|'2H'\|'ET1'\|'ET2', minute?, added_minute?, detail?, reason?, source?, client_recorded_at?}` → `{event_id, seq, duplicate, possible_duplicate}`. Retrying the same id is idempotent (`duplicate:true`). Corrections and voids need `supersedes` + `reason`; correcting an already-corrected event gives `league:stale_event`. |
| `match_live(p_match_id uuid, p_key text=null)` | **anon** | `{match{id, competition_id, round_id, home_team_id, away_team_id, kickoff_at, timezone, venue_name, match_status, result_status, seq, started_at, ended_at}, score{home, away, state:'none'\|'live'\|'provisional'\|'in_review'\|'homologated', pending_rehomologation}, timeline:[{id,type,team_id,period,minute,added_minute,detail,corrected,player,player_id,assist,assist_player_id}], officials:[{role,name}], my_role, can_homologate}`. Label anything other than `homologated` as unofficial. Prefer `match_page` for the page itself. |
| `match_event_history(p_match_id uuid)` | staff + the two teams | Full audit trail including void and superseded rows: `{items:[{id, seq, action, supersedes, type, team_id, player_id, assist_player_id, minute, reason, source, recorded_by, recorded_role, recorded_at, effective}]}` |

### 2.3 Formation / TacticsBoard (L5)
| RPC | Who | Returns / notes |
|---|---|---|
| `save_match_formation(p_match_id uuid, p_team_id uuid, p_formation text, p_slots jsonb, p_visibility 'team'\|'published'='team', p_base_version int=null)` | that team's captain/vice; on league matches also Mgr(c) | `p_slots = {"gk-0": player_id, "def-0": …}`, the same shape as TacticsBoard's localStorage. Null or `""` slots are ignored. `p_base_version` is the version you loaded (null the first time). → `{version, visibility, slots}`. Errors: `stale_formation` (someone saved first), `formation_locked` (live or later), `player_not_eligible` (not in the squad or suspended; on friendlies, not an active member), `invalid_formation` (bad key or label, duplicate player, more slots than the format allows, more than one GK). Works for friendlies too. |
| `match_formation(p_match_id uuid, p_team_id uuid)` | team members; anyone who can see the match once `published` | `{team_id, formation, version, visibility, published_by, published_at, slots:{slot_key:{player_id, name}}}` or `null`. Youth categories show initials. |

### 2.4 Close, homologate, W.O., abandon (L6)
| RPC | Who | Returns / notes |
|---|---|---|
| `homologate_match(p_match_id uuid, p_expected_seq int, p_reason text=null)` | authority (`homologation.authority`, default owner and manager) | From finished or abandoned with a provisional, submitted or homologated result. Writes revision *n* (score and stats from the log). → `{revision, kind:'played', home_score, away_score}`. Re-homologating after a post-homologation correction needs a reason; `league:nothing_to_rehomologate` if the log did not change. |
| `record_walkover(p_match_id uuid, p_absent_team_id uuid, p_reason text, p_expected_seq int)` | authority | Before the match is live (or when abandoned). Score comes from `regulation.walkover`; the absent team also takes `loser_points`. No player stats. → `{revision, home_score, away_score}` |
| `abandon_match(p_match_id uuid, p_reason text, p_expected_seq int)` | operator or authority, while live | → `{match_status:'abandoned'}`. The match does not count until decided. |
| `decide_abandoned_match(p_match_id uuid, p_decision 'keep_score'\|'award'\|'annul'\|'replay', p_payload jsonb, p_reason text, p_expected_seq int)` | authority | `award` takes `p_payload {home_score, away_score}`. → `{decision, revision, replay_match_id}`. `replay` creates a new `unscheduled` match in the same round (schedule it as usual) and annuls the original. |

### 2.5 Disputes and point adjustments (L6)
| RPC | Who | Returns / notes |
|---|---|---|
| `open_dispute(p_match_id uuid, p_reason text (5–1000), p_evidence jsonb='[]')` | captain or vice of either team | `p_evidence = [{kind:'url'\|'note'\|'var_clip', ref}]`. Allowed while provisional or in review, or within `dispute_window_hours` (default 48) of the current homologation. → `{dispute_id, deadline_at}`. Errors: `dispute_already_open` (one per team per match), `dispute_window_closed`, `invalid_dispute`. The official result keeps counting. |
| `decide_dispute(p_dispute_id uuid, p_decision 'upheld'\|'rejected'\|'withdrawn', p_note text=null)` | upheld/rejected: authority, note required. withdrawn: the opening team's leader. | → `{status}` (`unchanged:true` if already decided). Upholding changes no numbers: correct the log, then `homologate_match` with a reason. |
| `competition_disputes(p_competition_id uuid, p_status text='open')` **new** | staff see all; members of a registered team see disputes on their own matches | `{is_staff, items:[{id, match_id, round, home_team_id, away_team_id, opened_by_team_id, opened_by, homologation_revision, reason, evidence, status, deadline_at, decision_note, decided_role, decided_at, created_at, can_decide}]}`. Pass `p_status null` to get every status. |
| `adjust_points(p_competition_id uuid, p_team_id uuid, p_points int (±1..50), p_reason text (5–500))` | Mgr(c) | → `{adjustment_id}`. `league:invalid_adjustment` on 0, out of range or a short reason. |
| `revoke_point_adjustment(p_adjustment_id uuid, p_reason text)` | Mgr(c) | → `{revoked}`. The row is kept. |

### 2.6 Standings and rankings (L6), all **anon** with `p_key` for private competitions
| RPC | Returns |
|---|---|
| `competition_standings(p_competition_id uuid, p_key text=null)` | `{rows:[{team_id, name, slug, logo_url, j, w, d, l, gf, ga, gd, pts, adjustments, h2h, rank, tie_unresolved}], regulation_version, tiebreakers, points, pending (provisional/in-review count), adjustments:[{id, team_id, points, reason, created_at}]}` (`id` goes to `revoke_point_adjustment`), or `null` if not visible. Counts homologated results only. `tie_unresolved` teams share a rank (no coin toss). |
| `competition_player_stats(p_competition_id uuid, p_key text=null)` | `{items:[{player_id, name, photo_url, team_id, apps, goals, assists, own_goals, yellows (incl. second yellows), reds}]}`, sorted by goals, then assists. |
| `competition_rankings(p_competition_id uuid, p_kind 'goals'\|'assists'\|'cards'\|'apps'='goals', p_key text=null, p_limit int=20)` **new** | `{kind, items:[{rank, value, player_id, name, photo_url, team_id, team_name, apps, goals, assists, own_goals, yellows, reds}]}`. Zero rows are left out and ties share a rank. `cards` is value = yellows + reds, with reds ranked first. Artilharia = `goals`. |

### 2.7 Discipline (L7)
| RPC | Who | Returns / notes |
|---|---|---|
| `competition_discipline(p_competition_id uuid, p_key text=null)` | **anon** | `{suspended:[{player_id, team_id, name, matches, served}], pending_cases (staff only, else null)}` |
| `list_discipline_cases(p_competition_id uuid, p_status 'pending'\|'confirmed'\|'waived'\|null=null)` **new** | competition staff | `{is_manager, items:[{case_id, player_id, name, team_id, team_name, source_match_id, round, trigger:'red'\|'second_yellow'\|'yellow_accumulation'\|'manual', accumulation_n, suggested_matches, decided_matches, status, reason, decided_at, created_at, served, active}]}`. Pending cases sort first. |
| `decide_discipline_case(p_case_id uuid, p_decision 'confirm'\|'waive', p_matches int, p_reason text)` | Mgr(c) | `p_matches` null means the suggested number. → `{status, decided_matches}` |
| `open_discipline_case(p_competition_id uuid, p_player_id uuid, p_team_id uuid, p_matches int, p_reason text, p_source_match_id uuid=null)` | Mgr(c) | A manual case, confirmed immediately. The player must be in that team's homologated squad. → `{case_id}` |

Homologation only **suggests** cases (`pending`), and pending cases never block. A confirmed, active suspension blocks the team sheet, `set_match_lineup` and the formation. "Served" counts the team's homologated, non-annulled matches after the source match.

### 2.8 Awards and the fans' vote (L8)
| RPC | Who | Returns / notes |
|---|---|---|
| `award_official_mvp(p_match_id uuid, p_player_id uuid, p_reason text=null)` | a role in `mvp.official_by` (default: assigned referee, or manager, which includes the owner) | After finished. A re-award needs a reason. → `{revision, player_id, team_id, role}` |
| `open_fan_vote(p_match_id uuid, p_hours int=24 (1..168))` | Mgr(c); needs regulation `mvp.fan_vote = true` | Idempotent. → `{opens_at, closes_at}`. Errors: `fan_vote_disabled`, `match_not_finished`. |
| `cast_fan_vote(p_match_id uuid, p_player_id uuid)` | any signed-in account that can see the match | Any account can vote, fans included. One vote per account, changeable until close. Candidates are players on a sheet or who appeared in the snapshot; no self-vote. → `{voted_player_id, closes_at}`. Errors: `vote_closed`, `no_self_vote`, `not_a_candidate`. |
| `fan_vote_results(p_match_id uuid)` | signed-in | `{state:'none'\|'open'\|'closed', opens_at, closes_at, my_vote, total_votes (closed only), items:[{player_id, name, votes}] (closed only)}` |

### 2.9 The match page, one call: `match_page(p_match_id uuid, p_key text=null)`, **anon**
Returns `null` when the match is not visible, which is indistinguishable from "not found". Otherwise it returns everything from `match_live` **plus**:
```
competition {id, name, slug, league_id, league_slug, league_name, modality, format, match_duration_min, youth}
round       {number, name}
teams       {home {id, name, slug, logo_url}, away {…}}
homologation {revision, kind, home_score, away_score, decided_role, created_at, regulation_version, reason} | null
official_mvp {player_id, name, team_id, revision, decided_role} | null
fan_vote    {state, opens_at, closes_at, total_votes, my_vote, items}        (same as fan_vote_results)
formations  {home: <match_formation> | null, away: … }   (published ones; your own team's also when visibility='team')
lineups     {home: <sheet> | null, away: <sheet> | null} | null
            sheet = {team_id, count, players:[{player_id, name, photo_url, shirt_number, squad_role, position}]}
            competition staff + the match's assigned officials: both sheets; a team's members: their own sheet only;
            anon / fans / other teams: null (team sheets are not public, plan §5). Number + role come from the homologated squad.
dispute     {window_closes_at | null, open_count (staff / the two teams only, else null)}
me          {is_staff, is_manager, operator_role, can_homologate, leader_of_team_id, member_of_team_id}
```
Names follow the youth rule (initials, no photo). The payload contains no email, phone or age.

### 2.10 Unchanged, already shipped (for completeness)
Fans and follows: `set_supported_team(p_competition_id, p_team_id|null)`, `follow(p_entity_type, p_entity_id, p_on=true, p_notify=true)`, `set_notification_preference(p_topic, p_channel, p_enabled)` and `my_following()`. Competition teams: `competition_teams_page(p_competition_id, p_key)`. (`competition_page` gained `league_id`, see §2.1.)

---

## 3. Tables created and their grants (CLAUDE.md, post-2026-10-30 rule)
Every new table has RLS on with **SELECT-only** policies and explicit grants, following plan §5.2:
- `anon`: none. Public pages go through the RPCs.
- `authenticated`: `select` only. RLS decides which rows.
- `service_role`: `select, insert, update, delete`.

| Table | RLS read rule |
|---|---|
| `team_match_formations`, `team_match_formation_slots` | team members, or published + `can_see_match` |
| `team_match_homologations`, `team_match_official_stats` | `can_see_match` (write-once; trigger blocks UPDATE/DELETE even for postgres) |
| `team_match_disputes` | competition staff + both teams |
| `competition_point_adjustments` | `can_see_competition` |
| `competition_discipline_cases` | confirmed + `can_see_competition`, or staff, or the player's team |
| `team_match_awards`, `team_match_fan_vote_windows` | `can_see_match` |
| `team_match_fan_votes` | own vote only |

Internal helpers are `service_role` only: `league_player_eligible`, `league_write_homologation`, `league_team_results`, `league_suspensions`, `league_is_suspended`, `league_public_name`, `league_fan_vote_block` and `league_sheet`.

## 4. Risks and notes for review
1. **Homologation snapshots are write-once even for postgres.** Deleting a `team_matches` row that has a homologation (or a team or player that cascades to one) is therefore blocked with `league:snapshot_immutable`. This is intended for an audit trail. No migration or app path hard-deletes `team_matches` or `teams` (teams are archived, and archiving is already refused while a registration is active). Player rows are also `on delete restrict` from the snapshots, the same as the shipped event log. So the group-side "remove player" (`useCloud.js` → `players.delete()`) fails for a player with official league stats, as it already does for one with league events.
2. **Draft bug fixed:** `league_snapshot_immutable()` used a single AND chain on `old.status`. On `team_match_official_stats` that raised "record old has no field status" instead of the league error. It still blocked the write, but with the wrong message. Fixed with nested `if` + `to_jsonb`.
3. **Rivals isolation.** Every new read filters `source_type = 'competition'`, directly or via `league_lock_match`. `team_record`, h2h and scouting stay friendly-only through the shipped CHECK (a competition row can never be `confirmed`). The checks assert `team_record(A).played = 0` after league wins, and all Rivals suites stay green.
4. **Migration ordering:** CI's `supabase db push` needs these timestamps (20261022110000–110400) to be newer than anything already applied to prod. If another migration with a later timestamp merges first, rename these files before merging.
5. **PGlite ≠ Supabase.** Not covered here: PostgREST GET/POST behaviour for `stable` RPCs, the Realtime RLS fan-out, and performance. `team_match_events` is already in the realtime publication, and every lifecycle change bumps `team_matches.seq`, which streams too.
6. **Pilot rule defaults to confirm with the league:** referees cannot homologate by default (add `"referee"` to `homologation.authority` if AFPCE wants that). The fans' vote is off by default (`mvp.fan_vote`). There is no yellow accumulation unless `discipline.yellow_threshold` is set.

## 5. Validation (PGlite 0.2.17, Postgres 16 WASM, session scratchpad)
Setup:
- Stubbed Supabase roles, `auth.*`, `cron`, the publication, storage, `net` and `vault`, plus the pre-2026-10-30 default privileges.
- Then **all** 77 files in `supabase/migrations` in order, then the 5 new ones a second time (idempotency).

| Check | Rows | Result |
|---|---|---|
| `ligas_l1_check.sql` | 98 | all ok |
| `ligas_l2_check.sql` | 86 | all ok |
| `ligas_l3_check.sql` | 71 | all ok |
| `ligas_l4_check.sql` (new) | 42 | all ok |
| `ligas_l5_check.sql` (new) | 59 | all ok |
| `ligas_l6_check.sql` (new) | 95 | all ok |
| `ligas_l7_check.sql` (new) | 55 | all ok |
| `ligas_l8_check.sql` (new) | 65 | all ok |
| `ligas_fans_check.sql` | 36 | all ok |
| `rivals_results_check.sql` | 269 | all ok |
| `rivals_teams_check.sql` | 136 | all ok |
| `rivals_challenges_check.sql` | 127 | all ok |
| `fantasy_v2_check.sql` | 150 | all ok |
| `plans_check.sql` | 51 | all ok (needs the pre-plans group seed, as before) |

Results were identical with the new migrations applied once and applied twice.
