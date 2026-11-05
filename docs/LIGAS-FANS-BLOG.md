# Adeptos, Fantasy e blog das ligas

## Percursos

- Página da liga: /leagues/:slug. Inclui as últimas três publicações e entrada do adepto.
- Cadastro/login: /leagues/:slug/entrar. Usa o Auth existente, confirmação por email e recuperação de acesso.
- Fantasy: /leagues/:slug/fantasy. Primeira entrada pede nome público, nome da equipa e consentimento. Email e ID de autenticação não são publicados.
- Blog: /leagues/:slug/noticias. Categorias Notícias, Avisos, Resumos de jogos e Homenagens.
- Artigo: /leagues/:slug/noticias/:uuid. Apenas conteúdo publicado de uma liga publicada é acessível sem sessão.
- Organização: Gerir → Blog da liga. Criar, editar, guardar rascunho, publicar, retirar do ar e arquivar. O separador Fantasy abre a área real dos adeptos; a demonstração continua apenas na liga de exemplo.

## Contratos e segurança

Migração: 20261105134348_league_fans_blog.sql.
Quatro tabelas com RLS e sem acesso direto de anon/authenticated: league_articles, league_fantasy_members, league_fantasy_rounds e league_fantasy_entries. Acesso via RPCs com search_path vazio e identidade verificada no servidor. Metadados Auth servem apenas para encaminhamento da interface, nunca para conceder acesso. Edição editorial restrita ao owner da workspace; IDs de outra liga não concedem acesso. Versões impedem sobrescrever alterações concorrentes.

O Fantasy usa a primeira competição de liga (não a taça), épocas isoladas e o motor de pontuação existente, incluindo Conexão, preços e transferências. Cinco titulares e até dois suplentes dentro do orçamento de 120. O servidor valida atletas, capitão/vice, orçamento, lesões, limite de posse e prazo. A primeira gravação pede capitão e vice explicitamente. Cada jornada conserva a sua equipa; a anterior continua nas seguintes até ser alterada. Não há pontos retroativos. Só pontuam jornadas oficiais e correções das súmulas recalculam os pontos. O primeiro prazo já decorrido não pode ser reaberto adiando os jogos.

A opção de inscrições da página pública bloqueia novas equipas, preservando as existentes. Desligar o módulo Fantasy bloqueia o jogo. Os registos de interesse antigos são preservados e identificados separadamente na gestão.

## Editorial e apresentação

Texto simples, com quebras de linha preservadas; HTML não é executado. Capa opcional por endereço HTTPS com descrição acessível. Sem upload de ficheiros ou editor rich text nesta entrega. Página pública clara com cores da liga; contas e Fantasy navy/lime PITCH. Layouts responsivos para PC e telemóvel.

## Validação e entrega

- Testes do app, bot, sincronização do core e build de produção.
- node scripts/test-league-community.mjs: executa a migração real em PostgreSQL local/WASM com identidades fictícias. Testa permissões, isolamento, versões, prazos, pontuação contra o JS existente, correções, fim da época e inscrições fechadas. Não usa produção.
- node scripts/test-league-community-ui.mjs: interações React virtuais dos formulários e percurso completo de primeira equipa/capitão, usando o contexto obtido do SQL local. Executar depois do teste SQL.
- node design/ligas-review/check.mjs: regressão de renderização e isolamento visual.
- As bibliotecas de teste são obtidas em diretório ignorado, com versão e integridade SHA512 fixadas. Nenhuma dependência nova entra no bundle da aplicação.

A ferramenta de Chrome bloqueou a captura por não conseguir identificar a URL com segurança. Estes testes não substituem uma revisão visual no navegador nem o recebimento real de email de confirmação/recuperação. O Auth deve permitir o domínio do ambiente usado e o caminho de retorno; o encaminhamento da conta de adepto também recupera o Fantasy quando o Auth retorna à raiz.

Publicar primeiro a migração pelo workflow Deploy Supabase migrations, no ref desta branch. Depois de CI e migração aprovados, integrar a aplicação e aguardar Vercel. Nunca aplicar SQL manualmente em produção. Rollback de frontend não requer apagar tabelas ou contas; preservar os dados.
