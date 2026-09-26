-- ─────────────────────────────────────────────────────────
-- Migration — add 'ptbr' as a valid wa_bot_lang
--
-- The bot's message templates (messages.js/roster.js) and the @Pitch AI
-- system prompt (ask.js) now have a real Brazilian-Portuguese variant,
-- distinct from PT-PT ("gols" not "golos", "você" phrasing, etc.).
-- The original check constraint only allowed 'pt' | 'en' | 'pt+en'.
-- ─────────────────────────────────────────────────────────

alter table public.groups drop constraint if exists groups_wa_bot_lang_check;
alter table public.groups add constraint groups_wa_bot_lang_check
  check (wa_bot_lang in ('pt', 'ptbr', 'en', 'pt+en'));
