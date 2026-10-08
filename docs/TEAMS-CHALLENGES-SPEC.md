# Pitch Club — Teams e Challenges (v1)

> **⚠ DECISÕES DO VINICIUS (2026-10-08) — prevalecem sobre o texto abaixo**
>
> 1. **Confronto = entidade própria e leve no v1 (opção B).** Proposta → partida → resultado vivem em tabelas próprias de desafio, **não** em `games`/`attendances`/`matchdays` (que são do grupo: reset semanal, wa-bot, Adjunto, attendance_log, RLS por grupo). Ligar ao motor do Matchday só quando quisermos estatísticas individuais (fase posterior).
> 2. **Prioridade: entregar ANTES da entrega D do Adjunto e do MB Way real.**
> 3. **Piloto:** ainda não há equipas — o Vinicius arranja 2 equipas reais para o primeiro confronto (o Leo pode recrutar capitães via CRM de ligas).
> 4. **Marketing:** "vamos entrar forte" — o Leo desenha o formato de marketing e uma landing page dedicada.
> 5. Reaproveitar o que for compatível do ramo antigo `worktree-agent-afcf9e49e011cab46` (28/09), mas **as migrações dele (005800/005900) têm de ser renumeradas acima da última aplicada** e **não** mexer nas políticas de escrita de `games`/`attendances`/`matchdays` (opção B torna isso desnecessário).
> 6. Tudo atrás de feature flag (`teams`, `challenges` em `src/lib/flags.js`) até o teste com 2 equipas reais.

---

## Objetivo

Transformar a base existente de Teams e as telas provisórias de Challenges em um fluxo funcional: **criar equipe → convidar adversário → combinar jogo → jogar → confirmar resultado → pedir revanche**.

Priorizar uma primeira versão pequena, completa e confiável. O diferencial é conectar a organização da pelada à competição entre equipes reais, preservando a identidade dos jogadores.

## 1. Contexto

- `docs/PRODUCT-ARCHITECTURE-BRIEF.md` §8 e fases 6–7 do roadmap.
- `supabase/migrations/20260101004900_teams.sql`: equipes, membros e controles de acesso.
- `src/components/TeamsSection.jsx`, `src/hooks/useCloud.js` (create/addMember/removeMember/updateTeam).
- `src/components/TeamsPanel.jsx`, `ChallengesPanel.jsx` (provisórias), `CompetirTab.jsx`, `src/lib/flags.js`.
- Ramo `worktree-agent-afcf9e49e011cab46`: TeamsHub, TeamPage, CreateTeamSheet, ChallengesHub, ChallengeCard, ChallengeSheet, ResultSheet, useTeams.js, migrações de teams/challenges, docs/TEAMS-CHALLENGES.md.

## 2. Princípios de produto

- **Grupo ≠ Equipa.** Grupo = círculo que organiza jogos recorrentes (equipas mudam todas as semanas). Equipa = identidade permanente (nome, escudo, capitão, elenco, histórico). Mudanças no elenco não mexem no grupo; uma equipa sorteada numa pelada não vira equipa permanente sem ação explícita. O perfil do jogador é partilhado entre contextos.
- **Uma partida compartilhada:** um desafio aceite origina **uma única** partida, ligada às duas equipas e visível por ambas.
- **Convite direto antes de descoberta pública:** funciona com poucas equipas — o capitão cria a proposta e partilha um link com um adversário conhecido. Lista pública, filtros por distância e ranking por cidade ficam para depois.

## 3. Escopo do v1

**Incluído:** criar/editar equipa; capitão, vice-capitão, elenco; convite para entrar na equipa; desafio direto (equipa existente ou link); proposta, contraproposta, aceitação, recusa, expiração e cancelamento; estado do campo explícito; partida partilhada; placar com confirmação dos dois lados; contestação e correção; histórico e V-E-D confirmados; revanche.

**Depois:** descoberta pública, ranking por cidade, força da equipa, troféus, torneios, chat interno, pagamentos/reserva automática de campo, estatísticas individuais completas.

## 4. Teams

Campos: nome, escudo, cidade, cores, formato preferido (F5/F7/F11…), capitão, vice opcional, elenco por convite. Mínimo obrigatório pequeno; resto editável depois.

Permissões: capitão e vice gerem o elenco; exclusivo do capitão: transferir liderança, apagar equipa, alterações sensíveis. Convites com aceitação, expiração e revogação; sem entrada arbitrária por chamada direta; ninguém se auto-promove a capitão/vice; saída do capitão nunca deixa a equipa sem responsável.

Tela da equipa: escudo/nome/cidade → próximo jogo ou desafio que pede ação → V-E-D confirmados → últimos resultados → elenco e responsáveis → ação principal **Desafiar equipa**. Sem equipa: explicar o benefício + **Criar equipa** / **Entrar por convite**.

## 5. Challenges — proposta

| Campo | Comportamento |
|---|---|
| Adversário | Equipa existente ou convite por link |
| Formato | Opções do produto |
| Data e hora | Proposta concreta, fuso definido |
| Campo | Local + quem confirma a disponibilidade |
| Duração | Tempo combinado |
| Custo | Valor, moeda e divisão entre equipas |
| Observação | Opcional |

**Aceitar o desafio não reserva o campo.** Mostrar o estado do campo separado do estado da negociação. Não comunicar pagamento, reserva ou cobrança que o produto não faz.

Convite por link: quem recebe entende a proposta antes de aceitar; aceitar em nome de uma equipa exige login e permissão sobre ela; sem equipa → criar e voltar ao convite com contexto; o link não deixa aceitar arbitrariamente pela equipa adversária; definir se o convite é dirigido a uma equipa específica OU reivindicável (não misturar); impedir aceitações múltiplas; convites expirados/usados informados.

## 6. Estados e negociação

Fluxo: **Aguardando resposta → Contraproposta → Combinado → Resultado pendente → Concluído**; extras: recusado, cancelado, expirado; contestação como estado explícito do resultado. Separar estado da proposta, da partida e do resultado.

Contraproposta: destacar o que mudou; histórico de versões; aceitação da versão atual pela outra equipa; versão antiga não aceitável; prazo e expiração; mudanças materiais após o acordo exigem novo consentimento.

Comunicação: botão para falar no canal que os capitães já usam (WhatsApp); sem mensagens automáticas; sem chat interno no v1.

Cancelamento: quem cancelou + motivo opcional; distinguir cancelamento, ausência e jogo disputado; nunca derrota automática por cancelamento ou silêncio.

## 7. Resultado partilhado

1. Representante autorizado de uma equipa informa o placar. 2. A outra equipa confirma ou contesta. 3. Até confirmar, é provisório. 4. Confirmado → atualiza histórico e V-E-D das duas. 5. Revanche disponível.

Contestação: mostra o placar proposto e a divergência; nova proposta + confirmação da outra equipa; correção invalida a confirmação anterior; o autor nunca conta como confirmação da outra equipa; nada confirmado por demora; pendências persistentes → suporte (sem arbitragem automática); correção de resultado concluído com auditoria e agregados consistentes.

Estatísticas no v1: só placar e resultado da equipa.

## 8. Design

Navegação **Recebidos · Enviados · Histórico**. Card: adversário + escudo, data/hora, formato, campo + estado da confirmação, estado da proposta/resultado, próxima ação. Ações por estado (aceitar/contrapropor/recusar; rever alterações; detalhes/confirmar campo/pedir alteração; informar/validar placar; rever divergência; ver/partilhar/revanche). Visual atual (navy, lime, escudos), uma ação principal por momento, estados vazio/carregando/erro/sucesso/expirado/sem permissão, não depender só de cor, acessível.

## 9. Gamificação

Revanche (nova proposta com dados do confronto anterior, novo acordo); histórico do confronto; últimos 5 jogos confirmados; card do confronto; card de resultado; marcos (1.ª vitória, 10 jogos, 1.º confronto externo). Rankings por cidade/força só com volume. Partilha só por ação explícita.

## 10. Arquitetura e consistência

Conceitos: equipa e associação; convites de elenco; proposta de desafio e versões; aceitação da versão atual; partida ligada às duas equipas; estado do campo; proposta e confirmações de resultado; histórico de alterações. Validar no banco (RPCs SECURITY DEFINER): papel/pertença; transições permitidas; aceitar só a versão atual; uma partida por desafio; confirmação independente das duas equipas; histórico consistente; idempotência e concorrência. Nada de saldos/placares/papéis editáveis livremente pelo cliente. Grants explícitos em tabelas novas (CLAUDE.md).

## 11. Ordem de entrega

1. Equipa, elenco, capitão/vice e convite. 2. Desafio direto, versões, contraproposta, aceitação, cancelamento. 3. Partida partilhada, resultado, contestação e histórico. 4. Revanche, cards e marcos. 5. Descoberta e competições (após validação). **1–3 = v1 funcional.** Manter flags.

## 12. Critérios de conclusão

Dois capitães criam/selecionam equipas, negociam um desafio, veem a mesma partida, registam e confirmam o resultado e propõem revanche. Casos essenciais: sem equipa → orientação; convite de elenco não dá papel admin; não autorizado não edita nem aceita; convite expirado/revogado inutilizável; duas aceitações simultâneas → uma partida; aceite de proposta antiga rejeitado; contraproposta exige nova resposta; aceitar não marca campo reservado; cancelamento não gera derrota; provisório fora do histórico oficial; autor não confirma pelos dois lados; contestação preserva versões sem duplicar; correção mantém agregados; operações idempotentes; revanche = nova proposta; ambas as equipas veem a mesma data/local/resultado; 320/375/430 px; acessibilidade; grupo/sorteio/partida continuam a funcionar.

**Sucesso:** dois times organizam e concluem um confronto inteiro com clareza sobre horário, campo, custo e resultado, sem registos divergentes.
