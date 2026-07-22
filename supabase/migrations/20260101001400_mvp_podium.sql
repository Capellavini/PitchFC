-- ─────────────────────────────────────────────────────────
-- Migration 14 — MVP podium (1st/2nd/3rd)
--
-- Extends single-choice MVP voting into a ranked top-3 ballot: each voter
-- casts up to 3 rows (one per rank) instead of one. Points per ballot slot
-- are weighted client-side (see useCloud.js closeMvp) and summed across
-- all voters per candidate; the 3 highest-scoring candidates become the
-- night's podium, stored on matchdays.{mvp_id, runner_up_id, third_id}.
-- Fantasy League bonuses for 2nd/3rd (mvp2/mvp3 weights, see
-- src/lib/fantasy.js) piggy-back on the same mechanism the MVP bonus
-- already used.
-- ─────────────────────────────────────────────────────────

alter table public.matchdays add column if not exists runner_up_id uuid references public.players(id);
alter table public.matchdays add column if not exists third_id     uuid references public.players(id);

alter table public.matchday_votes add column if not exists rank int not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matchday_votes_rank_check') then
    alter table public.matchday_votes add constraint matchday_votes_rank_check check (rank in (1, 2, 3));
  end if;
end $$;

-- Drop whatever the old "one vote per voter" unique constraint is
-- actually named (auto-generated at table-creation time in migration 3) —
-- looking it up by its columns instead of guessing the name, same fix as
-- the peer_ratings constraint issue from migration 12.
do $$
declare
  old_conname text;
begin
  select tc.constraint_name into old_conname
  from information_schema.table_constraints tc
  where tc.table_name = 'matchday_votes' and tc.constraint_type = 'UNIQUE'
    and tc.constraint_name in (
      select constraint_name from information_schema.key_column_usage
      where table_name = 'matchday_votes'
      group by constraint_name
      having array_agg(column_name::text order by column_name) = array['matchday_id', 'voter_id']
    )
  limit 1;
  if old_conname is not null then
    execute format('alter table public.matchday_votes drop constraint %I', old_conname);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matchday_votes_voter_rank_key') then
    alter table public.matchday_votes add constraint matchday_votes_voter_rank_key unique (matchday_id, voter_id, rank);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matchday_votes_voter_candidate_key') then
    alter table public.matchday_votes add constraint matchday_votes_voter_candidate_key unique (matchday_id, voter_id, voted_for_id);
  end if;
end $$;
