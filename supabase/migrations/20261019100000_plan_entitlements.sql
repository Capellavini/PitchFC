-- ─────────────────────────────────────────────────────────
-- PITCH plans — entitlements + soft paywall (NO billing).
-- Owner decisions (Vini, 2026-10-19): the goal is acquisition, not
-- conversion. Nobody is charged; this only records WHICH plan a group
-- (or a player) has, so the app/bot can show the soft paywall and skip
-- Club-only automation on Free groups.
--
--   • group_plans   one row per group: free | club | club_ai.
--   • player_plans  one row per player: player_plus (optional, individual).
--
-- Effective plan (also computed client-side in src/lib/core/entitlements.js
-- — keep the two in sync):
--   no row / status 'canceled' / ends_at in the past  ⇒ free
--   otherwise                                          ⇒ the stored plan
--   ('past_due' keeps the plan — billing grace, for when billing exists).
--
-- Grants at launch:
--   • every group existing NOW      → Club + AI, source 'founder', until
--                                     2026-12-31 23:59 Europe/Lisbon.
--   • Goodweather + Fut TJ 11x11    → Club + AI forever ('founder_forever').
--   • every group created from now  → 14-day Club trial ('trialing'/'trial'),
--                                     by trigger on groups INSERT (groups are
--                                     created by direct inserts from the app,
--                                     useCloud.js createGroup*, and by SQL).
--
-- Writes ONLY through security-definer RPCs; members read their group's
-- row; admins (is_admin()) read/write everything.
-- Check: supabase/tests/plans_check.sql (reports which groups matched the
-- founder_forever patterns — the owner confirms the ids).
-- ─────────────────────────────────────────────────────────

-- ── 1. Tables ────────────────────────────────────────────
create table if not exists public.group_plans (
  group_id    uuid primary key references public.groups(id) on delete cascade,
  plan        text not null check (plan in ('free','club','club_ai')),
  status      text not null default 'active' check (status in ('trialing','active','past_due','canceled')),
  source      text not null check (source in ('trial','founder','founder_forever','manual','stripe')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,                       -- null = forever
  granted_by  uuid,                              -- auth user id of the admin (null = system)
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.group_plans is 'PITCH: the plan a group has (free | club | club_ai). No billing yet. Written only by trigger/admin RPCs; read via group_entitlement().';

create table if not exists public.player_plans (
  player_id   uuid primary key references public.players(id) on delete cascade,
  plan        text not null default 'player_plus' check (plan in ('player_plus')),
  status      text not null default 'active' check (status in ('trialing','active','past_due','canceled')),
  source      text not null check (source in ('trial','founder','founder_forever','manual','stripe')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  granted_by  uuid,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.player_plans is 'PITCH: individual Player+ (optional). Nothing is gated on it yet.';

-- ── 2. Helpers ───────────────────────────────────────────
-- Is the caller a (non-banned) member of this group? Current group via
-- players.group_id, or any group via player_group_memberships.
create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players p where p.user_id = auth.uid() and p.group_id = gid)
      or exists (select 1 from public.player_group_memberships m
                 join public.players p on p.id = m.player_id
                 where p.user_id = auth.uid() and m.group_id = gid and not m.banned);
$$;

-- Effective plan of a stored row at time t (pure).
create or replace function public.plan_effective(p_plan text, p_status text, p_ends_at timestamptz, p_at timestamptz default now())
returns text language sql immutable as $$
  select case
    when p_plan is null then 'free'
    when p_status = 'canceled' then case when p_plan = 'player_plus' then null else 'free' end
    when p_ends_at is not null and p_ends_at <= p_at then case when p_plan = 'player_plus' then null else 'free' end
    else p_plan
  end;
$$;

-- ── 3. RLS + explicit Data API grants (CLAUDE.md, Oct 2026 rule) ──
alter table public.group_plans  enable row level security;
alter table public.player_plans enable row level security;

drop policy if exists "group_plans read" on public.group_plans;
create policy "group_plans read" on public.group_plans for select
  using (public.is_admin() or public.is_group_member(group_id));

drop policy if exists "player_plans read" on public.player_plans;
create policy "player_plans read" on public.player_plans for select
  using (public.is_admin() or player_id = public.my_player_id());

-- No anon access at all; authenticated reads (rows filtered by RLS) but
-- never writes directly; service_role (wa-bot, Edge Functions) full.
revoke all on table public.group_plans, public.player_plans from anon, authenticated;
grant select on table public.group_plans, public.player_plans to authenticated;
grant select, insert, update, delete on table public.group_plans, public.player_plans to service_role;

-- ── 4. Read RPC: the group's effective entitlement ───────
-- → { group_id, plan, status, source, starts_at, ends_at, days_left,
--     expired, stored_plan }. plan is the EFFECTIVE plan (expired ⇒ free).
-- Members, admins and service_role only.
create or replace function public.group_entitlement(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r public.group_plans;
  eff text;
  expired boolean;
begin
  if p_group_id is null then raise exception 'plans:group_required'; end if;
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_admin() or public.is_group_member(p_group_id)) then
    raise exception 'plans:forbidden';
  end if;
  select * into r from public.group_plans where group_id = p_group_id;
  if not found then
    return jsonb_build_object('group_id', p_group_id, 'plan', 'free', 'status', 'active', 'source', null,
      'starts_at', null, 'ends_at', null, 'days_left', null, 'expired', false, 'stored_plan', null);
  end if;
  eff := public.plan_effective(r.plan, r.status, r.ends_at, now());
  expired := r.plan <> 'free' and eff = 'free';
  return jsonb_build_object(
    'group_id', r.group_id,
    'plan', eff,
    'status', case when expired then 'expired' else r.status end,
    'source', r.source,
    'starts_at', r.starts_at,
    'ends_at', r.ends_at,
    'days_left', case when r.ends_at is null or expired then null
                      else greatest(0, ceil(extract(epoch from (r.ends_at - now())) / 86400.0))::int end,
    'expired', expired,
    'stored_plan', r.plan);
end $$;

-- ── 5. Admin RPCs ────────────────────────────────────────
-- Set/extend a group's plan (source 'manual', status 'active').
-- p_ends_at null = forever. Returns the new entitlement.
create or replace function public.admin_set_group_plan(p_group_id uuid, p_plan text, p_ends_at timestamptz default null, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'plans:admin_only'; end if;
  if p_plan not in ('free','club','club_ai') then raise exception 'plans:invalid_plan'; end if;
  if not exists (select 1 from public.groups where id = p_group_id) then raise exception 'plans:group_not_found'; end if;
  if p_ends_at is not null and p_ends_at <= now() then raise exception 'plans:ends_in_past'; end if;
  insert into public.group_plans (group_id, plan, status, source, starts_at, ends_at, granted_by, note)
  values (p_group_id, p_plan, 'active', 'manual', now(), case when p_plan = 'free' then null else p_ends_at end, auth.uid(), nullif(trim(p_note), ''))
  on conflict (group_id) do update set
    plan = excluded.plan, status = 'active', source = 'manual', starts_at = now(),
    ends_at = excluded.ends_at, granted_by = excluded.granted_by,
    note = coalesce(excluded.note, public.group_plans.note), updated_at = now();
  return public.group_entitlement(p_group_id);
end $$;

-- Every group with its stored + effective plan, for the admin "Planos" list.
create or replace function public.admin_group_plans()
returns table (group_id uuid, name text, created_at timestamptz, players int,
               plan text, status text, source text, ends_at timestamptz, effective_plan text, days_left int, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'plans:admin_only'; end if;
  return query
  select g.id, g.name, g.created_at,
         (select count(*)::int from public.player_group_memberships m where m.group_id = g.id and not m.banned),
         gp.plan, gp.status, gp.source, gp.ends_at,
         coalesce(public.plan_effective(gp.plan, gp.status, gp.ends_at, now()), 'free'),
         case when gp.ends_at is null or gp.ends_at <= now() then null
              else ceil(extract(epoch from (gp.ends_at - now())) / 86400.0)::int end,
         gp.note
  from public.groups g
  left join public.group_plans gp on gp.group_id = g.id
  order by g.created_at desc;
end $$;

-- ── 6. New groups → 14-day Club trial ────────────────────
create or replace function public.grant_group_trial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_plans (group_id, plan, status, source, starts_at, ends_at, note)
  values (new.id, 'club', 'trialing', 'trial', now(), now() + interval '14 days', 'Teste do Club (14 dias, grupo novo)')
  on conflict (group_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_grant_group_trial on public.groups;
create trigger trg_grant_group_trial
  after insert on public.groups
  for each row execute function public.grant_group_trial();

-- ── 7. Backfill: launch grants ───────────────────────────
-- Fundadores: every group that exists now → Club + AI until
-- 2026-12-31 23:59 Lisbon (WET in December = UTC+0).
insert into public.group_plans (group_id, plan, status, source, starts_at, ends_at, note)
select g.id, 'club_ai', 'active', 'founder', now(),
       (timestamp '2026-12-31 23:59:00' at time zone 'Europe/Lisbon'),
       'Fundador — Club + AI grátis até 31 dez 2026'
from public.groups g
on conflict (group_id) do nothing;

-- Goodweather + Fut TJ 11x11 → Club + AI forever. Matched by name; the
-- check script lists the matched ids so the owner can confirm (and fix
-- with admin_set_group_plan if a pattern caught the wrong group).
update public.group_plans gp
set plan = 'club_ai', status = 'active', source = 'founder_forever', ends_at = null,
    note = 'Fundador — Club + AI grátis para sempre', updated_at = now()
from public.groups g
where g.id = gp.group_id
  and (g.name ilike 'goodweather%' or g.name ilike 'good weather%'
       or (g.name ~* '(\mtj\M|fut\s*tj)' and g.name ~* '(11\s*[xv]\s*11|onze\s*x\s*onze)'));

-- ── 8. EXECUTE grants ────────────────────────────────────
revoke execute on function public.is_group_member(uuid) from public, anon;
grant  execute on function public.is_group_member(uuid) to authenticated, service_role;
revoke execute on function public.plan_effective(text, text, timestamptz, timestamptz) from public, anon;
grant  execute on function public.plan_effective(text, text, timestamptz, timestamptz) to authenticated, service_role;
revoke execute on function public.group_entitlement(uuid) from public, anon;
grant  execute on function public.group_entitlement(uuid) to authenticated, service_role;
revoke execute on function public.admin_set_group_plan(uuid, text, timestamptz, text) from public, anon;
grant  execute on function public.admin_set_group_plan(uuid, text, timestamptz, text) to authenticated, service_role;
revoke execute on function public.admin_group_plans() from public, anon;
grant  execute on function public.admin_group_plans() to authenticated, service_role;
revoke execute on function public.grant_group_trial() from public, anon, authenticated;
