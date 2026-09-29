# Redesign v1 — handoff Leo → Cris

Data: 2026-09-29 · Autor: Leo (CMO) · Aprovado visualmente pelo Vinicius em modo demo local.

## Onde está

- Ramo **`redesign/v1`** (local, **sem push**), worktree `.claude/worktrees/redesign`.
- Base: ramo IA de 5 abas (`worktree-agent-a9dffd0e6fee86084`) + `main` fundido em 2026-09-28 (`38fb6de`).
- Diff vs `main`: ~84 ficheiros, +7.2k / −3.0k. **Zero migrações, zero mudanças de schema/RLS/Edge Functions.**
- Spec de design e estrutura: [`docs/REDESIGN-SPEC.md`](./REDESIGN-SPEC.md). Decisões de produto: `CLAUDE.md` → "Decisões de 2026-09-28".

## Como correr

- Demo local (sem `.env.local` no worktree): `node node_modules/vite/bin/vite.js "<worktree>" --port 5190`. `node_modules` do worktree é uma junction para o do repo principal.
- ⚠ Correr a partir da pasta principal usa o `.env.local` de **produção** (cloud mode). Para testar cloud mode, usar um projeto Supabase de staging se possível.

## O que mudou (resumo)

| Área | Mudança |
|---|---|
| Navegação | 5 abas: Home · Jogar · Matchday · Competir · Perfil (EN: Home · Play · Matchday · Compete · Me). Sem Clube (ferramentas admin do Clube em Perfil → ⚙). |
| Aba inicial | Contextual: `matchday` se há jornada ao vivo; `jogar` se tenho presença pendente num jogo desta semana; senão `home`. Calculada uma vez quando os dados ficam prontos (não "puxa" o utilizador depois). |
| Base visual | Tokens `S`/`R`/`T`/`TOUCH` em `theme.js`; novos primitivos `Chip`, `ListRow`, `StatTile`, `FormDots`, `TopBar`, `ScoreBlock`, `BackHeader`; `BtnPrimary/BtnGhost` 48px; `tCtx(ctx, s)` em i18n para traduções por contexto. Novo `C.legend`. |
| Home | 1 card de próxima ação; último resultado (ScoreBlock); **feed único** cronológico com itens automáticos: resultado, desempenho, marco (sequência), Golo da Semana, **pódio**, **conquista**, **LENDA**. |
| Jogar | Jogos \| Grupos. `GameDetail` (plantel, pagamentos, lembretes, material — a checklist de material não era mostrada em lado nenhum antes). `GroupPage`: Plantel · Histórico · Fantasy · Definições. **Fantasy vive no grupo.** Sorteio saiu daqui. |
| Matchday | Motor antes/ao vivo/depois com stepper Equipas · Jogo · Stats. `TeamDraw` (sorteio passou para aqui). Ao vivo: ScoreBlock, cronómetro inline, botões **Golo · Assistência · Defesa · MVP**, toggle **Golo \| Autogolo**, timeline, "Terminar jogo". Depois: resumo, MVP, card partilhável, "Submeter ao Golo da Semana" (abre o composer de post). |
| Matchday · A tua equipa | `OwnTeamCard.jsx` repõe o card "A TUA EQUIPA" de produção no topo do Matchday (antes do jogo e no passo Equipas; faixa compacta no passo Jogo). `TeamDraw` ganhou `hideTeamId`; `teamOverall` passou para `lib/helpers.js`. |
| Fantasy | Polimento visual sem mexer em pontuação/trocas: `FantasyStatsCard` (Selecionados verde/laranja, Banco vermelho só acima do orçamento, Pontos, Posição), sub-vistas A minha equipa · Liga · Mercado, `FantasyPlayerSheet` (capitão/banco num bottom sheet), `FantasyToken`, `FantasyBench`; cores do relvado passaram a tokens em `C`. Trocas não testáveis em demo. |
| Competir | Classificação abre em **Impacto** (+ Golos, Assist., MVP, GR, Forma, Fiabilidade, "Mais"); **Comparar jogadores**; votação MVP; pódio; Golo da Semana. Fórmulas centralizadas em `src/lib/rankings.js`. |
| Perfil | Hero PITCH ID + Resumo/Stats/Conquistas/Calendário; `SettingsScreen` reorganizado; `PeerRatingsCard`; `src/lib/profileStats.js` (forma, recordes, calendário). |
| Removido | **`StatsTab.jsx` apagado** — rankings/comparar → Competir; MVP/pódio → Matchday depois + Competir; cards → Matchday/Home. `ClubeTab` já não está na nav. |

## Mudanças de comportamento a validar

1. **Organizador tem de confirmar equipas antes de "Começar jogo"** (antes podia começar de um rascunho).
2. Durante o jogo ao vivo, o organizador pode mover/renomear jogadores mas **não re-sortear** (`lockDraw`).
3. Autogolo: lista os jogadores da equipa adversária; armazenamento do own-goal **inalterado**; não conta como golo do jogador.
4. "Votar MVP" na Home: em dia de jogo abre a votação na Competir; senão Matchday (depois).
5. **Golo da Semana** = posts de vídeo do grupo dos últimos 7 dias ordenados por ⚽ Golaço (o Golaço é o voto). Sem tabela nova. A votação antiga tinha sido removida em junho.
6. Fiabilidade %: divide pelo máximo entre jogos registados e o `gamesPlayed` mais alto do grupo (antes dava 100% a todos na demo).

## Pontos técnicos para o Cris decidir

- **Itens automáticos do feed não são persistidos** — calculados no cliente em `src/lib/homeFeed.js` a partir das jornadas. Para comentários em itens automáticos e push ("hat-trick do Joãozão"), é preciso uma tabela de atividade (brief §14).
- **Golaço partilhado:** nos cards de conquista/LENDA, o Golaço usa a mesma linha `kudos` do card de desempenho daquela noite → contagem partilhada em cloud. Aceitável para v1 ou separar por `kind`?
- **Datas de conquistas** derivadas por replay do histórico; "Fiel", "Liderança" e "Bem-visto" não são datáveis e não aparecem no feed. LENDA em cloud usa a data da avaliação mais recente.
- Demo: `src/lib/demoSeed.js` gera 9 jornadas relativas à data atual (não persistidas) + posts + liga Fantasy mock; `data.js` teve totais e avaliações (Joãozão OVR 87) ajustados. Só afeta local demo mode — confirmar que nada disto vaza para cloud.
- Vídeos demo usam um clip de amostra da MDN (precisa de internet).
- `SettingsScreen.jsx` tem um helper `Group` não exportado no mesmo ficheiro (exceção à regra de um componente por ficheiro).
- `.claude/launch.json` tem a config local `pitch-redesign` — não entra em commit.
- Conflito previsível com o ramo Teams/Challenges (`worktree-agent-afcf9e49…`): ambos tinham `SegmentedControl.jsx`; aqui foi reescrito como primitivo. Equipas/Desafios entram na Competir atrás das flags `teams`/`challenges`.

## Checklist de teste em cloud mode (não feito — só demo foi testado)

- [ ] Login, convite `?join=`, onboarding rápido → aba inicial contextual certa
- [ ] Link mágico `?confirm=` continua a abrir o Jogo certo
- [ ] Grelha realtime + confirmar/recusar + MB Way toggle no novo `JogoTab`/`GameDetail`
- [ ] Matchday cloud: sorteio sincroniza em `games.teams`, jogo ao vivo em `games.live_matchday`, read-only para não-organizadores, Autogolo grava igual
- [ ] Terminar jogo → stats da época, histórico, MVP
- [ ] Competir com dados reais (Impacto/GR/Forma batem com os valores antigos do StatsTab)
- [ ] Feed: posts reais, amigos, Golaço em itens automáticos (kudos), Golo da Semana
- [ ] Fantasy dentro do grupo (utilizador com `canSeeFantasy`)
- [ ] Perfil próprio vs de outro jogador; avaliações de pares; definições; admin Clube em ⚙
- [ ] EN + PT-PT; tema claro
- [ ] Performance: bundle (aviso de chunk já existia)

## Sugestão de sequência

1. Revisão de código do ramo.
2. Teste cloud (idealmente staging) com a checklist acima.
3. Merge em `main` fora de sábado (dia de jogo).
