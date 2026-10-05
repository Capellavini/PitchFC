-- ─────────────────────────────────────────────────────────
-- Migration — bot_message_log: 90-day retention
--
-- The log holds the text players type to the Pitch AI and its replies, so
-- it can't live forever (GDPR storage limitation). A daily pg_cron job
-- deletes rows older than 90 days. The Privacidade page states this
-- number — change both together.
-- ─────────────────────────────────────────────────────────

create or replace function public.purge_old_bot_messages()
returns void language sql security definer set search_path = public as $$
  delete from public.bot_message_log where created_at < now() - interval '90 days';
$$;

-- A security-definer delete must not be callable through the public API.
revoke execute on function public.purge_old_bot_messages() from public, anon, authenticated;

select cron.unschedule('pitch-purge-bot-messages')
  where exists (select 1 from cron.job where jobname = 'pitch-purge-bot-messages');
select cron.schedule('pitch-purge-bot-messages', '30 3 * * *', 'select public.purge_old_bot_messages()');
