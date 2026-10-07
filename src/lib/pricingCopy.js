// All user-facing copy for /pricing and the upgrade modal, in one place.
// Same convention as the rest of the app: the PT-PT string IS the key (and
// the source language); each L() call also registers its EN and (when it
// differs from PT-PT) PT-BR translation with the shared i18n, so a string
// can't drift from its translation. Components render with t(...).
//
// Product names (Pitch Club, Club + AI, Player+, Pitch Copilot, Pitch Coach)
// are NOT translated on purpose.

import { registerStrings } from "./i18n.js";

const EN = {};
const BR = {};
/** L(pt, en, ptBr?) → pt (the key). */
const L = (pt, en, ptBr) => {
  EN[pt] = en;
  if (ptBr !== undefined) BR[pt] = ptBr;
  return pt;
};

// ── Page chrome ────────────────────────────────────────────
export const PAGE = {
  back: L("Voltar", "Back"),
  heroTitle: L("Jogar é grátis. Organizar melhor é outra história.", "Football is free. Running it better isn't."),
  heroSub: L(
    "Começa grátis. Faz upgrade quando o teu grupo — ou o teu futebol — pedir mais.",
    "Start free. Upgrade when your group or your football life needs more.",
    "Comece grátis. Faça upgrade quando o seu grupo — ou o seu futebol — pedir mais.",
  ),
  tabGroups: L("Para grupos", "For groups"),
  tabPlayers: L("Para jogadores", "For players"),
  monthly: L("Mensal", "Monthly"),
  annual: L("Anual", "Annual"),
  saveTwoMonths: L("Poupa cerca de 2 meses", "Save ~2 months", "Poupe cerca de 2 meses"),
  groupSize: L("Jogadores ativos no grupo", "Active players in the group"),
  sizeStandard: L("Até 30 jogadores ativos", "Up to 30 active players"),
  sizeLarge: L("31–60 jogadores ativos", "31–60 active players"),
  perMonthGroup: L("/ mês / grupo", "/ month / group"),
  perYearGroup: L("/ ano / grupo", "/ year / group"),
  perMonth: L("/ mês", "/ month"),
  perYear: L("/ ano", "/ year"),
  perSaving: L("Poupa cerca de 2 meses", "Save ~2 months", "Poupe cerca de 2 meses"),
  mostPopular: L("MAIS POPULAR", "MOST POPULAR"),
  includesUpTo30: L("Inclui até 30 jogadores ativos", "Includes up to 30 active players"),
  largeBand: L("31–60 jogadores ativos", "31–60 active players"),
  perMonthShort: L("/mês", "/month"),
  perYearShort: L("/ano", "/year"),
  above60: L("Mais de 60 jogadores ativos?", "60+ active players?"),
  talkToUs: L("Fala connosco →", "Talk to us →", "Fale com a gente →"),
  openMatchesFree: L(
    "Os Jogos Abertos são grátis para todos os jogadores. O Player+ acrescenta melhor descoberta, alertas e personalização — nunca o acesso.",
    "Open Matches are free for every player. Player+ adds better discovery, alerts and personalisation — never access.",
    "Os Jogos Abertos são grátis para todos os jogadores. O Player+ acrescenta melhor descoberta, alertas e personalização — nunca o acesso.",
  ),
  groupLimitNote: L(
    "O limite de 2 grupos grátis aplica-se a grupos que crias — podes juntar-te a quantos grupos quiseres.",
    "The 2 free groups limit applies to groups you create — you can join as many as you like.",
    "O limite de 2 grupos grátis vale para grupos que você cria — você pode entrar em quantos quiser.",
  ),
  activeNote: L(
    "Jogadores ativos = quem participou ou interagiu com o grupo recentemente, não todos os membros de sempre.",
    "Active players = people who recently played or interacted with the group, not everyone who ever joined.",
    "Jogadores ativos = quem participou ou interagiu com o grupo recentemente, não todos os membros de sempre.",
  ),
  pricesEu: L("Preços em euros (€) para Portugal / Europa.", "Prices in euros (€) for Portugal / Europe."),
  pricesBr: L("Preços em reais (R$) para o Brasil.", "Prices in Brazilian reais (R$) for Brazil."),
  currentPlan: L("Plano atual", "Current plan"),
  manageSub: L("Gerir subscrição", "Manage subscription", "Gerenciar assinatura"),
  foundingLabel: L("Founding Club 🇧🇷", "Founding Club 🇧🇷"),
  foundingNote: L(
    "Os primeiros grupos do Pitch mantêm este preço durante os primeiros 12 meses.",
    "Founding Clubs keep this price for their first 12 months.",
    "Os primeiros grupos do Pitch mantêm este preço durante os primeiros 12 meses.",
  ),
  playerHint: L("Só jogas? O Player+ é para ti →", "Just play? Player+ is for you →", "Só joga? O Player+ é pra você →"),
};

// ── Plans ──────────────────────────────────────────────────
export const PLANS = {
  free: {
    name: L("Free", "Free"),
    tag: L("Grátis", "Free"),
    subtitle: L("Tudo o que precisas para organizar o teu jogo semanal.", "Everything you need to run your weekly game.", "Tudo o que você precisa para organizar o seu jogo semanal."),
    cta: L("Começa grátis", "Start free", "Começar grátis"),
    features: [
      L("Cria até 2 grupos", "Create up to 2 groups", "Crie até 2 grupos"),
      L("Até 20 jogadores ativos por grupo", "Up to 20 active players per group"),
      L("Matchday", "Matchday"),
      L("Confirmações de presença (RSVP)", "Player confirmations / RSVP"),
      L("Lista de espera", "Waiting list"),
      L("Jogadores convidados", "Guest players"),
      L("Sorteio de equipas", "Team generation", "Sorteio de times"),
      L("Resultados", "Results"),
      L("Votação MVP", "MVP voting"),
      L("Estatísticas básicas", "Basic statistics"),
      L("Controlo básico de pagamentos", "Basic payment tracking", "Controle básico de pagamentos"),
    ],
  },
  club: {
    name: L("Pitch Club", "Pitch Club"),
    subtitle: L("Mais controlo. Menos trabalho.", "More control. Less admin.", "Mais controle. Menos trabalho."),
    cta: L("Subscrever o Pitch Club", "Upgrade to Club", "Assinar Pitch Club"),
    inherits: L("Tudo o que está no Free, mais:", "Everything in Free, plus:"),
    features: [
      L("Até 30 jogadores ativos", "Up to 30 active players"),
      L("Histórico de jogos ilimitado", "Unlimited match history"),
      L("Épocas", "Seasons"),
      L("Estatísticas avançadas do grupo", "Advanced group statistics"),
      L("Estatísticas avançadas dos jogadores", "Advanced player statistics"),
      L("Pitch Manager / Fantasy", "Pitch Manager / Fantasy"),
      L("Índice de fiabilidade", "Reliability Score"),
      L("Vários organizadores / admins", "Multiple organizers / admins"),
      L("Gestão avançada de jogadores", "Advanced player management"),
      L("Gestão avançada de pagamentos", "Advanced payment management"),
      L("Histórico de pagamentos", "Payment history"),
      L("Lembretes automáticos", "Automated reminders"),
      L("Recordes do grupo", "Group records"),
      L("Rankings", "Rankings"),
    ],
  },
  club_ai: {
    name: L("Club + AI", "Club + AI"),
    subtitle: L("Deixa o Pitch organizar o jogo contigo.", "Let Pitch run the game with you.", "Deixe o Pitch organizar o jogo com você."),
    cta: L("Subscrever o Club + AI", "Get Club + AI", "Assinar Club + AI"),
    inherits: L("Tudo o que está no Pitch Club, mais:", "Everything in Pitch Club, plus:"),
    copilotName: L("Pitch Copilot", "Pitch Copilot"),
    copilotTag: L("O copiloto do organizador", "The organizer's copilot"),
    features: [
      L("Lembretes inteligentes de confirmação", "Smart confirmation reminders"),
      L("Contacta automaticamente quem falta responder", "Automatically follows up with missing players", "Cobra automaticamente quem falta responder"),
      L("Automação da lista de espera", "Waitlist automation"),
      L("Sugestões de substituição", "Replacement suggestions"),
      L("Lembretes de pagamento", "Payment reminders"),
      L("Ações no grupo em linguagem natural", "Natural-language group actions"),
      L("Sugestões inteligentes de equilíbrio de equipas", "Smart team balancing suggestions", "Sugestões inteligentes de equilíbrio de times"),
      L("Resumos pré-jogo", "Pre-match summaries"),
      L("Resumos pós-jogo", "Post-match summaries"),
      L("Insights do grupo", "Group insights"),
      L("Faz perguntas sobre o grupo", "Ask questions about the group", "Faça perguntas sobre o grupo"),
    ],
    demoLabel: L("Exemplo", "Example"),
    demoAsk: L("“Pitch, faltam-nos dois jogadores para domingo.”", "“Pitch, we're missing two players for Sunday.”", "“Pitch, faltam dois jogadores para domingo.”"),
    demoReply: L(
      "Já avisei quem ainda não respondeu e a lista de espera. Falta 1 vaga.",
      "I've pinged everyone who hasn't replied, and the waiting list. 1 spot left.",
      "Já avisei quem ainda não respondeu e a lista de espera. Falta 1 vaga.",
    ),
  },
  player_free: {
    name: L("Player", "Player"),
    tag: L("Grátis", "Free"),
    subtitle: L("O teu futebol começa aqui.", "Your football starts here.", "Seu futebol começa aqui."),
    cta: L("Joga com o Pitch", "Play with Pitch", "Jogar com Pitch"),
    features: [
      L("Junta-te a grupos Pitch ilimitados", "Join unlimited Pitch groups", "Entre em grupos Pitch ilimitados"),
      L("Perfil de jogador", "Player profile"),
      L("Estatísticas da época atual", "Current-season stats"),
      L("Histórico de jogos", "Match history"),
      L("Recordes básicos", "Basic records"),
      L("Entra em Jogos Abertos", "Join Open Matches", "Entre em Jogos Abertos"),
      L("Pesquisa Jogos Abertos", "Search Open Matches", "Pesquise Jogos Abertos"),
      L("MVPs", "MVPs"),
      L("Conquistas básicas", "Basic achievements"),
    ],
  },
  player_plus: {
    name: L("Player+", "Player+"),
    subtitle: L("A tua vida de futebol, num só lugar.", "Your football life, in one place.", "Seu futebol inteiro, em um só lugar."),
    cta: L("Subscrever o Player+", "Get Player+", "Assinar Player+"),
    inherits: L("Tudo o que está no Player, mais:", "Everything in Player, plus:"),
    pillars: [
      {
        id: "career",
        title: L("Carreira", "Career"),
        items: [
          L("Perfil de futebol completo entre grupos", "Full cross-group football profile"),
          L("Histórico completo da carreira", "Complete career history"),
          L("Estatísticas de sempre", "All-time statistics"),
          L("Épocas", "Seasons"),
          L("Recordes pessoais", "Personal records"),
          L("Sequências", "Streaks"),
          L("Conquistas e distintivos", "Achievements and badges"),
          L("Pitch Wrapped", "Pitch Wrapped"),
          L("Cards de jogador para partilhar", "Shareable player cards", "Cards de jogador pra compartilhar"),
        ],
      },
      {
        id: "stats",
        title: L("Estatísticas avançadas", "Advanced Stats"),
        items: [
          L("Estatísticas entre grupos", "Cross-group statistics"),
          L("Forma recente", "Form"),
          L("Rendimento por posição", "Position performance"),
          L("Comparação entre jogadores", "Player comparisons"),
          L("Combinações com colegas de equipa", "Teammate combinations", "Combinações com companheiros de time"),
          L("Percentagem de vitórias", "Win rate", "Porcentagem de vitórias"),
          L("Tendência de golos e assistências", "Goals / assists trends"),
          L("Insights pessoais avançados", "Advanced personal insights"),
          L("Tendências de rendimento", "Performance trends"),
        ],
      },
      {
        id: "discovery",
        title: L("Descoberta", "Discovery"),
        items: [
          L("Alertas inteligentes de Jogos Abertos", "Smart Open Match alerts"),
          L("Pesquisas guardadas", "Saved searches", "Buscas salvas"),
          L("Filtros avançados", "Advanced filters"),
          L("Locais favoritos", "Favourite locations"),
          L("Disponibilidade recorrente", "Recurring availability"),
          L("Recomendações de jogos", "Match recommendations"),
          L("Descoberta personalizada", "Personalised discovery"),
        ],
        example: L(
          "“Costumas jogar às quintas à noite. Há um jogo a 1,8 km amanhã às 20:00.”",
          "“You usually play Thursday evenings. There's a game 1.8 km away tomorrow at 20:00.”",
          "“Você costuma jogar às quintas à noite. Tem um jogo amanhã às 20h, a 1,8 km.”",
        ),
        note: L(
          "Encontrar, ver e entrar em Jogos Abertos é grátis. O Player+ acrescenta o resto.",
          "Finding, viewing and joining Open Matches is free. Player+ adds the rest.",
          "Encontrar, ver e entrar em Jogos Abertos é grátis. O Player+ acrescenta o resto.",
        ),
      },
      {
        id: "coach",
        title: L("Pitch Coach AI", "Pitch Coach AI"),
        beta: L("Beta", "Beta"),
        items: [
          L("Pergunta ao Pitch Coach sobre o teu jogo, com os teus dados reais", "Ask Pitch Coach about your game, using your real Pitch data", "Pergunte ao Pitch Coach sobre o seu jogo, com os seus dados reais"),
        ],
        examples: [
          L("“Como mudou a minha forma nos últimos 8 jogos?”", "“How has my form changed over the last 8 games?”", "“Como foi minha evolução nos últimos 8 jogos?”"),
          L("“Em que posição rendo melhor?”", "“Which position do I perform best in?”", "“Em qual posição eu jogo melhor?”"),
          L("“Com quem tenho a melhor percentagem de vitórias?”", "“Who do I have the best win rate with?”", "“Com quem tenho o melhor aproveitamento?”"),
          L("“Mostra-me o meu melhor mês desta época.”", "“Show me my best month this season.”", "“Qual foi meu melhor mês da temporada?”"),
          L("“Como estou comparado com a época passada?”", "“How am I performing compared with last season?”", "“Estou jogando melhor do que na temporada passada?”"),
        ],
      },
    ],
  },
};

// ── Copilot vs Coach ───────────────────────────────────────
export const AI_PAIR = {
  title: L("Duas IAs, dois trabalhos.", "Two AIs, two jobs.", "Duas IAs, dois trabalhos."),
  copilot: {
    name: L("Pitch Copilot", "Pitch Copilot"),
    who: L("Para o organizador", "For the organizer"),
    purpose: L("Gere o jogo.", "Runs the game."),
    items: [
      L("Confirmações", "Confirmations"),
      L("Pagamentos", "Payments"),
      L("Lista de espera", "Waiting list"),
      L("Substituições", "Replacements"),
      L("Equipas", "Teams", "Times"),
      L("Administração do grupo", "Group administration"),
      L("Insights do grupo", "Group insights"),
    ],
    included: L("Incluído no Club + AI", "Included in Club + AI"),
  },
  coach: {
    name: L("Pitch Coach", "Pitch Coach"),
    who: L("Para o jogador", "For the player"),
    purpose: L("Ajuda-te a perceber e melhorar o teu futebol.", "Helps you understand and improve your football.", "Ajuda você a entender e melhorar o seu futebol."),
    items: [
      L("Forma", "Form"),
      L("Rendimento", "Performance"),
      L("Estatísticas", "Stats"),
      L("Recordes", "Records"),
      L("Comparações", "Comparisons"),
      L("Insights pessoais", "Personal insights"),
    ],
    included: L("Incluído no Player+", "Included in Player+"),
  },
};

// ── Payments ───────────────────────────────────────────────
export const PAYMENTS = {
  title: L("Pagamentos sem folha de cálculo.", "Payments without the spreadsheet.", "Pagamentos sem planilha."),
  soon: L("Pitch Payments — Em breve", "Pitch Payments — Coming soon"),
  player: L("Jogador", "Player"),
  pitch: L("Pitch", "Pitch"),
  organizer: L("Organizador / Campo", "Organizer / Venue"),
  body1: L(
    "Cobra os jogos dentro do Pitch com meios de pagamento locais. O Pitch sabe automaticamente quem pagou, quem está confirmado e o que falta receber.",
    "Collect game payments inside Pitch with local payment methods. Pitch automatically knows who paid, who's confirmed and what's still outstanding.",
    "Receba os pagamentos dos jogos dentro do Pitch com meios de pagamento locais. O Pitch sabe automaticamente quem pagou, quem está confirmado e o que falta receber.",
  ),
  methodsLabel: L("Previstos, ainda não ativos:", "Planned, not live yet:", "Previstos, ainda não ativos:"),
  methodsEu: ["MB WAY", "Apple Pay", L("Cartões", "Cards", "Cartões")],
  methodsBr: ["PIX", L("Apple Pay / cartões, quando disponíveis", "Apple Pay / cards where available", "Apple Pay / cartões, quando disponíveis")],
  venue: L(
    "Nos Campos Pitch participantes, os pagamentos dos jogos podem ser tratados diretamente com o campo.",
    "At participating Pitch Venues, game payments can be handled directly with the venue.",
    "Nos Campos Pitch participantes, os pagamentos dos jogos podem ser tratados diretamente com o campo.",
  ),
  fees: L(
    "Os custos de processamento de pagamentos são independentes da subscrição e serão sempre mostrados com clareza onde se aplicarem.",
    "Payment-processing costs are separate from the subscription and will always be shown clearly where applicable.",
    "Os custos de processamento de pagamentos são independentes da assinatura e serão sempre mostrados com clareza onde se aplicarem.",
  ),
};

// ── Comparison ─────────────────────────────────────────────
const YES = true, NO = false;
export const COMPARE = {
  title: L("Compara de relance", "Compare at a glance", "Compare de relance"),
  groups: {
    cols: ["Free", "Club", "Club + AI"],
    sections: [
      {
        title: L("Organizar", "Organize"),
        rows: [
          [L("Matchday", "Matchday"), YES, YES, YES],
          [L("RSVP", "RSVP"), YES, YES, YES],
          [L("Lista de espera", "Waitlist"), YES, YES, YES],
          [L("Convidados", "Guests"), YES, YES, YES],
          [L("Sorteio de equipas", "Team generation", "Sorteio de times"), YES, YES, YES],
        ],
      },
      {
        title: L("Competir", "Compete"),
        rows: [
          [L("Estatísticas", "Stats"), L("Básicas", "Basic"), L("Avançadas", "Advanced"), L("Avançadas", "Advanced")],
          [L("Épocas", "Seasons"), NO, YES, YES],
          [L("Fantasy", "Fantasy"), NO, YES, YES],
          [L("Rankings", "Rankings"), NO, YES, YES],
          [L("Recordes", "Records"), NO, YES, YES],
        ],
      },
      {
        title: L("Automatizar", "Automate"),
        rows: [
          [L("Lembretes", "Reminders"), NO, L("Automáticos", "Automated"), L("Inteligentes", "Smart")],
          [L("Pagamentos", "Payments"), L("Básico", "Basic"), L("Avançado", "Advanced"), L("Avançado", "Advanced")],
          [L("Automação da lista de espera", "Waitlist automation"), NO, NO, YES],
          [L("Pitch Copilot", "Pitch Copilot"), NO, NO, YES],
        ],
      },
    ],
  },
  players: {
    cols: ["Player", "Player+"],
    sections: [
      {
        title: L("Jogador", "Player"),
        rows: [
          [L("Carreira", "Career"), L("Época atual", "Current season", "Temporada atual"), L("Completa", "Complete")],
          [L("Estatísticas entre grupos", "Cross-group stats"), NO, YES],
          [L("Descoberta de Jogos Abertos", "Open Match discovery"), L("Incluída", "Included"), L("+ alertas e recomendações", "+ alerts and recommendations")],
          [L("Pitch Coach", "Pitch Coach"), NO, L("Beta", "Beta")],
        ],
      },
    ],
  },
};

// ── FAQ ────────────────────────────────────────────────────
export const FAQ = {
  title: L("Perguntas frequentes", "FAQ", "Perguntas frequentes"),
  items: [
    {
      id: "free",
      q: L("Posso usar o Pitch de graça?", "Can I use Pitch for free?", "Posso usar o Pitch de graça?"),
      a: L("Sim. A experiência essencial do Pitch continua grátis.", "Yes. The core Pitch experience remains free."),
    },
    {
      id: "free_groups",
      q: L("Quantos grupos posso criar grátis?", "How many groups can I create for free?", "Quantos grupos posso criar de graça?"),
      a: L(
        "Um organizador Free pode criar até 2 grupos. Entrar em grupos como jogador não conta para esse limite.",
        "A Free organizer can create up to 2 groups. Joining groups as a player doesn't count towards that limit.",
        "Um organizador Free pode criar até 2 grupos. Entrar em grupos como jogador não conta para esse limite.",
      ),
    },
    {
      id: "multi_groups",
      q: L("Os jogadores podem juntar-se a vários grupos grátis?", "Can players join multiple groups for free?", "Os jogadores podem entrar em vários grupos grátis?"),
      a: L("Sim. Os jogadores podem participar em vários grupos Pitch sem pagar.", "Yes. Players can participate in multiple Pitch groups without paying.", "Sim. Os jogadores podem participar de vários grupos Pitch sem pagar."),
    },
    {
      id: "active",
      q: L("O que conta como jogador ativo?", "What counts as an active player?"),
      a: L(
        "Os limites de cada grupo baseiam-se na participação ativa, e não em membros antigos ou inativos. A regra exata do período de atividade pode evoluir.",
        "Group limits are based on active participation rather than every historical member. The exact active-period rule may evolve.",
        "Os limites de cada grupo se baseiam na participação ativa, e não em todos os membros de sempre. A regra exata do período de atividade pode evoluir.",
      ),
    },
    {
      id: "open_matches",
      q: L("Preciso do Player+ para entrar em Jogos Abertos?", "Is Player+ required to join Open Matches?"),
      a: L(
        "Não. Os Jogos Abertos continuam acessíveis a jogadores grátis. O Player+ acrescenta melhor descoberta, alertas, personalização e filtros avançados.",
        "No. Open Matches remain accessible to free players. Player+ adds better discovery, alerts, personalisation and advanced filters.",
        "Não. Os Jogos Abertos continuam acessíveis a jogadores grátis. O Player+ acrescenta melhor descoberta, alertas, personalização e filtros avançados.",
      ),
    },
    {
      id: "club_vs_player",
      q: L("Qual é a diferença entre o Pitch Club e o Player+?", "What's the difference between Pitch Club and Player+?"),
      a: L(
        "O Pitch Club pertence ao grupo e ajuda a organizar e gerir o jogo. O Player+ pertence ao jogador e acompanha a sua carreira de futebol por todos os grupos.",
        "Pitch Club belongs to the group and helps organize and manage the game. Player+ belongs to the player and follows their football career across groups.",
        "O Pitch Club pertence ao grupo e ajuda a organizar e gerenciar o jogo. O Player+ pertence ao jogador e acompanha a carreira de futebol dele por todos os grupos.",
      ),
    },
    {
      id: "copilot_vs_coach",
      q: L("Qual é a diferença entre o Pitch Copilot e o Pitch Coach?", "What's the difference between Pitch Copilot and Pitch Coach?"),
      a: L("O Copilot gere o grupo. O Coach analisa o jogador.", "Copilot manages the group. Coach analyzes the player."),
    },
    {
      id: "fees",
      q: L("Os custos de pagamento estão incluídos?", "Are payment fees included?"),
      a: L(
        "Os custos de processamento de pagamentos são independentes da subscrição e serão sempre mostrados com clareza onde se aplicarem.",
        "Payment-processing costs are separate from the subscription and will always be shown clearly where applicable.",
        "Os custos de processamento de pagamentos são independentes da assinatura e serão sempre mostrados com clareza onde se aplicarem.",
      ),
    },
    {
      id: "prices_differ",
      q: L("Porque é que os preços no Brasil e na Europa são diferentes?", "Why are prices different in Brazil and Europe?", "Por que os preços no Brasil e na Europa são diferentes?"),
      a: L(
        "O Pitch usa preços localizados para cada mercado.",
        "Pitch uses localized pricing for each market.",
        "O Pitch usa preços localizados para cada mercado.",
      ),
    },
  ],
};

// ── Final CTA + contextual CTAs ────────────────────────────
export const FINAL = {
  title: L("Bola a rolar em 2 minutos.", "Ball rolling in 2 minutes.", "Bola rolando em 2 minutos."),
  sub: L("Cria o teu grupo grátis. Faz upgrade só se e quando fizer sentido.", "Create your group for free. Upgrade only if and when it makes sense.", "Crie o seu grupo grátis. Faça upgrade só se e quando fizer sentido."),
  cta: L("Começa grátis", "Start free", "Comece grátis"),
};

export const CTA = {
  upgradeGroup: L("Fazer upgrade do grupo", "Upgrade group"),
};

// ── Upgrade modal (contextual prompts) ─────────────────────
export const UPGRADE = {
  availableClub: L("Disponível com o Pitch Club", "Available with Pitch Club"),
  availableClubAi: L("Disponível com o Club + AI", "Available with Club + AI"),
  availablePlayerPlus: L("Disponível com o Player+", "Available with Player+"),
  whichGroup: L("Qual grupo queres melhorar?", "Which group do you want to upgrade?", "Qual grupo você quer melhorar?"),
  includes: L("Inclui", "Includes"),
  seePlans: L("Ver planos", "See plans"),
  notNow: L("Agora não", "Not now"),
  continue: L("Continuar", "Continue"),
  soonTitle: L("As subscrições ainda não estão abertas.", "Subscriptions aren't open yet.", "As assinaturas ainda não estão abertas."),
  soonBody: L(
    "Não foi cobrado nada. Avisamos-te no Pitch assim que o upgrade estiver disponível.",
    "Nothing was charged. We'll let you know in Pitch as soon as upgrades are available.",
    "Nada foi cobrado. Avisamos você no Pitch assim que o upgrade estiver disponível.",
  ),
  needGroup: L("Escolhe primeiro o grupo a melhorar.", "Pick the group to upgrade first.", "Escolha primeiro o grupo a melhorar."),
  close: L("Fechar", "Close"),
};

registerStrings("en", EN);
registerStrings("pt-br", BR);
