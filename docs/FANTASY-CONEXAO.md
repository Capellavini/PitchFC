# Fantasy — revamp + Conexão da Rodada (fase 1)

Estado em 2026-10-29. Contrato original: `CLAUDE-IMPLEMENTAR-FANTASY.md` (pacote do Vinicius, fora do repo).

## O que está feito (fase 1, validado só no **demo local**)

- **Regra pura** em `src/lib/core/fantasyRules.js`: `FANTASY_CONNECTION` (+3 por lance, teto 2 lances = +6),
  `connectionDraftIssue`, `connectionBonus`, `scoreLineupWithConnection`. O total base (`scoreLineup`) não mudou;
  o bónus é parcela à parte (`breakdown.base`, `breakdown.connection`). Testes: `src/lib/core/fantasyConnection.test.js`.
  Cópia do bot atualizada com `npm run sync:core`.
- **Demo**: `buildDemoFantasy({ connectionConfig })` congela a dupla por ronda; `DEMO_FANTASY.connection` (seed) e eventos do seed
  com `id` estável. `onSaveSquad(..., connection)` grava elenco + dupla numa só chamada (`undefined` mantém, `null` remove).
- **UI**: quatro áreas (Meu time · Mercado · Rodada · Ranking), cabeçalho com ronda e fecho, coluna de contexto ≥ 1024 px,
  prévia de troca no Mercado, cartão/seletor/resultado da Conexão, seta no campo medida a partir do layout real.
  Só aparece em ligas com `league.connection_rules.enabled` — **a cloud não tem isso ainda**, por isso lá o redesign aparece
  mas a Conexão não.

## O que falta (fase 2 — backend, só por PR/CI)

1. **ID estável de lance** no registo de Matchday (`events[].id`) + compatibilidade com dados antigos (sem ID ⇒ "dados insuficientes").
2. Distinguir golo normal de **disputa de pénaltis** no modelo de eventos do grupo (a regra já ignora `shootout: true`).
3. Migração SQL: `connection_rules` por competição (versão + ronda inicial), dupla no snapshot (`locked_lineup`),
   RPC nova que grava elenco + dupla de forma atómica com verificação de versão, apuração em plpgsql espelho de `connectionBonus`
   (com os mesmos vetores), recomputo idempotente e atualização dos rankings. Grants explícitos nas tabelas novas.
4. Vetores partilhados + `supabase/tests` para a Conexão; hoje só há testes JS.
5. Link exato "ver registo do lance": hoje o botão leva ao Histórico do grupo (precisa do ID de evento para aterrar no lance).
6. Sorteio publicado ⇒ `teams` no seletor (a regra `split_teams` existe; o demo não tem equipas publicadas antes do jogo).

## Decisões a confirmar

- A shell do app é uma coluna de 430 px em todas as abas; o Fantasy "sai" dela (centrado) só a partir de 1024 px.
  A barra inferior continua a 430 px. Alargar a shell inteira é decisão global.
- O fecho segue o modelo atual: edição sempre aberta, e depois do fecho a edição conta para a **próxima** ronda.
- Texto da UI em PT-PT ("ronda"); a variante PT-BR ("rodada") está em `src/lib/fantasyConnectionCopy.js`.

## Pitch Manager nas Ligas (mesmo motor, dados das Ligas)

Estado em 2026-10-29, só no **demo das Ligas** (`/league/demo`). A aba "Fantasy" passou a "Pitch Manager" e renderiza o
mesmo `FantasyTab` e o mesmo motor (`core/fantasyRules.js`) do app de grupos; a prévia antiga (`FANTASY_DEMO_RULES`) deixou de ser usada na UI.

- **Adaptador** `src/lib/leagueFantasy.js`: jornada da liga = ronda; só pontua com **todos** os jogos da jornada oficiais (homologado/WO).
  Eventos vêm de `activeEvents()` (correções já aplicadas) com os **ids da liga** (a Conexão fica auditável). Golo→golo(+assistência),
  autogolo→`og` para o lado beneficiado; cartões, substituições e desempate por penáltis não são eventos do Pitch Manager.
- **Gestores = contas** (não atletas): `FantasyTab` ganhou `participants`, `rsvp={false}` (sem "próximo jogo") e `embedded`.
  `LEAGUE_FANTASY` (leagueDemo.js) tem a equipa de seed, 5 gestores inventados e a dupla da Conexão (9→11 do Marés na jornada 1, golo dos 38' corrigido).
- **Persistência**: `state.fantasyV2[accountId]` (só neste navegador). Homologar a jornada 2 em "Gerir liga" faz essa jornada pontuar sozinha;
  corrigir uma súmula recalcula (nada é guardado como total).
- "Ver registo do jogo" abre a súmula da liga (jogo e golo certos).

Lacunas assumidas: sem pontos de MVP (o "craque oficial" é por jogo, não pódio da ronda); sem jornadas provisórias (jogo em revisão mantém a jornada aberta);
sem cloud (as ligas reais não têm tabelas de Pitch Manager — migração + RPC como na fase 2 do grupo); sem trocas entre gestores (indisponível no demo, como nos grupos).
