-- ─────────────────────────────────────────────────────────
-- Migration 68 — WhatsApp bot: weekly-cycle state + per-group modes
--
-- 1) bot_game_state.cycle_opened_at: a recurring game reuses the same
--    games row every week (reset_recurring_confirmations sets a new
--    games.cycle_opened_at). The bot's last_confirmed counter didn't know
--    the cycle changed, so after week 1 "Jogo aberto" (prev === null)
--    never fired again, and the reset's drop to 0 could look like "abriu
--    vaga". The bot now stores the cycle it last saw and treats a new
--    cycle as a fresh game. NULL = legacy row (treated as same cycle once,
--    then overwritten), so deploying this doesn't re-announce anything.
--
-- 2) groups.wa_bot_kinds: optional allowlist of proactive message kinds
--    (game_open, milestone, promoted, spot_opened, reminder, matchday,
--    cancelled, postgame, match_awards, Adjunto group kinds). NULL = all
--    (today's behaviour). Goodweather F.C. → '{game_open}' (Vini, 2026-10-06).
--
-- 3) groups.wa_bot_interactive: false = the bot never answers in that
--    group (no @Pitch Q&A, no chat/poll confirmations, no commands).
--
-- Additive, constant defaults → no table rewrite. Columns only, no new
-- tables → no new grants needed.
-- ─────────────────────────────────────────────────────────

alter table public.bot_game_state add column if not exists cycle_opened_at timestamptz;

alter table public.groups add column if not exists wa_bot_kinds text[];
alter table public.groups add column if not exists wa_bot_interactive boolean not null default true;
