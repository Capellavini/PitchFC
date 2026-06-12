# CLAUDE.md — PITCH

## What this project is

PITCH is a mobile-first web app that organizes a **weekly football game between a fixed group of friends** — replacing the WhatsApp group chaos.

**The core scenario:** a group of ~15 friends needs exactly 10 players every Saturday. Today this is managed via WhatsApp: chasing confirmations, finding substitutes when someone cancels, collecting €8 from each player, remembering who brings the ball. PITCH solves exactly this, nothing more (for now).

**This is NOT (yet):** a court booking marketplace, a league management system, a social network, or a SaaS for court operators. Those are future phases (see "Long-term vision" at the bottom). Do not add features from those phases unless explicitly asked.

## Current state

- `src/PitchApp.jsx` — a complete, working UI prototype in a single React file with in-memory state and mock data. All screens and interactions are designed and functional. **This is the design reference**: when building the real app, match this UI exactly.
- No backend yet. The next milestone is wiring this UI to Supabase — `supabase/schema.sql` (full schema, ready to paste) and `SUPABASE.md` (setup guide + migration order) are prepared.

## Product principles

1. **The slot grid is the hero.** 10 squares — filled or empty — answering "do we have a game?" at a glance. Every design decision serves this.
2. **Zero-friction confirmation.** Players should confirm/decline in one tap. Target: magic links via WhatsApp so players don't even need to log in or install anything.
3. **WhatsApp is a channel, not the enemy.** We integrate with it (reminders, payment nudges, invites via `wa.me` links) rather than trying to replace the group chat socially.
4. **The organizer does nothing manually.** Auto-reminders for non-responders, auto-notification of substitutes when someone cancels, automatic payment tracking.
5. **Stats create retention.** Goals, assists, MVP votes, and reliability % give the group memory and friendly competition — the reason to keep using the app after game #3.
6. **Brand tone:** modern, bold, urban, football-loving. Dark UI, acid-lime accent. Portuguese (PT-PT) copy.

## Feature scope (current phase)

### Implemented in the prototype
- **Entry**: public marketing landing page → role pick (player/organizer) → onboarding (player builds a FUT-style card with photo/attributes; organizer sets group, venue, weekday/time, monthly price split). Local "session" in localStorage until Supabase.
- **Jogo tab**: slot grid (10 spots) on the field artwork, confirm/decline flow, pending players with WhatsApp reminders, payment overview + MB Way pay button, position-balanced team draw, material checklist, and **live matchday**: score the night's games (Jogo 1, Jogo 2…) with per-goal scorer/assist; ending it feeds season stats, history, clean sheets (GR/Defesa) and opens MVP voting.
- **Clube tab**: court booking (Campo 1×2, 7-day × hour-slot grid), events calendar with RSVP + mock table/ticket payment, open matches across groups ("falta 1") with join + publish-own-spots.
- **Stats tab**: last-matchday card (per-game scores + per-player goals/assists/clean sheets), MVP voting with real matchday candidates, leaderboards, game history.
- **Social tab**: cross-group feed (posts, photos, video-highlight mock), golaço likes, comments, WhatsApp share, Golo da Semana voting.
- **Grupo tab**: roster grouped by status with overall (OVR) chips and reliability %, invite via WhatsApp.
- **Perfil tab**: FUT card hero (gold/silver/bronze + LENDA ≥86 tiers), full profile editing incl. attribute sliders, peer ratings (request via WhatsApp `?rate=` link → friend rates on a no-login page → code paste back; card shows 50/50 blend of self and friends), organizer group settings, logout.

### Designed but needs backend
- Magic-link confirmation (one unique URL per player per game, no auth needed)
- Auto-substitution: when a confirmed player cancels, notify pending players automatically
- Scheduled WhatsApp reminders (e.g., Thursday nudge to non-responders)
- Real MB Way / payment processing
- Post-game result + goals/assists entry by the organizer (feeds the stats)
- Recurring game auto-creation (every Saturday 20:00)

## Architecture plan

### Stack
- **Frontend:** React + Vite (current prototype), mobile-first PWA. React Native is a later milestone — the inline-style approach in the prototype translates ~1:1 to `StyleSheet.create()`.
- **Backend:** Supabase (Postgres + Auth + Realtime + Edge Functions). Realtime matters: the slot grid should update live for everyone as players confirm.
- **Payments:** MB Way via Easypay or SIBS API (Portugal); Stripe as fallback/future.
- **Messaging:** Phase 1 = `wa.me` deep links with pre-filled text (free, zero setup). Phase 2 = WhatsApp Business API for automated reminders.
- **Hosting:** Vercel (frontend) + Supabase cloud.

### Data model (target Supabase schema)

```sql
-- A group of friends (one group = one recurring game, for now)
groups (
  id uuid pk,
  name text,                     -- "FC Amigos"
  created_at timestamptz
)

players (
  id uuid pk,
  group_id uuid fk -> groups,
  name text,
  nick text,
  email text,
  phone text,                    -- also the MB Way number
  position text,                 -- 'Guarda-redes' | 'Defesa' | 'Médio' | 'Avançado'
  foot text,                     -- 'Direito' | 'Esquerdo' | 'Ambos'
  is_organizer boolean default false,
  magic_token text unique,       -- for one-tap confirmation links
  created_at timestamptz
)

games (
  id uuid pk,
  group_id uuid fk -> groups,
  scheduled_at timestamptz,
  venue text,
  spots int default 10,
  total_cost_cents int,          -- e.g. 8000 = €80
  status text default 'open',    -- 'open' | 'full' | 'played' | 'cancelled'
  result text,                   -- "5-3", filled after the game
  recurring_rule text,           -- e.g. 'weekly_sat_2000', null = one-off
  created_at timestamptz
)

attendances (
  id uuid pk,
  game_id uuid fk -> games,
  player_id uuid fk -> players,
  status text default 'pending', -- 'pending' | 'confirmed' | 'declined'
  paid boolean default false,
  paid_at timestamptz,
  responded_at timestamptz,
  unique (game_id, player_id)
)

-- Per-player stats for a played game (organizer enters after the match)
game_stats (
  id uuid pk,
  game_id uuid fk -> games,
  player_id uuid fk -> players,
  goals int default 0,
  assists int default 0,
  team text,                     -- 'a' | 'b' (from the draw)
  unique (game_id, player_id)
)

mvp_votes (
  id uuid pk,
  game_id uuid fk -> games,
  voter_id uuid fk -> players,
  voted_for_id uuid fk -> players,
  created_at timestamptz,
  unique (game_id, voter_id)     -- one vote per player per game
)

material_items (
  id uuid pk,
  game_id uuid fk -> games,
  item text,                     -- "Bola", "Coletes"
  assigned_to uuid fk -> players null,
  done boolean default false
)
```

Derived values — compute, don't store: season totals (sum `game_stats`), reliability % (`count(confirmed attendances) / count(games)`), MVP winner (`mode of mvp_votes per game`), price per player (`total_cost_cents / spots`).

### Key flows

1. **Weekly game creation** (cron / Supabase scheduled function): every Sunday, create next Saturday's game from `recurring_rule`, create `pending` attendances for all group players, send magic links via WhatsApp.
2. **Magic link confirmation:** `/g/:gameId/:magicToken` → identifies the player, shows the Jogo screen with their confirm/decline buttons. No password, no signup.
3. **Cancellation → substitution:** when a `confirmed` attendance flips to `declined` and the game was full, notify all `pending` players ("vaga aberta no sábado!").
4. **Payment:** player taps pay → MB Way push to their phone → webhook flips `paid = true` → green check appears on their slot in real time. Organizer can also manually mark cash payments.
5. **Post-game:** organizer enters result + goals/assists per player → MVP voting opens for 24h → vote closes, MVP recorded → stats update.

## Code conventions

- **Language:** UI copy in Portuguese (PT-PT, not BR — "golos" not "gols", "equipas" not "times", "guarda-redes" not "goleiro"). Note: the prototype has a few BR-isms left; fix them as you touch those strings. Code, comments, and identifiers in English.
- **Design tokens:** all colors live in the `C` object (see `src/theme.js`). Never hardcode a hex value in a component. The palette is brand navy, sampled from the official field artwork (`public/brand/field.jpg`): `bg #0A0F18`, `surface #121A27` (= field background), `card #1A2433`, `border #262E3D` (= field line color). Accents: `accent #C8FF00` (acid lime), `green #00D08A` (success/paid), `orange #FF9F0A` (warning/pending), `red #FF3B5C` (declined). Brand assets via `BRAND` and `fieldBackdrop()` in `src/theme.js`; keep `src/index.css`, the `theme-color` meta and `public/manifest.webmanifest` in sync if `bg` ever changes.
- **Visual language:** dark navy theme only. 16px border-radius cards, 1px borders (`C.border`), initials- or photo-based avatars with per-player palette colors, big 900-weight italic (FIFA-style) numbers for stats.
- **Status colors are semantic and consistent:** green = confirmed/paid, orange = pending/owes money, red = declined. WhatsApp actions always use `#25D366`.
- **Components:** small and single-purpose. Shared primitives (`Avatar`, `SectionLabel`, `BtnPrimary`, `BtnGhost`, `cardStyle`) already exist — reuse them. When splitting `PitchApp.jsx` into files, keep one component per file under `src/components/`.
- **State:** prototype uses `useState` lifted to the root. When adding Supabase, introduce a thin data layer (`src/lib/supabase.js` + hooks like `useGame`, `useGroup`) — don't scatter queries inside components.
- **No backend secrets in the client.** Payment webhooks and WhatsApp API calls go through Supabase Edge Functions.

## Build / run

Prototype only, no build setup committed yet. To bootstrap:

```bash
npm create vite@latest . -- --template react
npm install lucide-react
# drop src/PitchApp.jsx in, render it from main.jsx
npm run dev
```

When the project grows: `npm run dev` (local), `npm run build` (production), deploy via Vercel.

## Suggested next milestones (in order)

1. **Bootstrap the Vite project** around the prototype; split `PitchApp.jsx` into components.
2. **Supabase setup**: schema above, Row Level Security (players can only see their own group), seed script with the mock data.
3. **Realtime slot grid**: confirmations update live for all viewers.
4. **Magic links**: tokenized URLs + WhatsApp share for the organizer.
5. **Post-game flow**: result entry → goals/assists → MVP voting → stats.
6. **Recurring games**: scheduled function creating next week's game.
7. **MB Way integration** (Easypay sandbox first).
8. **PWA polish**: installable, push notifications.

## Long-term vision (context only — do not build yet)

PITCH is phase one of a larger concept ("PITCH Club / PITCH OS"): a premium football venue in Matosinhos/Porto plus a platform eventually covering court bookings, leagues and tournaments, video highlights, a player marketplace ("falta 1 jogador"), corporate events, CRM for venue operators, and SaaS licensing. The weekly-game organizer is the wedge: nail the 15-friends use case first, expand later. Keep the data model extensible (e.g., a group can have many games; a player could later belong to many groups) but do not add speculative tables or UI.
