-- ─────────────────────────────────────────────────────────
-- Migration 5 — lock down Row Level Security
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- Replaces the permissive "open read/write v1" policies (anyone with
-- the anon key could read/write EVERYTHING, incl. real emails) with:
--   • authentication required for all access (blocks anonymous use)
--   • a server-side admin role (your email) with full cross-group access
--   • sensitive writes (groups, games, players, events) scoped to the
--     owner's group or an admin
--
-- SELECTs stay broad among *logged-in* users on purpose: the social feed,
-- club bookings grid and "add friend" need to read across groups. The
-- big win here is that nothing is readable/writable without a login.
--
-- ⚠️ After running this, TEST the app while logged in (confirm a game,
-- edit group settings, open the admin panel). If anything breaks, you
-- can revert by re-running the policy block at the bottom of schema.sql.
-- ─────────────────────────────────────────────────────────

-- ── Helper: is the current user an app admin? (by JWT email) ──
-- Add more addresses to the IN (...) list to grant admin.
create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') in (
    'capella.vinicius@gmail.com'
  );
$$;

-- ── Helper: the group the current user belongs to ──
-- SECURITY DEFINER so it can resolve the player row without tripping
-- the players policies (avoids recursion when used inside them).
create or replace function public.my_group_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select group_id from public.players where user_id = auth.uid() limit 1;
$$;

-- ── Drop every existing policy in public (the v1 open ones) ──
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── Baseline: logged-in users only, for every table (blocks anon) ──
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "auth select" on public.%I for select using (auth.uid() is not null)', t);
    execute format('create policy "auth insert" on public.%I for insert with check (auth.uid() is not null)', t);
    execute format('create policy "auth update" on public.%I for update using (auth.uid() is not null)', t);
    execute format('create policy "auth delete" on public.%I for delete using (auth.uid() is not null)', t);
  end loop;
end $$;

-- ── Tighten sensitive WRITES to owner-group or admin ──

-- groups: only members of the group (the organizer, in-app) or an admin
-- may edit/delete. Anyone logged-in may still INSERT (create a new group).
drop policy "auth update" on public.groups;
drop policy "auth delete" on public.groups;
create policy "groups update" on public.groups for update
  using (public.is_admin() or id = public.my_group_id());
create policy "groups delete" on public.groups for delete
  using (public.is_admin() or id = public.my_group_id());

-- games: same scoping as their group.
drop policy "auth update" on public.games;
drop policy "auth delete" on public.games;
create policy "games update" on public.games for update
  using (public.is_admin() or group_id = public.my_group_id());
create policy "games delete" on public.games for delete
  using (public.is_admin() or group_id = public.my_group_id());

-- players: edit yourself, anyone in your group (organizer toggles roles),
-- or admin. Delete is admin or same-group (organizer removes a member).
drop policy "auth update" on public.players;
drop policy "auth delete" on public.players;
create policy "players update" on public.players for update
  using (public.is_admin() or user_id = auth.uid() or group_id = public.my_group_id());
create policy "players delete" on public.players for delete
  using (public.is_admin() or group_id = public.my_group_id());

-- events: club-wide broadcasts — only an admin creates/edits/removes them.
drop policy "auth insert" on public.events;
drop policy "auth update" on public.events;
drop policy "auth delete" on public.events;
create policy "events insert" on public.events for insert with check (public.is_admin());
create policy "events update" on public.events for update using (public.is_admin());
create policy "events delete" on public.events for delete using (public.is_admin());

-- Note (phase 2, after testing): attendances, matchdays, votes, posts,
-- bookings, etc. still allow any *authenticated* write. Scope those to
-- the user's group / own rows once the above is confirmed working.
