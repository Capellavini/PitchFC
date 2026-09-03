-- ─────────────────────────────────────────────────────────
-- Migration 39 — mensalista (regular monthly member) vs avulso
-- (drop-in/casual player) as a permanent, per-membership attribute.
-- Mensalistas get confirmation priority (splitWaitlist.js, client-side);
-- avulsos start on the waiting list. An organizer can manually lock an
-- avulso's confirmed spot for a given game so a later-confirming
-- mensalista can't bump them once the organizer has told them "you're
-- in for real".
--
-- `players.player_type` mirrors the CURRENT active group, same pattern
-- as is_organizer/is_assistant → player_group_memberships.role: a player
-- can be a mensalista in one group and an avulso in another.
-- ─────────────────────────────────────────────────────────

alter table public.players add column if not exists player_type text not null default 'mensalista'
  check (player_type in ('mensalista', 'avulso'));

alter table public.player_group_memberships add column if not exists player_type text not null default 'mensalista'
  check (player_type in ('mensalista', 'avulso'));

-- Second invite link: joining through it sets player_type = 'avulso'
-- instead of the default 'mensalista', so the organizer can just hand
-- out the right link instead of toggling every new joiner by hand.
alter table public.groups add column if not exists invite_token_avulso text unique
  default encode(gen_random_bytes(8), 'hex');

-- Per-game manual override — see file header.
alter table public.attendances add column if not exists priority_locked boolean not null default false;

-- Extend the existing role-sync trigger to also carry player_type along.
create or replace function public.sync_player_group_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null then
    insert into public.player_group_memberships (player_id, group_id, role, player_type, joined_at)
    values (new.id, new.group_id,
            case when new.is_organizer then 'organizer' when new.is_assistant then 'assistant' else 'member' end,
            new.player_type,
            now())
    on conflict (player_id, group_id) do update
      set role = excluded.role, player_type = excluded.player_type, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_player_group_membership on public.players;
create trigger trg_sync_player_group_membership
  after insert or update of group_id, is_organizer, is_assistant, player_type on public.players
  for each row execute function public.sync_player_group_membership();
