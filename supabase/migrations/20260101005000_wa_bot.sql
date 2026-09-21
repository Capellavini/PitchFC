-- WhatsApp group bot (experimental, Baileys). Which groups have a bot, plus
-- the durable dedupe log ("never duplicate") and last-seen state ("diff, don't
-- guess"). Only the bot's service-role key touches these tables: RLS is on
-- with no policies, so clients can never read or write them.

alter table public.groups add column if not exists wa_group_jid text unique;      -- '1203…@g.us'
alter table public.groups add column if not exists wa_bot_enabled boolean not null default false;

create table if not exists public.bot_announcements (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  game_id     uuid references public.games(id) on delete cascade,
  kind        text not null,               -- game_open | milestone | spot_opened | reminder | cancelled
  dedupe_key  text not null unique,        -- claim-before-send; unique violation = already announced
  status      text not null default 'claimed' check (status in ('claimed','sent')),
  created_at  timestamptz not null default now()
);
create index if not exists bot_announcements_group_day on public.bot_announcements (group_id, created_at desc);

create table if not exists public.bot_game_state (
  game_id         uuid primary key references public.games(id) on delete cascade,
  last_confirmed  int not null,
  updated_at      timestamptz not null default now()
);

alter table public.bot_announcements enable row level security;
alter table public.bot_game_state   enable row level security;
