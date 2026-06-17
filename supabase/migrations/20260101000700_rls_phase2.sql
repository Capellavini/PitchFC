-- ─────────────────────────────────────────────────────────
-- Migration 8 (RLS Phase 2) — scope the remaining open writes
--
-- Phase 1 (migration 5) blocked anonymous access and scoped writes on
-- groups/games/players/events. But several tables still allowed ANY
-- logged-in user to write across groups. This scopes those writes to:
--   • the row's owner (the player it belongs to), or
--   • an organizer/assistant of the relevant group, or
--   • an app admin.
--
-- READS stay open to authenticated users on purpose (the social feed and
-- club views need cross-group reads) — confirmed product decision.
--
-- Confirmations model: a player may edit THEIR OWN attendance; the
-- organizer/assistant (and admin) may manage anyone in the group,
-- including guest/avulso players. (One-tap self-confirm is preserved.)
-- ─────────────────────────────────────────────────────────

-- ── Helpers ───────────────────────────────────────────────
-- The current user's player id (SECURITY DEFINER to avoid recursion
-- when referenced inside the players-related policies).
create or replace function public.my_player_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.players where user_id = auth.uid() limit 1;
$$;

-- Can the current user manage (organize) a given group?
create or replace function public.can_manage_group(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.players
    where user_id = auth.uid() and group_id = gid and (is_organizer or is_assistant)
  );
$$;

-- The group a game belongs to.
create or replace function public.game_group_id(g uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.games where id = g;
$$;

-- ── attendances: own row, or group organizer/assistant/admin ──
drop policy if exists "auth insert" on public.attendances;
drop policy if exists "auth update" on public.attendances;
drop policy if exists "auth delete" on public.attendances;
create policy "att insert" on public.attendances for insert
  with check (player_id = public.my_player_id() or public.can_manage_group(public.game_group_id(game_id)));
create policy "att update" on public.attendances for update
  using (player_id = public.my_player_id() or public.can_manage_group(public.game_group_id(game_id)));
create policy "att delete" on public.attendances for delete
  using (public.can_manage_group(public.game_group_id(game_id)));

-- ── matchdays: only the group's organizer/assistant/admin ──
drop policy if exists "auth insert" on public.matchdays;
drop policy if exists "auth update" on public.matchdays;
drop policy if exists "auth delete" on public.matchdays;
create policy "md insert" on public.matchdays for insert with check (public.can_manage_group(group_id));
create policy "md update" on public.matchdays for update using (public.can_manage_group(group_id));
create policy "md delete" on public.matchdays for delete using (public.can_manage_group(group_id));

-- ── matchday_votes: each player casts/updates their own vote ──
drop policy if exists "auth insert" on public.matchday_votes;
drop policy if exists "auth update" on public.matchday_votes;
drop policy if exists "auth delete" on public.matchday_votes;
create policy "mv insert" on public.matchday_votes for insert with check (voter_id = public.my_player_id());
create policy "mv update" on public.matchday_votes for update using (voter_id = public.my_player_id());
create policy "mv delete" on public.matchday_votes for delete using (voter_id = public.my_player_id() or public.is_admin());

-- ── posts / likes / comments: act only as yourself ──
drop policy if exists "auth insert" on public.posts;
drop policy if exists "auth update" on public.posts;
drop policy if exists "auth delete" on public.posts;
create policy "post insert" on public.posts for insert with check (author_id = public.my_player_id());
create policy "post update" on public.posts for update using (author_id = public.my_player_id() or public.is_admin());
create policy "post delete" on public.posts for delete using (author_id = public.my_player_id() or public.is_admin());

drop policy if exists "auth insert" on public.post_likes;
drop policy if exists "auth update" on public.post_likes;
drop policy if exists "auth delete" on public.post_likes;
create policy "like insert" on public.post_likes for insert with check (player_id = public.my_player_id());
create policy "like delete" on public.post_likes for delete using (player_id = public.my_player_id());

drop policy if exists "auth insert" on public.post_comments;
drop policy if exists "auth update" on public.post_comments;
drop policy if exists "auth delete" on public.post_comments;
create policy "comment insert" on public.post_comments for insert with check (author_id = public.my_player_id());
create policy "comment update" on public.post_comments for update using (author_id = public.my_player_id() or public.is_admin());
create policy "comment delete" on public.post_comments for delete using (author_id = public.my_player_id() or public.is_admin());

-- ── friendships: only the people involved ──
drop policy if exists "auth insert" on public.friendships;
drop policy if exists "auth update" on public.friendships;
drop policy if exists "auth delete" on public.friendships;
create policy "friend insert" on public.friendships for insert with check (requester_id = public.my_player_id());
create policy "friend update" on public.friendships for update
  using (addressee_id = public.my_player_id() or requester_id = public.my_player_id());
create policy "friend delete" on public.friendships for delete
  using (addressee_id = public.my_player_id() or requester_id = public.my_player_id() or public.is_admin());

-- ── bookings: members of the booking's group, or admin ──
drop policy if exists "auth insert" on public.bookings;
drop policy if exists "auth update" on public.bookings;
drop policy if exists "auth delete" on public.bookings;
create policy "book insert" on public.bookings for insert with check (group_id = public.my_group_id() or public.is_admin());
create policy "book update" on public.bookings for update using (group_id = public.my_group_id() or public.is_admin());
create policy "book delete" on public.bookings for delete using (group_id = public.my_group_id() or public.is_admin());

-- Note: legacy tables not used by the cloud app (matches, match_events,
-- material_items, mvp_votes, event_rsvps, open_match_signups, gotw_votes,
-- peer_ratings) still allow any authenticated write. They're empty in
-- practice; tighten them in a later pass if/when those features go cloud.
