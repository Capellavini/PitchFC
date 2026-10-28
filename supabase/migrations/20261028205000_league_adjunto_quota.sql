-- Adjunto da Liga (chat): durable per-user daily cap on model calls.
-- The chat only proposes changes; it never writes league records. A session is
-- all it takes to ask, so the cap is the cost guard. Apply through the normal
-- reviewed CI migration workflow only.
create table public.league_adjunto_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  calls integer not null check (calls between 1 and 40),
  primary key (user_id, usage_day)
);
alter table public.league_adjunto_usage enable row level security;
revoke all on table public.league_adjunto_usage from public, anon, authenticated;
grant all on table public.league_adjunto_usage to service_role;

create or replace function public.league_adjunto_take_slot()
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_calls integer;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated'; end if;
  insert into public.league_adjunto_usage as usage(user_id, usage_day, calls)
    values (auth.uid(), (now() at time zone 'UTC')::date, 1)
    on conflict (user_id, usage_day) do update set calls = usage.calls + 1
      where usage.calls < 40 returning calls into v_calls;
  return v_calls is not null;
end;
$$;
revoke all on function public.league_adjunto_take_slot() from public, anon;
grant execute on function public.league_adjunto_take_slot() to authenticated;
comment on function public.league_adjunto_take_slot() is 'PITCH: maximum 40 Adjunto chat calls per authenticated user per UTC day. No league writes.';
