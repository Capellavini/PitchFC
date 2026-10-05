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
- Never DMs anyone, except the opt-in Treinador Adjunto (off by default, see below).
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

## Attendance polls (only on request)

The bot **never posts a poll on its own.** A group member asks for it in the group:
`@Pitch enquete` / `@Pitch post a poll` (one per hour at most). The poll is
"Vais jogar <dia, hora>?" with "Eu vou / Não vou" options (bilingual for `pt+en`).

Votes count on **any** attendance poll the bot saw being created, its own or a
member's ("Eu vou" confirms, "Não vou" drops out; "Talvez", removing the vote or
two conflicting picks do nothing). For polls made by members, Haiku first decides
whether the poll is about the game, so a barbecue poll never confirms a spot.
Votes are decrypted locally (Baileys rc14 has this disabled); poll secrets live in
`data/polls.json` (gitignored). A poll created while the bot was offline cannot be read.

## Treinador Adjunto (private organizer DMs)

PT-PT "Treinador Adjunto" · PT-BR "Auxiliar Técnico" · EN "Assistant Coach".
Plan: `docs/ADJUNTO-PLAN.md` (the DECISIONS block at the top wins). Code:
`src/adjunto/` (pure modules are unit-tested; I/O only in `store.js`,
`data.js`, `index.js`). Shared stats/draw/format logic is `src/core/`
(generated from `src/lib/core`; run `npm run sync:core` at the repo root).

What it does, in a 1:1 WhatsApp chat with an organizer/assistant:
- **Activation**: the organizer writes *"Quero o Treinador Adjunto"* (also
  "ativar adjunto", "olá adjunto", "quero o auxiliar técnico", "assistant
  coach"…). Regex only, matched against the sender's WhatsApp number via
  `adjunto_find_organizer_by_phone`: 1 group → welcome; several → "Qual?";
  none / @lid without a number / same number on 2 players → one "não
  encontrei…" reply per day. The app's `ADJ-XXXXXX` code also works.
- **Format onboarding** (avulso / campeonato = night table only / personalizado),
  saved to `groups.game_format` on "sim".
- **Teams** 24h before kickoff (or "proponho com os N ou espero?" if short):
  OVR per player ("70?" under 3 ratings), team OVR, insights; *ok / troca X
  com Y / separa X e Y / sorteia de novo*; organizer OR assistant approves
  (first wins); then "publico no grupo?" (lineup only).
- **Proactive DMs** (templated, no AI): status T-48h, reminder hint T-26h,
  game day, spot opened, teams, group stage, night summary, unfinished
  matchday, format nudge. Quiet 23:00–09:00, max 3/day per organizer, never
  "confirmations opened" (the group already gets it).
- **Free text** → Claude (`ADJUNTO_MODEL`, default `claude-sonnet-5-5`) with
  tools. Numbers only from tools (guard); every write is a proposal that
  executes only after the organizer's explicit "sim", writing the same
  columns/RPCs as the app (`adjunto_apply_teams` CAS, `adjunto_reschedule_game`,
  `attendances.paid`, `games.spots` + `groups.max_players`, `games.status`).
- **Silence**: any other DM from an unlinked number gets no reply, no typing,
  no read receipt. A reply typed by hand on the bot's phone pauses the
  Adjunto in that chat for 30 minutes.

### Env

| Var | Default | |
|---|---|---|
| `ADJUNTO_ENABLED` | `false` | master switch. `false` = DMs ignored exactly as before (module not even loaded) |
| `ADJUNTO_AUTOSEND` | `false` | dry-run: logs `[adjunto dry-run]` DMs / group posts / "would …" writes; sends nothing and writes nothing to app tables (bot-private `adjunto_*` rows are still written so the flow can be followed). Group posts also need `BOT_AUTOSEND=true` |
| `ADJUNTO_MODEL` | `claude-sonnet-5-5` | uses `ANTHROPIC_API_KEY`; without a key → commands only |
| `ADJUNTO_EFFORT` | `low` | raised to `medium` automatically for analysis |
| `ADJUNTO_FALLBACK` | `true` | server-side refusal fallback (Claude API beta `server-side-fallback-2026-07-01`) |
| `ADJUNTO_MAX_ROUNDS` / `ADJUNTO_WINDOW_TURNS` | 6 / 12 | tool rounds per turn / remembered turns |
| `ADJUNTO_BURST_MS` | 4000 | messages within this window become one turn |
| `ADJUNTO_DM_DAILY_CAP` | 3 | non-urgent proactive DMs per organizer per day |
| `ADJUNTO_DAILY_MSGS` / `ADJUNTO_DAILY_TURNS` | 40 / 25 | per organizer per day |
| `ADJUNTO_DAILY_USD_PER_LINK` / `ADJUNTO_GLOBAL_DAILY_USD` | 0.5 / 10 | over → degraded mode (commands only, one notice/day) |

### Enable a group (pilot: Goodweather F.C.)

Migrations 006300–006700 must be applied. Then in the SQL editor:

```sql
-- 1) read-only check: organizer/assistant phones + roles
select p.nick, p.phone, m.role, m.banned, g.name, g.adjunto_enabled
from groups g
join player_group_memberships m on m.group_id = g.id
join players p on p.id = m.player_id
where g.name ilike '%goodweather%' and m.role in ('organizer','assistant');
-- players.phone must be E.164 (+351…) = the number they WhatsApp from.

-- 2) enable
update groups set adjunto_enabled = true where name ilike '%goodweather%';
```

Run with `ADJUNTO_ENABLED=true ADJUNTO_AUTOSEND=false`, have the organizer
send "Quero o Treinador Adjunto", read the `[adjunto dry-run]` log lines;
when happy, set `ADJUNTO_AUTOSEND=true`.

### Rollback

- Instant: `ADJUNTO_ENABLED=false` (Fly: `fly secrets set ADJUNTO_ENABLED=false`). The group bot is unaffected.
- One group: `update groups set adjunto_enabled = false where id = '…';`
- Stop sending, keep logging: `ADJUNTO_AUTOSEND=false`.
- Forget an organizer's conversation: `delete from adjunto_links where player_id = '…';` (threads, messages, proposals cascade).
