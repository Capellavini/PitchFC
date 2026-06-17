-- ─────────────────────────────────────────────────────────
-- Migration 6 — recurring game + confirmation-open window
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--
-- Lets a group define a weekly recurring game and WHEN confirmations
-- open for each round (e.g. "toda segunda às 17h abre o jogo de domingo").
-- The open/closed gating is derived client-side from these fields, so no
-- scheduled job is required for it to work. (A pg_cron job to auto-reset
-- attendances each new round is an optional later enhancement.)
-- ─────────────────────────────────────────────────────────

alter table groups add column if not exists recurring   boolean default true;
alter table groups add column if not exists open_weekday int;    -- 0=Sun … 6=Sat
alter table groups add column if not exists open_time    text;   -- 'HH:MM'

-- Sensible defaults for existing groups: open confirmations the Monday
-- 17:00 before the game (organizers can change this in settings).
update groups set open_weekday = 1   where open_weekday is null;
update groups set open_time    = '17:00' where open_time is null;
