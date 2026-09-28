# PITCH — Social: estado atual do código e dados

Documento técnico pra discutir "por que o Social ainda não está no ponto certo". Escrito a partir do código real em 2026-09-24 (não é a visão de produto do CLAUDE.md, é o que está de facto implementado e funcionando).

## 1. Onde vive no código

| Peça | Ficheiro |
|---|---|
| UI da tab | `src/components/SocialTab.jsx` (272 linhas) |
| Card de treino (feature bolt-on) | `src/components/WorkoutCardModal.jsx` |
| Dados cloud (fetch + mutations) | `src/hooks/useCloud.js` (~linhas 177-209 fetch, ~1337-1400 mutations) |
| Normalização cloud ↔ local | `src/PitchApp.jsx` (~linhas 1328-1377) |
| Schema base | `supabase/migrations/20260101000000_schema.sql` (linhas 153-183) |
| Migração de amigos + realtime | `supabase/migrations/20260101000300_social.sql` |
| RLS (segurança por linha) | `supabase/migrations/20260101000400_rls_lockdown.sql`, `20260101000700_rls_phase2.sql` |
| Bucket de upload | `supabase/migrations/20260101000800_storage.sql` |

## 2. Modelo de dados (Postgres/Supabase)

```sql
posts (id, author_id, type['text'|'photo'|'video'], body, media_url, gotw boolean, created_at)
post_likes (post_id, player_id)          -- PK composta, 1 like por pessoa
post_comments (id, post_id, author_id, body, created_at)
friendships (id, requester_id, addressee_id, status['pending'|'accepted'], created_at)
gotw_votes (post_id, player_id, week)    -- existe na BD, ZERO uso no código (ver secção 6)
```

**Reparo importante:** `posts` não tem `group_id`. O "grupo" de um post é inferido em tempo real a partir de `author.group_id` (o grupo *atual* do autor), não do grupo em que ele estava quando publicou. Se alguém troca de grupo, os posts antigos dele "migram" de scope silenciosamente.

## 3. Como o feed é buscado (1 query, sem paginação)

`useCloud.js:180-183`:
```js
supabase.from("posts")
  .select("*, author:players!author_id(id,nick,name,photo_url,group_id), post_likes(player_id), post_comments(...)")
  .order("created_at", { ascending: false }).limit(100)
```
- Não filtra por grupo/scope no servidor — traz sempre os **100 posts mais recentes de toda a plataforma**.
- A separação em abas (Grupo / Clube / Amigos) é **100% client-side**, em `SocialTab.jsx:37-41`:
  ```js
  const visible = posts.filter((p) => {
    if (scope === "clube") return true;                          // literalmente tudo
    if (scope === "grupo") return p.author.groupId === myGroupId;
    return p.author.id === meId || friendIds.includes(p.author.id); // amigos
  });
  ```
- **Segurança:** a policy de leitura (`rls_lockdown.sql:59`) é `using (auth.uid() is not null)` — qualquer utilizador autenticado pode ler `posts`/`friendships` de qualquer grupo via API direta, scope nenhum é aplicado no servidor. O próprio `rls_phase2.sql` comenta isso como pendência ("Fase 3 — restringir LEITURAS por grupo+amigos, hoje abertas a autenticados").

## 4. Não existe "Clube" como entidade

Não há tabela `clubs`. O scope "Clube" no Social (e a tab "Clube" do app em geral) não representa um clube/organização real — é um rótulo para "toda a plataforma PITCH, todos os grupos". Vale confirmar se isso é intencional (rede social entre grupos, tipo Strava) ou se devia mapear pra algo mais concreto (ex: um clube físico/venue).

## 5. Amigos — grafo simples, sem escopo de clube

`friendships` é 1 linha por par, pedido→aceite. Fluxo:
- `SocialTab.jsx` → aba "Amigos" → "Adicionar amigo" abre lista de `candidates`
- `candidates` (`PitchApp.jsx:1352`) = **todos os jogadores da plataforma** menos eu e quem já tenho relação — apesar da label na UI dizer "MEMBROS DO CLUBE" (`SocialTab.jsx:151`), não há filtro de clube/grupo nenhum aplicado.
- Pedido → aceitar/recusar → lista de amigos. Sem bloquear, sem "amigos em comum", sem sugestões.

## 6. "Golo da Semana" — só existe na copy, não no código

O onboarding vende: *"Partilha highlights, vota no Golo da Semana e convive com jogadores de outros grupos."* (`src/lib/i18n.js`, 3 ocorrências).

Realidade:
- `posts.gotw` (coluna boolean) e a tabela `gotw_votes` existem no schema desde o início.
- **Não há nenhum código** em `SocialTab.jsx`, `useCloud.js` ou em qualquer outro componente que leia, escreva ou vote nessas colunas/tabela.
- `rls_phase2.sql:109` confirma isto explicitamente no próprio comentário: `gotw_votes` está listada entre as "legacy tables not used by the cloud app... empty in practice".

Ou seja: uma das três promessas centrais do pitch do Social (a que dá competição/gamificação semanal) não existe — é a tabela e a coluna mortas desde a primeira migração.

## 7. O que de facto funciona hoje

- **Publicar**: texto, foto ou vídeo (upload pro bucket público `social` no Storage — ver `useCloud.js:1338-1348`). Sem legendas obrigatórias, sem limite de tamanho visível ao utilizador, sem preview de compressão.
- **Curtir** ("⚽ Golaço") — like binário, sem outras reações.
- **Comentar** — texto simples, sem edição/apagar comentário individual (só o post inteiro pode ser apagado, e só pelo autor).
- **Apagar o próprio post** (com `window.confirm` nativo do browser).
- **Partilhar no WhatsApp** — `openWhatsApp(sharePostMessage(...))`, gera um link `wa.me` com o texto do post.
- **"Treino"** — feature à parte (`WorkoutCardModal.jsx`): gera um cartão de imagem de treino (canvas) e publica-o como um post tipo "photo". É a única coisa no composer que não é genérica (Foto/Vídeo/Texto).
- **Realtime** — `posts`, `post_likes`, `post_comments`, `friendships` estão na publicação `supabase_realtime`, então o feed atualiza ao vivo entre dispositivos (via `refetch()` chamado por subscription, `useCloud.js:250-253`).

## 8. Lacunas técnicas conhecidas (além do Golo da Semana morto)

1. **Sem paginação** — feed é sempre "os 100 mais recentes globais"; sem infinite scroll, sem `created_at` cursor.
2. **Sem notificações** — ninguém é avisado quando alguém curte/comenta/aceita amizade (compare com o push que já existe para "entraste no jogo").
3. **Sem moderação/denúncia** — qualquer post fica visível a toda a plataforma (scope "Clube") sem qualquer filtro de conteúdo.
4. **RLS de leitura aberta** — ver secção 3; é o maior risco técnico/produto: hoje não há isolamento real entre grupos ao nível de dados, só de UI.
5. **`group_id` do post é derivado, não gravado** — post muda de "grupo" se o autor mudar de grupo (secção 2).
6. **"Clube" não é uma entidade real** — é "tudo", sem hierarquia (secção 4).
7. **Golo da Semana** — coluna e tabela mortas, feature prometida na copy nunca implementada (secção 6).
8. **"Amigos" ignora fronteira de grupo/clube** — lista de candidatos é a app inteira, texto da UI diz o contrário.

## 9. Perguntas em aberto pra discussão

- O Social devia ser cross-group desde já (rede tipo Strava entre todos os grupos do PITCH) ou devia começar scoped ao próprio grupo/clube, com "Clube" a significar algo real mais tarde?
- Vale a pena implementar Golo da Semana agora (tabela já existe) ou cortar de vez a promessa da copy até haver um plano?
- RLS de leitura por grupo/amigos (Fase 3, já mapeada em `CLAUDE.md`) — prioridade antes ou depois de mais features sociais? Hoje há 100+ utilizadores reais (`pitch-user-scale` memory) — o gap de leitura aberta já é um risco em produção, não só teórico.
- O feed sem paginação/notificações aguenta o volume atual? Vale medir quantos posts/dia estão a ser criados antes de decidir a próxima função.
