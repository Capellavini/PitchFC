-- WhatsApp bot: per-group message language.
--   'pt'     Portuguese (PT-PT)
--   'en'     English
--   'pt+en'  both, Portuguese first, in the same message (Goodweather FC)

alter table public.groups add column if not exists wa_bot_lang text not null default 'pt'
  check (wa_bot_lang in ('pt', 'en', 'pt+en'));

-- After linking the Goodweather WhatsApp group (see wa-bot/README.md):
--   update public.groups set wa_bot_lang = 'pt+en' where name ilike '%goodweather%';
