-- ─────────────────────────────────────────────────────────
-- Migration 57 — RLS Phase 3: scope social READS to group + friends
--
-- Until now every social table kept the broad "auth select" policy from
-- migration 5 (rls_lockdown): `using (auth.uid() is not null)`. With
-- 100+ real users across unrelated groups, any logged-in account could
-- read every group's posts/comments/likes and the whole friend graph via
-- the Data API. Writes were already scoped in migration 8 (rls_phase2)
-- and are NOT touched here.
--
-- New read rules:
--   • posts          — author is me, OR shares ≥1 group with me, OR is
--                      an accepted friend of mine (or I'm an app admin,
--                      needed for moderation: admins can already delete
--                      any post via "post delete").
--   • post_likes     — iff the parent post is readable.
--   • post_comments  — iff the parent post is readable.
--   • gotw_votes     — my own votes, or votes on a readable post.
--   • friendships    — only rows where I'm requester or addressee.
--
-- "Shares a group" uses player_group_memberships (migration 36) — the
-- multi-group membership model — not the scalar players.group_id, so a
-- player in groups A and B sees posts from both. Banned memberships
-- (migration 41) don't count, on either side. A soft-removed (not
-- banned) member keeps their membership row by design (the group
-- switcher lets them back in), so they still count as a member here.
--
-- `players` reads stay open to authenticated users on purpose (roster,
-- add-friend candidates, embeds like posts.author depend on it).
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────

-- ── Indexes the helpers rely on ───────────────────────────
-- players.user_id → auth.uid() lookup (used by every helper below and by
-- my_player_id()/my_group_id() already).
create index if not exists players_user_id_idx on public.players (user_id);
-- "does <author> share a group with me": lookups by player_id are served
-- by the unique (player_id, group_id) index; this covers the reverse.
create index if not exists pgm_group_player_idx on public.player_group_memberships (group_id, player_id);
-- Friendship lookups by addressee (requester side is covered by the
-- unique (requester_id, addressee_id) index).
create index if not exists friendships_addressee_requester_idx on public.friendships (addressee_id, requester_id);
-- Parent-post lookups from likes/comments/votes, and the feed ordering.
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists post_comments_post_idx on public.post_comments (post_id);
create index if not exists gotw_votes_post_idx on public.gotw_votes (post_id);

-- ── Helpers ───────────────────────────────────────────────
-- SECURITY DEFINER + fixed search_path: they read players/memberships/
-- friendships/posts without going through those tables' RLS, which both
-- avoids policy recursion (posts → friendships → …) and keeps each check
-- to a handful of index lookups.

-- Can the current user see content authored by player `p_author`?
create or replace function public.can_see_author(p_author uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_author is not null and auth.uid() is not null and (
    public.is_admin()
    -- me (any player row linked to my account)
    or exists (
      select 1 from public.players me
      where me.user_id = auth.uid() and me.id = p_author
    )
    -- shares at least one (non-banned) group with me
    or exists (
      select 1
      from public.players me
      join public.player_group_memberships mine   on mine.player_id = me.id and not mine.banned
      join public.player_group_memberships theirs on theirs.group_id = mine.group_id and not theirs.banned
      where me.user_id = auth.uid() and theirs.player_id = p_author
    )
    -- accepted friend (either direction)
    or exists (
      select 1
      from public.players me
      join public.friendships f
        on f.status = 'accepted'
       and ((f.requester_id = me.id and f.addressee_id = p_author)
         or (f.addressee_id = me.id and f.requester_id = p_author))
      where me.user_id = auth.uid()
    )
  );
$$;

-- Can the current user read post `p_post_id`? (Same rule as the posts
-- policy, resolved from the post id — used by likes/comments/votes.)
create or replace function public.can_read_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and public.can_see_author(p.author_id)
  );
$$;

revoke all on function public.can_see_author(uuid) from public, anon;
revoke all on function public.can_read_post(uuid)  from public, anon;
grant execute on function public.can_see_author(uuid) to authenticated, service_role;
grant execute on function public.can_read_post(uuid)  to authenticated, service_role;

-- ── posts ─────────────────────────────────────────────────
drop policy if exists "auth select"  on public.posts;
drop policy if exists "open read v1" on public.posts;
drop policy if exists "post select"  on public.posts;
create policy "post select" on public.posts for select
  using (public.can_see_author(author_id));

-- ── post_likes ────────────────────────────────────────────
drop policy if exists "auth select"  on public.post_likes;
drop policy if exists "open read v1" on public.post_likes;
drop policy if exists "like select"  on public.post_likes;
create policy "like select" on public.post_likes for select
  using (public.can_read_post(post_id));

-- ── post_comments ─────────────────────────────────────────
drop policy if exists "auth select"    on public.post_comments;
drop policy if exists "open read v1"   on public.post_comments;
drop policy if exists "comment select" on public.post_comments;
create policy "comment select" on public.post_comments for select
  using (public.can_read_post(post_id));

-- ── gotw_votes (unused by the app today, see docs/SOCIAL-STATE.md §6) ──
drop policy if exists "auth select"  on public.gotw_votes;
drop policy if exists "open read v1" on public.gotw_votes;
drop policy if exists "gotw select"  on public.gotw_votes;
create policy "gotw select" on public.gotw_votes for select
  using (player_id = public.my_player_id() or public.can_read_post(post_id) or public.is_admin());

-- ── friendships: only the two people involved ─────────────
drop policy if exists "auth select"   on public.friendships;
drop policy if exists "open all v1"   on public.friendships;
drop policy if exists "open read v1"  on public.friendships;
drop policy if exists "friend select" on public.friendships;
create policy "friend select" on public.friendships for select
  using (
    requester_id = public.my_player_id()
    or addressee_id = public.my_player_id()
    or public.is_admin()
  );

-- Write policies ("post insert/update/delete", "like insert/delete",
-- "comment insert/update/delete", "friend insert/update/delete") from
-- migration 8 are unchanged. gotw_votes writes still use migration 5's
-- "auth insert/update/delete" (legacy, unused) — also unchanged.
