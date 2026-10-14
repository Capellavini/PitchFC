# Pitch VAR — jogo automático

O jogador confirmado escolhe apenas o Matchday do grupo (quando houver mais de um) e inicia a câmera. Não escolhe cada jogo. Pode gravar antes de existir o primeiro confronto; o VAR aguarda e acompanha as trocas sem reiniciar câmera, sessão ou relógio do buffer. O organizador continua usando os controles existentes do Matchday.

activeMatchId é compartilhado no Matchday: primeiro confronto de calendário, confronto escolhido pelo organizador ou próximo não concluído. Consulta ao histórico de um confronto concluído continua local e não altera o jogo ao vivo. VAR mostra o jogo recebido do servidor, com Realtime de games e heartbeat de 15s como recuperação.

Sessão automática acompanha todos os gols registrados naquele mesmo Matchday enquanto captura saudável estiver ativa. Cada pedido mantém o matchId real do gol, inclusive se chegar depois de trocar de jogo. Sessões antigas continuam restritas ao confronto escolhido. Grupos e Matchdays distintos permanecem isolados. Encerra ao parar, revogar acesso/desativar VAR ou terminar oficialmente o Matchday; não para durante intervalo entre confrontos. O dispositivo precisa continuar filmando o campo correto e em primeiro plano.

Não há detecção física da entrada de jogadores; a fonte é o jogo registrado no Matchday. A câmera continua entre os jogos até o utilizador parar ou encerrar o Matchday. Mantidos buffer curto, tetos de memória, fila após captura e acesso aos vídeos pelo autor por 3h após o fim. Mari Eder permanece público, local e independente.

Validação: 112 testes do Pitch e 17 do VAR aprovados; builds aprovados. Banco: teste com rollback antes e depois da migração, câmera esperando primeiro jogo, dois confrontos, intervalo, pedido atrasado preservando identificação, compatibilidade da sessão antiga, bloqueio de intruso e encerramento. Nenhum dado de teste persistido. Navegador isolado e respostas simuladas: login, ausência de seletor, espera, Jogo 1 → Jogo 2 mantendo uma única sessão, parada e galeria de gol próprio. Revisão de segurança sem avisos novos de VAR.
