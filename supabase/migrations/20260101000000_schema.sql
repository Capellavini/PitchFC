-- ─────────────────────────────────────────────────────────
-- PITCH — Supabase schema v1
-- Paste this whole file into: Supabase Dashboard → SQL Editor
-- → New query → Run. It mirrors the prototype's data model
-- (CLAUDE.md) plus the club features (bookings, events,
-- open matches, peer ratings, live matchdays).
-- ─────────────────────────────────────────────────────────

-- A group of friends (one group = one recurring game, for now)
create table groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- "FC Amigos"
  venue         text,                          -- "PITCH Club — Campo 1"
  weekday       int  default 6,                -- 0=Sunday … 6=Saturday
  game_time     text default '20:00',
  monthly_price_cents int default 8000,        -- €80
  max_players   int  default 10,
  created_at    timestamptz default now()
);

create table players (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid references groups(id) on delete cascade,
  name          text not null,
  nick          text not null,
  email         text,
  phone         text,                          -- also the MB Way number
  photo_url     text,                          -- Supabase Storage path
  age           int,
  nationality   text,
  club          text,                          -- clube do coração
  position      text check (position in ('Guarda-redes','Defesa','Médio','Avançado')),
  foot          text check (foot in ('Direito','Esquerdo','Ambos')),
  attrs         jsonb default '{"rit":70,"rem":70,"pas":70,"dri":70,"def":70,"fis":70}',
  is_organizer  boolean default false,
  magic_token   text unique default encode(gen_random_bytes(16), 'hex'),
  created_at    timestamptz default now()
);

-- One row per weekly game ("matchday")
create table games (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid references groups(id) on delete cascade,
  scheduled_at  timestamptz not null,
  venue         text,
  spots         int default 10,
  total_cost_cents int,
  status        text default 'open' check (status in ('open','full','live','played','cancelled')),
  open_spots_published boolean default false,  -- listed in "find a match"
  recurring_rule text,                         -- 'weekly_sat_2000', null = one-off
  created_at    timestamptz default now()
);

create table attendances (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  player_id     uuid references players(id) on delete cascade,
  status        text default 'pending' check (status in ('pending','confirmed','declined')),
  paid          boolean default false,
  paid_at       timestamptz,
  responded_at  timestamptz,
  team          text check (team in ('a','b')), -- from the draw
  unique (game_id, player_id)
);

-- The short games inside one matchday (Jogo 1, Jogo 2…)
create table matches (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  n             int not null,                   -- 1, 2, 3…
  created_at    timestamptz default now(),
  unique (game_id, n)
);

-- Every goal: scorer + optional assist. Score and clean sheets derive.
create table match_events (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid references matches(id) on delete cascade,
  team          text not null check (team in ('a','b')),
  scorer_id     uuid references players(id),
  assist_id     uuid references players(id),
  created_at    timestamptz default now()
);

create table mvp_votes (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  voter_id      uuid references players(id) on delete cascade,
  voted_for_id  uuid references players(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (game_id, voter_id)                    -- one vote per player per game
);

create table material_items (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  item          text not null,                  -- "Bola", "Coletes"
  assigned_to   uuid references players(id),
  done          boolean default false
);

-- Friends rate your card (replaces the base64-code demo flow)
create table peer_ratings (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid references players(id) on delete cascade,
  rater_name    text default 'Anónimo',
  attrs         jsonb not null,                 -- {"rit":80,…}
  created_at    timestamptz default now()
);

-- Court bookings (club has court 1 and court 2)
create table bookings (
  id            uuid primary key default gen_random_uuid(),
  court         int not null check (court in (1, 2)),
  day           date not null,
  hour          text not null,                  -- '20:00'
  group_id      uuid references groups(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (court, day, hour)                     -- no double booking
);

-- Club events (broadcasts, pop-ups, sales…) with RSVP + payment
create table events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  emoji         text,
  day           date not null,
  event_time    text,
  description   text,
  kind          text check (kind in ('mesa','bilhete')),  -- null = free
  price_cents   int default 0,
  created_at    timestamptz default now()
);

create table event_rsvps (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references events(id) on delete cascade,
  player_id     uuid references players(id) on delete cascade,
  paid          boolean default false,
  created_at    timestamptz default now(),
  unique (event_id, player_id)
);

-- Cross-group signups for published open spots ("falta 1!")
create table open_match_signups (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid references games(id) on delete cascade,
  player_id     uuid references players(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (game_id, player_id)
);

-- Social feed
create table posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references players(id) on delete cascade,
  type          text default 'text' check (type in ('text','photo','video')),
  body          text,
  media_url     text,                           -- Supabase Storage path
  gotw          boolean default false,          -- Golo da Semana candidate
  created_at    timestamptz default now()
);

create table post_likes (
  post_id       uuid references posts(id) on delete cascade,
  player_id     uuid references players(id) on delete cascade,
  primary key (post_id, player_id)
);

create table post_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid references posts(id) on delete cascade,
  author_id     uuid references players(id) on delete cascade,
  body          text not null,
  created_at    timestamptz default now()
);

create table gotw_votes (
  post_id       uuid references posts(id) on delete cascade,
  player_id     uuid references players(id) on delete cascade,
  week          date not null,                  -- monday of the voting week
  primary key (player_id, week)                 -- one vote per player per week
);

-- ─────────────────────────────────────────────────────────
-- Row Level Security: ON for every table. The prototype uses
-- the anon key, so v1 policies are permissive (open read,
-- open write). LOCK THESE DOWN before real users: scope by
-- group_id / magic-token auth (see SUPABASE.md, step 5).
-- ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "open read v1"  on %I for select using (true)', t);
    execute format('create policy "open write v1" on %I for insert with check (true)', t);
    execute format('create policy "open update v1" on %I for update using (true)', t);
    execute format('create policy "open delete v1" on %I for delete using (true)', t);
  end loop;
end $$;

-- Realtime: the slot grid and live scores update for everyone
alter publication supabase_realtime add table attendances, match_events, bookings, event_rsvps, posts, players, groups;
