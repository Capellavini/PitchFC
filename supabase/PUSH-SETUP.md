# Push notifications — setup (one-time)

The app code (service worker, opt-in, subscription storage, Edge Function)
is all in the repo. To switch it on you need to do these steps once —
they involve secrets/keys that can't live in the repo.

## 1. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
You get a **public** and a **private** key.

## 2. Publish the public key to the frontend
Add to **Vercel → Settings → Environment Variables** (and `.env.local` for dev):
```
VITE_VAPID_PUBLIC_KEY=<public key>
```
Redeploy the frontend. The "Ativar notificações" card in Perfil only shows once this is set.

## 3. Apply the DB migration
`supabase/migrations/20260101001000_push.sql` (push_subscriptions table) — flows
through the normal CI on merge to `main`.

## 4. Deploy the Edge Function + its secrets
```bash
supabase functions deploy notify-next
supabase secrets set \
  VAPID_PUBLIC_KEY=<public key> \
  VAPID_PRIVATE_KEY=<private key> \
  VAPID_SUBJECT=mailto:capella.vinicius@gmail.com
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

> Optional: add `supabase functions deploy notify-next` to the GitHub Actions
> workflow so it redeploys on merge (uses the existing SUPABASE_ACCESS_TOKEN).

## 5. Wire the trigger (Database Webhook — easiest)
Dashboard → **Database → Webhooks → Create**:
- Table: `attendances`
- Events: **Update**
- Type: **Supabase Edge Function** → `notify-next`
- (HTTP POST; Supabase sends `{ record, old_record }`, which the function expects.)

The function itself ignores everything except a `confirmed → declined` change,
so a plain "on update" webhook is fine.

## How it behaves
When a confirmed titular cancels and the game was full, the next person on the
waiting line (now promoted into the XI) gets a push: "Entraste no jogo! ⚽".
Dead subscriptions are auto-pruned. No WhatsApp Business API needed.

## Test
1. Two accounts in a group with `spots` filled + 1 extra on the waiting line.
2. The waitlisted one: Perfil → **Ativar notificações** (grant permission).
3. A titular cancels → the waitlisted one receives the push.
