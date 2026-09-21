# PITCH group bot (experimental)

An organizer bot that lives in a WhatsApp group (first target: Goodweather). It
uses **Baileys** (unofficial WhatsApp Web protocol), so it runs as its own
long-lived process, not as a Supabase Edge Function.

## What it does

Proactive, **state-change events only** (deterministic templates, no AI):

| Event | When |
| --- | --- |
| Jogo aberto | a fresh game appears (<12h old) |
| Marco | confirmed count crosses `spots` / `spots+2` / `spots+5` (10 / 12 / 15). Jumps coalesce to the highest one |
| Abriu vaga | a **full** game drops below `spots` |
| Lembrete | <24h to kickoff and spots still open (once) |
| Cancelado | game cancelled (urgent: ignores quiet hours and daily cap) |

Reactive: `@Pitch <pergunta>` gets a short PT-PT answer from Haiku. The model
only sees a small DATA block read from Supabase (spots, confirmed names, link).
Without `ANTHROPIC_API_KEY` the bot posts events only.

## Ban-risk guards (built in)

- **Dry-run by default.** Nothing is sent or recorded until `BOT_AUTOSEND=true`.
- Opt-in per group (`groups.wa_bot_enabled` + `wa_group_jid`).
- Max `BOT_MAX_PER_DAY` proactive messages per group (default 4).
- Quiet hours 23:00-08:00 Lisbon (deferred, not dropped).
- Random 2-8s delay + "typing" presence before every send.
- 2-poll debounce: confirm-then-undo never reaches the group.
- Never DMs anyone. Group only.
- @Pitch answers: 1 per sender per 20s.
- Claim-before-send dedupe (`bot_announcements.dedupe_key` unique) so a restart
  can't double-post.

Still true: Baileys violates WhatsApp's terms and a ban can come without
warning. Use a **dedicated chip**, never a personal number. Keep the
`auth/` folder private (it is the session, like a password; gitignored).

## Setup (test on Goodweather)

1. Run `supabase/migrations/20260101005000_wa_bot.sql` in the Supabase SQL editor.
2. `cd wa-bot && npm install && cp env.example .env` and fill
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), optionally `ANTHROPIC_API_KEY`.
3. Put the test chip in the Goodweather WhatsApp group, then link it:
   `npm run groups` -> scan the QR (WhatsApp > Linked devices) -> it prints
   every group as `<jid>  <name>`.
4. Enable the group:
   ```sql
   update groups set wa_group_jid = '<jid>@g.us', wa_bot_enabled = true
   where name ilike '%goodweather%';
   ```
5. `npm start` in **dry-run** and watch the log: it prints exactly what it
   would post. When you like it, set `BOT_AUTOSEND=true`.

`npm test` runs the decision-logic tests (no network).

## Files

- `src/events.js` pure "what is due?" logic (tested)
- `src/messages.js` PT-PT templates
- `src/index.js` Baileys transport, poll loop, guards, @mention
- `src/ask.js` Haiku answer over a fixed data block
- `src/db.js` Supabase reads and the claim/dedupe log

## Not built yet

- Confirming by chat ("@Pitch eu vou"): needs phone -> player matching.
- Hosting: needs an always-on box (Railway/Fly/VPS) and a persistent volume for `auth/`.
- Official WhatsApp Business API adapter, before this serves paying groups.
