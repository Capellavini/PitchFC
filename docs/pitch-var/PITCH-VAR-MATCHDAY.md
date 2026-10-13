# Pitch VAR × Matchday — integração preparada

Data: 13/10/2026. Estado: integração implementada em 13/10/2026 para publicação. Backend aplicado e fluxo autenticado validado; ver var/README.md para o funcionamento entregue. As notas de preparação abaixo preservam o desenho e os próximos refinamentos.

## Experiência desejada

1. João, organizador/adjunto, ativa VAR para a partida no Matchday. Jogadores confirmados e autenticados daquele grupo veem VAR disponível para esta partida. Não há QR nem pareamento individual pelo organizador.
2. Cada jogador confirmado abre o VAR com o próprio login, seleciona a partida quando houver mais de uma elegível, confirma Gravar neste celular e inicia sua câmera. Todos os gols serão capturados naquele aparelho enquanto ele estiver gravando e com salvamento automático ativo. A galeria pessoal conserva os gols do próprio jogador; os demais ficam em fila temporária para upload. O organizador vê somente Ativar/Desativar VAR, sem contagem de câmeras.
3. João registra gol de Lukas. Pitch confirma o gol no servidor e cria um pedido de replay vinculado ao mesmo evento.
4. O servidor cria um pedido por sessão/dispositivo elegível e avisa todas as câmeras ativas. Cada aparelho busca seu pedido autorizado, localiza o momento no próprio histórico e guarda seu ângulo com os IDs do grupo, partida, gol e Lukas. Quem filmou é registrado separadamente do autor do gol.
5. O Matchday não mostra câmeras ativas ou contagem de salvamentos ao organizador. Recibos e falhas são tratados internamente; a interface do aparelho que filma pode informar seus próprios uploads pendentes.
6. Vídeos enviados por outros aparelhos aparecem em Meus gols para o autor do gol, mesmo sem câmera própria. Ficam acessíveis na nuvem por três horas após o encerramento oficial da partida; o jogador pode baixar para guardar. A interface só oferece assistir/baixar após confirmação do upload.

O grupo não é uma conta compartilhada: cada pessoa usa seu login e as permissões vêm da participação no grupo. Não é preciso compartilhar senha entre João e Vinicius. Um aparelho emprestado exige uma sessão autorizada de gravação; depois ela pode ser revogada.

## O que existe e o que falta

- Matchday já sincroniza games.live_matchday pelo Supabase; addGoal em src/PitchApp.jsx acrescenta eventos ao array da partida.
- O evento atual inclui scorerId e pode incluir minute. Não tem identidade permanente nem horário preciso do gol. Minuto de jogo não permite recortar vídeo com precisão.
- O roster converte players.id em uuid e usa um id local na tela. O pedido deve resolver baseGroup.find(p => p.id === event.scorerId).uuid, não transportar esse número local como identidade do jogador.
- players.user_id liga o jogador à conta; player_group_memberships liga jogador/grupo. Convidados podem não ter conta. O vínculo principal do lance é players.id; o servidor resolve a conta atual. Não confiar num user_id arbitrário enviado pelo navegador.
- VAR hoje guarda somente vídeos no navegador, sem login ou assinatura de eventos. A próxima etapa acrescenta autenticação e escolha de grupo/partida.

## Tempo e histórico

Registrar eventId UUID estável e recordedAt ISO UTC assim que João confirmar o gol. Guardar occurredAt separadamente se houver horário real do lance; caso contrário, assumir explicitamente recordedAt como aproximação. O minuto visual permanece para a timeline.

O relógio de cada aparelho deve ser calibrado contra o servidor, estimando deslocamento e incerteza por requisição/tempo de ida e volta. O VAR ancora o começo do vídeo no relógio calibrado e mede duração com performance.now(), sem depender de mudanças no relógio do telefone. Horário de inserção no banco é referência de auditoria, não prova do instante físico em que a bola entrou.

A janela é relativa ao gol, não ao instante de chegada da notificação. Exemplo: gol no segundo 95 do vídeo, registro no 100, recebimento no 103 → replay 75–105 (20 antes + 10 depois). Confirmar somente após o fim dessa janela e persistência local.

Atraso humano ao preencher o autor do gol pode consumir o histórico. O padrão de aproximadamente 45 segundos comporta somente atrasos curtos. Se o evento já saiu, devolver Histórico expirado; não salvar um vídeo atual como se fosse o gol. Se faltar só parte do início, marcar Janela reduzida. Não aumentar o histórico nem enviar a partida inteira automaticamente: respeitar os tetos de memória existentes.

## Transporte proposto

Usar Supabase Realtime como aviso rápido entre aparelhos e uma fila persistida de pedidos como fonte de verdade. Realtime não é confirmação de gravação do dispositivo. Na reconexão, buscar pedidos pendentes da sessão e confirmar quais ainda cabem no histórico.

O aviso deve carregar somente a identidade do pedido. O VAR busca os dados sob RLS; não aceitar autoria/horário de um broadcast arbitrário como verdade autorizada. Canal privado por sessão de captura, com autorização do grupo/partida. A fila evita depender de um broadcast transitório.

Gravar gol + pedido na mesma transação no servidor (RPC ou camada backend), apenas se o recurso estiver ligado e houver sessões de captura elegíveis. Não colocar envio de mensagens dentro do atualizador de estado React. O gol deve continuar funcionando quando o VAR estiver indisponível.

Múltiplas câmeras são o padrão: uma sessão por dispositivo, com recibo e clipe separados. A autorização é por grupo + partida + jogador confirmado; ingresso exige opt-in e início manual da câmera. Confirmados que só assistem ao Matchday não gravam automaticamente. Desligar VAR no Matchday interrompe novos comandos automáticos em todas as sessões; parar uma câmera afeta apenas aquele aparelho. Perda da confirmação ou saída do grupo revoga elegibilidade. Pode haver um limite configurável de sessões simultâneas, sem exigir aprovação manual de cada jogador.

## Modelo proposto — ainda sem migração

- Configuração da partida: VAR liberado/desligado pelo organizador; confirmação de presença válida e sessão autenticada exigidas para ingresso.
- var_capture_sessions: id, group_id, game_id, match_id, device_id, operator_user_id, armed, state, capture_started_at, lease_expires_at, clock_uncertainty_ms. Identidade da sessão muda ao iniciar captura nova.
- match_events: id estável, group_id, game_id, match_id, scorer_player_id, own_goal, occurred_at, recorded_at, revision, cancelled_at. Compatível com a timeline atual, sem usar posição do array como identidade.
- var_replay_requests: id, event_id, capture_session_id, revision, created_at; unicidade por sessão/evento. Servidor resolve todas as associações.
- var_replay_receipts: request_id, device_id, local_clip_id, state, saved_at, reason, association_revision. Estados: received, collecting, saved_local, expired, failed, cancelled; unicidade por pedido/dispositivo.
- Metadados do vídeo local: goalId, scorerPlayerId, groupId, gameId, matchId, sessionId, deviceId, occurredAt, recordedAt, ownGoal, revision. Não guardar blobs no banco desses comandos.

Persistir comando/clip e sua identidade no IndexedDB. Na inicialização, reconstruir o conjunto de comandos processados a partir dos clipes e do diário local. Retry retorna recibo existente; nunca faz uma segunda captura do mesmo gol. A revisão muda a atribuição, não cria vídeo adicional. Um erro transitório pode ser retomado enquanto ainda houver histórico.

Correção do autor usa o mesmo eventId, aumenta revision e reconcilia a associação (inclusive no dispositivo offline ao reconectar). Desfazer gol cancela a associação sem apagar silenciosamente o vídeo local; galeria permite confirmar exclusão. Autogolo é marcado como autogolo e não como gol de mérito do autor.

## Permissões necessárias para ativar

Habilitar RLS e verificar as relações reais no servidor: sessão pertence ao grupo/jogo; operador é membro autorizado; João pode gerir aquele Matchday; Lukas pertence ao roster/participação da partida. Somente o aparelho autorizado da sessão pode registrar seus recibos. Leitura dos vídeos limitada ao jogador autor do gol e à política definida para quem filmou; a participação no grupo autoriza o fluxo, mas não abre todos os vídeos a qualquer membro. Nenhuma service-role no navegador.

Login e seleção de grupo não bastam como autorização. Validar também os IDs recebidos, cancelar acesso ao sair do grupo e revalidar sessão após reconexão. Links diretos /VAR não conferem acesso a sessões privadas. Novas tabelas só são expostas após grants e RLS revisados.

## Bateria e conectividade

Durante a captura, comandos/metadados trafegam. Os trechos marcados entram em fila local para enviar após a gravação; a partida inteira não é enviada. Uma conexão Realtime enquanto a sessão estiver armada, sem polling por frame. Sinalização de presença com intervalo moderado (ex.: 30 segundos) e lease; não confundir conectado com câmera ativa. MP4 e upload ficam para depois da captura.

Os aparelhos precisam de conectividade com o servidor. Câmera offline pode continuar gravando localmente, mas não recebe imediatamente o gol de outro aparelho. Ao reconectar, pedidos antigos só são executados se ainda houver vídeo. O navegador deve permanecer em primeiro plano, com tela desbloqueada.

## Código preparado e testes

No protótipo replay-campo:

- src/mobile/matchday-var.ts: contrato, flag falsa, identidade/horário do evento, janela pelo horário sincronizado, rejeição de outra sessão, expiração e duplicatas. É uma camada de preparação, não autorização de rede.
- src/mobile/model.ts: vínculo opcional ReplayAssociation no clipe e origem matchday; o IndexedDB existente preserva esses campos.
- src/mobile/recorder.ts: commandMatchday recebe um plano validado e associa o clipe antes de salvar. Não tem chamador de rede na interface atual. O conjunto persistido de chaves/recibos ainda precisa ser integrado.
- tests/matchday-var.test.ts: atraso, vínculo Lukas/dispositivo, recurso desativado, outro grupo/jogo/sessão, repetição/revisão, relógios inválidos, histórico expirado e janela reduzida.

Próxima implementação: normalizar eventos e autorização no backend, gerar/revisar migração, adicionar autenticação/seleção de sessão ao VAR, implementar fila/recibos e reconciliação, ligar adaptador de eventos no Matchday, então testar dois aparelhos reais. Publicar piloto somente após os testes de isolamento, reconexão e persistência. A base preparada não dispara comandos em produção.

## Referências

- https://supabase.com/docs/guides/realtime/broadcast
- https://supabase.com/docs/guides/realtime/authorization

## Distribuição dos vídeos
Distribuído significa vários aparelhos capturando seus próprios ângulos do mesmo gol e enviando os trechos para acesso temporário do autor. Um gol pode ter N ângulos. Cada registro indica quem filmou, aparelho de origem, autor e se o upload concluiu. Câmeras e fila temporária respeitam o teto local de 200 MB; ao encher, avisar no aparelho que filma. Sem ao menos uma câmera gravando naquele momento e posterior upload válido, não existe vídeo recuperável.

A preparação inclui fanOutMatchdayGoal, que seleciona múltiplas sessões ativas de jogadores confirmados na mesma partida, com lease válido. Os dados de elegibilidade vêm do servidor autenticado, nunca do cliente como autorização. Não há conexão de rede ativa nesta etapa.

## Nuvem temporária — decisão atual

- O único controle do organizador é Ativar/Desativar VAR para a partida. Estados de captura/upload permanecem internos ou no aparelho que filma. Não acrescentar painel de câmeras.
- O ingresso do jogador explica que os trechos de gols capturados serão disponibilizados temporariamente aos respectivos autores. Não transmitir a gravação inteira. O início da câmera é uma ação explícita do jogador.
- Separar proprietário do gol (scorer_player_id) de operador/câmera (operator_player_id/device_id). Gol de Vini filmado por Lukas pertence à galeria de gols do Vini; Lukas é a origem do vídeo.
- Cada câmera precisa capturar todos os gols marcados para disponibilizar os de outras pessoas. Meus gols filtra pelos próprios gols; a fila técnica mantém temporariamente os demais, sem exibi-los como acervo pessoal. Somente após upload confirmado e associação concluída pode remover a cópia temporária de outro autor.
- Para preservar bateria e memória, a primeira versão prepara MP4 e envia a fila após Encerrar gravação, sequencialmente. Manter a página visível/desbloqueada até finalizar. Upload contínuo durante a partida não é a escolha inicial. No navegador, fechar a página não garante a continuação do envio; fila persistida pode retomar ao reabrir dentro do prazo.
- Prazo: expires_at = finished_at oficial da partida, gravado no servidor + 3 horas. Não começa quando Lukas desliga a câmera, quando Vini abre a app ou quando o upload chega. Não reiniciar o prazo em retry. Antes do encerramento, objetos têm retenção provisória com limite absoluto configurado para evitar retenção indefinida em partidas abandonadas.
- Depois do prazo, o servidor bloqueia novos acessos e uploads daquele acervo; uma rotina remove os objetos/metadados temporários. A remoção física é assíncrona, embora a autorização expire no horário. Links privados curtos devem expirar no máximo no prazo restante; nada de bucket público/URL permanente. Vídeos já baixados ficam com o jogador.
- Upload confirmado exige validação de objeto e metadados no backend. Recibo de envio HTTP não basta se a associação falhou. Pedidos repetidos usam a mesma chave por gol/sessão/dispositivo; vários ângulos são registros distintos e legítimos.
- Nova entidade proposta var_cloud_clips: goal_id, game_id, group_id, capture_session_id, device_id, scorer_player_id, operator_player_id, object_path, state, uploaded_at, expires_at. Bucket privado; servidor verifica autoria/participação e propriedade de sessão tanto ao enviar quanto ao acessar. Não confiar em IDs enviados pelo navegador sem verificar suas relações.
- Correção de autor revoga acesso do autor antigo, vincula o novo e preserva expires_at. Desfazer gol desassocia/revoga acesso conforme política, sem apagar silenciosamente vídeos pessoais já guardados no aparelho.
- Esta etapa é especificação. Login, upload, bucket, políticas, rotina de expiração e galeria na app ainda não estão implementados nem publicados.

## Disponibilidade real por jogo — Lukas grava apenas quando joga

Distinguir VAR liberado pelo organizador (permissão/configuração) de sessão de câmera gravando (capacidade real). Entrar no VAR ou estar online não torna um aparelho elegível.

Cada sessão aponta para group_id + game_id (dia/partida principal) + match_id (jogo específico na sequência do Matchday). Ao trocar de jogo, atualizar esse vínculo explicitamente e preservar os recibos anteriores; não enviar gols de outro jogo do mesmo dia a essa câmera.

Estados internos: preparando, gravando, pausada/encerrada, desconectada, erro. Só gravando, com salvamento automático ativo e presença recente, recebe novos pedidos. O dispositivo anuncia gravando somente após câmera aberta, track de vídeo ativo e gravador produzindo vídeo. Upload pendente ou galeria aberta não contam como câmera ativa.

Parar de gravar envia indisponível imediatamente e para as renovações da sessão. Fechar a página, perder a câmera, falta de memória ou suspensão também desarmam a captura. Se não for possível comunicar a parada, o servidor invalida a disponibilidade pelo vencimento de uma presença curta (ex.: renovação a cada 15 segundos e expiração após 40 segundos). Essa detecção tem atraso e não prova que o vídeo foi capturado: confirmação local continua necessária, internamente.

Quando Lukas volta a jogar e inicia outra captura, recebe uma sessão nova e novo capture_started_at. Gols anteriores a esse início são rejeitados; ligar a câmera depois não recupera o passado. Se outra câmera estava gravando, o autor pode receber aquele ângulo quando seu upload concluir.

Se ninguém estava gravando: registrar normalmente o gol, não prometer vídeo nem criar pedido para uma câmera futura. Meus gols pode informar Sem vídeo disponível. Se havia pedido mas o upload não concluiu, usar estado Aguardando vídeo, sem confundir com ausência definitiva de gravação. A tela do organizador continua somente com Ativar/Desativar VAR, sem alertas por gol ou contagens.

Receber pedido com presença aparentemente válida e devolver não gravando é uma falha esperada tratada no servidor, sem mudar o placar. Encerramento preserva clipes já marcados e a fila de upload; parar a câmera não apaga os lances existentes.

A fundação fanOutMatchdayGoal agora exige matchId e início de captura compatíveis com o horário do gol. Testes cobrem Lukas parando, zero câmeras, outro jogo, reinício após um gol e elegibilidade apenas para gols posteriores. A conexão/presença real com backend permanece para a implementação seguinte.
