# PITCH Ligas — Adjunto (WhatsApp + app), leitura do boletim e Página da Liga

27/10/2026 · Rascunho de desenho, sem código nem migrações. Base: revisão da prévia do GPT (127.0.0.1:5257), análise do Tournify (site público + painel de organizador), anexo `anexo 1.pdf` (boletim AFPCE) e o Adjunto já em produção (`wa-bot/src/adjunto/`, ~3000 linhas, `docs/ADJUNTO-PLAN.md`).

## 0. Princípios (valem para as três partes)

1. **Um só Adjunto.** O Adjunto dos grupos já tem identidade por DM, ciclo de ferramentas, guarda de números (`numbersGrounded`), orçamento, propostas com confirmação e deteção de sessão. O Adjunto das Ligas é o mesmo cérebro com **outro contexto** (ferramentas, snapshot e política), não um segundo produto. O que o GPT preparou (`/api/league-copilot`, `leagueAdjunto.js`) fica como contratos e UI; o motor de conversa é o `runAgentTurn`.
2. **A IA lê, as regras validam, a direção homologa.** Nunca o contrário. A IA nunca escreve registo oficial.
3. **Falha fechada** nas Ligas (o plano dos grupos deixa seguir sem configuração; aqui não).
4. **Tudo o que se diz no chat reflete-se na app** (mesmas tabelas/RPCs). Já é decisão do Adjunto dos grupos.
5. **Números só vêm de ferramentas.** Já é a regra do `agent.js`; passa a incluir licenças e golos lidos de fichas (vêm da extração + conferência, nunca do texto do modelo).

## 1. O anexo (boletim de participantes AFPCE)

**O que é.** Boletim de Participantes, Futebol 11 Escalão Sénior, da Associação Futebol Popular do Concelho de Espinho. Uma página, **em branco**, **digitalizada como imagem** (não é PDF com campos).

**O que lê o Adjunto** (coincide com o mapa do GPT em `afpceBoletim.js`):
- Cabeçalho: época, nome do clube, prova, n.º do jogo, campo, hora, data.
- Resultados: intervalo, final, prolongamento, penáltis (quatro pares).
- Atletas: n.º, nome, licença, colunas **Am · A/V · Vm · Gl(GI?) · SB**; secção separada de **suplentes**.
- Equipa técnica com licença: treinador, delegado ao jogo, delegado/treinador adjunto, massagista.
- Capitão e subcapitão (n.º de licença).
- Observações do árbitro e do delegado ao jogo; carimbo do clube, "tomei conhecimento" do delegado, visto do árbitro.

**Consequências para o produto**
- **Não se pode preencher o PDF por cima**: é uma fotografia. Duas saídas: (a) recriação vetorial A4 fiel, **aprovada pela AFPCE como modelo digital** (é o que o GPT começou; falta a aprovação); (b) a longo prazo, o boletim passa a existir só digital, com impressão opcional.
- **Falta a legenda** das colunas (Am/A/V/Vm/Gl/SB). Não assumir: "SB" pode ser substituído/saiu. Perguntar à AFPCE antes de converter marcas em eventos.
- **Só temos o formulário em branco.** Sem fichas preenchidas não há medição de erro. O pedido mais urgente à AFPCE é um lote autorizado (10–30 fichas reais, anonimizadas se possível).
- É **um clube por boletim**. A reconciliação com o boletim do adversário e com o resultado oficial é uma etapa própria.

## 2. Ler bem (a parte que decide se o produto funciona)

O erro típico de OCR numa ficha é dígito trocado numa licença ou nome mal lido. Não se resolve com um modelo melhor; resolve-se com contexto:

1. **Leitura limitada pelo plantel.** O servidor entrega ao modelo a lista de candidatos (nome + licença + n.º) do clube naquele jogo; o modelo escolhe da lista e só devolve texto livre quando nada encaixa. Uma licença lida que não está no plantel inscrito nunca é aceite sozinha: vira pergunta.
2. **Portão de qualidade antes de gastar tokens** (código, sem IA): fotografia cortada, desfocada, rodada ou escura → o bot responde "tira outra, apanha a folha toda, sem sombra". Poupa custo e frustração.
3. **Leitura por regiões** do modelo conhecido (cabeçalho, tabela de atletas, equipa técnica, observações). Por linha devolve valor, confiança e "ilegível".
4. **Validadores determinísticos** (a parte que dá valor à associação):
   - licença repetida na mesma ficha; n.º de camisola repetido;
   - atleta sem inscrição ou licença no clube/escalão; atleta **suspenso**;
   - mais de 11 efetivos / mais de N suplentes (N a confirmar); sem guarda-redes;
   - capitão/subcapitão que não consta da lista, ou a mesma licença nos dois;
   - delegado ao jogo sem licença; ausência de carimbo, tomada de conhecimento ou visto (assinalar presença visual, nunca autenticar);
   - resultado do boletim ≠ resultado oficial do jogo;
   - boletins dos dois clubes inconsistentes.
5. **Perguntas curtas no WhatsApp**, uma lista numerada: "Li 11 efetivos e 7 suplentes. Dúvidas: *4* nº 10 ou 18? *9* licença termina em 4 ou 9? Responde: 4: 18, 9: 4". Cada resposta cria uma nova versão; só o remetente original confirma (já no desenho do GPT).
6. **Medir antes de prometer**: conjunto de ficheiros de referência, erro por campo (nº, licença, nome, marcas), tempo e custo por ficha. Meta de produto: "a direção corrige em menos de 2 minutos", não "OCR perfeito".

## 3. O Adjunto das Ligas

### 3.1 Um cérebro, três papéis, duas superfícies

| Papel | Quem | O que faz no WhatsApp | O que vê na app |
|---|---|---|---|
| **Direção** | owner/manager da Liga/competição | pergunta pelas pendências, aprova avisos, recebe resumo | Central da Liga |
| **Delegado do clube** | delegado/dirigente com número verificado e **escopo do seu clube** | envia o boletim antes do jogo, recebe validação, vê o seu calendário | Espaço da Equipa |
| **Mesa/árbitro** (fase 2) | número verificado, escopo da competição | envia a ficha final ou resultado provisório | Matchday |

Superfícies: **WhatsApp (DM)** e **chat na app** usam o mesmo `runAgentTurn`, a mesma tabela de mensagens e as mesmas propostas. O chat da app do GPT (Anthropic via `api/league-copilot`) converge para o mesmo núcleo partilhado (`src/lib/core` já é sincronizado para o bot), em vez de duplicar prompt, ferramentas e guardas. Decisão pendente: onde corre o laço do modelo para a app (Vercel Function chamando o núcleo, ou chamada ao bot). Recomendo função Vercel + núcleo partilhado, com a mesma cota por utilizador.

### 3.2 Ferramentas (leitura primeiro, propostas depois)

- Leitura: `liga_pendencias`, `liga_calendario(jornada)`, `liga_classificacao`, `clube_plantel`, `jogo_ficha(estado)`, `suspensos(jornada)`, `fichas_em_falta`.
- Propostas (criam pendente, **a direção confirma**): `pedir_fichas_em_falta` (rascunha a mensagem para cada delegado), `preparar_comunicado(resumo|aviso)`, `reagendar_jogo`, `abrir_ficha_oficial`.
- Ficha: `receber_boletim(foto)` → rascunho versionado → `corrigir(campo)` → `confirmar(versão)` → "pronto para importação" (nunca homologa).

### 3.3 Conversas que vendem o produto

> **Delegado (sexta, 19h):** [foto do boletim]
> **Adjunto:** Recebi o boletim do *Clube X* para *X × Y, sábado 15h*. 11 efetivos, 7 suplentes. ⚠️ Atleta nº 7 (licença …) não está inscrito neste escalão. ⚠️ Capitão nº 4 não consta da lista. Responde "7: …" ou "ok" para a direção ver.
>
> **Direção (segunda, 08:30):** *Resumo da jornada 6*: 7 de 8 jogos com ficha, 1 em falta (*Clube Z*). 2 atletas chegam a suspensão se tiverem amarelo na 7. Queres que eu peça a ficha ao *Clube Z* e prepare o resumo para os clubes? Eu só envio quando confirmares.

Este é o ciclo que o Excel e o Tournify não fazem: **antes do jogo** (validação), **depois do jogo** (ficha lida), **sobre a semana** (pendências e comunicação).

### 3.4 Diferenciadores, por ordem de impacto

1. **Boletim por fotografia no WhatsApp, validado contra o plantel e o regulamento** (§2). Ninguém no segmento amador faz isto.
2. **Pré-validação pelo delegado do clube** antes do jogo, não só leitura depois. Evita o problema em vez de o registar.
3. **Perseguir fichas em falta** com mensagens rascunhadas e aprovadas em um toque.
4. **Regulamento como regras parametrizáveis** (limites de suplentes, suspensões por cartões, descanso), com fonte/artigo citado. O Adjunto avisa; a direção decide. Começar com poucas regras, as que a AFPCE confirmar por escrito.
5. **Comunicados e resumos aprovados** → publicados na página da Liga, no WhatsApp e no cartão partilhável da jornada.
6. **Auditoria total**: quem enviou, que versão, quem confirmou, quem homologou. É o que as associações pedem quando há protestos.

### 3.5 Transporte e risco

- Baileys (já em produção) serve para o piloto, **mas** é não oficial: risco de bloqueio do número. As Ligas são clientes institucionais; recomendo **número separado** do bot dos grupos (para isolar o risco) e planear a **WhatsApp Cloud API** (oficial) antes de comercializar além do piloto. A janela de 24h cobre respostas; avisos proativos a quem não escreveu há mais de 24h exigem modelos aprovados e custo.
- Mídia: guardar a fotografia em armazenamento privado, sem URL pública, com retenção definida; logs sem imagem, sem número completo, sem licença (já no desenho do GPT).
- Dados pessoais, incluindo menores em escalões de formação: a associação é responsável pelo tratamento, a PITCH é subcontratante e a Anthropic subcontratante ulterior. Precisa de acordo de tratamento e revisão jurídica antes de operar com fichas reais.
- Cota e orçamento por Liga, para que um dia de jornada não gaste o mês.

## 4. Página da Liga (a "casa" pública)

**Conceito.** Não é um calendário com cabeçalho. É o ponto central da Liga para clubes, atletas e adeptos: abre num telemóvel, em dia de jogo, e responde em 3 segundos a "o que está a acontecer, quem vai bem e onde me ponho a seguir".

### 4.1 Duas marcas, um só motor

- **PITCH Leagues (marca PITCH):** navy + lima, "Powered by PITCH" visível. Para ligas que querem arrancar já.
- **Marca da Liga (white label):** logótipo, nome curto, cor principal, imagem de capa, texto de abertura, patrocinadores. "Powered by PITCH" fica discreto no rodapé (nunca removível no piloto). **Domínio próprio** é fase posterior.
- Implementação: tokens por Liga (`--brand`, `--on-brand`, `--surface`, logótipo) sobre o tema base. O GPT já tem `LeagueIdentity`, `leagueMonogram` e `safeLeagueLogo`. Acrescentar: cor segura (contraste mínimo calculado, cor de texto automática, recusar cores ilegíveis), capa opcional, e modo claro/escuro que respeita o contraste.

### 4.2 Estrutura (mobile first)

1. **Topo vivo:** próximo jogo / jogo em direto / último resultado, com estado "Oficial" ou "Provisório".
2. **Destaques da jornada** (carrossel curto; ver 4.3).
3. **Classificação** compacta com forma recente (V/E/D) e ligações para as equipas.
4. **Jornada e calendário** com filtro "o meu clube".
5. **Equipas**: página própria (emblema, plantel, calendário, forma, melhor marcador).
6. **Atletas**: cartão PITCH ID (golos, assistências, jogos, cartões) com ligação ao perfil.
7. **Prémios e rankings**: artilheiros, assistentes, melhor ataque/defesa, fair play, MVP oficial (árbitro) **separado** do voto dos adeptos.
8. **Comunicados** aprovados pela direção (vindos do Adjunto) e documentos (regulamento).
9. **Seguir**: escolher equipa/atleta favoritos; receber o resumo e o jogo do fim de semana por WhatsApp ou notificação.
10. **Patrocinadores**: faixa fixa e faixa por jornada (configuráveis; sem anúncios de terceiros).

### 4.3 Motor de destaques (o que torna a página "viva")

Todos calculados **só com dados homologados** (com etiqueta "Oficial"), sem escrever texto inventado:

- **Jogo da jornada** (mais golos / virada / decisão tardia, se houver minutos).
- **Golo da jornada**: escolhido pelos adeptos entre clipes VAR já existentes, com votação (reutiliza o Golo da Semana).
- **Craque da jornada**: regra clara e visível (golos + assistências + vitória), com explicação em uma linha.
- **Artilheiro e líder de assistências**, **melhor defesa** (menos golos sofridos), **equipa em forma**, **revelação** (atleta com mais golos nas primeiras jornadas).
- **Recordes automáticos** ("maior vitória da época", "sequência de 5 vitórias").
- A direção pode **fixar, esconder ou editar a ordem** dos destaques; nunca inventar valores.
- **Cartão partilhável** gerado por jornada (imagem vertical para o Instagram/estado do WhatsApp e imagem de prévia OG para links) para WhatsApp e Instagram, com a marca da Liga.

### 4.4 Adeptos

- Página por equipa e atleta, com ligação direta e prévia de partilha.
- Reação nativa ⚽ Golaço; sem avaliações por estrelas.
- Voto de adepto (Golo/Craque da jornada) **separado** do prémio oficial.
- Fantasy da Liga (já existe `LeagueFantasy`) entra como separador opcional, **não** na primeira versão da página.
- Sem chat próprio, sem DMs, sem feed algorítmico (decisão de visão).

### 4.5 Implementação e privacidade

- Leitura pública via funções que já respeitam visibilidade e chave privada (guarda NULL já corrigida, `20261026090000_league_private_key_guard.sql`).
- **Nada de contactos nem licenças** na página pública; só o que a Liga autorizar. Menores: nomes abreviados e sem fotografia por defeito.
- Dados de destaques calculados no servidor (RPC ou vista), com cache curto; imagens OG geradas no servidor (o repo já tem `middleware.js` e OG para Rivals).
- Medir: visitas por jornada, seguidores por equipa, partilhas do cartão, tempo até ao resultado publicado.

## 5. O que acrescentar ao que o GPT entregou

(ordem sugerida quando assumir, sem alterar o que ele fez sem comparação)

1. **Correções pequenas**: marcadores coerentes com a classificação; estado "Por validar" igual no calendário; "Exportar plantéis" só para direção.
2. **Seed de disciplina** com cartões e uma suspensão que bloqueia a convocatória.
3. **Fluxo linear da Central** (Preparar → Equipas → Formato → Calendário → Jornada → Página) e navegação reduzida.
4. **Campo como entidade** + quadro de calendário por campo + geração automática.
5. **Formato de taça** (grupos/eliminatórias, fase por desempenho).
6. **Motor de destaques + Página da Liga v2** (marca PITCH e marca da Liga).
7. **Adjunto das Ligas no bot**: adaptador de DM → política de operadores → leitura de boletim (roster-constrained) → rascunho → confirmação.
8. **Importar plantéis e calendário do Excel**.
9. **Link da mesa** (resultado provisório) e **Matchday opcional**.

## 6. Decisões para o Vinicius

1. **Número de WhatsApp separado** para o Adjunto das Ligas? (recomendo sim)
2. **Quem recebe o boletim antes do jogo**: só a direção, ou também o delegado de cada clube? (o diferenciador está no delegado)
3. **Marca da Liga**: logótipo, cor e nome curto na v1; domínio próprio fica para depois?
4. **Prémio de adeptos**: entra na v1 da página, ou só resultados e destaques oficiais?
5. **Pedir à AFPCE**: legenda das colunas, n.º máximo de suplentes, escalões/modalidades, lote de fichas reais, acordo de tratamento de dados.
