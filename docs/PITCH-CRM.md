# CRM de ligas

Rota principal: `/CRM`. `/CRM/`, `/crm` e `/crm/` também abrem a aplicação.

A página usa o mesmo Supabase Auth e a mesma sessão do Pitch. O acesso não depende de `VITE_ADMIN_EMAILS`: a lista explícita `public.crm_members` autoriza as contas. O acesso inicial foi concedido somente à conta confirmada `vini@pitch-fc.com`, conforme pedido do proprietário. Contas comuns e visitantes não têm acesso aos dados. Alterar a lista requer uma operação administrativa no banco; nenhum usuário pode se autorizar pelo navegador.

`public.crm_state` mantém a base compartilhada com políticas de leitura e atualização somente para membros autorizados. Apenas a coluna `leagues` pode ser alterada pelo cliente. Um gatilho controla a revisão, data e autor. As gravações são serializadas no navegador e condicionadas à revisão carregada; conflito ou falha de conexão interrompe a sincronização e mostra um aviso persistente, permitindo exportar um backup antes de recarregar. Não há gravação dos dados comerciais em localStorage. A sessão de autenticação continua usando o mecanismo existente do Pitch.

O CRM conserva o mapa, fichas, histórico, próximas ações, métricas, lista, funil, agenda e backups da versão local. A demonstração utiliza seis registros fictícios, somente em memória. Ao sair desse modo, a base compartilhada volta a ser exibida. Alterações da demonstração não vão para o banco.

A consolidação de 06/11/2026 reúne pesquisas locais anteriores e mensagens consultadas, com fontes por registro e histórico. A base comercial permanece somente no banco privado. Os indicadores mostram cobertura parcial: faixas, mínimos, estimativas, edições históricas e capacidade máxima são distintos; números históricos ou vagas não entram nos totais atuais. Pode haver sobreposição entre organizadores, ligas e eventos. Nenhum total representa usuários do Pitch.

Pins aproximados usam cidades do GeoNames (CC BY 4.0), com atribuição no mapa; locais sem confirmação ficam na lista e no filtro de pendências, sem coordenadas inventadas. A lista tem carregamento progressivo e o mapa agrupa pins. A interface usa o logo oficial existente e a paleta do Pitch. Leaflet 1.9.4 e MarkerCluster 1.5.3 são servidos localmente com suas licenças em `public/CRM/vendor`.

Respostas automáticas, encaminhamentos e envios não significam interesse confirmado. Pedidos explícitos para não receber contato ficam identificados e sem próxima abordagem. Conversas e relatórios incompletos não foram tratados como contratos ou reuniões concluídas sem evidência.

Validação: compilação de produção; teste transacional com leitura e atualização da conta autorizada, incremento de revisão, bloqueio de revisão antiga e negação de leitura/escrita para outra conta; confirmação de que visitantes não possuem permissão de leitura; nenhum dado de teste permaneceu no banco. Testes da tela de login não devem alterar a senha ou criar uma sessão administrativa artificial.

Limites: a base é carregada ao abrir a página; não há atualização em tempo real entre abas. Caso outra sessão grave antes, é preciso exportar as alterações pendentes e recarregar. Dados do protótipo local podem ser transferidos com os controles de backup/importação após entrar no CRM.
