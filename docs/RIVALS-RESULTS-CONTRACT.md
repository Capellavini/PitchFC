# PITCH Rivals — results / RSVP / stats contract (PR6 ↔ PR7 ↔ PR9)

Authoritative interface between the SQL (migration `20261014120000_rivals_results.sql`)
and the app (`useTeams`, components, demo mode). Written by Cris, 2026-10-14.
Context: `docs/RIVALS-PLAN.md` §2–§4, `docs/TEAMS-CHALLENGES-SPEC.md` (decisions
block wins; 2026-10-13 decisions 10a–e are IN SCOPE here). Option B still holds:
**nothing touches games / attendances / matchdays.**

## Conventions (same as 007100)
- All RPCs `SECURITY DEFINER`, `set search_path = public`, errors `raise exception 'rivals:<code>'`
  (`errcode '42501'` for auth, `'P0001'` otherwise), `select … for update` on the row being
  transitioned, one `rivals_audit_challenge(...)` row per state transition. EXECUTE granted to
  `authenticated, service_role` (never `anon`, except where stated). New tables: `select`→authenticated,
  all→service_role, nothing→anon, **no write policies / revoke writes** (writes only via RPCs).
  Every new table needs the explicit grants (CLAUDE.md rule), RLS on.
- Return `jsonb`. Mutations return the changed entity (shape below). Reads return `{ items: [...] }`
  or one object. IDs are uuids, timestamps ISO-8601 (`to_jsonb(timestamptz)`).
- "Leader" = active captain or vice of that team (`is_team_leader`). "Member" = active member.
- Nothing ever auto-confirms a result. Metrics are DERIVED (functions), never stored; the official
  score on `team_matches` is written in the same transaction as the confirm/correction.

## Tables (new)
- `team_match_results(id, match_id, revision int, kind 'report'|'counter'|'correction', home_score, away_score (0–99),
  reported_by_team_id, reported_by_player_id, status 'proposed'|'confirmed'|'disputed'|'superseded'|'withdrawn',
  responded_by_player_id, responded_at, note ≤280, created_at)` — unique `(match_id, revision)`; at most one `proposed`
  and one `confirmed` per match (partial unique indexes).
- `team_match_availability(match_id, player_id, team_id, status 'yes'|'no'|'maybe', updated_at)` PK `(match_id, player_id)`;
  readable only by members of `team_id`.
- `team_match_lineup(match_id, player_id, team_id, set_by_player_id, set_at)` PK `(match_id, player_id)`.
- `team_match_player_stats(match_id, player_id, team_id, goals int 0–30, assists int 0–30, set_by_player_id, set_at)` PK `(match_id, player_id)`.
  Informational until the result is CONFIRMED; only confirmed matches feed metrics.

## RPCs — mutations
| RPC | Who / when | Effect → returns |
|---|---|---|
| `set_match_availability(p_match_id, p_status)` | member of either team, match `scheduled`, before kickoff | upsert own answer → `{match_id, team_id, status}` |
| `set_match_lineup(p_match_id, p_player_ids uuid[])` | leader of a team in the match, match `scheduled`/`played`; ≤ 22 ids, all active members of THAT team | replaces that team's lineup → `{match_id, team_id, count}` |
| `set_match_player_stats(p_match_id, p_stats jsonb)` | leader, after kickoff; `[{player_id, goals, assists}]`, players in own lineup (or active members if no lineup) | replaces own team's stats rows → `{match_id, team_id, count}` |
| `report_match_result(p_match_id, p_home_score, p_away_score, p_note default null)` | leader of either team, after kickoff, `result_status = 'none'`, match `scheduled` | revision 1 `report`/`proposed`; `result_status='reported'` → `result` object |
| `confirm_match_result(p_match_id, p_revision)` | leader of the team that did **not** propose revision `p_revision`; it must be the latest `proposed` | revision `confirmed`, previous `superseded`; writes `official_*`, `result_status='confirmed'`, `confirmed_revision`, `result_confirmed_at`, `match_status='played'` → `result` object (+ match) |
| `contest_match_result(p_match_id, p_revision, p_home_score, p_away_score, p_note default null)` | non-proposer leader; same-score → `rivals:same_score` | old `disputed`, new revision `counter`/`proposed` by contester; `result_status='disputed'`; ≥ 4 revisions → `rivals:needs_help` |
| `propose_result_correction(p_match_id, p_home_score, p_away_score, p_note default null)` | either leader, `result_status='confirmed'`; same as official → `rivals:same_score` | new revision `correction`/`proposed`; **official score unchanged until the other team confirms it** |
| `withdraw_result_proposal(p_match_id, p_revision)` | the proposer's leader, revision still `proposed` | `withdrawn`; if it was the first report → `result_status='none'`; if a correction → back to `confirmed` |
| `mark_match_not_played(p_match_id, p_reason default null)` | leader, after kickoff, `result_status='none'` | `match_status='not_played'`, reason ≤ 280, informational (never a loss) |
| `create_rematch(p_match_id, p_terms jsonb, p_client_ref default null)` | leader of either team; match `played` with confirmed result | creates a directed challenge to the OTHER team with `rematch_of_match_id`; terms default from the match, `kickoff_at` REQUIRED in `p_terms`; same limits/validation as `create_challenge` → same return shape as `create_challenge` |

`result` object: `{ match_id, revision, kind, status, home_score, away_score, reported_by_team_id, reported_by_player_id, note, created_at, responded_at }`.
Errors to define (at least): `not_authenticated, match_not_found, not_team_leader, not_team_member, match_not_scheduled,
too_early (before kickoff), too_late (after kickoff for RSVP), result_exists, no_open_proposal, stale_revision, own_proposal
(proposer cannot confirm/contest own), same_score, needs_help, invalid_score, invalid_status, invalid_lineup, invalid_stats,
not_played_blocked, not_eligible_rematch`.

## RPCs — reads (all `stable`)
- `get_match_availability(p_match_id)` → `{ items: [{ player_id, nick, name, photo_url, position, role, status|null, updated_at|null }], counts: {yes,no,maybe,pending} }` — **own team only**; error if not a member.
- `get_match_lineup(p_match_id)` → `{ items: [{ team_id, player_id, nick, name, photo_url, position }] }` — both teams' lineups once the match is `played`; before that only own team.
- `get_match_results(p_match_id)` → `{ items: [result…] }` ordered by revision, members of either team (+ `official` summary).
- `get_match_player_stats(p_match_id)` → `{ items: [{ team_id, player_id, nick, goals, assists }] }` members of either team.
- `my_challenges()` (existing) — the `match` object GAINS: `result: { status, official_home_score, official_away_score, open_revision: {…result…}|null, revisions_count }`,
  `my_availability: 'yes'|'no'|'maybe'|null`, `availability_counts: {yes,no,maybe,pending}` (my team), `lineup_count` (my team), `stats_recorded: bool`.
  Keep every existing key (backward compatible).
- `team_record(p_team_id)` → `{ played, wins, draws, losses, gf, ga, gd, form: ['W','D','L',…last 5, newest first], streak: {type:'W'|'D'|'L'|null, n}, biggest_win: {opponent, score}|null, clean_sheets, cancellations, late_cancellations, not_played }` — only matches with `result_status='confirmed'`; cancel/not-played never count as losses; any authenticated user may read (public stats card).
- `team_head_to_head(p_team_id, p_opponent_id)` → `{ played, wins, draws, losses, gf, ga, last: {kickoff_at, score, ...}|null, confronto_n }` (`confronto_n` = confirmed meetings + 1).
- `team_player_stats(p_team_id)` → `{ items: [{ player_id, nick, name, photo_url, position, attrs, appearances, goals, assists, member_since }] }` — appearances from lineup on CONFIRMED matches; goals/assists from confirmed matches. Readable by members of that team; for the OPPONENT see `scout_opponent`.
- `scout_opponent(p_match_id)` → `{ team: rivals_team_card, record: team_record, h2h, items: [{ player_id, nick, photo_url, position, attrs, appearances, goals, assists }] }` — for members of either team, only while the challenge is `agreed` (match scheduled/played). **Never** phone/email/name beyond nick.
- `team_profile(p_slug)` (existing, anon) — GAINS `record` + `form`; for callers with `auth.uid() is not null` also `top_scorers`/`top_assisters` (`[{nick, n}]`, top 3). No roster for anon.
- `my_team_career()` → `{ items: [{ team_id, name, slug, appearances, goals, assists, wins, draws, losses }] }` for the caller's player.

## App side (PR7 / PR9)
- `useTeams` actions 1:1 with the mutations, each returning `{ data } | { error }` (error = the `rivals:<code>`), cloud via `supabase.rpc`, demo mode simulated in `src/lib/rivals.js`
  with the SAME rules (revision flow, official-score-only metrics). Realtime already debounced.
- Copy in `src/lib/rivalsCopy.js` via `registerStrings` (PT-PT / PT-BR "time" / EN); "PITCH Rivals" never translated.
- Support copy when `needs_help` / dispute > 7 days: "Precisas de ajuda? Fala connosco" → WhatsApp bot `+351 913 813 845`.
- Never claim what isn't built: no live goal-by-goal engine for team matches in v1 — post-game per-player goals/assists steppers (`set_match_player_stats`) only.
