-- ─────────────────────────────────────────────────────────
-- Migration 29 — "sorteado por" / "confirmado por" attribution on the
-- team draw. Any organizer or assistant can draw/confirm teams (shared
-- draft on the game row, see migration 26/28) — with more than one
-- manager in a group, it wasn't obvious to the others who last touched
-- it, causing confusion ("did I already draw these, or is this stale?").
-- ─────────────────────────────────────────────────────────

alter table public.games add column if not exists teams_set_by uuid references public.players(id) on delete set null;
alter table public.games add column if not exists teams_confirmed_by uuid references public.players(id) on delete set null;
