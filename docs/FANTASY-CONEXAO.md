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
