-- ─────────────────────────────────────────────────────────
-- Migration 7 — weekly auto-reset of confirmations (pg_cron)
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- Closes the recurring-game loop: at each group's open moment
-- (open_weekday/open_time, e.g. "segunda às 17h"), the previous round's
-- confirmations are wiped so everyone starts the new week as 'pending'.
-- The open/closed UI is already derived client-side; this is the server
-- side that actually clears last week's answers.
--
-- Requires the pg_cron extension. If the CREATE EXTENSION line errors,
-- enable "pg_cron" first in Dashboard → Database → Extensions, then
-- re-run from there.
--
-- Times are evaluated in Europe/Lisbon (the product's timezone).
-- ─────────────────────────────────────────────────────────

create extension if not exists pg_cron;

-- Marks which weekly cycle a game's confirmations were last opened for,
-- so the reset fires exactly once per week (not on every cron tick).
alter table games add column if not exists cycle_opened_at timestamptz;

-- Most recent past occurrence of (weekday, time) — the current open moment.
create or replace function public.last_open_moment(open_weekday int, open_time text)
returns timestamptz language plpgsql stable as $$
declare loc timestamp; t time := open_time::time; d int; res timestamp;
begin
  loc := now() at time zone 'Europe/Lisbon';
  d := (extract(dow from loc)::int - open_weekday + 7) % 7;       -- 0=Sun..6=Sat
  res := (date_trunc('day', loc) - make_interval(days => d)) + t;
  if res > loc then res := res - interval '7 days'; end if;        -- not reached today yet
  return res at time zone 'Europe/Lisbon';
end $$;

-- Next future occurrence of (weekday, time) — the upcoming game kickoff.
create or replace function public.next_game_datetime(game_weekday int, game_time text)
returns timestamptz language plpgsql stable as $$
declare loc timestamp; t time := game_time::time; d int; res timestamp;
begin
  loc := now() at time zone 'Europe/Lisbon';
  d := (game_weekday - extract(dow from loc)::int + 7) % 7;
  res := (date_trunc('day', loc) + make_interval(days => d)) + t;
  if res < loc then res := res + interval '7 days'; end if;
  return res at time zone 'Europe/Lisbon';
end $$;

-- For every recurring group whose open moment has passed since its last
-- reset: wipe confirmations on the current game and roll it forward.
create or replace function public.reset_recurring_confirmations()
returns void language plpgsql security definer set search_path = public as $$
declare g record; om timestamptz; gm record;
begin
  for g in
    select * from groups
    where recurring is true and open_weekday is not null and open_time is not null
  loop
    om := last_open_moment(g.open_weekday, g.open_time);
    select * into gm from games
      where group_id = g.id and status in ('open','full','live')
      order by scheduled_at desc limit 1;
    if gm.id is null then continue; end if;

    if gm.cycle_opened_at is null or gm.cycle_opened_at < om then
      -- New week: everyone back to pending, payments cleared.
      update attendances
        set status = 'pending', paid = false, paid_at = null, responded_at = null
        where game_id = gm.id;
      update games
        set cycle_opened_at = om, status = 'open',
            scheduled_at = next_game_datetime(g.weekday, g.game_time)
        where id = gm.id;
    end if;
  end loop;
end $$;

-- Run hourly: confirmations reset within an hour of the open moment.
select cron.unschedule('pitch-reset-confirmations')
  where exists (select 1 from cron.job where jobname = 'pitch-reset-confirmations');
select cron.schedule('pitch-reset-confirmations', '0 * * * *',
  $$ select public.reset_recurring_confirmations(); $$);
