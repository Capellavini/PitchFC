# Versão de apresentação (`/demo`)

App completa sobre **dados fictícios**, sem login e sem tocar no Supabase — mesmo num build de produção com as chaves. Pensada para reuniões.

## Como abrir

- **Local (pronto já):** duplo clique em `Abrir-Demo.cmd` (ou `npm run demo`). Compila e abre `http://localhost:4180/demo`. No telemóvel: mesmo Wi-Fi + o endereço *Network* que o terminal mostra, com `/demo` no fim.
- **Online:** `https://<domínio>/demo` assim que este código estiver em produção (não está — ver estado do git).
- Qualquer URL com `?demo=1` entra em modo demo; `?demo=0` sai.

## Menu `/demo`

Escolhe o ponto de vista: **Jogador** · **Organizador** · **Equipa (Rivals)** · **Liga**, e o idioma (PT / BR / EN). Dentro da app, o botão **DEMO** (topo, ao centro) troca de persona, repõe dados ou sai.

## O que está povoado

| Área | Dados |
|---|---|
| Grupo "FC Amigos" | 15 jogadores com retratos ilustrados inventados, OVR/atributos, golos, assistências, MVPs, fiabilidade realista |
| Jogo | **Hoje** (daqui a ~2h, máx. 23:30; passa a amanhã se for tarde) com 10/10 confirmados, 3 pendentes, 2 recusas, pagamentos mistos |
| Matchday | Jogável: sortear equipas → confirmar → começar jogo → golos/assistências/defesas → terminar. 9 semanas de histórico |
| Fantasy | Liga do grupo com 6 participantes, #2 com 361 pts, rondas fecham à hora do jogo |
| Home / Social | Feed com vídeo, fotos, comentários, Golo da Semana, votação MVP aberta |
| Rivals | Equipa "FC Amigos" (capitão: Carlão) com 6 jogos oficiais (4V 1E 1D), jogo agendado vs Porto Casual, 2 desafios no inbox; ferramentas de demo para avançar o relógio |
| Liga | Liga Amadora de Matosinhos: 6 equipas, 48 atletas com retrato, jornadas 1–2 jogadas, jornada 3 no próximo sábado; papéis Torcedor / Atleta / Capitão / Gestor |

## Notas técnicas

- `src/lib/presentation.js` decide o modo (flag em `sessionStorage`); `supabase.js` fica desligado e `storage.js` usa o prefixo `pitch.demo.v1.` (nunca mistura com dados reais do mesmo navegador).
- Os dados são relativos a "hoje"; uma vez por dia o armazenamento da demo é limpo e re-semeado (a persona e o idioma mantêm-se). "Repor dados" faz isto a pedido.
- Retratos: `src/lib/demoAvatars.js` (SVG determinístico). Para fotos reais, pôr JPGs em `public/demo/` e apontar `photo` em `src/data.js` (`LOOKS`).
- Rivals: `src/lib/presentationRivals.js` corre as operações reais do demo (desafio → acordo → resultado → confirmação) com datas passadas, para manter invariantes.
- `/demo` é `noindex`; o banner de cookies não aparece em modo demo.
