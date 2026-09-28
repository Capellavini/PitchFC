-- ─────────────────────────────────────────────────────────
-- ONE-OFF CLEANUP — merge duplicate `players` rows (same auth user)
--
-- Context: on 2026-09-26 the "Onze x Onze" onboarding produced several
-- `players` rows for the same account (one user got 9 in ~3s): the quick
-- onboarding button had no in-flight guard and joinGroupWithProfile did a
-- blind INSERT, so every tap during the slow join+refetch added a row.
-- Each extra row also got its own player_group_memberships row (via the
-- sync trigger) and attendance → the player showed up N times in the
-- roster. The client is fixed in the same commit as this file; the DB
-- guard (unique players.user_id) is migration
-- supabase/migrations/20260101005600_dedupe_guard.sql, which REFUSES to
-- apply while duplicates exist — so run this file FIRST.
--
-- Rule: per auth user, keep the OLDEST row (created_at, then id) — the
-- same row the app now resolves as "me". Every reference to a duplicate
-- is repointed to the keeper, then the duplicates are deleted.
--
-- HOW TO RUN (Supabase dashboard → SQL editor):
--   STEP 1 — run ONLY the "PREVIEW" SELECT below (read-only) and check
--            what will be merged ("keep" = survivor, "merge" = deleted).
--   STEP 2 — run the whole "CLEANUP" block (from `begin;` to `commit;`).
--            It is one transaction: if anything errors, nothing changes.
--   STEP 3 — re-run the PREVIEW: it must return 0 rows.
--   STEP 4 — only then apply migration 20260101005600_dedupe_guard.sql
--            (merging it to main auto-applies it via the GitHub Action).
-- ─────────────────────────────────────────────────────────


-- ═════════ PREVIEW (read-only — run this SELECT first) ═════════
-- One line per row of every duplicate set. Nothing is modified.
/*
with ranked as (
  select p.*,
         row_number() over (partition by p.user_id order by p.created_at asc nulls last, p.id asc) as rn,
         count(*)     over (partition by p.user_id) as copies
  from public.players p
  where p.user_id is not null
)
select case when r.rn = 1 then 'keep' else 'merge' end as action,
       r.user_id, r.copies, r.id, r.nick, r.name, r.email,
       g.name as group_name, r.is_organizer, r.created_at, r.last_seen_at,
       (select count(*) from public.attendances a where a.player_id = r.id)              as attendances,
       (select count(*) from public.player_group_memberships m where m.player_id = r.id) as memberships,
       (select coalesce(sum(m.games_played), 0) from public.player_group_memberships m where m.player_id = r.id) as games_played
from ranked r
left join public.groups g on g.id = r.group_id
where r.copies > 1
order by r.user_id, r.rn;
*/


-- ═════════ CLEANUP (one transaction) ═════════
begin;

-- dup_id → keeper_id for every duplicate row.
create temp table dedupe_map on commit drop as
select id as dup_id, keeper_id
from (
  select id,
         first_value(id) over (partition by user_id order by created_at asc nulls last, id asc) as keeper_id
  from public.players
  where user_id is not null
) s
where id <> keeper_id;

-- 1) Keeper's own row: fill gaps from the duplicates (never overwrite a
--    value the keeper already has). If the keeper has no group but a dup
--    does, adopt the most recently seen dup's group + role.
update public.players k
set photo_url    = coalesce(k.photo_url, d.photo_url),
    phone        = coalesce(k.phone, d.phone),
    last_seen_at = greatest(k.last_seen_at, d.last_seen_at),
    group_id     = coalesce(k.group_id, d.group_id),
    is_organizer = case when k.group_id is null and d.group_id is not null then d.is_organizer else k.is_organizer end,
    is_assistant = case when k.group_id is null and d.group_id is not null then d.is_assistant else k.is_assistant end,
    player_type  = case when k.group_id is null and d.group_id is not null then d.player_type  else k.player_type  end
from (
  select distinct on (m.keeper_id) m.keeper_id, p.*
  from dedupe_map m join public.players p on p.id = m.dup_id
  order by m.keeper_id, (p.group_id is not null) desc, p.last_seen_at desc nulls last, p.created_at desc
) d
where k.id = d.keeper_id;

-- 2) player_group_memberships — unique (player_id, group_id). Collapse
--    each (keeper, group) set into ONE row: stats summed, strongest role,
--    earliest joined_at, banned if any copy was banned. The survivor is
--    the keeper's own row when it exists, else the oldest dup row.
create temp table pgm_merge on commit drop as
select coalesce(dm.keeper_id, m.player_id) as keeper_id, m.group_id,
       sum(m.goals) as goals, sum(m.assists) as assists, sum(m.mvps) as mvps,
       sum(m.games_played) as games_played, sum(m.wins) as wins,
       sum(m.clean_sheets) as clean_sheets, sum(m.epic_saves) as epic_saves,
       min(m.joined_at) as joined_at, bool_or(m.banned) as banned,
       case when bool_or(m.role = 'organizer') then 'organizer'
            when bool_or(m.role = 'assistant') then 'assistant' else 'member' end as role,
       (array_agg(m.player_type order by (m.player_id = coalesce(dm.keeper_id, m.player_id)) desc, m.joined_at))[1] as player_type,
       (array_agg(m.id order by (m.player_id = coalesce(dm.keeper_id, m.player_id)) desc, m.joined_at, m.id))[1] as survivor_id
from public.player_group_memberships m
left join dedupe_map dm on dm.dup_id = m.player_id
where m.player_id in (select dup_id from dedupe_map)
   or m.player_id in (select keeper_id from dedupe_map)
group by 1, 2;

delete from public.player_group_memberships m
using pgm_merge x
where m.group_id = x.group_id
  and m.id <> x.survivor_id
  and (m.player_id = x.keeper_id
       or m.player_id in (select dup_id from dedupe_map where keeper_id = x.keeper_id));

update public.player_group_memberships m
set player_id = x.keeper_id, goals = x.goals, assists = x.assists, mvps = x.mvps,
    games_played = x.games_played, wins = x.wins, clean_sheets = x.clean_sheets,
    epic_saves = x.epic_saves, joined_at = x.joined_at, banned = x.banned,
    role = x.role, player_type = x.player_type, updated_at = now()
from pgm_merge x
where m.id = x.survivor_id;

-- 3) attendances — unique (game_id, player_id). Per (game, keeper) keep
--    the most meaningful answer: a real answer (confirmed/declined) over
--    'pending', then the latest responded_at; `paid` survives if ANY copy
--    was paid.
create temp table att_merge on commit drop as
select a.game_id, coalesce(dm.keeper_id, a.player_id) as keeper_id,
       (array_agg(a.id order by (a.status <> 'pending') desc, a.responded_at desc nulls last,
                                (a.player_id = coalesce(dm.keeper_id, a.player_id)) desc, a.id))[1] as survivor_id,
       bool_or(coalesce(a.paid, false)) as paid,
       max(a.paid_at) as paid_at
from public.attendances a
left join dedupe_map dm on dm.dup_id = a.player_id
where a.player_id in (select dup_id from dedupe_map)
   or a.player_id in (select keeper_id from dedupe_map)
group by 1, 2;

delete from public.attendances a
using att_merge x
where a.game_id = x.game_id
  and a.id <> x.survivor_id
  and (a.player_id = x.keeper_id
       or a.player_id in (select dup_id from dedupe_map where keeper_id = x.keeper_id));

update public.attendances a
set player_id = x.keeper_id, paid = x.paid, paid_at = coalesce(a.paid_at, x.paid_at)
from att_merge x
where a.id = x.survivor_id;

-- 4) Every OTHER foreign key that references players(id) — discovered
--    from the catalog so nothing is missed (match_events, mvp/matchday
--    votes, peer_ratings, posts/likes/comments, friendships, push subs,
--    fantasy_*, teams/team_members, matchday_kudos, games.teams_*_by,
--    matchdays.mvp_id/runner_up_id/third_id, material_items, event_rsvps,
--    open_match_signups, gotw_votes, card_generations…). Row by row: if
--    repointing would violate a unique/check constraint (the keeper
--    already has that like/vote/membership), the duplicate's row is
--    dropped instead.
do $$
declare
  fk  record;
  rw  record;
begin
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.players'::regclass
      and array_length(c.conkey, 1) = 1
  loop
    for rw in execute format(
      'select t.ctid as rid, m.keeper_id from %s t join dedupe_map m on m.dup_id = t.%I',
      fk.tbl, fk.col)
    loop
      begin
        execute format('update %s set %I = $1 where ctid = $2', fk.tbl, fk.col)
          using rw.keeper_id, rw.rid;
      exception when unique_violation or check_violation then
        execute format('delete from %s where ctid = $1', fk.tbl) using rw.rid;
      end;
    end loop;
  end loop;
end $$;

-- Self-references the merge may have created (keeper ↔ its own dup).
delete from public.friendships    where requester_id = addressee_id;
delete from public.peer_ratings   where rater_id = player_id;
delete from public.matchday_kudos where to_player_id = from_player_id;

-- 5) Player ids embedded in JSON / uuid[] columns (games.teams,
--    games.live_matchday, matchdays.summary, live_matchday_archive,
--    fantasy_squads.player_ids/reserve_ids/formation_order/prices_paid…) —
--    discovered from the catalog as well.
do $$
declare
  col record;
  mp  record;
begin
  for col in
    select table_schema, table_name, column_name, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and udt_name in ('jsonb', '_uuid')
      and table_name in (select table_name from information_schema.tables
                         where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    for mp in select dup_id, keeper_id from dedupe_map loop
      if col.udt_name = 'jsonb' then
        execute format(
          'update %I.%I set %I = replace(%I::text, $1::text, $2::text)::jsonb where strpos(%I::text, $1::text) > 0',
          col.table_schema, col.table_name, col.column_name, col.column_name, col.column_name)
          using mp.dup_id, mp.keeper_id;
      else
        execute format(
          'update %I.%I set %I = array_replace(%I, $1, $2) where $1 = any(%I)',
          col.table_schema, col.table_name, col.column_name, col.column_name, col.column_name)
          using mp.dup_id, mp.keeper_id;
      end if;
    end loop;
  end loop;
end $$;

-- 6) Delete the duplicates (nothing references them any more).
delete from public.players where id in (select dup_id from dedupe_map);

-- 7) Clone GROUPS from the organizer double-tap (Everton, 2026-09-24):
--    12 "Continental FC" groups were created within ~31s, each holding
--    only one of his duplicate player rows (or nobody). Keep the group his
--    surviving (keeper) row points to; delete the others.
--    ⚠ players.group_id is ON DELETE CASCADE — deleting a group deletes the
--    players in it. That's why this runs AFTER the dedupe (the dups are
--    gone, the keeper sits in the kept group) and why every delete below is
--    guarded by "no other player/member lives in this group". Games,
--    attendances, memberships, invites, etc. of the clones go with them
--    via their own ON DELETE CASCADE.
do $$
declare
  v_keeper constant uuid := '7b779315-5971-4ae8-93b6-4f7f91e76ff2';
  v_keep_group uuid;
  v_deleted int;
begin
  select group_id into v_keep_group from public.players where id = v_keeper;
  if v_keep_group is null then
    raise exception 'Everton keeper row has no group — aborting, nothing changed';
  end if;

  delete from public.groups g
  where g.name = 'Continental FC'
    and g.created_at >= '2026-09-24 16:54:00+00'
    and g.created_at <  '2026-09-24 16:55:00+00'
    and g.id <> v_keep_group
    and not exists (select 1 from public.players p where p.group_id = g.id)
    and not exists (select 1 from public.player_group_memberships m
                    where m.group_id = g.id and m.player_id <> v_keeper);
  get diagnostics v_deleted = row_count;
  raise notice 'Continental FC: kept group %, deleted % clone group(s)', v_keep_group, v_deleted;

  if v_deleted <> 11 then
    raise exception 'expected to delete 11 Continental FC clones, got % — aborting, nothing changed', v_deleted;
  end if;
end $$;

-- Safety net: abort (rolls everything back) if any duplicate survived.
do $$
begin
  if exists (select 1 from public.players where user_id is not null
             group by user_id having count(*) > 1) then
    raise exception 'dedupe incomplete — duplicates remain; transaction rolled back';
  end if;
end $$;

commit;
