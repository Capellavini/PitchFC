# Pitch VAR — interface de câmera

Publicado nos endereços /VAR/ (integrado) e /VARMariEder (público, tema de tênis).

Prévia em destaque, botão principal iniciar/salvar, zoom e lentes recolhidos, modo de campo escuro e parada acessível. Ajustes em diálogo nativo com foco e fechamento pelo teclado. Orientação inicial dispensável; erros persistem e confirmações breves desaparecem.

Matchday recolhido: conta e jogo continuam acessíveis; seleção aparece quando faltar jogo e se recolhe ao começar a captura. Fila de envio fica visível apenas para lances com associação real. O VAR público não usa login ou nuvem.

Galeria em cartões: miniaturas reais de vídeos locais visíveis, geradas uma por vez apenas sem captura, envio ou exportação. URLs, decodificadores e imagens são liberados ao sair. O estado da lista guarda metadados, sem manter os blobs de cada replay. Vídeos da nuvem são buscados pelo usuário; disponibilidade continua limitada ao autor e ao prazo existente. Não alterados backend, associação ou política de retenção.

Validação: 15 testes existentes aprovados, TypeScript e builds das duas variantes. Teste isolado com vídeo de demonstração: ajustes, gravar/salvar/parar, modo de campo, miniatura real, replay e exportação MP4. Sem estouro horizontal a 320, 375, 768 e 844 pixels. Teste integrado com respostas simuladas (sem dados reais): login, seleção, join/stop e abertura de gol próprio. Conferidas imagens de celular. Câmera, bateria e voz em aparelhos físicos não fazem parte desta validação de layout.
