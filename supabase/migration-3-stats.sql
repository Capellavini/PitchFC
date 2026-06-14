-- ─────────────────────────────────────────────────────────
-- Migration 3 — season stats + MVP voting in the cloud
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query.
-- Safe to re-run (idempotent). Ignore "already member" notices.
-- ─────────────────────────────────────────────────────────

-- Cumulative season stats live on the player row (shared ranking).
alter table players add column if not exists goals        int default 0;
alter table players add column if not exists assists      int default 0;
alter table players add column if not exists mvps         int default 0;
alter table players add column if not exists games_played int default 0;
alter table players add column if not exists wins         int default 0;
alter table players add column if not exists clean_sheets int default 0;

-- Seed the example FC Amigos players with their mock totals (once),
-- so the demo group has a populated ranking. Real groups start at 0.
update players set
  goals = 12, assists = 8,  mvps = 3, games_played = 13 where nick = 'Carlão'  and games_played = 0;
update players set goals = 21, assists = 5,  mvps = 5, games_played = 15 where nick = 'Joãozão'   and games_played = 0;
update players set goals = 3,  assists = 11, mvps = 2, games_played = 11 where nick = 'Miguelinho' and games_played = 0;
update players set goals = 0,  assists = 2,  mvps = 4, games_played = 14 where nick = 'Ruizão'    and games_played = 0;
update players set goals = 9,  assists = 13, mvps = 1, games_played = 9  where nick = 'Diogo'     and games_played = 0;
update players set goals = 17, assists = 4,  mvps = 2, games_played = 12 where nick = 'Liminha'   and games_played = 0;

-- One row per finished matchday: history + last-day summary + MVP state.
create table if not exists matchdays (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references groups(id) on delete cascade,
  played_on   date not null default current_date,
  n_games     int default 0,
  total_goals int default 0,
  mode        text,                       -- 'avulsa' | 'campeonato'
  summary     jsonb,                      -- { teamResults, matches, lines, candidates }
  mvp_id      uuid references players(id),
  mvp_open    boolean default true,
  created_at  timestamptz default now()
);

create table if not exists matchday_votes (
  id           uuid primary key default gen_random_uuid(),
  matchday_id  uuid references matchdays(id) on delete cascade,
  voter_id     uuid references players(id) on delete cascade,
  voted_for_id uuid references players(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (matchday_id, voter_id)          -- one vote per player per matchday
);

-- Permissive v1 RLS (matches the rest of the schema; lock down later).
alter table matchdays enable row level security;
alter table matchday_votes enable row level security;
do $$ begin create policy "open all v1" on matchdays for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "open all v1" on matchday_votes for all using (true) with check (true); exception when duplicate_object then null; end $$;

-- Realtime so the ranking and MVP tally update live for everyone.
do $$ begin alter publication supabase_realtime add table matchdays;      exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table matchday_votes; exception when others then null; end $$;
