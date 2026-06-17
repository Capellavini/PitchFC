# Deploy & migrations runbook

How PITCH ships, and how database changes flow through the Supabase CLI.

## Overview

| Layer | Tool | Trigger |
|-------|------|---------|
| Frontend | Vercel (GitHub integration) | auto-deploys on push to `main` |
| Database | Supabase CLI (`supabase db push`) | `.github/workflows/supabase-migrations.yml` on push to `main` touching `supabase/migrations/**`, or manual |

The Supabase project ref is **`zfjhdgvdvbqkycjaencz`** (West EU). Frontend env vars
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAILS`) live in the
**Vercel dashboard**, not in the repo.

## Local setup

The CLI is a dev dependency, so no global install is needed:

```bash
npm install                       # installs the supabase CLI too
npx supabase --version            # 2.106.x
npx supabase login                # opens a browser, stores your access token
npx supabase link --project-ref zfjhdgvdvbqkycjaencz   # prompts for the DB password
```

## Migrations live in `supabase/migrations/`

Each change is a timestamped `.sql` file applied in filename order. The current
history (already live, applied by hand before the CLI existed):

```
20260101000000_schema.sql        base schema + permissive v1 RLS
20260101000100_auth.sql          accounts, invites, admin events
20260101000200_stats.sql         season stats + MVP
20260101000300_social.sql        posts/likes/comments/friends
20260101000400_rls_lockdown.sql  RLS hardening (anon blocked)   ← applied
20260101000500_recurring.sql     recurring-game columns          ← applied
20260101000600_auto_reset.sql    pg_cron weekly reset            ← NOT applied yet
```

Create a new migration:

```bash
npx supabase migration new my_change
# edit the generated file under supabase/migrations/
```

## ⚠️ First-time baseline (do this ONCE)

The migrations above were run manually in the SQL Editor, so the remote project
has **no record** of them in `supabase_migrations.schema_migrations`. If you run
`supabase db push` without baselining, it will try to re-run `schema.sql` and
fail ("relation already exists").

Mark everything that's already live as applied, then push only what's new:

```bash
npx supabase link --project-ref zfjhdgvdvbqkycjaencz
# mark the already-applied migrations (schema through recurring):
npx supabase migration repair --status applied \
  20260101000000 20260101000100 20260101000200 \
  20260101000300 20260101000400 20260101000500
# now only the auto-reset migration is pending:
npx supabase db push        # applies 20260101000600_auto_reset.sql
```

After this one-time step, CI can safely run `db push` on every merge.

> Note: `20260101000600_auto_reset.sql` needs the **pg_cron** extension. If
> `db push` errors on `create extension pg_cron`, enable it once in
> Dashboard → Database → Extensions, then re-run.

## CI (GitHub Actions)

- **`ci.yml`** — runs `npm run build` on PRs and pushes (catches broken builds before Vercel).
- **`supabase-migrations.yml`** — on merges to `main` that touch `supabase/migrations/` (or manual run): links the project, **baselines** the already-applied migrations (`migration repair`, safe to re-run), then `supabase db push` for anything new. So you don't need to run the manual baseline above if you deploy through CI — the workflow does it for you.

Add these repo secrets (Settings → Secrets and variables → Actions) before the
migrations workflow can run:

| Secret | Where to get it |
|--------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → Account → Access Tokens |
| `SUPABASE_DB_PASSWORD` | the project's database password |
| `SUPABASE_PROJECT_ID` | `zfjhdgvdvbqkycjaencz` |

Never commit these or the `service_role` key — they belong only in GitHub/Vercel secrets.
