# Strava — auditoria funcional e equivalência pro PITCH

Levantamento feito navegando o Strava de verdade (conta logada do Vinicius, 22 atividades reais, PT-PT) em 2026-09-25. Objetivo: entender o que o Strava realmente é, função por função, e onde isso se traduz (ou não) em algo aproveitável pro PITCH. Complementa o roadmap "Strava do futebol" de 2026-08-03 (`pitch-strava-roadmap` na memória) — aquele foi opinião sem ver o produto de perto; este é o produto de perto.

## 0. Achado mais importante: Strava não tem nada de futebol

Testei isso na prática: abri uma atividade logada como **"Futebol"** (tipo de esporte existe no Strava — está na lista junto com Basquete, Vôlei, Padel etc.). A página da atividade mostra exatamente os mesmos campos de uma corrida: distância (3,68 km), tempo (21:31), ritmo (5:50/km), elevação, mapa GPS, calorias, segmentos ("Não Há Segmentos Nesta Atividade"), kudos, comentários. **Zero golos, zero assistências, zero placar, zero MVP, zero "quem jogou".** O Strava trata "jogar futebol" como "correr com bola" — é rastreamento de GPS genérico, não um produto de futebol.

Fui mais longe: procurei clubes com "futebol" no nome (`strava.com/clubs/search?text=futebol`) — existem, mas são pequenos (1 a 26 membros) e o maior que testei, "Futebol Clube Aliviada" (Marco de Canaveses), é na verdade um **clube de ciclismo de torcedores de um time de futebol** — segue ciclistas, não jogadores. Confirma: não existe comunidade de futebol de verdade dentro do Strava.

**Conclusão prática:** o PITCH não compete com o Strava — ocupa um espaço que ele nem tenta preencher. Isso muda a pergunta de "o que copiar do Strava" pra "que padrões de UX/engajamento genéricos do Strava fazem sentido aplicados ao nosso domínio (que ele não tem)".

## 1. Estrutura de navegação

`Painel` (feed) · `Treinamento` (log + calendário) · `Mapas` (heatmap + criador de rotas) · `Desafios` · `Dê um presente` · `Iniciar teste` (upsell assinatura) · `Carregar` (upload manual de atividade) · Perfil (avatar, menu).

## 2. A atividade individual = o "post" do Strava

Campos: distância, tempo em movimento, ritmo médio, elevação, calorias, tempo decorrido, mapa (padrão/satélite/híbrido), segmentos percorridos nessa rota. Ações: editar, excluir, compartilhar, **"Adicionar amigos"** (marcar quem também estava lá mas não gravou — não tem conta ou esqueceu o relógio), incorporar em blog, kudos (👍 binário), comentários.

Isso é essencialmente o post do Social do PITCH (`docs/SOCIAL-STATE.md`), mas **auto-gerado a partir de dados de GPS**, não escrito manualmente. O usuário do Strava não "publica"; ele grava e o Strava publica por ele. Isso é o oposto do PITCH, onde tudo no Social é composição manual (texto/foto/vídeo).

**Ideia aproveitável:** "Adicionar amigos que não gravaram" resolve exatamente o problema que o PITCH tem com jogadores convidados que não estão na app — vale olhar se cabe algo parecido no fluxo de súmula (marcar "jogou mas não tem conta" num Matchday).

## 3. Perfil do atleta

- **Capa**: colagem automática das fotos mais recentes das atividades (não é uma foto de capa escolhida).
- **Calendário de 4 semanas**: uma linha de bolinhas por dia, coloridas por esporte (corrida/ciclismo/natação/outros), clicável.
- **Tabs**: Visão geral · Coleção de troféus · Seguindo · KOMs/CRs/Top 10 · Local Legends · Publicações.
- **Coleção de troféus**: vazio até completar um Desafio (ver seção 5) — não são conquistas automáticas do dia a dia, são medalhas de campanhas específicas.
- **Melhores marcas**: recordes pessoais auto-detectados por tipo de esforço (ex: "Pedalada mais longa 14,8 km", "5 milhas 33:39") — calculados sozinhos a partir do histórico, sem o usuário "registar" nada.
- **Totais**: atividades / distância / elevação / tempo — ano corrente e "totais" (carreira inteira).
- **KOMs/CRs/Top 10**: ranking de posição em segmentos de GPS (trechos de rota com nome, tipo "quem é mais rápido nesse pedaço de estrada específico"). Território competitivo geográfico.
- **Comparação lado a lado**: comparar as próprias estatísticas com as de outro atleta.
- **Estatísticas sociais**: "Seguindo 4 / Seguidores 3" — contadores simples, sem lista de amizades bilaterais.

## 4. Seguir ≠ Amigo (diferença estrutural do PITCH)

O Strava usa **follow assimétrico** (tipo Instagram/Twitter): eu sigo alguém sem ele aceitar, meu feed mostra atividades de quem sigo. O PITCH usa **amizade simétrica com pedido/aceite** (`friendships`, ver `SOCIAL-STATE.md`). São modelos de produto diferentes — Strava otimiza para "acompanhar atletas que admiro" (inclusive gente que não te conhece), o PITCH otimiza para "grupo fechado de amigos reais". Não recomendo copiar o modelo assimétrico — ele resolveria um problema que o PITCH não tem (descoberta de estranhos), e complicaria a UI de amigos que já existe.

## 5. Desafios (Challenges)

Testei ao vivo: a lista veio **vazia** pra essa conta (`strava.com/challenges` sem nenhum desafio ativo/disponível). Pelo que a "Coleção de troféus" descreve, o conceito é: campanhas com prazo (normalmente mensais, com patrocínio de marca — ex: "corra 50km em setembro"), completar = ganha medalha digital que fica no perfil pra sempre. É a mecânica de gamificação de **prazo fixo + objetivo quantitativo**, separada da competição do dia a dia.

**Equivalência pro PITCH:** isso é literalmente o espaço do **Golo da Semana**, que documentei como morto no código (`SOCIAL-STATE.md`, secção 6) — e também abre espaço pra "desafios do mês" tipo "grupo com mais jogos seguidos sem faltar" ou "mais assiduidade no trimestre", como evento com prazo e medalha, separado do ranking contínuo de Stats.

## 6. Clubes — o achado com aproveitamento mais direto

Abri o clube "Futebol Clube Aliviada" (26 membros) e a página de classificação tem exatamente esta estrutura:

**Líderes da semana passada** — 3 mini-pódios lado a lado, um por categoria (Distância / Pedalada mais longa / Subida), cada um mostrando 1º/2º/3º lugar com nome e número.

**Classificação desta semana** — tabela completa ranqueada: Atleta | Distância | Pedaladas | Mais longa | Velocidade média | Ganho de elevação. Reseta toda semana.

Outros elementos: tabs (Classificação do clube / Atividade recente / Membros / Publicações), "Convidar atletas", contador de membros com preview de avatares, widget de compartilhamento.

**Isso é diretamente aproveitável pro Stats do PITCH.** Hoje o ranking do PITCH é um único score "Impacto" (`docs/SOCIAL-STATE.md` menciona o padrão, ver `StatsTab.jsx`). O padrão do Strava — **vários mini-pódios por categoria, lado a lado, resetando toda semana** — mapeia direto pro futebol: "mais golos da semana", "mais assistências da semana", "melhor aproveitamento da semana", cada um com seu próprio pódio de 3, ao lado do ranking geral de temporada que já existe. Reforça o hábito semanal (bate com o Princípio 5 do CLAUDE.md: "Stats create retention").

## 7. Monetização — Strava não trava conteúdo, trava análise/competição

Tabela grátis vs pago (`strava.com/subscribe`):

| Grátis | Assinatura (€4,17/mês anual, ou €1,87/mês plano família 4 contas) |
|---|---|
| Gravar atividades | Rotas offline + criar próprias rotas |
| Comunidade (kudos/comentários/seguir) | Análise avançada de treino |
| Recursos de segurança | Metas personalizadas com monitoramento |
| Rotas sugeridas (só ver) | **Classificações de segmento (competir)** |
| Histórico de treino | **Participar/criar Desafios com amigos** |
|  | Pontuação de fitness ao longo do tempo |

Reparo: o **kudos, comentário, feed e seguir são todos grátis** — o Strava nunca cobra pela camada social básica, só pela análise/competição avançada. Isso é coerente com onde o PITCH devia mirar se algum dia cobrar por algo: não trancar confirmação/pagamento/stats básicos (que resolvem a dor #1), e sim eventuais analytics avançados ou features de clube/liga maiores (bate com "Long-term vision" do CLAUDE.md — SaaS pra operador de campo, não pro jogador comum).

## 8. Resumo — o que vale trazer pro PITCH

| Do Strava | Pro PITCH | Prioridade |
|---|---|---|
| Mini-pódios por categoria + tabela semanal no clube | Stats: "líderes da semana" (golos/assistências/aproveitamento) ao lado do ranking de temporada | Alta — reforça hábito semanal, dado já existe |
| Desafios com prazo → medalha | Reviver Golo da Semana como "desafio" com prazo, ou criar desafios de assiduidade mensal | Média — conecta com gap já documentado |
| "Adicionar amigos que não gravaram" | Marcar na súmula quem jogou mas não tem conta PITCH | Baixa/Média — nicho, mas resolve fricção real de convidados |
| Follow assimétrico | **Não copiar** — amizade simétrica do PITCH já serve melhor o caso de grupo fechado | — |
| Segmentos/KOM (território geográfico) | Não se aplica — futebol não tem "trechos de rota" | — |
| Rotas/heatmap/mapas | Não se aplica ao caso de uso (jogo é sempre no mesmo campo) | — |
| Modelo de monetização (social grátis, análise paga) | Referência pra quando o PITCH pensar em cobrar algo — não travar o que resolve a dor #1 | Futuro |

## 9. Pergunta em aberto

O achado da secção 0 muda a moldura da discussão: a pergunta não é mais "como o PITCH vira o Strava do futebol" (não existe um Strava do futebol pra copiar), é **"quais padrões de gamificação semanal genéricos, testados em escala pelo Strava, fazem sentido aplicados a um domínio que ele nunca tentou"**. Vale levar isso pro GPT junto com o `SOCIAL-STATE.md` — as duas conversas se conectam: o Golo da Semana morto (Social) e o padrão de Desafio do Strava (aqui) são a mesma peça faltando.
