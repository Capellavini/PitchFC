-- ─────────────────────────────────────────────────────────
-- Migration 2 — real accounts, group invites, admin events
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query.
-- If the "alter publication" lines error ("already member"),
-- that's harmless — ignore and continue.
-- ─────────────────────────────────────────────────────────

-- Group invite links (?join=<token>)
alter table groups add column if not exists invite_token text unique
  default encode(gen_random_bytes(8), 'hex');
update groups set invite_token = encode(gen_random_bytes(8), 'hex')
  where invite_token is null;

-- Link a player card to a real account (null = demo/fake player)
alter table players add column if not exists user_id uuid
  references auth.users(id) on delete set null;

-- A registered player can exist before joining any group
alter table players alter column group_id drop not null;

-- Club events get an owner + visibility (admin-created, everyone sees)
alter table events add column if not exists created_by uuid references auth.users(id);

-- Realtime for roster / settings / events / bookings changes
do $$ begin
  alter publication supabase_realtime add table players;  exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table groups;   exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table events;   exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table bookings; exception when others then null; end $$;

-- A couple of example events so the calendar isn't empty (idempotent)
insert into events (title, emoji, day, event_time, description, kind, price_cents)
select * from (values
  ('Final da Champions — ecrã gigante', '📺', (current_date + 5)::date, '20:00',
   'Transmissão no lounge com som de estádio. Reserva mesa para o teu grupo.', 'mesa', 2000),
  ('Pop-up: Smash burgers do Mané', '🍔', (current_date + 7)::date, '19:00',
   'Food pop-up na esplanada, das 19h até esgotar. Entrada livre.', null, 0)
) as v(title, emoji, day, event_time, description, kind, price_cents)
where not exists (select 1 from events);
