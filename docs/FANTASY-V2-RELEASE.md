# Fantasy v2 — Fase A, validação e transição

Vinicius confirmou em 19/10/2026 o reinício das ligas atuais, com preservação do histórico, e autorizou a publicação pelo repositório e CI depois da validação.

## Comportamento
Pontuação e fecho de ronda controlados pela base de dados; cópia da escalação no início do jogo; capitão/vice, banco automático, transferências e preços pela forma; Taça do Mês e Campeonato da Época; classificação e troféus por temporada. Draft continua indisponível nesta fase.

## Reinício confirmado
- Guarda a classificação anterior numa temporada fechada, incluindo empates no primeiro lugar e troféus.
- Preserva as linhas anteriores de `fantasy_scores` como histórico, sem lhes atribuir rondas v2.
- Esvazia as escalações, repõe os saldos iniciais e cancela propostas de troca pendentes.
- Mantém ativa apenas a liga mais recente de cada grupo e abre as competições v2.

## Validação anterior à publicação
- 239 testes JavaScript aprovados na revisão da Fase A; compilação aprovada e núcleo do bot sincronizado.
- Cadeia completa de 88 migrações aplicada numa base PGlite local, com adaptadores para Auth, Storage e cron do Supabase.
- 150 checks SQL do Fantasy aprovados.
- Regressão SQL do Rivals: 136 de equipas, 127 de desafios e 269 de resultados, todos aprovados.
- Fixture com ligas antigas: 6 verificações de histórico, campeões (incluindo empate), troféus, escalações, saldo, cancelamento de propostas e temporadas aprovadas.
- Reaplicação local: contagem de temporadas, troféus e linhas históricas não muda; os 6 checks da fixture continuam aprovados.
- O agendamento real de cron e a infraestrutura Supabase são verificados em produção por leitura após o CI; o adaptador local não executa o relógio do serviço.

## Ordem das migrações
A migração Fantasy ainda não publicada foi reversionada para `20261019180559_fantasy_v2_foundation.sql`, gerada pela CLI. A antiga versão `20261019150053` era anterior ao onboarding `20261019160000`, já aplicado. Não alterar versões já aplicadas nem executar esta migração manualmente em produção.

## Verificação posterior ao CI
Antes da publicação, a produção tinha 3 ligas, 14 escalações e 182 linhas históricas de pontuação. Uma referência privada com a assinatura dos registos e as classificações por liga foi guardada fora do repositório. Depois do CI, comparar a assinatura das 182 linhas, as temporadas fechadas, os campeões/troféus, o estado das escalações e o agendamento `pitch-fantasy-tick`.
