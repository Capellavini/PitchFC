# PITCH Ligas — alvo (apresentação) vs plataforma, e plano A + B

28/10/2026. Base: os comentários do Vinicius em `leagues.pptx` (10 diapositivos, capturas da conta `vini@pitch-fc.com`) e a apresentação AFPCE como alvo.

## 1. Porque a plataforma e a apresentação eram tão diferentes

Eram duas interfaces. A apresentação mostra a **app nova** (Painel, Gerir, Adjunto), que só guardava dados no browser. Uma conta real entrava nas **telas antigas** ligadas à base de dados. A app nova nunca esteve ligada à conta.

Este PR liga as duas (**opção A, a ponte**): a conta de uma liga passa a abrir a app nova, com a liga guardada na nuvem.

## 2. Os 10 comentários

| # | Comentário | Estado |
|---|---|---|
| 1 | Onboarding com o Adjunto a fazer perguntas e a liga a formar-se com as respostas (ou estilo Tournify) | **Feito** — fluxo único guiado, ver §3 |
| 2 | Eliminar o pedido de piloto, criação direta | **Feito para contas de liga** — a conta nova abre o onboarding e cria a liga sem aprovação. O cartão de pedido só existe nas telas antigas (hub do admin) |
| 3–4 | Chat de boas-vindas proativo | **Feito** (fluxo guiado, perguntas fixas). Conversa livre com IA depende de `ANTHROPIC_API_KEY` |
| 5 | Barra de rolagem feia; design em geral; "Rascunho" sem sentido | **Barra: feito** (escura e fina, em toda a app). **"Rascunho" desaparece** com as telas antigas. **Design em geral: pendente** (o Vinicius pede ajuda ao GPT; ver §5) |
| 6 | Faltam logos e fluidez | **Logo da liga: feito** (upload, aparece no cabeçalho e no menu). **Logos das equipas: pendente** (a função existe, falta o ecrã) |
| 7 | Terminar a criação da liga antes de mudar de ecrã | **Feito** — tudo no mesmo fluxo, sem saltar para outras páginas |
| 8–9 | Upload de imagem em vez de https; cor da liga tirada do logo | **Feito** (a cor sai dos pixels do logo; ajustável) |
| 10 | Calendário por upload (manual ou Excel) dentro do onboarding | **Feito** — Excel `.xlsx` e CSV, com pré-visualização e linhas rejeitadas explicadas; ou gerar jornadas automaticamente |

Também pedido por Excel: **equipas e plantéis** (colunas Equipa · Nome · Número · Posição).

## 3. O que passa a existir (este PR)

- **Ponte (A):** tabela `league_workspaces` (um documento por conta, versão otimista, só acessível por funções) + `league_workspace_get/save/set_published/public`. Guarda sozinha ao fim de 0,8 s; se a liga mudar noutro dispositivo, **para e avisa** em vez de apagar.
- **Página pública `/l/<slug>`:** só depois de a direção a publicar (Gerir → Liga → Página pública). Mostra calendário, resultados, classificação e plantéis só com nome e número. Sem contactos, sem Fantasy.
- **Onboarding guiado:** nome e cidade → logótipo (cor automática) → competições (percebe taças) → equipas (texto, Excel/CSV, ou reutilizar) → plantéis (Excel/CSV) → calendário (Excel/CSV ou gerar). Cada resposta fica guardada; "Saltar e configurar depois" entrega o resto a Gerir.
- **Leitor de Excel sem dependências** (`.xlsx` lê datas e horas; `.xls` antigo pede para gravar como `.xlsx`).
- **Conta de liga em modo real:** sem "Demo", sem "Ver como", sem "Apagar a liga"; indicador "Guardado / A guardar / Sem ligação / Conflito".

## 4. Opção B (ligação à base relacional)

A base relacional (`leagues`, `competitions`, `competition_teams`, `team_matches`, eventos, homologação, disciplina, classificação) já existe e está em produção. A ponte guarda **o mesmo estado** num documento; a B é traduzi-lo para essas tabelas. Faz-se por fatias, cada uma com testes e sem tirar o que a ponte já faz:

| Fatia | O que muda | Porquê nesta ordem |
|---|---|---|
| B1 | Identidade, competições, equipas e plantéis → `leagues`, `competitions`, `competition_teams`, `competition_squad_*` | É o que o Excel importa e o que dá página pública relacional |
| B2 | Calendário → `competition_matches` (`create_fixtures`, `schedule_match`) | Substitui a lista de jogos do documento |
| B3 | Resultados e lances → `record_match_event`, `set_match_phase`, `homologate_match` | Dá o registo imutável e a homologação auditada |
| B4 | Disciplina e classificação → leitura de `competition_standings`, `competition_discipline` | Fica o servidor como fonte única dos números oficiais |
| B5 | Convites e papéis (dono, gestor, mesa) | Várias pessoas na mesma liga |

Até cada fatia chegar, a ponte continua a ser a fonte; a migração de uma liga é um passo explícito (copiar o documento para as tabelas), nunca automático.

**Honestidade sobre prazos:** a ponte (A) é o que dá uma liga utilizável. A B é trabalho de semanas e só vale a pena quando houver uma época a correr.

## 5. O que ainda falta (por ordem)

1. **Ativar o serviço:** fundir este PR e o do Adjunto (a migração corre pela CI), e pôr `ANTHROPIC_API_KEY` + `LEAGUE_COPILOT_ENABLED=true` na Vercel.
2. **Teste ponta a ponta com uma conta real** (criar conta em `/league/entrar`, montar a liga, recarregar noutro dispositivo, publicar `/l/<slug>`). Não foi feito: a migração ainda não está em produção, e criar contas de teste lá precisa do teu OK.
3. **Logos das equipas** (ecrã de upload por equipa; mostrar nas tabelas e na página pública).
4. **Design:** passar o desenho para o GPT como o Vinicius sugeriu; este PR não mexe na estética geral.
5. **Conflitos entre dispositivos:** hoje avisa e pede para recarregar; falta mostrar o que mudou.
6. **Papéis e convites** (vários operadores; capitães/atletas) — só existem como demonstração. Para a AFPCE no 1.º ano (direção opera sozinha) não bloqueia.
7. **EN:** os textos novos estão em PT-PT; a tradução inglesa fica por fazer.
8. **WhatsApp do Adjunto:** continua em plano (ver `docs/ADJUNTO-LIGAS-PLANO.md`); precisa da liga na nuvem — agora existe.

## 6. Segunda ronda de comentários (28/10, `leagues.pptx` v2) e súmula

| # | Comentário | Estado |
|---|---|---|
| 5 | **MUITO IMPORTANTE:** botão para só lançar o resultado; no Painel, resultado pendente depois do jogo passar; botão «subir súmula» com o Adjunto a ler foto/PDF; ligado ao WhatsApp | **Feito na app**: «Só lançar resultado» e «Subir súmula» na ficha do jogo; «Resultado em falta» no Painel (2 h depois do apito inicial); o Adjunto propõe o resultado (marcadores, cartões, quem jogou) e a direção confirma. **WhatsApp: próximo PR** |
| 1 | Atletas com email, telefone e data de nascimento (separar jovens e veteranos; email/telefone criam conta de jogador ligada à equipa) | Pendente. Mexe em privacidade (menores) e em convites; precisa de decisão sobre o consentimento |
| 2 | Menu «outras opções» maior ou campo aberto (modalidade, escalão) | Pendente, pequeno |
| 3 | Zona para o organizador escrever o regulamento | Pendente. O regulamento hoje é só de leitura |
| 4 | Calendário como o Tournify: arrastar e largar, modelos de confrontos, fases das taças (oitavos, quartos, meias), nome do campo, previsão do tempo | Pendente, é o maior. Nome do campo já existe; fases das taças existem como «nome da fase» |
| 6 | Fase de grupos das taças, para gerar confrontos automaticamente | Pendente (grupos + cruzamento para o quadro final) |
| 7 | Página com todas as equipas da liga (golos, jogos, forma VVDVVD); botões «convidar equipa» e «convidar atleta» | Pendente. Convites existem no backend relacional (B5) |

### A súmula da AFPCE
A folha é o **Boletim de Participantes (futebol 11, séniores)**, de **um clube**: efetivos e suplentes com número, nome, licença e as colunas **Am · A/V · Vm · Gl · SB**, resultado ao intervalo / final / prolongamento / penáltis, capitão, equipa técnica, observações do árbitro e do delegado, carimbo e assinaturas. O Adjunto lê-a assim:

- **Am** = amarelo; **A/V** = segundo amarelo (vira vermelho); **Vm** = vermelho direto; **Gl** = golos do atleta. **SB** não está confirmado e é ignorado.
- Quem aparece na folha conta como «jogou» (alimenta a convocatória).
- O resultado fica **provisório** e a homologação é sempre da direção.
- **Por confirmar com a AFPCE:** o que significa SB, e se os dois números do resultado são «casa/fora» pela ordem impressa. Enquanto não se souber, o Adjunto pergunta em vez de adivinhar.

### Frases livres
«O Porto FC jogou hoje com o Corinthians, terminou 2x0, dois golos do Vini e amarelo ao Barto» vira uma proposta de resultado: o sistema (não o modelo) resolve as equipas, o jogo e os atletas; se o nome for ambíguo ou não existir, diz porquê. Sem marcadores, os golos ficam registados «sem marcador». Um autogolo conta para a outra equipa.

### WhatsApp (próximo PR)
Mesmo número do piloto. Fluxo: a direção gera um código na app («Ligar WhatsApp»), envia-o ao bot, e a partir daí o bot trata das mensagens e fotos dessa pessoa como o chat da app: lê, mostra o resumo e só aplica com «sim». O bot continua a correr só quando alguém o arranca num computador (ver `CLAUDE.md`), por isso «sempre ligado» exige alojá-lo.
