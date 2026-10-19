-- ─────────────────────────────────────────────────────────
-- AI conversational onboarding (organizers) — per-user daily usage.
-- Written ONLY by the Vercel function api/onboarding-ai.js with the
-- service-role key; the client never reads or writes it (no policies,
-- no grants to anon/authenticated — explicit grants per the Oct-30-2026
-- Data API change, service_role only).
--
--  ai_onboarding_bump(user, limit)  → atomically counts one call for
--      today (Europe/Lisbon) and returns the new count, or NULL when the
--      user is already at the limit (the function then refuses to call
--      the model).
--  ai_onboarding_add_cost(user, µ$) → adds the estimated cost after the
--      model replied (est_cost_micros: 1 = US$0.000001).
-- ─────────────────────────────────────────────────────────

create table if not exists public.ai_onboarding_usage (
  user_id          uuid not null references auth.users(id) on delete cascade,
  day              date not null,
  calls            int  not null default 0 check (calls >= 0),
  est_cost_micros  bigint not null default 0 check (est_cost_micros >= 0),
  updated_at       timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ai_onboarding_usage enable row level security;
revoke all on public.ai_onboarding_usage from public, anon, authenticated;
grant select, insert, update, delete on public.ai_onboarding_usage to service_role;

create or replace function public.ai_onboarding_bump(p_user uuid, p_limit int)
returns int
language sql
set search_path = public
as $$
  insert into public.ai_onboarding_usage as u (user_id, day, calls)
  select p_user, (now() at time zone 'Europe/Lisbon')::date, 1 where p_limit > 0
  on conflict (user_id, day) do update
    set calls = u.calls + 1, updated_at = now()
    where u.calls < greatest(p_limit, 0)
  returning calls;
$$;

create or replace function public.ai_onboarding_add_cost(p_user uuid, p_micros bigint)
returns void
language sql
set search_path = public
as $$
  update public.ai_onboarding_usage
     set est_cost_micros = est_cost_micros + greatest(coalesce(p_micros, 0), 0), updated_at = now()
   where user_id = p_user and day = (now() at time zone 'Europe/Lisbon')::date;
$$;

revoke all on function public.ai_onboarding_bump(uuid, int) from public, anon, authenticated;
revoke all on function public.ai_onboarding_add_cost(uuid, bigint) from public, anon, authenticated;
grant execute on function public.ai_onboarding_bump(uuid, int) to service_role;
grant execute on function public.ai_onboarding_add_cost(uuid, bigint) to service_role;
