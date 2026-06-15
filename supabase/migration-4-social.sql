-- ─────────────────────────────────────────────────────────
-- Migration 4 — assistant role + friendships + social to cloud
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run. Ignore "already member" notices.
-- ─────────────────────────────────────────────────────────

-- The organizer can promote a player to "auxiliar": may also draw and
-- rename teams. (Granting the role IS the organizer's permission.)
alter table players add column if not exists is_assistant boolean default false;

-- Friend graph (request → accept). One row per pair.
create table if not exists friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references players(id) on delete cascade,
  addressee_id uuid references players(id) on delete cascade,
  status       text default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table friendships enable row level security;
do $$ begin create policy "open all v1" on friendships for all using (true) with check (true); exception when duplicate_object then null; end $$;

-- Realtime so the feed, likes, comments and friend requests update live.
do $$ begin alter publication supabase_realtime add table posts;         exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table post_likes;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table post_comments; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table friendships;   exception when others then null; end $$;
