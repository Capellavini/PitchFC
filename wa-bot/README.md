# PITCH group bot (experimental)

An organizer bot that lives in a WhatsApp group (first target: Goodweather). It
uses **Baileys** (unofficial WhatsApp Web protocol), so it runs as its own
long-lived process, not as a Supabase Edge Function.

## What it does

Proactive, **state-change events only** (deterministic templates, no AI):

| Event | When |
| --- | --- |
| Jogo aberto | a fresh game appears (<12h old) |
| Marcos (proporcionais) | confirmed crosses 80% ("faltam 2"), 100% (jogo fechado), then waiting list at 120% / 150%. For 10 spots: 8 / 10 / 12 / 15. Jumps coalesce to the highest one |
| Abriu vaga | a **full** game drops below `spots` |
| Lembrete 24h | <24h to kickoff and spots still open (once) |
| Dia do jogo | morning of the game (from 10:00 Lisbon) until kickoff, with the count |
| Pós-jogo | when the organizer finishes the matchday: game scores, top scorer, MVP vote link |
| Cancelado | game cancelled (urgent: ignores quiet hours and daily cap) |

**Language** is per group (`groups.wa_bot_lang`): `pt`, `en`, or `pt+en`
(Portuguese then English in the same message; used for Goodweather).

Reactive: `@Pitch <pergunta>` gets a short answer from Haiku, in the language of
the question. It only sees a DATA block read from Supabase: next game (spots,
confirmed names, link) and season stats (goals, assists, MVPs, games, wins,
clean sheets, last matchday scores). Without `ANTHROPIC_API_KEY` the bot posts
events only.

**Confirm / drop out from the chat.** `@Pitch eu vou` / `@Pitch não vou` (or
`@Pitch I'm in` / `I'm out`) changes the sender's own attendance for the next
open game. Rules:
- Strict phrases only: the whole short message must be the intent. Questions
  ("eu vou?") and longer sentences go to the Q&A path, never to an action.
- The player is identified by the sender's **phone number** matched against
  `players.phone` (last 9 digits), never by anything typed in the message. No
  match or an ambiguous match -> the bot replies with the signup link and does nothing.
- It calls the same `magic_set_status` SQL function as the WhatsApp magic link, so
  the confirmation window, bans and payment reset behave exactly like the app.
- The reply says whether they are in (`c/s`) or on the waiting list (with the
  same mensalista/avulso ordering as the app). Poll-loop events (marcos, abriu
  vaga) then follow as usual.
- Dry-run: logs "would confirm X" and writes nothing.
- Caveat: WhatsApp groups may expose a privacy id (`@lid`) instead of the number.
  The bot tries `participantAlt` and Baileys' LID mapping; if neither resolves
  it logs `could not resolve sender phone` and asks the person to use the link.
  Verify this in the test group before relying on it.

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

1. Run `20260101005000_wa_bot.sql` and `20260101005100_wa_bot_lang.sql` (in `supabase/migrations/`) in the Supabase SQL editor.
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
