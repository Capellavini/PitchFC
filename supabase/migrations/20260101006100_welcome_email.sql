-- ─────────────────────────────────────────────────────────
-- Migration — welcome email, once per auth user
--
-- The `send-welcome` Edge Function sends one welcome email right after a
-- user confirms their email address. At that point there may be no
-- players row (and no group) yet, so the dedupe is keyed by the AUTH
-- user, not the player: the function claims a row here
-- (insert … on conflict do nothing returning user_id) BEFORE sending, so
-- two concurrent calls can never both email the same person, and deletes
-- the row again if Resend fails so a later call retries.
--
-- Service role only: RLS on with no policies, and (per CLAUDE.md, new
-- tables after 2026-10-30 get no automatic Data API grants) an explicit
-- grant to service_role and nothing for anon/authenticated.
-- ─────────────────────────────────────────────────────────

create table if not exists public.welcome_emails (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  sent_at  timestamptz not null default now()
);

alter table public.welcome_emails enable row level security;

revoke all on public.welcome_emails from anon, authenticated;
grant select, insert, update, delete on public.welcome_emails to service_role;

-- Everyone who confirmed their email before this ships has long since been
-- "welcomed" — mark them, so the app's post-confirmation trigger doesn't
-- email 100+ existing users the first time they open the app after deploy.
insert into public.welcome_emails (user_id, sent_at)
select id, coalesce(email_confirmed_at, now())
from auth.users
where email_confirmed_at is not null
on conflict (user_id) do nothing;
