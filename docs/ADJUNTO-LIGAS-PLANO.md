# Adjunto das Ligas · chat com documentos, WhatsApp e plano de envios

28/10/2026. Plano e primeira entrega. Complementa `docs/ADJUNTO-LIGAS-WHATSAPP-MATCHDAY.md` (transporte e política de acesso) e reaproveita o Adjunto dos grupos semanais (`wa-bot/src/adjunto/`, `docs/ADJUNTO-PLAN.md`).

## 1. A ideia numa frase

Um único Adjunto, dois canais (a app e o WhatsApp). O gestor escreve frases livres ou manda documentos; o Adjunto responde, leva-o ao ecrã certo ou **prepara propostas** (equipas, plantéis, calendário, mudar um jogo, comunicados, módulos). Nada entra na liga sem o gestor confirmar. As propostas são as mesmas nos dois canais: um catálogo, uma validação, uma aplicação.

## 2. O que fica feito neste PR (chat na app)

| Peça | Onde | O que faz |
|---|---|---|
| Catálogo de propostas | `src/lib/leagueAdjuntoActions.js` | 10 propostas: nome da liga, competição, equipa, plantel, capitão, calendário, jogo avulso, mudar jogo, comunicado, módulo. Os nomes (equipa, atleta, jogo) são resolvidos **em código**, nunca pelo modelo; ambíguo ou desconhecido = erro legível, nunca palpite. |
| Lote com pré-visualização | `prepareBatch` | Corre as propostas por ordem numa cópia da liga. Cada linha sai ✓ ou ✗ com o motivo; o que falha não bloqueia o resto. Aplicar = a mesma função sobre o estado atual. |
| Contexto para o modelo | `adjuntoContext` | Estrutura e contagens da liga. **Sem nomes de atletas**, contactos ou licenças. |
| Privacidade | `leagueAdjuntoPrivacy.js` | Emails, telefones, NIF/licenças e sequências de 6+ dígitos são mascarados no browser **e** no servidor antes de irem ao modelo. Datas e horas ficam. |
| Pedido e resposta | `leagueAdjuntoRequest.js` | Limites (12 mensagens, 3 documentos, 2,4 MB, 40 000 caracteres de texto), verificação de tipo real de imagem/PDF, ferramentas do modelo, leitura da resposta (ferramentas desconhecidas são descartadas). |
| Servidor | `api/league-adjunto.js` | Sessão do utilizador + cota diária (40 chamadas/utilizador/dia, função `league_adjunto_take_slot`) + chamada à Anthropic. Não escreve nada: devolve propostas. |
| Chat | `LeagueAdjunto.jsx` | Conversa, anexar documentos (PDF, JPG, PNG, WebP, CSV, TXT), cartão de proposta com Aplicar/Descartar, fallback guiado se a IA não estiver ativa. |

Documentos que o chat lê: calendário em PDF ou foto, plantéis em CSV/TXT/PDF/foto, regulamento, ficha de jogo. Excel (`.xlsx`) tem de ser exportado para CSV ou PDF; ler `.xlsx` diretamente fica para depois.

### Para ligar a IA (do teu lado)

1. Vercel → Environment Variables: `ANTHROPIC_API_KEY` e `LEAGUE_COPILOT_ENABLED=true` (a mesma chave do Adjunto dos grupos serve; o interruptor é o mesmo do copiloto antigo).
2. Opcional: `LEAGUE_ADJUNTO_MODEL` (por defeito `claude-sonnet-5-5`; `claude-haiku-4-5` baixa o custo, lê pior documentos difíceis).
3. A migração `20261028190000_league_adjunto_quota.sql` sai com o merge pelo CI. Sem ela, o chat cai no modo guiado (a cota falha fechada).

Custo de referência (Sonnet): uma conversa com um PDF de calendário ou um plantel de 15 atletas fica na ordem de cêntimos; o teto de 40 chamadas/dia limita o pior caso por conta.

### Limite assumido

As alterações aplicadas pelo chat **ficam no browser**, como tudo o resto da plataforma, até existir persistência na nuvem (secção 4). O chat funciona, mas não há ainda "a liga" num sítio que o WhatsApp consiga ler.

## 3. WhatsApp: o mesmo Adjunto, no telemóvel do gestor

### Como funciona (reaproveita o que existe)

- **Identidade.** Só responde a DMs de números verificados ligados a um papel owner/manager da liga (política de `ADJUNTO-LIGAS-WHATSAPP-MATCHDAY.md`). Outros números: silêncio. Vinculação por código de uso único gerado na app, enviado ao bot a partir do número pretendido. O router de DMs, o silêncio para desconhecidos, o orçamento diário/mensal e o `#n` + "sim/não" para confirmar propostas já existem em `wa-bot/src/adjunto/` e passam a ter um segundo "domínio": ligas.
- **Conversa.** Frase livre → o mesmo modelo, o mesmo catálogo de propostas. O bot responde com a lista ✓/✗ e pergunta "Aplico? Responde *sim #12* ou *não #12*". "Sim" solto nunca aprova a proposta anterior implicitamente.
- **Documentos.** Foto, PDF ou ficheiro CSV enviado em DM é descarregado, passa pelas mesmas regras de privacidade e tamanho, e devolve uma proposta. Fichas de jogo seguem o fluxo de rascunho versionado já desenhado (só quem enviou confirma; confirmar gera rascunho pronto para importação, nunca resultado homologado).
- **Falha fechada.** Sem configuração, sem cota, sem vínculo ou sem liga na nuvem: o bot diz uma frase e não faz nada.

### O que o Adjunto pode enviar (catálogo proativo)

Princípio: **a direção recebe o que lhe exige decisão; capitães recebem o que lhes pede ação; atletas e adeptos só recebem o que pediram.** Tudo respeita horas de silêncio (23:00–09:00), máximo de 3 mensagens não urgentes por pessoa por dia (juntam-se num resumo), e dedupe por chave para um reinício nunca repetir.

**Direção (gestor, owner/manager)**

| Mensagem | Gatilho | Quando | Urgente |
|---|---|---|---|
| Resultados por homologar | Jogo terminou e há ficha/resultado provisório por homologar | 2 h depois do fim; repete na manhã seguinte e ao fim de 48 h | não |
| Jogo sem ficha | Passaram 3 h do início previsto e não há resultado | uma vez, com botão para abrir o jogo | sim |
| Contestação à espera | Há contestação aberta | à hora, e lembrete às 24 h | sim |
| Convocatórias em falta | Faltam convocatórias a 24 h do jogo | T-24 h, lista de equipas | não |
| Atleta suspenso numa convocatória | Convocatória inclui atleta com castigo por cumprir | assim que acontece | sim |
| Conflito de calendário | Dois jogos no mesmo campo e hora | na criação, e T-72 h | não |
| Jogo alterado confirmado | Gestor aplicou "mudar jogo" | logo, com texto pronto a reencaminhar às equipas | não |
| Resumo da jornada | Todas as fichas da jornada homologadas | no momento, com texto de partilha | não |
| Semana da liga | Resumo de segunda-feira: jogos da semana, pendências, suspensões | segunda 09:00 | não |
| Tudo montado? | 24 h depois de criar a liga, passos em falta | uma vez | não |

**Capitães** (só depois de a direção ligar o número da equipa; opt-in da equipa)

| Mensagem | Gatilho | Quando |
|---|---|---|
| Lembrete de jogo | Jogo da sua equipa | T-48 h e T-3 h |
| Convocatória por enviar | Falta a da sua equipa | T-24 h e T-6 h |
| Resultado para conferir | Resultado provisório do seu jogo | no momento |
| Decisão sobre contestação | Direção decidiu | no momento |

**Atletas e adeptos** (opt-in explícito; "PARAR" desliga tudo; nunca por defeito)

| Mensagem | Módulo | Gatilho |
|---|---|---|
| Jogo amanhã / hoje | Área do adepto | equipa seguida, T-24 h e manhã do jogo |
| Resultado final | Área do adepto | jogo da equipa seguida homologado |
| Estás suspenso no próximo jogo | núcleo | atleta com castigo por cumprir |
| Votação de craque aberta / fecha em 1 h | Voto dos adeptos | jogo terminado; T-1 h do fecho |

**Fantasy** (módulo ligado e opt-in)

| Mensagem | Gatilho |
|---|---|
| Jornada aberta: monta a tua equipa | abertura da jornada |
| Fecha em 24 h / em 1 h, ainda não escolheste | equipa por fazer ou incompleta |
| Pontos da jornada | jornada homologada: pontos, posição, melhor jogador |
| Aviso de lesão/suspensão no teu onze | atleta da tua equipa suspenso ou sem convocatória |

### Regras e riscos do transporte

- **Baileys (não oficial)**, usado nos grupos semanais, serve para o piloto com gestores: mensagens livres, sem templates. Risco conhecido: o número pode ser bloqueado e não há garantias de entrega. Não é caminho para atletas e adeptos em volume.
- **WhatsApp Cloud API (oficial)**: necessário para escala e para mensagens a atletas/adeptos. Fora da janela de 24 h desde a última mensagem da pessoa só se envia **template aprovado** (ex.: "lembrete de jogo", "resultado", "jornada Fantasy"). Isto obriga a desenhar os textos acima como templates curtos com variáveis. A opção decide-se antes da Fase 4.
- **Consentimento (RGPD).** Direção e capitães: vinculação explícita. Atletas e adeptos: opt-in registado (quando, como), "PARAR" imediato, sem dar o número a terceiros. A direção não importa números de atletas sem base legal clara; começar só com quem se inscreve.
- **Número separado.** A Liga é um produto à parte. Usar o número do bot dos grupos semanais mistura marcas e mensagens. Recomenda-se um número próprio para as Ligas.

## 4. Dependência que decide o calendário: a liga na nuvem

O WhatsApp só serve se o bot lê e escreve **a mesma liga** que a app. Hoje a liga montada em Gerir vive no browser. Duas saídas:

**A. Ponte rápida (recomendada para o piloto).** Tabela `league_workspaces` com um documento por liga (`state jsonb`, `version`, dono, RLS por dono/gestores). A app carrega e guarda com versão (conflito = recarregar). O bot (service role) lê o documento, aplica **o mesmo catálogo de propostas** (módulo partilhado via `scripts/sync-core.mjs`, como o núcleo atual) e grava com a versão. Tempo: poucos dias. Dívida: duplica o que o esquema relacional das ligas já modela (páginas públicas, `match_events`, homologação com `seq`).

**B. Adaptador relacional.** A app e o bot passam a falar com `competitions`, `league_registrations`, `match_events` e as RPC existentes. É o destino certo e o único que serve páginas públicas e Matchday com idempotência; é bastante mais trabalho (plantéis, convocatórias, fichas, adeptos) e o catálogo de propostas teria de chamar RPC em vez de funções puras.

Recomendação: A para a AFPCE/Coimbra, B logo a seguir, com o catálogo de propostas como camada estável por cima (só muda o "aplicar"). Nenhuma das duas começa sem o teu OK: cria tabelas e dados de pessoas na base de produção.

## 5. Fases

| Fase | Entrega | Depende de |
|---|---|---|
| 0 (este PR) | Chat com documentos, propostas, privacidade, cota | tuas chaves na Vercel para a IA |
| 1 | Persistência da liga na nuvem (A) + a app carrega/guarda | decisão A vs B; migração pelo CI |
| 2 | WhatsApp para o gestor: vinculação, conversa, propostas com #n, documentos | Fase 1; número e transporte |
| 3 | Envios proativos à direção (tabela acima), resumo semanal | Fase 2 |
| 4 | Capitães, atletas, adeptos e Fantasy | Cloud API + templates + opt-in |
| 5 | Fichas de jogo por foto no WhatsApp com rascunho versionado | Fase 2 + política de acesso |

## 6. Decisões em aberto (do Vinicius)

1. **Persistência:** ponte A (rápida) ou direto B? Recomendação: A para o piloto, B depois.
2. **Número:** número próprio das Ligas (recomendado) ou o bot atual?
3. **Transporte:** Baileys só para o piloto com gestores, Cloud API para o resto?
4. **Modelo:** Sonnet 5.5 por defeito (recomendado para ler documentos) ou Haiku para poupar?
5. **Cota:** 40 chamadas por conta e dia chega para o piloto?

## 7. O que não faz

Não homologa, não decide castigos, não altera resultados, não envia mensagens a terceiros por conta própria e não guarda documentos no servidor (passam pelo pedido e desaparecem). Texto de documentos é tratado como dados: instruções escritas lá dentro não são ordens.
