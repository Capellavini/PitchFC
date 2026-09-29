# PITCH — Redesign v1 spec (design + structure)

Owner: Leo (CMO), 2026-09-28. Branch `redesign/v1` (worktree `.claude/worktrees/redesign`).
Vinicius reviews it **locally in demo mode** before it goes to Cris for review/merge.
Visual reference: the mockup in `docs/PRODUCT-ARCHITECTURE-BRIEF.md` (navy + lime, "APP REDESIGN — KEY SCREENS").
Product rules: `CLAUDE.md` → "Vision" + "Decisões de 2026-09-28" (read them first).

## 1. Navigation (decided)

5 tabs, Matchday emphasized in the centre:

| id | PT-PT label | EN label | Intent |
|---|---|---|---|
| `home` | Home | Home | "What's happening?" — next action + single activity feed |
| `jogar` | Jogar | Play | "Where/when do I play?" — segmented **Jogos \| Grupos** |
| `matchday` | Matchday | Matchday | contextual match engine (before / live / after) |
| `competir` | Competir | Compete | launch: season rankings + weekly podium + Golo da Semana |
| `perfil` | Perfil | Me | PITCH ID; settings behind a gear |

- **No Clube tab.** Admin-only Clube tools stay behind Perfil → ⚙ (as the IA branch already did).
- **Opening tab is contextual:** `jogar` if there's a game this week awaiting *my* response (pending attendance); `matchday` if a matchday is live right now; otherwise `home`.
- Matchday "hot" state (solid lime, pulse): game today / live, or open game awaiting my answer. Organizer always has access.

## 2. Screen structure

**Home** — header (logo left; bell + avatar right; NO group selector). Then:
1. Next action card (one, the most urgent): confirm attendance → pay → vote MVP → result pending. Shows the mini 10-slot grid when it's about the next game. One lime CTA.
2. Last result recap (score, my goals/assists, MVP) if played in last 7 days.
3. Activity feed — **single chronological feed** of my groups + friends. No "For you / Following / Near you" filters. Auto-generated items first-class (results, records, milestones, achievements, Golo da Semana); manual posts allowed. Reaction = ⚽ Golaço.

**Jogar** — segmented **Jogos | Grupos**.
- Jogos: next game card (slot grid is the hero), my upcoming games, "Encontrar jogo" (behind `openGames` flag), past games. Tapping a game opens **Game Detail** (roster by status, payment overview, WhatsApp reminders, material) — a pushed screen, not a tab.
- Grupos: list of my groups → **Group page** with segmented sub-views: Plantel · Stats · Fantasy (Pitch Manager lives HERE, not in Competir) · Definições (organizer).

**Matchday** — one screen, three states:
- A (before): roster/check-in, team draw (position-balanced, manual edit), goalkeeper, format, "Confirmar equipas" lime CTA.
- B (live): big score block (two team panels, lime/blue edges like mockup ALPHA/BRAVO), timer, event timeline, four big action buttons **Golo · Assistência · Defesa · MVP** (the mockup's "Card" button is replaced by Defesa — we don't track cards), red "Terminar jogo" CTA.
- C (after): final score, goals/assists, MVP voting/result, share card, "Submeter ao Golo da Semana".

**Competir** — header + segmented control only when Teams/Challenges flags are on (Rankings | Equipas | Desafios). At launch: group picker chip (if >1 group) → season leaderboards (Golos, Assistências, MVP, Fiabilidade %), weekly podium, Golo da Semana voting.

**Perfil (Me)** — hero: photo (or strong initials avatar), OVR badge, NAME uppercase, position · city; 4-stat row (Jogos · Golos · Assist. · MVP). Segmented **Resumo | Stats | Conquistas | Calendário**. Resumo = recent form dots (V/E/D), career records (most goals in a match, longest scoring streak, G+A per game), groups, teams. FUT card stays (it's our personality) — shown in Resumo. Gear top-right → Settings.

## 3. Visual system

Keep: dark navy base, acid-lime signature, football-card personality. Light mode keeps working through `C` (never hardcode hex).

- **Lime = action / active state only** (primary CTA, active tab/segment, "action required" edge). Not for decoration or body text.
- **Spacing:** 8px grid; 16px page side margin; 16–24px between sections; 12px inside dense rows.
- **Radius:** cards 16; buttons/inputs 12; pills/segments 999; avatars circle.
- **Type:** system font. Scale: 30 page title (display italic 900) · 20 section/hero numbers · 16 card title (700) · 14 body · 12 meta/caption (min, never below 11). Italic display (`displayFont`) ONLY for page titles, scores and big stat numbers — not for every label.
- **Contrast:** meta text uses `C.text2`, never `C.text3`, for anything a user needs to read.
- **Cards:** one level only — no card inside a card. Group rows inside a card with 1px `C.border` dividers instead.
- **Card states:** neutral = `C.card` + `C.border`; action required = lime left edge 3px or lime icon; destructive = red only; done = green check, muted.
- **Touch targets ≥ 44px** (buttons 48px tall). **One primary CTA per card.**
- **Chips** for context (Grupo / Equipa / Competição).
- **Avatars:** must look good WITHOUT photos (most players have none): colored initials circle from `AVATAR_PALETTE`, bold.
- Semantic colors unchanged: green confirmed/paid, orange pending, red declined, WhatsApp `C.whatsapp`.

## 4. Copy + localization

- PT-PT source strings in code, wrapped in `t()`. Add EN entries to the `en` dictionary in `src/lib/i18n.js` for every new/changed string (pt-br/it may fall back).
- No BR-isms: golos, equipas, guarda-redes, telemóvel.

## 5. Out of scope for v1

No Supabase schema/migration changes. No new backend. Teams/Challenges branch not merged here. Everything must run in **local demo mode** (no `.env.local`) with the existing mock data, and cloud mode must keep working (don't break `useCloud` props).
