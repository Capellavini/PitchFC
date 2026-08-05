-- ─────────────────────────────────────────────────────────
-- Migration 44 — Refresh /roadmap content to the SCORE format
--
-- Migration 43 seeded roadmap_content with a short feature-list draft.
-- This UPDATEs the same singleton row (never re-inserts, never edits
-- migration 43) with the fuller SCORE business-plan document — exec
-- summary, company section, pricing, competitors, financial model with
-- an editable calculator, management plan, next steps. Editorial source
-- of truth is docs/BUSINESS-PLAN.md; this JSON mirrors docs/roadmap-seed.json.
-- Same table, same RLS (admin-only read + write) — no schema change.
-- ─────────────────────────────────────────────────────────

update public.roadmap_content
set data = '{
  "hero": {
    "tagline": "De grupo de WhatsApp caótico a sistema operativo do futebol amador — organizador, jogador e, mais tarde, o campo em si.",
    "stats": [
      { "value": "11", "label": "módulos já em produção" },
      { "value": "~645k", "label": "grupos endereçáveis PT+BR (estimativa)" },
      { "value": "8", "label": "vias de monetização identificadas" },
      { "value": "2", "label": "verticais com sinal real" }
    ]
  },

  "execSummary": [
    { "title": "O problema", "desc": "Milhões de jogos semanais são organizados à mão em grupos de WhatsApp: contar quem vem, perseguir quem não pagou, sortear equipas de cabeça, reservar campo por telefone. O organizador é um voluntário exausto, e o grupo perde o jogo quando ele desiste." },
    { "title": "A solução", "desc": "Uma aplicação web que absorve todo o trabalho do organizador — grelha de confirmações, cobrança, sorteio equilibrado, matchday ao vivo, estatísticas e fantasy — sem obrigar ninguém a instalar nada: o jogador confirma por link mágico no WhatsApp, num toque." },
    { "title": "Porquê agora", "desc": "Pagamento instantâneo (MB Way em PT, Pix no BR) tornou-se universal e gratuito de iniciar; o WhatsApp é canal por omissão nos dois mercados; e as web apps modernas eliminam a fricção da app store. As três peças que tornavam isto inviável há cinco anos existem hoje." },
    { "title": "Estado actual", "desc": "Produto em produção e em uso real. Falta a peça de monetização: pagamento MB Way nativo (hoje é um toggle manual do organizador) e os planos free/pro. Notificações push estão codificadas mas desligadas." },
    { "title": "Modelo de receita", "desc": "Freemium por grupo (~€5–10/mês no plano Pro) mais comissão sobre pagamentos processados, escalando depois para reservas de campo, eventos corporativos, patrocínios e licenciamento B2B." },
    { "title": "O pedido", "desc": "Capital de arranque modesto para cobrir 12 meses de infraestrutura, integração de pagamentos e a primeira contratação part-time — ou uma parceria de distribuição com um operador de campos. O plano não depende de ronda de investimento para chegar a receita." }
  ],

  "company": {
    "mission": "Garantir que o jogo semanal acontece. Tudo o resto — estatísticas, fantasy, feed, reservas — existe para tornar esse jogo mais fácil de organizar e mais difícil de abandonar.",
    "operations": [
      { "title": "Estrutura", "desc": "Sociedade unipessoal ou por quotas sediada em Portugal; expansão ao Brasil por entidade local ou parceiro de merchant of record, apenas depois de PT validar retenção." },
      { "title": "Operação", "desc": "100% remota e digital. Sem inventário, sem loja, sem armazém. O único activo físico eventual é o PITCH Club, na Fase 5, e só se o software o financiar." },
      { "title": "Stack e custos fixos", "desc": "Hospedagem serverless (Vercel), Supabase gerido e domínio — dezenas de euros por mês em fase inicial, escalando com o uso." },
      { "title": "Pagamentos", "desc": "Sempre através de processador licenciado (Easypay/SIBS em PT, Stripe/Pix no BR). A PITCH nunca detém fundos de terceiros." }
    ],
    "startupCosts": [
      { "item": "Infraestrutura (hosting, BD, domínio, e-mail)", "kind": "Fixo", "amount": 600 },
      { "item": "Integração e taxas de processador de pagamentos", "kind": "Variável", "amount": 400 },
      { "item": "Contabilidade, constituição e taxas legais", "kind": "Fixo", "amount": 700 },
      { "item": "Design, marca e conteúdo", "kind": "Pontual", "amount": 300 }
    ],
    "costsNote": "O trabalho de desenvolvimento é feito internamente e não está monetizado nesta tabela — é o principal custo de oportunidade do projecto e deve ser declarado como tal a qualquer investidor."
  },

  "today": [
    { "title": "Grelha de confirmações", "desc": "10 vagas, WhatsApp, pagamento por jogador, lista de espera automática.", "status": "done" },
    { "title": "Sorteio de equipas", "desc": "Equilibrado por posição, edição manual, equipas nomeadas.", "status": "done" },
    { "title": "Matchday ao vivo", "desc": "Golos, assistências, defesas, guarda-redes rotativo, campeonato e eliminatórias.", "status": "done" },
    { "title": "Quadro tático", "desc": "Arrastar jogadores, formações (4-3-3 e outras), notas por jogador.", "status": "done" },
    { "title": "Stats e conquistas", "desc": "Época, histórico, badges, MVP por votação, cartão FUT com avaliação de pares.", "status": "done" },
    { "title": "Pitch Manager (Fantasy)", "desc": "Liga fantasy interna com mercado, trocas, formações e pontuação real.", "status": "done" },
    { "title": "Feed social", "desc": "Posts, fotos e vídeo, Golo da Semana, amizades entre grupos.", "status": "done" },
    { "title": "Identidade cross-group", "desc": "Um jogador em vários grupos, com stats e histórico próprios em cada um.", "status": "done" },
    { "title": "Ferramentas de organizador", "desc": "Auxiliares, remover e banir membros, cancelar e reagendar jogo, reservas de campo.", "status": "done" },
    { "title": "Link mágico (sem login)", "desc": "Confirmação por WhatsApp num toque, sem instalar nem criar conta.", "status": "done" },
    { "title": "Notificações push", "desc": "Fila automática pronta (avisar o suplente quando alguém desiste) — falta activar.", "status": "beta" },
    { "title": "Pagamento real (MB Way)", "desc": "Hoje é um toggle manual do organizador. É a maior peça em falta.", "status": "beta" }
  ],

  "phases": [
    { "num": 0, "when": "Concluída", "title": "Fundação — o organizador de bolso", "desc": "O wedge: resolver por completo o jogo semanal de um grupo de amigos, sem exigir que ninguém mude de app para participar.", "tags": ["Confirmações", "Sorteio", "Matchday", "Stats", "Fantasy", "Social", "Multi-grupo"] },
    { "num": 1, "when": "0–6 meses", "title": "Activar monetização e automação", "desc": "Ligar o que já existe mas está desligado, e construir o que falta para o organizador deixar de fazer trabalho manual. É onde nasce a subscrição paga.", "tags": ["MB Way real", "Push automático", "Lembretes agendados", "Jogo recorrente", "Planos free/pro"] },
    { "num": 2, "when": "6–12 meses", "title": "Efeitos de rede", "desc": "Sair de \"uma app por grupo isolado\" para \"uma rede de grupos\". A identidade cross-group já está construída — esta fase dá-lhe uso.", "tags": ["Falta 1 jogador", "Rankings locais", "Seletor de grupos", "Convites com incentivo"] },
    { "num": 3, "when": "12–18 meses", "title": "Reservas e eventos", "desc": "Entrar na transação que já acontece hoje por fora — reservar campo, cobrar aos jogadores — e torná-la nativa, com operadores de campo como parceiros, não concorrentes.", "tags": ["Marketplace de reservas", "Pacotes corporativos", "Torneios entre grupos"] },
    { "num": 4, "when": "18–24 meses", "title": "Captura automática e conteúdo", "desc": "A aposta de maior risco técnico. Reconhecimento de golo por vídeo é o negócio inteiro de outras empresas — começar pelo mais barato: integrações via OAuth.", "tags": ["Strava / Garmin", "Vídeo destaques", "Golo da Semana com prémio"] },
    { "num": 5, "when": "24+ meses", "title": "PITCH Club & PITCH OS", "desc": "O software financia e valida a marca antes de qualquer investimento físico. Só depois: um espaço próprio, e a mesma plataforma licenciada a outros operadores.", "tags": ["Campo físico (Porto/Matosinhos)", "PITCH OS white-label", "CRM para operadores"] }
  ],

  "pricing": [
    { "name": "Free", "price": "€0", "highlight": "", "desc": "1 grupo, confirmações, sorteio, matchday e stats base. Sem limite de jogadores. O objectivo é que o grupo nunca tenha razão para sair." },
    { "name": "Pro", "price": "€5–10 / mês por grupo", "highlight": "1", "desc": "Cobrança automática MB Way, push e lembretes, jogo recorrente, fantasy completo, histórico ilimitado e exportação. Chega na Fase 1." },
    { "name": "Empresas", "price": "Por evento ou anual", "highlight": "", "desc": "Torneios internos, marca da empresa, relatório de participação para RH. Já validado organicamente com um grupo real (Ziar Imóveis)." }
  ],

  "tam": {
    "tam": { "value": 645000, "label": "grupos com jogo semanal ou quinzenal (PT+BR)" },
    "sam": { "value": 225000, "label": "digitalmente alcançáveis, já a pagar campo" },
    "som": { "value": 3500, "label": "meta realista a 3–5 anos" },
    "assumptions": "⚠ Estimativa, não pesquisa primária. Portugal ≈10,4M hab.; Brasil ≈213M. Assume-se que ≈7% da população portuguesa e ≈4% da brasileira joga futebol recreativo com regularidade semanal/quinzenal em grupo organizado (~700k jogadores em PT, ~8,5M no BR), divididos por grupos de ~15 pessoas → ~47k grupos em PT + ~570k no BR ≈ 645k. O SAM assume 35% (urbano, smartphone, com transacção já a acontecer). O SOM assume captação essencialmente orgânica, sem orçamento de aquisição paga relevante. Estes rácios devem ser substituídos por dados primários antes de qualquer utilização externa — um inquérito a organizadores e dados de ocupação de operadores de campo são as duas fontes mais rápidas de obter."
  },

  "competitors": [
    { "category": "WhatsApp + folha de cálculo", "examples": "o status quo, >90% do mercado", "solves": "Toda a gente já lá está. Custo zero.", "fails": "Trabalho manual todo em cima de uma pessoa; sem histórico, sem cobrança, sem lista de espera. O grupo morre quando o organizador desiste." },
    { "category": "Apps de gestão de equipa", "examples": "Spond, TeamSnap, Heja", "solves": "Presenças e comunicação para equipas federadas e desporto juvenil.", "fails": "Desenhadas para uma equipa fixa com treinador, não para o jogo aberto entre amigos. Obrigam toda a gente a instalar e a criar conta — a barreira que mata a adopção num grupo casual." },
    { "category": "Marketplaces de reserva", "examples": "Playtomic, Matchi", "solves": "Encontrar e reservar campo, sobretudo em padel e ténis.", "fails": "Resolvem o campo, não o grupo. Nada de sorteio, stats, fantasy ou vida do grupo entre jogos. Parceiro natural na Fase 3, não concorrente frontal." },
    { "category": "Captura de vídeo", "examples": "Veo, Trace", "solves": "Gravação e análise automática de jogos.", "fails": "Hardware caro, orientado a clubes com orçamento. Fora do alcance de um grupo de amigos. Por isso a Fase 4 começa por OAuth e não por visão computacional própria." }
  ],

  "advantages": [
    { "title": "Fricção zero no lado do jogador", "desc": "Link mágico sem instalação nem conta. Nenhum concorrente de gestão de equipa faz isto, porque o modelo deles depende de contas." },
    { "title": "Dados acumulados por grupo", "desc": "Histórico, ratings de pares e ligas fantasy criam custo de mudança que cresce todas as semanas e não se replica." },
    { "title": "Identidade cross-group já construída", "desc": "A base técnica do \"falta 1 jogador\" — o efeito de rede real — existe antes de haver rede." },
    { "title": "Amplitude do fluxo completo", "desc": "Confirmação → cobrança → sorteio → jogo → stats → fantasy num só sítio; os concorrentes cobrem um pedaço cada." }
  ],

  "revenueStreams": [
    { "title": "1 · Subscrição do organizador", "statusLabel": "FASE 1", "statusKind": "next", "desc": "Freemium: grátis até 1 grupo e funcionalidades base; plano Pro a ~€5–10/mês por grupo." },
    { "title": "2 · Comissão em pagamentos", "statusLabel": "FASE 1", "statusKind": "next", "desc": "Percentagem sobre pagamentos MB Way processados na app (~1,5–3%, alinhado com Easypay/Stripe)." },
    { "title": "3 · Marketplace \"falta 1 jogador\"", "statusLabel": "FASE 2", "statusKind": "later", "desc": "Taxa de matchmaking entre grupos, através da rede cross-group." },
    { "title": "4 · Comissão em reservas de campo", "statusLabel": "FASE 3", "statusKind": "later", "desc": "Percentagem por reserva feita via marketplace de campos parceiros." },
    { "title": "5 · Eventos corporativos e torneios", "statusLabel": "SINAL REAL HOJE", "statusKind": "live", "desc": "Já validado organicamente com um grupo real de empresa (Ziar Imóveis)." },
    { "title": "6 · Brand deals e patrocínios", "statusLabel": "FASE 2–4", "statusKind": "later", "desc": "Marcas desportivas, bebidas, torneios e Golo da Semana com nome patrocinado." },
    { "title": "7 · PITCH OS — licenciamento B2B", "statusLabel": "FASE 5", "statusKind": "later", "desc": "Operadores de campos pagam licença mensal pelo CRM e motor de reservas, em white-label." },
    { "title": "8 · PITCH Club — receita física", "statusLabel": "FASE 5", "statusKind": "later", "desc": "Aluguer de campo, bar/F&B e eventos no espaço próprio." }
  ],

  "financials": {
    "rows": [
      { "year": "Ano 1", "groups": "≈ 50", "revenue": 5600, "costs": 2000, "sources": "Subscrições iniciais + 1.º piloto de brand deal" },
      { "year": "Ano 2", "groups": "≈ 500", "revenue": 55000, "costs": 26000, "sources": "Subscrições + 1.º pacote corporativo + brand deal" },
      { "year": "Ano 3", "groups": "≈ 3 000", "revenue": 304000, "costs": 155000, "sources": "Subscrições PT+BR, comissões, 2 pilotos B2B SaaS" }
    ],
    "assumptions": "⚠ Premissas. Preço médio blended ≈€6–7/mês por grupo (mistura free/pro e PT/BR). O ano 2 inclui a primeira contratação part-time (~€18k); o ano 3 inclui equipa de 2–3 pessoas (~€90k) e entrada operacional no Brasil (~€15k). Exclui capital de arranque e o custo de oportunidade da equipa fundadora. O salto de 500 para 3 000 grupos no ano 3 é a premissa mais frágil de todo o plano e depende inteiramente de o efeito de rede da Fase 2 funcionar."
  },

  "calculator": {
    "groups": 500,
    "price": 7,
    "players": 14,
    "fee": 5,
    "games": 4,
    "adoption": 40,
    "take": 2,
    "fixedMonthly": 1800,
    "variablePerGroup": 0.45
  },
  "calculatorNote": "Como ler: o cenário Base está calibrado para reproduzir a tabela acima — 50 grupos dão ≈€5,5k (ano 1), 500 grupos ≈€55k (ano 2) e 3 000 grupos ≈€333k (ano 3). Se mexeres nos parâmetros e os números deixarem de bater com a tabela, é o modelo que está certo e a tabela que precisa de ser reescrita. O modelo é de estado estável: assume o número de grupos constante ao longo de doze meses e não modela crescimento, churn nem sazonalidade. Serve para testar ordem de grandeza e sensibilidade ao preço — não substitui uma projecção mensal de tesouraria.",

  "marketing": [
    { "title": "1 · Orgânico, liderado pelo produto", "desc": "O convite de grupo está embutido no ciclo central: cada jogo espalha o link por 10–15 pessoas. O cartão FUT e o Golo da Semana são naturalmente partilháveis; o \"Wrapped\" de época é o gancho sazonal." },
    { "title": "2 · Parcerias de distribuição", "desc": "Co-marketing com operadores de futebol 5/7: eles já têm os grupos, nós damos-lhes uma ferramenta que reduz faltas e no-shows. Canal de maior alavancagem por euro investido." },
    { "title": "3 · Conteúdo e criadores", "desc": "Micro-criadores de \"pelada\" e futebol de rua em PT e BR — audiências pequenas, altíssima afinidade e custo por parceria baixo." },
    { "title": "4 · Canal corporativo", "desc": "O caso Ziar Imóveis como case study para vender a RH de outras empresas. Venda directa, ticket maior, sem depender de viralidade." }
  ],

  "partnerships": [
    { "category": "Distribuição", "name": "Operadores de campos e complexos desportivos", "why": "Já têm os grupos concentrados; a app reduz-lhes no-shows e cancelamentos." },
    { "category": "Pagamentos", "name": "Easypay / SIBS (PT) · Stripe / Pix (BR)", "why": "Processador licenciado — a PITCH nunca detém fundos de terceiros." },
    { "category": "Mensageria", "name": "WhatsApp Business API", "why": "Quando o volume justificar o custo por mensagem; até lá, wa.me deep links." },
    { "category": "Corporativo", "name": "Departamentos de RH e bem-estar", "why": "Orçamento real, ticket maior, sem sensibilidade a €10/mês." },
    { "category": "Wearables", "name": "Strava / Garmin (OAuth)", "why": "Caminho barato para a Fase 4, sem construir visão computacional." },
    { "category": "Comunidade", "name": "Associações universitárias e ligas informais", "why": "Densidade de grupos por metro quadrado — aquisição concentrada." }
  ],

  "brandDeals": [
    { "title": "Equipamento desportivo", "desc": "Chuteiras e equipamento, com presença no cartão de jogador e nos destaques." },
    { "title": "Bebidas isotónicas", "desc": "Naming ou skin do Golo da Semana." },
    { "title": "Torneios patrocinados", "desc": "Torneios entre grupos com nome de marca." },
    { "title": "Clínicas e fisioterapia", "desc": "Geolocalizado por campo e cidade — alta intenção depois de uma lesão." },
    { "title": "Apps complementares", "desc": "Cross-promo com Strava e Garmin." },
    { "title": "Cartão de jogador premium", "desc": "Skins de marca, sempre opt-in e nunca pay-to-win." }
  ],

  "management": {
    "now": "Equipa fundadora, acumulando produto, engenharia e apoio ao cliente. É simultaneamente a maior força do projecto — ciclo de iteração muito curto, custo próximo de zero — e o seu maior risco de concentração.",
    "hires": [
      { "when": "Ano 1", "role": "— (só fundadores)", "trigger": "Validar que grupos pagam antes de somar custo fixo.", "cost": 0 },
      { "when": "Ano 2", "role": "Suporte e comunidade (part-time)", "trigger": "~200 grupos pagantes; o suporte deixa de caber no tempo dos fundadores.", "cost": 18000 },
      { "when": "Ano 3", "role": "Engenharia + parcerias/vendas (2–3 pessoas)", "trigger": "Entrada no Brasil e abertura dos canais de reservas e corporativo.", "cost": 90000 },
      { "when": "Ano 3", "role": "Operação Brasil (parceiro local)", "trigger": "Entidade, fiscalidade e Pix; só após PT provar retenção.", "cost": 15000 }
    ],
    "advisors": "Contabilista certificado (PT), apoio jurídico pontual para termos, RGPD e contratos de parceria, e — idealmente — um mentor com experiência em marketplaces ou operação desportiva. Um operador de campos no advisory board vale mais do que capital."
  },

  "risks": [
    { "risk": "\"O WhatsApp grátis chega.\"", "mitigation": "Fricção zero de entrada: o valor aparece mesmo com adopção parcial do grupo, e o link mágico convive com o WhatsApp em vez de o substituir." },
    { "risk": "Vão pagar por algo já resolvido de graça?", "mitigation": "Freemium: o grátis resolve o jogo, o pago vende tempo poupado ao organizador — cobrança automática e zero perseguição de pagamentos." },
    { "risk": "Equipa muito pequena", "mitigation": "Stack simples e barato, roteiro faseado, e nenhuma contratação antes do gatilho de receita correspondente." },
    { "risk": "Brasil não validado", "mitigation": "O TAM inclui o Brasil por dimensão, mas a entrada só acontece depois de Portugal provar retenção. Nenhum custo brasileiro entra antes do ano 3." },
    { "risk": "Risco regulatório de pagamentos", "mitigation": "Sempre via processador licenciado, nunca fluxo directo. A PITCH não detém nem transfere fundos de terceiros." },
    { "risk": "Visão computacional é terreno de players maiores", "mitigation": "Adiada para a Fase 4 e reduzida ao mínimo: integrações OAuth em vez de reconhecimento de golo próprio." },
    { "risk": "Concentração no fundador", "mitigation": "Documentar operação e automatizar suporte antes de escalar; a contratação do ano 2 existe precisamente para reduzir este risco." }
  ],

  "nextSteps": [
    { "title": "Substituir as estimativas de mercado por dados primários", "desc": "Um inquérito a 50–100 organizadores em PT dá TAM e disposição a pagar reais em poucas semanas." },
    { "title": "Medir retenção nos grupos activos", "desc": "Percentagem de grupos que continuam a marcar jogo ao fim de 4, 8 e 12 semanas — é a métrica que decide tudo o resto." },
    { "title": "Fechar a integração MB Way", "desc": "Sem ela não há via 1 nem via 2, e o plano financeiro é hipotético." },
    { "title": "Formalizar o caso Ziar Imóveis", "desc": "Transformar o sinal orgânico num case study com números de participação." },
    { "title": "Assinar um operador de campos piloto", "desc": "Valida em simultâneo o canal de distribuição e a via de receita 4." }
  ],

  "appendixNote": "Documentos a anexar numa versão formal: currículo da equipa fundadora · demonstração do produto ou capturas de ecrã · dados de utilização actuais · contrato-modelo com operador de campos · termos e política de privacidade (RGPD) · orçamento do processador de pagamentos · projecção mensal de tesouraria a 24 meses."
}'::jsonb,
    updated_at = now()
where id = 1;
