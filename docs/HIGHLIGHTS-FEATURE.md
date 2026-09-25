# Highlights automáticos do jogo — spec técnica (2026-09-25)

Origem: discussão sobre o produto 3DTennis (suporte + controle Bluetooth + app que corta clipes automaticamente). Ver também `docs/STRAVA-AUDIT.md` e a ressalva de 2026-08-03 sobre reconhecimento de golo por vídeo (memória `pitch-strava-roadmap`) — este documento é a versão concreta e buildável dessa ideia, evitando a parte que continua sendo aposta de alto risco (visão computacional).

## O insight central

O PITCH já grava, de graça, o dado mais caro que produtos como o 3DTennis/Veo pagam caro pra inferir por IA: **o minuto exato de cada golo**, capturado por toque ou voz na súmula ao vivo (`Matchday.jsx:202` e `:226`, campo `minute` calculado em `Matchday.jsx:31-33`). Isso remove a necessidade de reconhecimento automático de golo/jogador por vídeo (ver conversa anterior — continua sendo aposta de alto risco/baixo retorno). O gatilho humano já existe e é preciso.

## Desenho em duas fases

**Fase 1 — Lista de cortes (sem vídeo, sem infra nova)**
No fim do live matchday, mostrar/exportar a lista "Golo aos 12' (Carlão), aos 18' (Tiago)…" pra quem filmou o jogo cortar manualmente. Zero custo de infra, zero novo dado — é só UI sobre o que já existe. Ship-first, valida se as pessoas realmente filmam o jogo inteiro antes de investir em automação.

**Fase 2 — Corte automático (upload → clipes prontos)**
1. Alguém filma o jogo inteiro (telemóvel comum, apoiado numa bolsa/tripé — sem hardware do PITCH).
2. Depois do jogo, sobe o vídeo (fluxo parecido com o upload de foto/vídeo que o Social já tem, `SocialTab.jsx` + bucket `social`).
3. O sistema corta um clipe de N segundos ao redor de cada `minute` já registado (ex: 8s antes, 12s depois do golo).
4. Clipes salvos no Storage, um post automático é criado no Social pra cada um (`type: "video"`, creditando o marcador), e o grupo do WhatsApp recebe os clipes automaticamente (ver secção "Bot" abaixo).

### Como cortar o vídeo — duas opções, custo bem diferente

**Opção A — corte no próprio telemóvel (client-side, `ffmpeg.wasm`)**
O corte roda no navegador de quem filmou, usando FFmpeg compilado pra WebAssembly. Como é só recorte por timestamp (`-c copy`, sem recodificar), é leve computacionalmente. **Só os clipes pequenos (poucos MB cada) sobem pro servidor — o vídeo bruto (vários GB) nunca sai do telemóvel.** É a opção mais barata de longe, mas tem risco técnico real: processar um vídeo de 1-2h (vários GB) dentro do WASM do browser em telemóveis médios pode ser lento ou instável (limite de memória do browser). **Precisa de protótipo antes de prometer isto a sério.**

**Opção B — corte no servidor (upload do vídeo bruto)**
Sobe o vídeo inteiro (vários GB), um serviço pequeno com FFmpeg instalado (não dá pra ser Supabase Edge Function — roda Deno, não é feito pra invocar binário de FFmpeg; precisaria de um mini-serviço tipo o `wa-bot/` hoje, um processo Node dedicado, hospedado em Railway/Fly.io) corta os clipes (`-c copy`, rápido, não recodifica) e **apaga o vídeo bruto logo depois** — só os clipes ficam guardados. Mais confiável que a Opção A, mas custa upload de ficheiro grande (precisa de upload resumível/em partes) e um pouco de infraestrutura nova.

**Recomendação:** prototipar a Opção A primeiro (mais barata, reaproveita mais do que já existe); cair pra Opção B só se o WASM não aguentar vídeos longos na prática.

## Bot que envia os clipes pro grupo — sim, dá, reaproveitando o que já existe

A pergunta era: dá pra ter um bot que "puxa" os clipes salvos na nuvem e manda no grupo do WhatsApp? Dá, e o caminho já existe quase todo:

1. Clipe salvo → linha nova numa tabela (`highlight_clips`: game_id, player_id, minute, media_url), igual ao padrão do resto do schema.
2. Um **Database Webhook** na inserção dessa tabela (mesmo padrão do `notify-next` que já existe pra "entraste no jogo", ver `supabase/PUSH-SETUP.md`) avisa o `wa-bot/`.
3. O `wa-bot` (já manda mensagens automáticas pro grupo — lembretes, "abriu vaga", resumo pós-jogo, `wa-bot/src/events.js`) manda o vídeo do clipe direto no chat, com o nome de quem marcou o golo. Baileys já suporta enviar vídeo por URL (`sock.sendMessage(jid, { video: { url }, caption })`), é o mesmo mecanismo que ele já usa pra texto.

Ou seja: não é um bot novo, é **o `wa-bot` que já existe fazendo mais uma coisa** — mesma arquitetura, mesmo processo, só mais um tipo de evento.

## Custo de infraestrutura — ordem de grandeza (a confirmar com o preço atual do Supabase antes de prometer a alguém)

- Vídeo bruto de telemóvel, 1080p, ~1h de jogo: **~3-6 GB** (varia por aparelho/definições).
- Só os clipes (10 golos × ~20s cada, ~20MB cada): **~200MB por jogo** — é isso que fica guardado se o bruto for descartado.
- Corte por `-c copy` (recorte sem recodificar) é leve — segundos de CPU por clipe, não precisa de GPU.
- Com dezenas de grupos usando isto 1×/semana, o crescimento de armazenamento fica na casa de poucos GB/mês — na tabela de preço do Storage da Supabase isso é de baixos dígitos de euros por mês, não uma centena.
- O custo real a vigiar é **egress/banda** (download dos clipes) se o Social crescer muito — ainda assim, clipe pequeno de poucos MB é barato comparado a manter o vídeo bruto todo.

**Conclusão prática:** o custo de infra pra rodar isto é baixo comparado ao valor percebido (highlights automáticos do jogo, sem ninguém editar nada). Dá margem real pra cobrar por isto — mas a decisão de *quanto* e *como* cobrar (feature Premium? por grupo? por jogo?) é terreno do Leo/negócio, não técnico; aqui só confirmo que o custo não inviabiliza.

## Riscos/dependências antes de começar a construir

1. **Validar Fase 1 primeiro** — se ninguém filmar o jogo inteiro mesmo tendo a lista de cortes, a Fase 2 não tem valor nenhum ainda.
2. **Protótipo do `ffmpeg.wasm`** com um vídeo real de ~1h antes de comprometer a Opção A.
3. Upload de ficheiro grande em rede móvel de campo de futebol (Wi-Fi ruim/4G) é o gargalo prático mais chato — vale medir antes de prometer "sobe e pronto".
