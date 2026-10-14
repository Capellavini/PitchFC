# Pitch VAR Mari Eder

Página pública por link direto: https://pitch-fc.com/VARMariEder

Sem login, leitura de sessão Pitch, Matchday ou upload à nuvem. Os lances são salvos por botão/voz no navegador do aparelho; podem ser exportados como MP4 e compartilhados. A galeria local é separada da versão integrada. Quem recebe o link consegue usar a página; não há restrição por pessoa.

Mantém o histórico circular, limites de memória, opções de economia, modo de campo, zoom conforme suporte e pacote offline opcional. Tela desbloqueada e página em primeiro plano durante a captura. Câmera, bateria e voz em aparelhos físicos ainda exigem teste em campo.

Para reconstruir, na pasta var: definir VAR_BASE=/VARMariEder/ e VITE_VAR_PUBLIC=true, instalar dependências pelo lockfile e executar o build. Copiar dist para public/VARMariEder. Para a versão integrada, usar VAR_BASE=/VAR/ e VITE_VAR_PUBLIC=false. Os arquivos já publicados em public/VAR não foram substituídos nesta entrega.

Validação: TypeScript, build público e 15 testes de replay/voz/zoom/integração aprovados. Nenhum acesso visual ao navegador foi usado.

Tema de tênis: quadra e bola em SVG estático, identificação Mari & Eder, textos sobre pontos e rallies. A ilustração some no modo de campo, sem animações nem processamento adicional durante a captura.

## Processador de vídeo (ffmpeg) fora do repositório — 2026-10-14

O core ffmpeg (~32 MB) desta versão já não fica em public/VARMariEder/media-core. É servido pelo bucket público `static-assets` do Supabase (migration `20261014100000_static_assets_bucket.sql`: só leitura, sem políticas de escrita):

- https://zfjhdgvdvbqkycjaencz.supabase.co/storage/v1/object/public/static-assets/var-mari/ffmpeg-core.js
- https://zfjhdgvdvbqkycjaencz.supabase.co/storage/v1/object/public/static-assets/var-mari/ffmpeg-core.wasm

Rebuild (PowerShell, na pasta var; no Git Bash usar `MSYS_NO_PATHCONV=1`, senão `/VARMariEder/` vira `C:/Program Files/Git/VARMariEder/`):

```
$env:VAR_BASE='/VARMariEder/'; $env:VITE_VAR_PUBLIC='true'
$env:VITE_FFMPEG_CORE_BASE='https://zfjhdgvdvbqkycjaencz.supabase.co/storage/v1/object/public/static-assets/var-mari/'
pnpm install --frozen-lockfile; pnpm build
```

`VITE_FFMPEG_CORE_BASE` tem de estar no ambiente do shell (não num ficheiro .env): o script prepare-mobile lê-o para não copiar o core e para pôr as URLs remotas no offline-files.json. Sem essa variável o build continua a copiar o core para media-core/, que é o padrão do /VAR integrado (inalterado). Copiar `var/dist` para public/VARMariEder sem recriar media-core/.

Upload manual (uma vez, pelo dono). Os ficheiros são os de `@ffmpeg/core@0.12.10` (`var/node_modules/@ffmpeg/core/dist/esm/`), idênticos aos removidos do repositório. Para os extrair do histórico git para fora do repo (Git Bash ou cmd; não usar `>` do PowerShell 5, que corrompe binários):

```
mkdir C:\Users\capel\Desktop\var-mari-core
git show 5ee5c00:public/VARMariEder/media-core/ffmpeg-core.js   > C:\Users\capel\Desktop\var-mari-core\ffmpeg-core.js
git show 5ee5c00:public/VARMariEder/media-core/ffmpeg-core.wasm > C:\Users\capel\Desktop\var-mari-core\ffmpeg-core.wasm
```

SHA-256 esperado: .wasm `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`; .js `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3`. Depois: aplicar a migration; Supabase Dashboard → Storage → `static-assets` → criar pasta `var-mari` → upload dos dois ficheiros; abrir as duas URLs acima no navegador para confirmar. O pacote offline guarda as cópias remotas em cache (o Storage responde com CORS) e o sw.js serve-as quando não há rede.

Nota: o .wasm continua no histórico git (commits anteriores); só sai das próximas versões/deploys.
