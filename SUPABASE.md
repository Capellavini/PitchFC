# Ligar o PITCH ao Supabase — guia para a primeira vez

O Supabase dá-nos a base de dados (Postgres), autenticação, realtime e storage —
tudo o que falta para os dados deixarem de viver só no telemóvel de cada um.
Plano gratuito chega de sobra para testar com o grupo.

## Passo 1 — Criar a conta e o projeto (5 min, no browser)

1. Vai a [supabase.com](https://supabase.com) → **Start your project** → entra com o GitHub.
2. **New project**:
   - Organization: a tua (criada automaticamente)
   - Name: `pitch`
   - Database password: gera uma e **guarda-a** (não vais precisar dela no dia-a-dia, mas não se recupera)
   - Region: **West EU (Ireland)** — a mais perto de Portugal
3. Espera ~2 minutos até o projeto ficar pronto.

## Passo 2 — Criar as tabelas (2 min)

1. No dashboard do projeto: **SQL Editor** → **New query**.
2. Abre o ficheiro [`supabase/schema.sql`](supabase/schema.sql) deste repo, copia TUDO, cola e carrega **Run**.
3. Vai a **Table Editor** — deves ver as tabelas: `groups`, `players`, `games`, `attendances`, `matches`, `match_events`, `bookings`, `events`, `posts`, etc.

## Passo 3 — Buscar as chaves (1 min)

Em **Project Settings → API**:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **anon public key** — um token longo `eyJ…`

Estas duas vão para um ficheiro `.env.local` na raiz do projeto (NÃO se faz commit):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ…
```

> A anon key é desenhada para viver no browser — o que protege os dados são as
> RLS policies, não o segredo da chave. A `service_role` key é que NUNCA pode
> aparecer no cliente.

## Passo 4 — Diz-me que está feito 😄

Com o projeto criado e as chaves no `.env.local`, o trabalho passa para o código
(faço eu): instalar `@supabase/supabase-js`, criar `src/lib/supabase.js` + hooks
(`useGroup`, `useGame`…), substituir o localStorage tabela a tabela, seed com os
dados mock, e ligar o realtime à grelha de vagas.

Ordem prevista (1 PR de cada vez, a app continua a funcionar entre passos):

1. `groups` + `players` (o teu grupo e cartões reais, partilhados entre telemóveis)
2. `games` + `attendances` + realtime (a grelha de vagas ao vivo — o coração da app)
3. Magic links (`/g/:gameId/:token`) para confirmar sem login
4. Matchdays: `matches` + `match_events` + `mvp_votes`
5. Clube: `bookings`, `events`, `event_rsvps`, `open_match_signups`
6. Social: `posts`, likes, comments, Golo da Semana
7. `peer_ratings` (substitui os códigos por WhatsApp)

## Passo 5 — Antes de utilizadores a sério (mais tarde)

O `schema.sql` ativa RLS com policies **abertas** (qualquer pessoa com a anon key
lê/escreve tudo) — certo para testar com amigos, errado para produção. Quando a
app estabilizar: policies por `group_id`, escrita de attendances só com o
`magic_token` do próprio jogador, e votos/ratings com unique constraints já
garantidos pelo schema.
