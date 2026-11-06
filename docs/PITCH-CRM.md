# CRM de ligas

Rota principal: `/CRM`. `/CRM/`, `/crm` e `/crm/` também abrem a aplicação.

A página usa o mesmo Supabase Auth e a mesma sessão do Pitch. O acesso não depende de `VITE_ADMIN_EMAILS`: a lista explícita `public.crm_members` autoriza as contas. O acesso inicial foi concedido somente à conta confirmada `vini@pitch-fc.com`, conforme pedido do proprietário. Contas comuns e visitantes não têm acesso aos dados. Alterar a lista requer uma operação administrativa no banco; nenhum usuário pode se autorizar pelo navegador.

`public.crm_state` mantém a base compartilhada com políticas de leitura e atualização somente para membros autorizados. Apenas a coluna `leagues` pode ser alterada pelo cliente. Um gatilho controla a revisão, data e autor. As gravações são serializadas no navegador e condicionadas à revisão carregada; conflito ou falha de conexão interrompe a sincronização e mostra um aviso persistente, permitindo exportar um backup antes de recarregar. Não há gravação dos dados comerciais em localStorage. A sessão de autenticação continua usando o mecanismo existente do Pitch.

O CRM conserva o mapa, fichas, histórico, próximas ações, métricas, lista, funil, agenda e backups da versão local. A demonstração utiliza seis registros fictícios, somente em memória. Ao sair desse modo, a base compartilhada volta a ser exibida. Alterações da demonstração não vão para o banco.

Os registros iniciais de AFPCE e Coimbra estão somente na migração de banco, não nos arquivos públicos do cliente. As notas de 27/10/2026 são referências anteriores: as reuniões previstas não foram consideradas realizadas, os números são aproximados e os pins usam o centro das cidades até confirmação das sedes.

Validação: compilação de produção; teste transacional com leitura e atualização da conta autorizada, incremento de revisão, bloqueio de revisão antiga e negação de leitura/escrita para outra conta; confirmação de que visitantes não possuem permissão de leitura; nenhum dado de teste permaneceu no banco. Testes da tela de login não devem alterar a senha ou criar uma sessão administrativa artificial.

Limites: a base é carregada ao abrir a página; não há atualização em tempo real entre abas. Caso outra sessão grave antes, é preciso exportar as alterações pendentes e recarregar. Dados do protótipo local podem ser transferidos com os controles de backup/importação após entrar no CRM.
