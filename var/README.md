# Pitch VAR integrado

Código fonte do navegador em var/. A versão compilada publicada fica em public/VAR/.

Fluxo: organizador ativa VAR no Matchday; jogador confirmado abre /VAR com a própria conta, escolhe o jogo e inicia câmera. Gol é marcado com horário do primeiro toque e identidade permanente do autor. Somente sessões gravando aquele jogo recebem pedidos. Câmera parada/suspensa não recebe novos gols. Login usa a mesma sessão do Pitch no mesmo navegador.

Após parar a câmera, os trechos são preparados e enviados sequencialmente. Os próprios gols permanecem locais; os de outras pessoas são temporários e removidos após upload confirmado. Mantenha a página aberta até terminar. Meus gols permite ao autor recuperar vídeos de outros aparelhos. Acesso termina três horas após encerrar o Matchday; limpeza física executa a cada dez minutos. A partida inteira não é enviada. Arquivos têm limite de 24 MB por upload; galeria/fila local, 200 MB.

Backend: RPC pitch_var, tabelas var_*, bucket privado pitch-var e Edge Function pitch-var-cleanup. As rotinas privilegiadas vivem em private, com verificação de usuário e associação real ao grupo. Nenhuma chave de serviço está no frontend. O token do job fica no Vault; a função valida seu hash. Não publicar esse token em arquivos ou logs.

Desenvolvimento (Node 24 e pnpm): copiar somente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para var/.env.local; executar pnpm install --frozen-lockfile dentro de var, definir VAR_BASE=/VAR/ e executar pnpm build. Copiar var/dist para public/VAR, removendo somente assets antigos gerados, e executar o build normal do Pitch. Não alterar /VAR/sw.js para controlar o restante do site.

Validação: 86 testes existentes do Pitch, 3 de timestamp e 15 do VAR aprovados. Build dos dois frontends aprovado. Teste autenticado com quatro contas temporárias confirmou Realtime, duas câmeras, deduplicação, câmera parada, upload de MP4, recuperação pelo autor, bloqueio de terceiros, prazo e remoção física. Teste do banco usa rollback e não modifica dados reais. Câmera, bateria, voz e rede em dois celulares físicos continuam pendentes. A conferência visual automática foi bloqueada pela ferramenta; não foi usada para validar esta publicação.

Apple Watch não está integrado nesta entrega.
