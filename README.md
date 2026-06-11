# PITCH ⚽

O teu jogo semanal, organizado. Confirmações, pagamentos, sorteio de equipas, material e stats — sem o caos do WhatsApp.

Mobile-first PWA · React + Vite · dark UI, acid-lime accent · PT-PT.

## Run

```bash
npm install
npm run dev      # local dev at http://localhost:5173
npm run build    # production build to dist/
```

> **Note (this machine):** Node.js is installed as a portable copy at
> `%LOCALAPPDATA%\node-portable\node-v22.12.0-win-x64` (not on PATH).
> Either add that folder to PATH, or install Node system-wide from
> [nodejs.org](https://nodejs.org) and the commands above work as-is.
> The Claude Code preview config (`.claude/launch.json`) already points
> at the portable copy.

## Structure

```
src/
  PitchApp.jsx        root — state + tab routing (persists to localStorage)
  theme.js            design tokens (C, cardStyle, AVATAR_PALETTE)
  data.js             mock data → future Supabase seed
  lib/
    helpers.js        initials, avatar colors
    storage.js        usePersistentState (localStorage)
    whatsapp.js       wa.me deep links + message builders
  components/         one component per file
    JogoTab.jsx       slot grid, confirm/decline, payments, draw, material
    StatsTab.jsx      MVP voting, leaderboards, history
    GrupoTab.jsx      roster, reliability %, invite
    PerfilTab.jsx     identity card, edit profile, season stats
    Avatar.jsx · SectionLabel.jsx · BtnPrimary.jsx · BtnGhost.jsx · BottomNav.jsx
```

`PitchApp.jsx` at the repo root is the original single-file prototype, kept as the design reference.

## Current state

Fully functional frontend with in-browser persistence (localStorage). All interactions work: confirm/decline, payments, position-balanced team draw, material checklist with assignment, MVP voting, profile editing, and WhatsApp actions (reminders, charging, invites) via `wa.me` deep links.

Next milestone: wire to Supabase — schema and plan in [CLAUDE.md](CLAUDE.md).
