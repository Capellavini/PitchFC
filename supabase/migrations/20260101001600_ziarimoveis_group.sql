-- ─────────────────────────────────────────────────────────
-- Migration 16 — test group for vinicius.capella@ziarimoveis.com.br
--
-- Migration 15 (fantasy_test_players) was a no-op: that account had no
-- group yet, so there was nothing to seed into. This creates the group
-- (and the player card, if one doesn't already exist for that auth
-- user), a recurring weekly game so kickoffAt/Fantasy squad-lock logic
-- has something to read, and re-seeds the same 15 fake players into it
-- — migration 15 itself won't re-run now that it's recorded as applied.
--
-- Idempotent: only acts if the auth user exists and doesn't already
-- have a group.
-- ─────────────────────────────────────────────────────────

do $$
declare
  uid   uuid;
  pid   uuid;
  gid   uuid;
  gm_id uuid;
begin
  select id into uid from auth.users where lower(email) = 'vinicius.capella@ziarimoveis.com.br' limit 1;
  if uid is null then
    return; -- account doesn't exist yet — nothing to do
  end if;

  select id, group_id into pid, gid from public.players where user_id = uid limit 1;
  if gid is not null then
    return; -- already has a group — don't touch it
  end if;

  insert into public.groups (name, venue, weekday, game_time, monthly_price_cents, max_players)
  values ('Grupo Teste Fantasy', 'Campo de Teste', 6, '20:00', 8000, 10)
  returning id into gid;

  if pid is not null then
    update public.players set group_id = gid, is_organizer = true where id = pid;
  else
    insert into public.players (user_id, group_id, name, nick, email, position, foot, is_organizer)
    values (uid, gid, 'Vinicius Capella', 'Vinicius', 'vinicius.capella@ziarimoveis.com.br', 'Médio', 'Direito', true)
    returning id into pid;
  end if;

  insert into public.games (group_id, scheduled_at, venue, spots, total_cost_cents, status, recurring_rule)
  values (gid, now() + interval '7 days', 'Campo de Teste', 10, 8000, 'open', 'weekly_6_20:00')
  returning id into gm_id;

  insert into public.attendances (game_id, player_id, status)
  values (gm_id, pid, 'confirmed');

  insert into public.players (
    group_id, name, nick, position, foot, attrs,
    goals, assists, clean_sheets, mvps, games_played, wins, is_organizer
  )
  select gid, v.name, v.nick, v.position, v.foot, v.attrs::jsonb,
         v.goals, v.assists, v.clean_sheets, v.mvps, v.games_played, v.wins, false
  from (values
    ('Tozé Guedes',   'Tozé',     'Guarda-redes', 'Direito',  '{"rit":55,"rem":30,"pas":50,"dri":40,"def":85,"fis":78}', 0, 0, 6, 1, 10, 5),
    ('Bino Alves',    'Bino',     'Guarda-redes', 'Esquerdo', '{"rit":52,"rem":28,"pas":48,"dri":38,"def":80,"fis":74}', 0, 0, 4, 0, 8,  3),
    ('Nuno Rocha',    'Nuno',     'Defesa',       'Direito',  '{"rit":65,"rem":45,"pas":60,"dri":55,"def":80,"fis":75}', 1, 0, 5, 0, 12, 6),
    ('Ricardo Sousa', 'Ricardo',  'Defesa',       'Direito',  '{"rit":63,"rem":42,"pas":58,"dri":52,"def":78,"fis":73}', 0, 1, 3, 0, 9,  4),
    ('André Neves',   'André',    'Defesa',       'Esquerdo', '{"rit":68,"rem":40,"pas":62,"dri":58,"def":82,"fis":77}', 0, 2, 7, 1, 14, 8),
    ('Fábio Duarte',  'Fábio',    'Defesa',       'Direito',  '{"rit":60,"rem":38,"pas":55,"dri":50,"def":76,"fis":70}', 0, 0, 2, 0, 6,  2),
    ('Hugo Marques',  'Hugo',     'Defesa',       'Ambos',    '{"rit":66,"rem":48,"pas":60,"dri":54,"def":79,"fis":74}', 2, 0, 4, 0, 10, 5),
    ('Tiago Ramos',   'Tiago',    'Médio',        'Direito',  '{"rit":72,"rem":60,"pas":82,"dri":76,"def":55,"fis":68}', 3, 9, 0, 1, 13, 7),
    ('Gonçalo Pires', 'Gonçalo',  'Médio',        'Esquerdo', '{"rit":74,"rem":58,"pas":78,"dri":74,"def":50,"fis":66}', 5, 6, 0, 0, 11, 5),
    ('Edu Faria',     'Edu',      'Médio',        'Direito',  '{"rit":70,"rem":55,"pas":75,"dri":70,"def":52,"fis":65}', 2, 4, 0, 0, 7,  3),
    ('Sérgio Baptista','Sérgio',  'Médio',        'Direito',  '{"rit":71,"rem":57,"pas":80,"dri":72,"def":54,"fis":67}', 1, 8, 0, 1, 12, 6),
    ('Rafa Coelho',   'Rafa',     'Médio',        'Ambos',    '{"rit":73,"rem":62,"pas":76,"dri":73,"def":48,"fis":64}', 4, 3, 0, 0, 8,  4),
    ('Bruno Cardoso', 'Bruno',    'Avançado',     'Direito',  '{"rit":85,"rem":82,"pas":60,"dri":78,"def":30,"fis":70}', 15, 4, 0, 2, 14, 8),
    ('Zé Maria Costa','Zé Maria', 'Avançado',     'Esquerdo', '{"rit":83,"rem":80,"pas":58,"dri":76,"def":28,"fis":68}', 9,  2, 0, 1, 10, 5),
    ('Pauleta Lopes', 'Pauleta',  'Avançado',     'Direito',  '{"rit":80,"rem":78,"pas":56,"dri":74,"def":26,"fis":66}', 6,  3, 0, 0, 9,  4)
  ) as v(name, nick, position, foot, attrs, goals, assists, clean_sheets, mvps, games_played, wins);
end $$;
