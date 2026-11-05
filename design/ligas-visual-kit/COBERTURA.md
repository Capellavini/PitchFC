# Mapa inicial de cobertura — PITCH Ligas

Este mapa é preparatório. Componentes abaixo foram encontrados numa cópia local antiga e não confirmam rotas ou arquitetura da branch atual. Marcar uma tela como concluída exige implementação e validação, não apenas uma captura ou alteração de estilo.

Escopo: somente PITCH Ligas, incluindo seus perfis, página pública e experiências de adepto/Fantasy/blog vinculadas à liga. As demais áreas do PITCH ficam fora deste redesign. Componentes compartilhados serão adaptados com isolamento e verificação de regressão.

| Área | Cobertura esperada | Referências locais a reconciliar | Estado |
|---|---|---|---|
| Estrutura e contexto | navegação PC/celular, papel, liga ativa, conta e saída | LeagueContextApp, LeagueCloudShell, LeagueHeader, LeagueBottomNav, LeagueContextSwitcher | Mapear na base atual |
| Painel | pendências agrupadas, prioridade, jornada atual, vazios e carregamento | LeagueHome, LeagueOrganizerHome, OperationsOverview | Mapear na base atual |
| Jogos e calendário | filtros, jornada, horários, estados, conflitos e paginação/volume | LeagueMatches, LeagueCloudMatches, LeagueManageCalendar, OperationsCalendar | Mapear na base atual |
| Detalhe de jogo | resumo, convocados, lances, súmula, desempate, revisão e ações por papel | LeagueMatchPage, LeagueCloudMatchPage, LeagueLineups, LeagueSumula, LeagueTimeline | Mapear na base atual |
| Classificação e rankings | nomes, pontos, desempates, oficial/provisório, PC e celular | LeagueTable, LeagueCloudTable, LeagueStandingsTable, LeagueRankingList | Mapear na base atual |
| Taça e época | fases, relações, vencedor, penáltis, fecho/arquivo conforme feature disponível | LeagueCompetitionSchedule, LeagueAwards, OperationsStandings | Depende da base/feature |
| Equipes e atletas | plantéis, busca, perfis, presença, estatísticas e identidade | LeagueTeamPage, LeaguePlayerPage, LeaguePlayersDirectory, LeagueSquadGrid | Mapear na base atual |
| Gestão e inscrições | identidade, módulos, competição, importação, calendário e relatórios | LeagueManage, LeagueIdentityEditor, LeagueManageRegistrations, LeagueManageReports | Mapear na base atual |
| Capitão | plantel, convocatória, contestação e limites de acesso | LeagueCaptainTools, LeagueLineupSheet, LeagueReasonSheet | Mapear na base atual |
| Disciplina e regulamento | suspensões, elegibilidade, decisão e regras/configuração existente | LeagueDiscipline, LeagueCloudDiscipline, LeagueRegulation | Mapear na base atual |
| Convites e acessos | aceitar, identificar atleta, sucesso, inválido e expirado | LeagueInviteAccept, LeagueRoleCard, LeagueRoleSwitcher | Mapear na base atual |
| Adjunto e operações | chat, propostas, confirmação, erros e estados | OperationsAdjuntoChat, OperationsCopilot, OperationsLiveMatchday | Coordenar com Claude |
| Página pública | início esportivo, competições, clubes, classificação, taça e identidade da liga | OperationsPublic; confirmar implementação real da rota pública | Coordenar com Claude |
| Autenticação e conta do adepto | cadastro, login, recuperação, sessão e retorno ao Fantasy | AuthForm, AuthLanding, LeagueEntry | Feature e integração a definir |
| Fantasy | entrada, seleção de equipe, mercado/escalação, pontos e rankings existentes | FantasyTab, FantasyPitch, FantasyTables, LeagueFantasy | Confirmar backend e dono |
| Blog/anúncios | gestão editorial, artigos, avisos, imagens, publicação e leitura | Nenhum componente específico confirmado nesta leitura | Feature e dono a definir |
| Onboarding de Ligas e módulos opcionais | entrada de organizador, configuração e módulos efetivamente usados dentro de Ligas | Inventário pendente na base atual; preservar as demais áreas que compartilhem componentes | Mapear na base atual |

## Verificações por bloco

- Layout em 320, 390, 768, 1024, 1366 e 1920 px, conforme a superfície; zoom de 200% e texto ampliado nos fluxos principais.
- Nomes e pontos reconhecíveis; evitar cortes de ações e sobreposição com barras persistentes.
- Estados padrão, vazio, carregando, erro, sucesso, desabilitado e pendente de confirmação.
- Navegação por teclado, foco visível, nomes acessíveis, diálogo com foco contido e retorno ao controle de origem.
- Contraste medido para texto e controles, incluindo cores muito claras ou muito escuras de ligas.
- Seleção da liga e competição coerente com formulários e ações; filtros mantidos ou reiniciados de modo explícito.
- Permissões por gestor/capitão/atleta/adepto; preservar comportamento e limites existentes.
- Resultados oficiais, provisórios, penáltis e vencedor coerentes nas superfícies internas e públicas.
- Fluxos de cadastro/login/Fantasy e publicação de conteúdo verificados com persistência real quando forem implementados.
- Regressão funcional e build da base integrada, usando os comandos e requisitos do repositório confirmado.

## Progresso desta preparação

Concluído: direção aprovada, tokens de marca, biblioteca isolada de 20 componentes React, galeria executável, sete testes automatizados aprovados e branch `codex/pitch-ligas-redesign` criada em `763e385`.

Pendente: conectar os componentes ao app, migrar as telas existentes, integrar as features e validar o build do app final. A conferência visual da biblioteca em navegador também continua pendente devido às falhas da conexão do Chrome. Nenhuma tela desta matriz é considerada migrada nesta etapa.
