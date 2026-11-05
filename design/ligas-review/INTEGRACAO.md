# Integração do redesign — PITCH Ligas

Base: 763e385. Branch isolada: codex/pitch-ligas-redesign.

Alterações de apresentação restritas a src/components/league, mais a projeção pública de penáltis em src/lib/leagueLanding.js. O tema global, PitchApp, as áreas de grupos/rivais, API, bot e migrações não foram alterados.

O tema local mantém azul escuro e lima PITCH. A página pública tem superfícies claras e cores da liga com contraste calculado. A gestão mostra todas as secções; jogos têm filtros por estado; a tabela móvel mantém nomes completos, J, DG e Pts. Convocatórias em falta são agrupadas por jogo. Resultados empatados mantêm o desempate por penáltis separado do marcador.

Foram preservados os contratos de pedidos de atletas, convocatórias, importação e fecho de época. Não houve aplicação de migrações, push para main ou publicação.

Validação em 5 de novembro de 2026:
- Build Vite concluído. Permanece o aviso de tamanho do bundle geral já existente.
- 493/493 testes da aplicação.
- 209/209 testes do bot.
- 9/9 testes dos componentes reais, incluindo renderização das 11 secções de gestão, tema isolado, projeção de penáltis e tabela compacta.
- Prévia HTTP: 200 em localhost e no endereço Wi-Fi do PC.
- Inspeção visual feita anteriormente no Chrome: painel PC, classificação PC e 390 px; navegação de jogos em 390 px. Revisão visual completa das outras telas e telefone físico pendentes, porque o controlo do Chrome foi interrompido ao não conseguir confirmar o endereço da janela. Renderização e HTTP 200 não substituem a inspeção visual.

A prévia é uma entrada separada que importa os componentes reais. Dados e alterações são fictícios/locais; ações remotas da autenticação, publicação e convites estão desligadas. A versão HTML autónoma não depende da instalação do repositório.

Próximos passos antes de publicar: avaliação visual pelo utilizador, concluir a inspeção das telas restantes e verificar os fluxos autenticados numa conta de teste. Login do adepto para Fantasy e blog com artigos próprios são novas funcionalidades separadas desta migração visual; os avisos e inscrição de interesse existentes estão incluídos.

## Integração para publicação — 5 de novembro de 2026

A branch passou a incluir origin/main em 31e8d75, com as últimas features do Claude. Foram conciliados três conflitos de importação, mantendo todos os contratos e as ações novas. Os componentes de carreira, regulamento, subidas/descidas, Supertaça e próxima fase da taça usam o tema local do redesign.

Validação final: 510 testes da aplicação, 209 do bot, 9 testes dos componentes; sincronização dos 11 ficheiros core e 10 ficheiros leaguelib do bot confirmada; compilação Vite aprovada. Não há diferenças relativamente a origin/main em API, bot, migrações, workflows, PitchApp ou tema global.

O utilizador aprovou a prévia e autorizou a integração/publicação em 5 de novembro de 2026. A entrega segue pelo GitHub e pela integração Vercel existente.
