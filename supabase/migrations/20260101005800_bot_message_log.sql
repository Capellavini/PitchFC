-- ─────────────────────────────────────────────────────────
-- Migration — bot_message_log: what @Pitch actually said
--
-- bot_announcements already tracks proactive events (kind, dedupe key,
-- sent/claimed) but never the message TEXT. Free-text @Pitch answers and
-- confirm/decline replies weren't recorded anywhere at all — the only way
-- to see what the bot said was to open WhatsApp itself. This table is the
-- durable, queryable record: question (where there is one) + the full
-- answer text + which group + when.
--
-- Internal audit table only — the bot (service_role) is the sole writer,
-- and reads happen via the Supabase SQL Editor (which runs as postgres,
-- bypassing these grants entirely), not through the app. No anon/
-- authenticated grant on purpose: nothing in the app needs this, and the
-- message text can include whatever a player typed.
-- ─────────────────────────────────────────────────────────

create table if not exists public.bot_message_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  kind text not null check (kind in ('proactive','answer','action_reply','admin_reply','poll_reply')),
  event_kind text,          -- kind='proactive' only: 'milestone','game_open','reminder','matchday','spot_opened','cancelled','postgame','match_awards','game_poll'
  question text,            -- the inbound message, where there is one (answer/action_reply/admin_reply)
  answer text not null,     -- the actual text the bot sent
  asker_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bot_message_log_group_idx on public.bot_message_log (group_id, created_at desc);

grant select, insert, update, delete on public.bot_message_log to service_role;
