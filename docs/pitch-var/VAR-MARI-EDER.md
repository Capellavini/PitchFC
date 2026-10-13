# Pitch VAR Mari Eder

Página pública por link direto: https://pitch-fc.com/VARMariEder

Sem login, leitura de sessão Pitch, Matchday ou upload à nuvem. Os lances são salvos por botão/voz no navegador do aparelho; podem ser exportados como MP4 e compartilhados. A galeria local é separada da versão integrada. Quem recebe o link consegue usar a página; não há restrição por pessoa.

Mantém o histórico circular, limites de memória, opções de economia, modo de campo, zoom conforme suporte e pacote offline opcional. Tela desbloqueada e página em primeiro plano durante a captura. Câmera, bateria e voz em aparelhos físicos ainda exigem teste em campo.

Para reconstruir, na pasta var: definir VAR_BASE=/VARMariEder/ e VITE_VAR_PUBLIC=true, instalar dependências pelo lockfile e executar o build. Copiar dist para public/VARMariEder. Para a versão integrada, usar VAR_BASE=/VAR/ e VITE_VAR_PUBLIC=false. Os arquivos já publicados em public/VAR não foram substituídos nesta entrega.

Validação: TypeScript, build público e 15 testes de replay/voz/zoom/integração aprovados. Nenhum acesso visual ao navegador foi usado.
