-- Read-only Copilot: durable per-user cap; no official match writes.
-- Apply through the normal reviewed CI migration workflow only.
create table public.league_copilot_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  calls integer not null check (calls between 1 and 30),
  primary key (user_id, usage_day)
);
alter table public.league_copilot_usage enable row level security;
revoke all on table public.league_copilot_usage from public, anon, authenticated;
grant all on table public.league_copilot_usage to service_role;

-- Read-only eligibility for the pre-creation AI wizard; never grants creation rights.
create or replace function public.league_onboarding_allowed()
returns boolean language sql stable security invoker set search_path = '' as $$
 select auth.uid() is not null and (public.is_admin() or exists (
  select 1 from public.league_access_requests r where r.requester_player_id=public.my_player_id()
    and r.status='approved' and r.used_by_league_id is null));
$$;
revoke all on function public.league_onboarding_allowed() from public,anon;
grant execute on function public.league_onboarding_allowed() to authenticated;

create or replace function public.league_copilot_take_slot(p_competition_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_league uuid; v_calls integer;
begin
  if auth.uid() is null then raise exception 'league:not_authenticated'; end if;
  if p_competition_id is null then
    if not public.league_onboarding_allowed() then raise exception 'league:forbidden'; end if;
  else
  select league_id into v_league from public.competitions where id=p_competition_id;
  if v_league is null or not public.is_league_manager(v_league,p_competition_id)
    then raise exception 'league:forbidden'; end if;
  end if;
  insert into public.league_copilot_usage as usage(user_id,usage_day,calls)
    values(auth.uid(),(now() at time zone 'UTC')::date,1)
    on conflict(user_id,usage_day) do update set calls=usage.calls+1
      where usage.calls<30 returning calls into v_calls;
  return v_calls is not null;
end;
$$;
revoke all on function public.league_copilot_take_slot(uuid) from public,anon;
grant execute on function public.league_copilot_take_slot(uuid) to authenticated;
comment on function public.league_copilot_take_slot(uuid) is 'PITCH: maximum 30 Copilot attempts per authenticated user per UTC day across competitions, authorized league managers only. No match writes.';
