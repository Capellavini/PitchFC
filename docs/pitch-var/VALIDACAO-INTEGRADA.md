# Validação da integração — 13/10/2026

- 89 testes do Pitch (86 existentes + 3 novos de timestamp) e 15 do VAR aprovados.
- TypeScript e builds do Pitch e VAR aprovados; núcleo compartilhado do bot consistente.
- Teste transacional no banco: duas câmeras, idempotência, câmera parada, isolamento de grupo/usuário e encerramento com prazo de 3h. Rollback preservou dados reais.
- Quatro contas temporárias usadas em teste HTTP autenticado. Realtime recebido; gol encaminhado a duas sessões; duplicatas evitadas; parada bloqueou novos pedidos.
- MP4 de teste de 630392 bytes enviado ao bucket privado; autor recuperou os mesmos 630392 bytes. Terceiros não tiveram acesso; galeria do operador não recebeu gol alheio como próprio.
- Após expiração, listagem/acesso bloqueados. Limpeza sem autenticação retornou 401; limpeza autorizada removeu o objeto. Confirmado zero objetos de teste restantes.
- Contas, grupo e partida temporários removidos após as verificações.
- RLS ativo nas cinco tabelas novas; operações privilegiadas em schema private e wrapper público SECURITY INVOKER, sem acesso anon. Revisão Supabase não apontou avisos novos relativos ao VAR; avisos anteriores do projeto continuam fora desta alteração.
- Conferência visual automática bloqueada porque a ferramenta não confirmou o endereço da janela; nenhuma imagem nova foi usada como evidência desta integração. Câmera/bateria/voz e teste simultâneo em iPhone/Android físicos ainda pendentes.
