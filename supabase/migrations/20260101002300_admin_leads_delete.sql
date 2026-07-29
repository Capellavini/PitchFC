-- ─────────────────────────────────────────────────────────
-- Migration 24 — let admins delete leads (spam/cleanup) from the new
-- desktop admin dashboard. Migration 12 only granted admins SELECT;
-- there was no write policy at all yet (default deny), so DELETE was
-- silently blocked.
-- ─────────────────────────────────────────────────────────

drop policy if exists "leads admin delete" on public.leads;
create policy "leads admin delete" on public.leads for delete using (public.is_admin());
