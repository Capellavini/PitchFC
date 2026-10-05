-- ─────────────────────────────────────────────────────────
-- Migration — Treinador Adjunto (3/3): attendance_log
--
-- Recurring games reuse the same games row, and the weekly reset
-- (reset_recurring_confirmations, 005400) wipes attendances back to
-- status='pending', responded_at=null — so "who usually confirms late" has
-- no history today. This is an append-only log of every real status
-- change, written by a trigger on attendances. It feeds the Adjunto's
-- get_late_confirmers (plan §3 "006500", §7.3); insights unlock after 3
-- logged cycles.
--
-- What is logged:
--   * INSERT into attendances (magic link / app / bot confirm on a row that
--     didn't exist yet), unless it's a plain pending placeholder
--   * UPDATE where status actually changed
-- What is NOT logged: the weekly-reset write (new.status='pending' and
-- new.responded_at is null) — that's the system, not the player.
--
-- Safety on a hot table:
--   * creating a trigger takes a brief SHARE ROW EXCLUSIVE lock on
--     attendances; no table rewrite, no data change.
--   * the trigger is AFTER ROW and swallows its own errors (WARNING only),
--     so a logging problem can never fail or roll back a player's
--     confirmation, the reset, magic_set_status or the bot's chat-confirm.
--   * existing webhooks on attendances (notify-next) are unaffected.
--
-- Access: RLS on, no policies, service_role grants only (CLAUDE.md rule);
-- anon/authenticated revoked explicitly. 365-day retention via pg_cron,
-- same mechanism as 006200.
-- ─────────────────────────────────────────────────────────

create table if not exists public.attendance_log (
  id              bigserial primary key,
  game_id         uuid not null references public.games(id)   on delete cascade,
  group_id        uuid references public.groups(id)           on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  cycle_opened_at timestamptz,             -- games.cycle_opened_at at the time (null for one-off games)
  status          text not null,           -- new status: pending | confirmed | declined
  prev_status     text,                    -- null on insert
  at              timestamptz not null default now(),
  kickoff         timestamptz              -- games.scheduled_at at the time
);
create index if not exists attendance_log_group_idx  on public.attendance_log (group_id, at desc);
create index if not exists attendance_log_game_idx   on public.attendance_log (game_id, cycle_opened_at);
create index if not exists attendance_log_player_idx on public.attendance_log (player_id, at desc);

alter table public.attendance_log enable row level security;
revoke all on table public.attendance_log from anon, authenticated;
grant select, insert, update, delete on table public.attendance_log to service_role;
revoke all on sequence public.attendance_log_id_seq from anon, authenticated;
grant usage, select on sequence public.attendance_log_id_seq to service_role;

create or replace function public.log_attendance_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.attendance_log (game_id, group_id, player_id, cycle_opened_at, status, prev_status, kickoff)
    select new.game_id, g.group_id, new.player_id, g.cycle_opened_at, new.status,
           case when tg_op = 'UPDATE' then old.status end,
           g.scheduled_at
    from public.games g
    where g.id = new.game_id;
  exception when others then
    raise warning 'attendance_log insert failed (%): %', sqlstate, sqlerrm;
  end;
  return null;  -- AFTER trigger: return value ignored
end $$;
revoke execute on function public.log_attendance_change() from public, anon, authenticated;

drop trigger if exists trg_attendance_log_insert on public.attendances;
create trigger trg_attendance_log_insert
  after insert on public.attendances
  for each row
  when (new.status is not null
        and new.game_id is not null and new.player_id is not null
        and not (new.status = 'pending' and new.responded_at is null))
  execute function public.log_attendance_change();

drop trigger if exists trg_attendance_log_update on public.attendances;
create trigger trg_attendance_log_update
  after update of status on public.attendances
  for each row
  when (old.status is distinct from new.status
        and new.status is not null
        and new.game_id is not null and new.player_id is not null
        and not (new.status = 'pending' and new.responded_at is null))
  execute function public.log_attendance_change();

-- ── Retention: 365 days ──────────────────────────────────
create or replace function public.purge_old_attendance_log()
returns void language sql security definer set search_path = public as $$
  delete from public.attendance_log where at < now() - interval '365 days';
$$;
revoke execute on function public.purge_old_attendance_log() from public, anon, authenticated;

select cron.unschedule('pitch-purge-attendance-log')
  where exists (select 1 from cron.job where jobname = 'pitch-purge-attendance-log');
select cron.schedule('pitch-purge-attendance-log', '50 3 * * *', 'select public.purge_old_attendance_log()');
