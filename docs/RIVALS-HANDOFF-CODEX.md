# PITCH Rivals — continuidade Codex, 13/10/2026

O Vinicius aprovou a nova landing e autorizou sua publicação e a continuidade do trabalho do Claude.

## Entrega atual

- Copy e estrutura aprovadas: benefício prático na abertura, quatro passos, uma seção de rivalidade, cadastro reduzido e FAQ.
- Cadastro real mantido: conta, confirmação de email e retomada da criação de equipe.
- Comunicação de acesso antecipado e indicação explícita de resultados/estatísticas em desenvolvimento.
- /rivals indexável, /desafios com canonical /rivals; links com tokens continuam noindex.
- Corrigido useTeams.matches: partidas compartilhadas extraídas dos desafios, com identidades das duas equipes e sem duplicação.
- Teste de regressão: desafio aceite aparece em Jogar/Matchday com adversário correto; cancelamento excluído.
- Build e 113 testes do aplicativo aprovados.
- Conferência visual desktop/mobile e metadados em navegador.

## Estado confirmado do banco

As migrações rivals_teams, rivals_challenges e rivals_bot_lookup estão aplicadas em produção. team_matches existe; team_match_results e team_match_availability ainda não existem.

## Continuação

1. Convocatória persistente e gestão de escalação, em tabelas próprias.
2. Resultados versionados, confirmação independente, contestação e correção com auditoria.
3. Gols/assistências individuais, estatísticas da equipe, carreira e plantel adversário após acordo (decisão 10 da spec).
4. Revanche, cards reais, previews sociais e piloto completo com duas equipes.

Manter as decisões 9/10 de TEAMS-CHALLENGES-SPEC.md acima das passagens antigas do plano. Nenhuma estatística individual deve usar games/attendances/matchdays dos grupos nesta etapa. Não liberar globalmente o Rivals completo antes do piloto.

Nenhuma alteração em .claude/launch.json ou arquivos locais de outros trabalhos faz parte desta entrega.
