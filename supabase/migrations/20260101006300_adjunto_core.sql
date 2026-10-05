-- ─────────────────────────────────────────────────────────
-- Migration — Treinador Adjunto (1/3): core tables
--
-- The "Treinador Adjunto" (PT-BR "Auxiliar Técnico", EN "Assistant
-- Coach") is a private WhatsApp DM assistant for organizers/assistants,
-- run by the wa-bot. Plan: docs/ADJUNTO-PLAN.md (§3), with the decisions
-- block at the top of that file (no season player league; teams proposed
-- 24h before kickoff; organizer AND assistants approve; activation also by
-- DM phrase matched on the sender's phone; everything free).
--
-- INERT FOR PRODUCTION: groups.adjunto_enabled defaults to false and every
-- new table starts empty. Nothing here changes an existing feature:
--   * groups gets two NULL-able / constant-default columns (no rewrite on
--     PG11+, brief lock only) and a CHECK that every existing row passes
--     (game_format is NULL everywhere).
--   * bot_message_log.kind's CHECK only GAINS 'adjunto_in'/'adjunto_out';
--     every existing value is kept, so every existing row still passes.
--
-- Access model: every new table has RLS ENABLED and NO policies. Only the
-- bot (service_role, which bypasses RLS) reads/writes them. The app never
-- touches them directly — it goes through the SECURITY DEFINER RPCs in
-- migration 006400. Explicit Data API grants (CLAUDE.md rule, Supabase
-- stops auto-granting on 2026-10-30): service_role only. Until that date
-- Supabase's default privileges still auto-grant anon/authenticated on new
-- tables, so we REVOKE those explicitly — defense in depth on top of RLS.
-- ─────────────────────────────────────────────────────────

-- ── groups: per-group gate + game format ─────────────────
-- The founder flips adjunto_enabled by hand in the SQL editor for his group
-- only (plan §12.6). game_format is the versioned format object (plan §5);
-- NULL = not set yet. Only the shape's outer frame is enforced here (an
-- object with a string "type"); the full schema is validated in code
-- (core/format.js validateFormat) because it will evolve with "v".
alter table public.groups add column if not exists adjunto_enabled boolean not null default false;
alter table public.groups add column if not exists game_format jsonb;

alter table public.groups drop constraint if exists groups_game_format_check;
alter table public.groups add constraint groups_game_format_check
  check (game_format is null
         or (jsonb_typeof(game_format) = 'object'
             and jsonb_typeof(game_format -> 'type') = 'string'));

-- ── Activation codes (the "Ativar" button in the app) ────
-- 'ADJ-' + 6 chars from a 32-symbol alphabet without 0/O/1/I. Created only
-- via adjunto_create_link_code() (006400); the bot marks them used.
create table if not exists public.adjunto_link_codes (
  code        text primary key check (code ~ '^ADJ-[A-HJ-NP-Z2-9]{6}$'),
  player_id   uuid not null references public.players(id) on delete cascade,
  group_id    uuid not null references public.groups(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 minutes',
  used_at     timestamptz,
  used_jid    text
);
create index if not exists adjunto_link_codes_player_idx
  on public.adjunto_link_codes (player_id, created_at desc);

-- ── Links: one WhatsApp DM ↔ one player ──────────────────
-- A link is per PLAYER (not per group): one organizer of several groups has
-- one DM thread and switches the active group ("grupo <nome>").
create table if not exists public.adjunto_links (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null unique references public.players(id) on delete cascade,
  wa_jid          text not null unique,      -- chat jid we reply to (as received)
  wa_lid          text unique,               -- '…@lid' form, when known
  wa_pn           text,                      -- E.164 digits (no '+'), when known
  active_group_id uuid references public.groups(id) on delete set null,
  lang            text check (lang in ('pt','ptbr','en')),   -- null = group's wa_bot_lang
  prefs           jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
                                             -- {teamsLeadHours:24, proactive:true, digest:false}
  enabled         boolean not null default true,
  linked_at       timestamptz not null default now(),
  last_inbound_at timestamptz
);
create index if not exists adjunto_links_wa_pn_idx on public.adjunto_links (wa_pn);

-- ── Conversation state (survives bot restarts) ───────────
-- mode 'choose_group' also serves decision 11: activation by phrase from an
-- organizer of several groups ("Qual? 1) … 2) …"); candidates go in draft.
create table if not exists public.adjunto_threads (
  link_id     uuid primary key references public.adjunto_links(id) on delete cascade,
  mode        text not null default 'idle' check (mode in ('idle','onboarding','choose_group')),
  step        text,                                   -- onboarding step id
  draft       jsonb not null default '{}'::jsonb,     -- partial game_format / group choices
  version     int  not null default 0,                -- optimistic concurrency
  updated_at  timestamptz not null default now()
);

-- ── Conversation memory: rolling window (plan §7.4) ──────
-- Only final text is stored (no tool blocks / thinking). 90-day purge below.
create table if not exists public.adjunto_messages (
  id          bigserial primary key,
  link_id     uuid not null references public.adjunto_links(id) on delete cascade,
  group_id    uuid references public.groups(id) on delete set null,
  role        text not null check (role in ('user','assistant','event')),  -- event = compact action log line
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists adjunto_messages_link_idx
  on public.adjunto_messages (link_id, created_at desc);

-- ── Two-phase writes (plan §7.3) ─────────────────────────
-- The model can only CREATE a proposal; execution happens in code after the
-- organizer's (or an assistant's — first approval wins) explicit "sim".
create table if not exists public.adjunto_proposals (
  id           bigserial primary key,               -- short ref "#12" shown to the organizer
  link_id      uuid not null references public.adjunto_links(id) on delete cascade,
  group_id     uuid not null references public.groups(id) on delete cascade,
  game_id      uuid references public.games(id) on delete cascade,
  cycle        timestamptz,                         -- games.cycle_opened_at at proposal time
  kind         text not null,                       -- set_format|teams|group_reminder|open_spots|reschedule|set_spots|mark_paid|cancel_game
  payload      jsonb not null,
  precondition jsonb not null default '{}'::jsonb,  -- e.g. {teams_md5, scheduled_at, status}
  status       text not null default 'pending'
               check (status in ('pending','executed','rejected','expired','superseded','failed')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.players(id) on delete set null,  -- who said "sim"/"não"
  error        text
);
create unique index if not exists adjunto_one_pending_per_kind
  on public.adjunto_proposals (link_id, kind, coalesce(game_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';
create index if not exists adjunto_proposals_game_idx
  on public.adjunto_proposals (game_id, kind) where status = 'pending';

-- ── Usage / budget accounting (plan §10) ─────────────────
-- Keyed by PLAYER, not link: unlink cascades away the link, and keying by
-- link would let someone reset the daily budget by unlinking + relinking.
create table if not exists public.adjunto_usage (
  day                date   not null,
  player_id          uuid   not null references public.players(id) on delete cascade,
  turns              int    not null default 0,
  llm_requests       int    not null default 0,
  input_tokens       bigint not null default 0,
  cache_read_tokens  bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  output_tokens      bigint not null default 0,
  usd_micros         bigint not null default 0,
  msgs_in            int    not null default 0,
  msgs_out           int    not null default 0,
  primary key (day, player_id)
);

-- ── Replies to UNLINKED senders (rate limiting) ──────────
-- The bot is silent in DMs except two cases: an expired/invalid activation
-- code (decision 7, max 3/hour/jid) and the activation phrase from a number
-- that isn't an organizer (decision 11, max 1/jid/day). Those senders have
-- no adjunto_links row, so the throttle needs its own durable table (an
-- in-memory counter would reset on every Fly restart). 30-day purge below.
create table if not exists public.adjunto_dm_replies (
  id          bigserial primary key,
  jid         text not null,
  kind        text not null check (kind in ('code_invalid','phrase_not_found')),
  created_at  timestamptz not null default now()
);
create index if not exists adjunto_dm_replies_jid_idx
  on public.adjunto_dm_replies (jid, kind, created_at desc);

-- ── RLS on, no policies; service_role only ───────────────
alter table public.adjunto_link_codes enable row level security;
alter table public.adjunto_links      enable row level security;
alter table public.adjunto_threads    enable row level security;
alter table public.adjunto_messages   enable row level security;
alter table public.adjunto_proposals  enable row level security;
alter table public.adjunto_usage      enable row level security;
alter table public.adjunto_dm_replies enable row level security;

revoke all on table
  public.adjunto_link_codes, public.adjunto_links, public.adjunto_threads,
  public.adjunto_messages, public.adjunto_proposals, public.adjunto_usage,
  public.adjunto_dm_replies
  from anon, authenticated;

grant select, insert, update, delete on table
  public.adjunto_link_codes, public.adjunto_links, public.adjunto_threads,
  public.adjunto_messages, public.adjunto_proposals, public.adjunto_usage,
  public.adjunto_dm_replies
  to service_role;

revoke all on sequence
  public.adjunto_messages_id_seq, public.adjunto_proposals_id_seq, public.adjunto_dm_replies_id_seq
  from anon, authenticated;
grant usage, select on sequence
  public.adjunto_messages_id_seq, public.adjunto_proposals_id_seq, public.adjunto_dm_replies_id_seq
  to service_role;

-- ── Audit: reuse bot_message_log (migration 005800) ──────
-- Same pattern as 005500: drop + re-add the CHECK with the full list.
-- Existing values kept verbatim; only 'adjunto_in'/'adjunto_out' are new.
alter table public.bot_message_log drop constraint if exists bot_message_log_kind_check;
alter table public.bot_message_log add constraint bot_message_log_kind_check
  check (kind in ('proactive','answer','action_reply','admin_reply','poll_reply','adjunto_in','adjunto_out'));

-- ── Retention (GDPR storage limitation) ──────────────────
-- Same mechanism as 006200 (pitch-purge-bot-messages, which already covers
-- the adjunto_in/adjunto_out rows of bot_message_log at 90 days):
--   adjunto_messages  90 days (organizer's own words — matches the privacy page)
--   adjunto_proposals 90 days (payloads carry names)
--   adjunto_link_codes 7 days (single-use, 30-min codes)
--   adjunto_dm_replies 30 days (throttle only)
--   adjunto_usage     400 days (cost history, no content)
create or replace function public.purge_old_adjunto_data()
returns void language sql security definer set search_path = public as $$
  delete from public.adjunto_messages   where created_at < now() - interval '90 days';
  delete from public.adjunto_proposals  where created_at < now() - interval '90 days';
  delete from public.adjunto_link_codes where created_at < now() - interval '7 days';
  delete from public.adjunto_dm_replies where created_at < now() - interval '30 days';
  delete from public.adjunto_usage      where day < current_date - 400;
$$;

-- A security-definer delete must not be callable through the public API.
revoke execute on function public.purge_old_adjunto_data() from public, anon, authenticated;

select cron.unschedule('pitch-purge-adjunto')
  where exists (select 1 from cron.job where jobname = 'pitch-purge-adjunto');
select cron.schedule('pitch-purge-adjunto', '40 3 * * *', 'select public.purge_old_adjunto_data()');
