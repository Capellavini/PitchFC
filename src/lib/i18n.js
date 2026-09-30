/**
 * Lightweight i18n: the source of truth is the PT-PT string in the code;
 * t() looks it up in the target-language dictionary and falls back to
 * PT-PT when missing, so untranslated corners degrade gracefully
 * instead of breaking.
 *
 * The language lives in localStorage under the app prefix (same key that
 * usePersistentState("lang") uses in PitchApp — PitchApp re-renders the
 * tree on change; this module just mirrors the current value for t()).
 *
 * Supported: "pt" (PT-PT, the identity/source language), "pt-br", "en".
 */

const LANG_KEY = "pitch.v2.lang";
const SUPPORTED = ["pt", "pt-br", "en"];

/** Maps the browser's own language preference (navigator.language, no
 *  permission needed, no geolocation) to one of our 3 dictionaries —
 *  used only as the FIRST-VISIT default, before anyone's picked a
 *  language explicitly. "pt-BR" → pt-br; any other "pt-*" → pt-PT
 *  (the app's source language); unmatched locales fall back to "en"
 *  as the most broadly understood option. */
export function detectLang() {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const raw of langs) {
      const l = (raw || "").toLowerCase();
      if (l.startsWith("pt-br")) return "pt-br";
      if (l.startsWith("pt")) return "pt";
      if (l.startsWith("en")) return "en";
    }
  } catch { /* navigator unavailable — ignore, fall through */ }
  return "en";
}

let current = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(LANG_KEY));
    if (SUPPORTED.includes(stored)) return stored;
  } catch { /* no stored preference yet */ }
  return detectLang();
})();

export const getLang = () => current;
export const setLang = (l) => {
  current = SUPPORTED.includes(l) ? l : "pt";
  try { localStorage.setItem(LANG_KEY, JSON.stringify(current)); } catch { /* in-memory only */ }
};

export const t = (s) => (current === "pt" ? s : (DICTS[current]?.[s] ?? s));

/** Context-scoped translation, for a PT-PT word whose translation
 *  depends on WHERE it appears. Looks up "<ctx>:<s>" first (e.g.
 *  "nav:Perfil" → "Me" for the bottom-nav tab, while plain "Perfil"
 *  stays "Profile" in page titles), then falls back to plain t(s).
 *  In PT the source string is returned unchanged.
 *  Contexts in use: "nav" (BottomNav labels), "form" (FormDots letters
 *  V/E/D → W/D/L — single letters are too ambiguous for the global map). */
export const tCtx = (ctx, s) => (current === "pt" ? s : (DICTS[current]?.[`${ctx}:${s}`] ?? t(s)));

// Attribute names get their own map: "Defesa" the position translates to
// "Defender", but "Defesa" the attribute is "Defending" — can't share a key.
const ATTRS_PT = {
  rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico",
  div: "Elasticidade", man: "Segurança", kic: "Chute", ref: "Reflexos", spd: "Velocidade", pos: "Posicionamento",
};
const ATTRS_PT_BR = { rit: "Ritmo", rem: "Finalização", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };
const ATTRS_EN = {
  rit: "Pace", rem: "Shooting", pas: "Passing", dri: "Dribbling", def: "Defending", fis: "Physical",
  div: "Diving", man: "Handling", kic: "Kicking", ref: "Reflexes", spd: "Speed", pos: "Positioning",
};
const ATTRS_DICTS = { "pt-br": ATTRS_PT_BR, en: ATTRS_EN };
export const attrName = (k) => (current === "pt" ? ATTRS_PT[k] : (ATTRS_DICTS[current]?.[k] ?? ATTRS_PT[k]));

// 3-letter FUT-card abbreviations — separate from attrName's full words.
// EN uses FIFA's own well-known codes (PAC/SHO/PAS/DRI/DEF/PHY, and for
// goalkeepers DIV/HAN/KIC/REF/SPD/POS) rather than a mechanical
// truncation, since that's what players expect to see.
const ATTR_ABBR_PT = {
  rit: "RIT", rem: "REM", pas: "PAS", dri: "DRI", def: "DEF", fis: "FIS",
  div: "DIV", man: "MAN", kic: "KIC", ref: "REF", spd: "SPD", pos: "POS",
};
const ATTR_ABBR_PT_BR = { rit: "RIT", rem: "FIN", pas: "PAS", dri: "DRI", def: "DEF", fis: "FIS" };
const ATTR_ABBR_EN = {
  rit: "PAC", rem: "SHO", pas: "PAS", dri: "DRI", def: "DEF", fis: "PHY",
  div: "DIV", man: "HAN", kic: "KIC", ref: "REF", spd: "SPD", pos: "POS",
};
const ATTR_ABBR_DICTS = { "pt-br": ATTR_ABBR_PT_BR, en: ATTR_ABBR_EN };
export const attrAbbr = (k) => (current === "pt" ? ATTR_ABBR_PT[k] : (ATTR_ABBR_DICTS[current]?.[k] ?? ATTR_ABBR_PT[k]));

const EN = {
  // ── Home (redesign v1): next action, recap, activity feed ──
  "Jogo completo": "Game full", "vaga livre": "spot left", "vagas livres": "spots left",
  "Ver jogo": "View game", "Último resultado": "Latest result", "Tu": "You",
  "Resultado": "Result", "Novo recorde pessoal": "New personal best", "MVP da jornada": "Matchday MVP",
  "Hat-trick!": "Hat-trick!", "A tua jornada": "Your matchday", "Grande jornada": "Big night",
  "golo": "goal", "assistência": "assist", "assistências": "assists", "sem sofrer": "clean sheet",
  "Não falhaste nenhuma. Mantém a série viva no próximo jogo.": "You haven't missed one. Keep the streak alive next game.",
  "uma publicação": "a post", "Enviar": "Send", "Partilha um momento…": "Share a moment…",
  "Pedidos de amizade": "Friend requests", "Jogadores no PITCH": "Players on PITCH",
  "Ainda sem amigos. Adiciona quem joga contigo para veres a atividade deles aqui.": "No friends yet. Add the people you play with to see their activity here.",
  "pedido": "request", "pedidos": "requests", "Atividade": "Activity",
  "A atividade começa no primeiro jogo": "Activity starts with your first game",
  "Resultados, golos, MVPs e recordes do teu grupo e dos teus amigos aparecem aqui automaticamente.": "Results, goals, MVPs and records from your groups and friends show up here automatically.",
  "AO VIVO": "LIVE", "O dia de jogo está a decorrer": "The matchday is under way", "Abrir Matchday": "Open Matchday",
  "RESULTADO EM FALTA": "RESULT MISSING", "Regista o resultado de hoje": "Log today's result",
  "Estás dentro": "You're in", "Não vais": "You're out", "O que está a acontecer": "What's happening",
  "SEM JOGO MARCADO": "NO GAME SCHEDULED", "Nada agendado por agora": "Nothing scheduled yet",
  "Quando houver jogo num dos teus grupos, aparece aqui.": "When one of your groups has a game, it shows up here.",
  "Ir para Jogar": "Go to Play",
  // ── Dates ──────────────────────────────────────────────
  "Domingo": "Sunday", "Segunda": "Monday", "Terça": "Tuesday", "Quarta": "Wednesday",
  "Quinta": "Thursday", "Sexta": "Friday", "Sábado": "Saturday",
  "Dom": "Sun", "Seg": "Mon", "Ter": "Tue", "Qua": "Wed", "Qui": "Thu", "Sex": "Fri", "Sáb": "Sat",
  "Fev": "Feb", "Abr": "Apr", "Mai": "May", "Ago": "Aug", "Set": "Sep", "Out": "Oct", "Dez": "Dec",
  "às": "at",

  // ── Shared / generic ───────────────────────────────────
  "Guardar": "Save", "Cancelar": "Cancel", "Voltar": "Back", "Sair": "Log out",
  "Adicionar": "Add", "Remover": "Remove", "Copiado": "Copied", "Partilhar": "Share",
  "Convidar": "Invite", "Um momento…": "One moment…", "A carregar…": "Uploading…",
  "jogo": "game", "jogos": "games", "jogadores": "players", "jogador": "player",
  "(tu)": "(you)", "não definido": "not set", "Entrar": "Log in", "Criar conta": "Sign up",

  // ── Jogar tab (redesign v1): Jogos, Game Detail, Group page ──
  "jogar:Jogos": "Games", "group:Grupo": "Group",
  "OUTROS JOGOS": "OTHER GAMES", "Ver tudo": "See all", "JOGOS ANTERIORES": "PAST GAMES",
  "Escolhe a data e a hora do primeiro jogo do grupo.": "Pick the date and time of the group's first game.",
  "Afinal vou!": "I'm in after all!", "Sair da lista": "Leave list", "Semanal": "Weekly", "Partilhar jogo": "Share game",
  " — e as próximas semanas também, nesse dia da semana.": " — and the following weeks too, on that weekday.",
  "Detalhes do jogo": "Game details", "Plantel · Pagamentos · Material": "Squad · Payments · Kit",
  "Enviar lista no WhatsApp": "Send list on WhatsApp", "Confirmados, vagas e preço": "Confirmed, spots and price",
  "Pagos": "Paid", "Não pode": "Can't make it", "de": "of", "Ainda ninguém confirmou.": "No one has confirmed yet.",
  "Material": "Kit", "Sem material na lista.": "No kit on the list.", "Ninguém atribuído": "Unassigned", "Ninguém": "No one",
  "Adicionar item (ex.: Coletes)": "Add item (e.g. Bibs)", "Bola": "Ball", "Coletes": "Bibs", "Bomba de ar": "Air pump",
  "Monta a tua equipa de fantasia com os jogadores do grupo e pontua com os jogos reais. Cria conta para jogar.": "Build your fantasy team from the group's players and score with the real games. Sign up to play.",
  "Golden Boot": "Golden Boot", "Best of the Day": "Best of the Day", "Playmaker": "Playmaker", "Golden Glove": "Golden Glove",
  "Histórico": "History", "sem votos": "no votes", "Apagar este dia de jogo": "Delete this matchday",
  "Link mensalista": "Regular link", "Prioridade nas confirmações": "Priority when confirming",
  "Link avulso": "Drop-in link", "Entra na lista de espera por defeito": "Starts on the waiting list by default",
  "Campo": "Pitch", "Jogo avulso": "One-off game", "Vagas por jogo": "Spots per game", "Convites": "Invites",
  "Copiar link": "Copy link", "Jogadores banidos": "Banned players", "Bloqueados de voltar a entrar": "Blocked from rejoining",
  "Desbanir": "Unban", "Remover do grupo": "Remove from group", "Desbloquear vaga": "Unlock spot",
  "Confirmar definitivamente": "Confirm for good", "fiabilidade": "reliability", "Gerir jogador": "Manage player",
  "ENCONTRAR JOGO": "FIND A GAME", "Jogos abertos perto de ti": "Open games near you",
  "Grupos com vagas livres para hoje e esta semana — entra num jogo com um toque.": "Groups with free spots today and this week — join a game in one tap.",

  // Positions & feet (stored values stay PT; only display is translated)
  "Guarda-redes": "Goalkeeper", "Defesa": "Defender", "Médio": "Midfielder", "Avançado": "Forward",
  "Direito": "Right", "Esquerdo": "Left", "Ambos": "Both",
  "anos": "yrs",

  // ── BottomNav ──────────────────────────────────────────
  "Jogo": "Game", "Clube": "Club", "Grupo": "Squad", "Perfil": "Profile",
  "Jogar": "Play", "Competir": "Compete", "Grupos": "Groups", "Desafios": "Challenges", "Competições": "Competitions", "Em breve": "Coming soon", "Definições": "Settings",
  // Context-scoped (see tCtx): the nav's Perfil tab is "Me" in EN.
  "nav:Perfil": "Me",

  // ── Redesign primitives (Chip, FormDots, TopBar…) ──────
  "form:V": "W", "form:E": "D", "form:D": "L",
  "Vitória": "Win", "Empate": "Draw", "Derrota": "Loss",
  "Forma recente": "Recent form",
  "Competição": "Competition", "Equipa": "Team",

  // ── LandingPage ────────────────────────────────────────
  "O teu jogo semanal,": "Your weekly game,",
  "organizado.": "organized.",
  "O PITCH junta tudo o que o teu grupo precisa: confirmações, contas do campo, sorteio de equipas, stats e o teu cartão de jogador.":
    "PITCH brings together everything your group needs: confirmations, pitch finances, team draws, stats and your player card.",
  "Criar conta grátis": "Create free account",
  "Já tenho conta": "I already have an account",
  "A APP": "THE APP",
  "Tudo o que o grupo precisa, numa app": "Everything the group needs, in one app",
  "Do «quem joga sábado?» ao golo da semana — sem stress para o organizador, sem desculpas para os atrasados.":
    "From “who's playing Saturday?” to the goal of the week — no stress for the organizer, no excuses for late payers.",
  "Jogos organizados": "Organized games",
  "Confirmações num toque, grelha de vagas em direto e lembretes automáticos. O jogo de sábado trata-se sozinho.":
    "One-tap confirmations, a live slot grid and automatic reminders. Saturday's game takes care of itself.",
  "Finanças do grupo": "Group finances",
  "A mensalidade do campo dividida por todos. Vês quem já pagou e cobras os atrasados pelo WhatsApp.":
    "The pitch fee split between everyone. See who's paid and chase late payers on WhatsApp.",
  "Reserva de campo": "Pitch booking",
  "O teu horário semanal fica garantido no clube — reservas e renovações diretamente na app.":
    "Your weekly slot is guaranteed at the club — bookings and renewals right in the app.",
  "O teu cartão": "Your card",
  "Estilo FUT: overall, atributos, posição e foto. O teu jogo, em cartão.":
    "FUT style: overall, attributes, position and photo. Your game, on a card.",
  "Ratings e stats": "Ratings & stats",
  "Golos, assistências, votação MVP e fiabilidade. A época toda fica registada.":
    "Goals, assists, MVP voting and reliability. The whole season on record.",
  "Partilha highlights, vota no Golo da Semana e convive com jogadores de outros grupos.":
    "Share highlights, vote for Goal of the Week and hang out with players from other groups.",
  "Eventos": "Events",
  "Pronto para o próximo jogo?": "Ready for the next game?",
  "Cria a tua conta, monta o teu cartão e entra em campo.":
    "Create your account, build your card and step onto the pitch.",
  "Criar conta na app": "Create account in the app",
  "PITCH Club · Matosinhos — Porto · versão beta": "PITCH Club · Matosinhos — Porto · beta version",

  // ── AuthForm / ResetPassword ───────────────────────────
  "Preenche email e palavra-passe.": "Fill in your email and password.",
  "A palavra-passe precisa de pelo menos 6 caracteres.": "The password needs at least 6 characters.",
  "Diz-nos o teu nome.": "Tell us your name.",
  "Conta criada! Confirma no email que te enviámos e depois faz login.":
    "Account created! Confirm via the email we sent you, then log in.",
  "Escreve o teu email primeiro — enviamos-te o link para lá.":
    "Type your email first — we'll send the link there.",
  "Enviámos-te um email com o link para criares uma nova palavra-passe. Vê também o spam.":
    "We've sent you an email with a link to create a new password. Check your spam folder too.",
  "Esqueceste-te da palavra-passe?": "Forgot your password?",
  "Nome completo": "Full name", "Como te chamas": "What's your name",
  "Telemóvel": "Phone", "tu@email.com": "you@email.com",
  "Palavra-passe": "Password", "mín. 6 caracteres": "min. 6 characters",
  "Criar conta ⚽": "Sign up ⚽",
  "Já tens conta? ": "Already have an account? ",
  "Ainda não tens conta? ": "Don't have an account yet? ",
  "Nova palavra-passe": "New password",
  "Palavra-passe alterada ✓ Já estás dentro.": "Password changed ✓ You're in.",
  "Ir para a app ⚽": "Go to the app ⚽",
  "Escolhe a nova palavra-passe da tua conta.": "Choose your account's new password.",
  "Confirmar palavra-passe": "Confirm password", "repete a mesma": "repeat it",
  "As palavras-passe não coincidem.": "The passwords don't match.",
  "Guardar nova palavra-passe": "Save new password",

  // ── AuthLanding / JoinGroup / NoGroupState ─────────────
  "O teu jogo semanal, organizado. ⚽": "Your weekly game, organized. ⚽",
  "Sou Jogador": "I'm a Player",
  "Cria o teu cartão FUT e entra no jogo": "Build your FUT card and get in the game",
  "Sou Organizador": "I'm an Organizer",
  "Define o campo, o horário e convida a malta": "Set the pitch, the schedule and invite the crew",
  "Painel de administrador": "Admin panel",
  "Versão de demonstração — os dados ficam só neste dispositivo":
    "Demo version — data stays on this device only",
  "← Voltar à página inicial": "← Back to home page",
  "Cola o código de convite do teu grupo.": "Paste your group's invite code.",
  "Entra num grupo": "Join a group",
  "Pede ao organizador o link ou o código de convite do grupo. Abrir o link do convite junta-te automaticamente.":
    "Ask the organizer for the group's invite link or code. Opening the invite link joins you automatically.",
  "Código de convite": "Invite code",
  "A entrar…": "Joining…", "Juntar-me ao grupo": "Join the group",
  "Ainda não tenho grupo": "I don't have a group yet",
  "Explora a app na mesma — entras num grupo quando quiseres.":
    "Explore the app anyway — join a group whenever you like.",
  "Ainda sem grupo": "No group yet",
  "Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e ver o Clube e o Social.":
    "Join a group with your organizer's invite link to see the game, the slot grid, the draw and the stats. Meanwhile, you can still build your card and check out the Club and Social.",
  "Entrar num grupo": "Join a group",
  "Procurar grupo perto de ti — em breve": "Find a group near you — coming soon",

  // ── Onboarding (player + organizer) ────────────────────
  "Estilo FUT — o cartão atualiza enquanto preenches.": "FUT style — the card updates as you fill it in.",
  "Trocar fotografia": "Change photo", "Adicionar fotografia": "Add photo",
  "Aparece no cartão e nos jogos": "Shows on your card and in games",
  "Alcunha (nome no cartão)": "Nickname (name on the card)",
  "Idade": "Age", "Nacionalidade": "Nationality", "Clube do coração": "Favourite club",
  "ex.: FC Porto, Real Madrid, Flamengo…": "e.g. FC Porto, Real Madrid, Flamengo…",
  "Posição": "Position", "Pé dominante": "Preferred foot",
  "A carregar foto…": "Uploading photo…", "Criar o meu cartão ⚽": "Create my card ⚽",
  "O teu grupo": "Your group",
  "Define o jogo semanal — depois é só convidar a malta.":
    "Set up the weekly game — then just invite the crew.",
  "Editar grupo": "Edit group",
  "Atualiza as definições do jogo — nada mais é apagado ou reenviado.":
    "Updates the game's settings — nothing else gets deleted or resent.",
  "Guardar alterações": "Save changes",
  "Cidade (para a previsão do tempo)": "City (for the weather forecast)",
  "Grupo e campo": "Group & pitch", "Nome do grupo": "Group name", "Campo / recinto": "Pitch / venue",
  "Dia e hora do jogo": "Game day & time", "Hora de início": "Start time",
  "Ainda não sei o dia/hora": "I don't know the day/time yet", "✓ Ainda não sei": "✓ Not sure yet",
  "Sem problema — o grupo fica criado e agendas o primeiro jogo mais tarde, na aba Jogo.": "No problem — the group is created and you can schedule the first game later, from the Game tab.",
  "Jogo recorrente": "Recurring game",
  "Abre a confirmação automaticamente todas as semanas": "Opens confirmations automatically every week",
  "As confirmações abrem em…": "Confirmations open on…", "…a esta hora": "…at this time",
  "Mensalidade": "Monthly fee",
  "Preço mensal do campo (€)": "Monthly pitch price (€)",
  "Nº de jogadores por jogo": "Players per game",
  "por jogador / mês": "per player / month",
  "O PITCH trata do resto": "PITCH handles the rest",
  "Convites e lembretes por WhatsApp": "Invites and reminders via WhatsApp",
  "Confirmações com grelha de vagas em direto": "Confirmations with a live slot grid",
  "Controlo de pagamentos por jogador": "Per-player payment tracking",
  "Sorteio de equipas equilibrado por posição": "Position-balanced team draw",
  "Stats, MVP e histórico de jogos": "Stats, MVP and game history",
  "Criar grupo e convidar 📣": "Create group & invite 📣",

  // ── JogoTab ────────────────────────────────────────────
  "PRÓXIMO JOGO": "NEXT GAME", "RECORRENTE": "RECURRING",
  "Copiar link do jogo": "Copy game link",
  "Alterar": "Change", "Alterar dia e hora do jogo": "Change game day & time", "Hora:": "Time:",
  "Nenhum jogo marcado": "No game scheduled",
  "Escolhe o dia e a hora do primeiro jogo do grupo.": "Pick the day and time for the group's first game.",
  "O organizador ainda não marcou o próximo jogo.": "The organizer hasn't scheduled the next game yet.",
  "Agendar primeiro jogo": "Schedule first game",
  "O próximo jogo passa para": "The next game moves to",
  " — e as próximas semanas também.": " — and the following weeks too.",
  "vaga em aberto": "spot open", "vagas em aberto": "spots open",
  "Equipa completa!": "Full squad!", "na lista de espera": "on the waiting list",
  "Nº de jogadores:": "Players:",
  "Ainda ninguém confirmou — sê o primeiro! ⚽": "No one's confirmed yet — be the first! ⚽",
  "Partilhar lista no WhatsApp": "Share list on WhatsApp",
  "Agora convida os jogadores 📣": "Now invite the players 📣",
  "Partilha o link — quem abrir entra logo no grupo.": "Share the link — whoever opens it joins the group right away.",
  "Confirmações ainda fechadas": "Confirmations still closed",
  "Abrem": "They open", "Vais poder confirmar num toque.": "You'll be able to confirm in one tap.",
  "Estás na lista de espera": "You're on the waiting list",
  "Entras automaticamente se alguém desistir. Sem pagar até entrares.":
    "You get in automatically if someone drops out. No payment until you're in.",
  "Estás dentro!": "You're in!",
  "Pago ✓ — bom jogo!": "Paid ✓ — have a good game!", "Falta pagar": "Still to pay",
  "Estás dentro — só falta a tua parte.": "You're in — just your share left to pay.",
  "Pagar": "Pay",
  "Disseste que não podes. Mudaste de ideias?": "You said you can't make it. Changed your mind?",
  "Afinal vou! Confirmar": "I'm in after all! Confirm",
  "Vais jogar?": "Are you playing?",
  "Jogo cheio — entra na lista de espera e entras se alguém desistir.":
    "Game's full — join the waiting list and you're in if someone drops out.",
  "Estou dentro!": "I'm in!", "Entrar na lista de espera": "Join the waiting list", "Não posso": "Can't make it",
  "Lista de espera": "Waiting list",
  "Por ordem de confirmação. Entra automaticamente quem está em 1º se um titular desistir":
    "In confirmation order. Whoever's 1st gets in automatically if a starter drops out",
  " — avisa-os por WhatsApp para estarem a postos.": " — ping them on WhatsApp so they're ready.",
  "Avisar": "Notify",
  "Sorteio de Equipas": "Team Draw",
  "Só o organizador (ou o auxiliar) pode sortear e renomear.": "Only the organizer (or assistant) can draw and rename.",
  "Faltam confirmações para sortear": "Not enough confirmations to draw",
  "Escolhe quantas equipas e sorteia — depois podes renomear.": "Pick how many teams and draw — you can rename after.",
  "Equipas:": "Teams:", "Re-sortear": "Re-draw", "Sortear": "Draw",
  "sem jogadores": "no players",
  "Sem resposta": "No reply",
  "jogador ainda não respondeu": "player hasn't replied yet",
  "jogadores ainda não responderam": "players haven't replied yet",
  "Lembrar todos": "Remind all", "Lembrar": "Remind",
  "NÃO PODEM": "CAN'T PLAY",
  "Material do Jogo": "Match Kit", "Adicionar item…": "Add item…", "atribuir…": "assign…",
  "Pagamentos": "Payments", "/jogador": "/player", "total": "total",
  "DEVEM PAGAR": "TO PAY", "Pago ✓": "Paid ✓",
  "JÁ PAGARAM": "ALREADY PAID", "Desfazer": "Undo",
  "Limpar sorteio": "Clear draw",
  "Confirmados": "Confirmed", "Faltam": "Still need",
  "confirma aqui:": "confirm here:",
  "Equipa completa! Vê tudo na app:": "Full squad! See everything in the app:",
  "Cobrar pelo WhatsApp": "Charge via WhatsApp", "Todos pagaram!": "Everyone's paid!",

  // ── Matchday / MatchTimer / MatchSummary ───────────────
  "Avulsa": "Casual", "Campeonato": "League",
  "Marca golos e assistências, sem tabela.": "Track goals and assists, no table.",
  "Pontos, saldo de golos e classificação.": "Points, goal difference and standings.",
  "Dia de jogo": "Matchday",
  "Escolhe o formato e começa a marcar os jogos.": "Pick the format and start scoring games.",
  "Sorteia as equipas para começar.": "Draw the teams to get started.",
  "Começar dia de jogo": "Start matchday",
  "DIA DE JOGO · AO VIVO": "MATCHDAY · LIVE",
  "CAMPEONATO": "LEAGUE", "AVULSA": "CASUAL",
  "CLASSIFICAÇÃO": "STANDINGS", "EQUIPA": "TEAM",
  "J": "P", "V-E-D": "W-D-L", "SG": "GD", "P": "Pts",
  "JOGO": "GAME",
  "MEIA-FINAL": "SEMIFINAL", "FINAL": "FINAL", "CAMPEÃO": "CHAMPION",

  // ── Matchday · Personalizado (custom tournament format) ─
  "Personalizado": "Custom",
  "Defines as tuas próprias regras — calendário automático.": "Set your own rules — the fixture list builds itself.",
  "PERSONALIZADO": "CUSTOM",
  "Confrontos": "Fixtures",
  "Único (cada equipa joga uma vez)": "Single (each team plays once)",
  "Ida e volta (repete confronto)": "Home & away (repeat fixture)",
  "Ter fase final (play-off)": "Add a play-off stage",
  "Quantas equipas vão à final:": "How many teams reach the play-offs:",
  "1º lugar da fase de grupos vai direto à final": "1st place from the group stage skips straight to the final",
  "Permitir grandes penalidades em caso de empate": "Allow a penalty shootout on a draw",
  "passa à próxima ronda": "advances to the next round",
  "Venceu nos pénaltis:": "Won on penalties:",
  "Empate — quem venceu nos pénaltis?": "Draw — who won on penalties?",
  "Avançar para a fase final": "Advance to the play-off",
  "Avançar de ronda": "Advance to next round",
  "Termina os jogos desta ronda para avançar.": "Finish this round's games to advance.",
  "Assistência de…": "Assist by…", "Golo dos": "Goal for", "— quem marcou?": "— who scored?",
  "Sem assistência": "No assist", "Golo": "Goal",
  "Quem joga agora?": "Who plays now?", "Escolhe duas equipas diferentes.": "Pick two different teams.",
  "Criar jogo": "Create game", "Novo jogo": "New game", "Terminar dia": "End matchday",
  "Clean sheets do GR escolhido e das Defesas contam ao terminar o dia.": "Clean sheets for the picked GK and the defenders count when the day ends.",
  "Cronómetro do jogo": "Match timer", "Fim do tempo!": "Time's up!",
  "Tirar 1 minuto": "Remove 1 minute", "Adicionar 1 minuto": "Add 1 minute",
  "Pausar": "Pause", "Retomar": "Resume", "Iniciar": "Start", "Repor": "Reset",
  "Resumo das partidas": "Match summary",
  "Inicia um dia de jogo para ver o resumo. ⚽": "Start a matchday to see the summary. ⚽",
  "ao vivo": "live", "último dia": "last matchday",
  "Resultado do último dia de jogo": "Last matchday's result",
  "Vitórias": "Wins", "Artilheiros": "Top scorers", "Assistências": "Assists",

  // ── GrupoTab ───────────────────────────────────────────
  "O Grupo": "The Squad",
  "CONFIRMADOS": "CONFIRMED", "SEM RESPOSTA": "NO REPLY",
  "AUXILIAR": "ASSISTANT",
  "Remover auxiliar": "Remove assistant", "Tornar auxiliar": "Make assistant",
  "Remover do jogo": "Remove from game", "Confirmar": "Confirm", "Apagar jogador": "Delete player",
  "Apagar": "Delete",
  "? Esta ação não pode ser desfeita — o jogador sai do grupo e perde o histórico.":
    "? This can't be undone — the player leaves the group and loses their history.",
  "Jogador avulso": "Guest player", "Nome do jogador": "Player name",
  "(opcional)": "(optional)", "ex.: 75": "e.g. 75",
  "Adicionar jogador": "Add player",
  "Adicionar jogador avulso (sem conta)": "Add guest player (no account)",
  "Adicionar ao grupo": "Add to the group",
  "Partilha o link de convite — quem abrir cria conta e entra logo no grupo.":
    "Share the invite link — whoever opens it creates an account and joins right away.",
  "Convida um amigo pelo link ou WhatsApp": "Invite a friend via link or WhatsApp",

  // ── StatsTab ───────────────────────────────────────────
  "Temporada": "Season",
  "ÚLTIMO DIA DE JOGO": "LAST MATCHDAY",
  "VOTAÇÃO MVP": "MVP VOTE", "pts": "pts",
  "Quem foram os 3 melhores em campo?": "Who were the 3 best on the pitch?",
  "1º lugar": "1st place", "2º lugar": "2nd place", "3º lugar": "3rd place",
  "✓ o teu voto": "✓ your vote",
  "Fechar votação e revelar o pódio": "Close voting & reveal the podium",
  "Pódio do último dia": "Last matchday's podium",
  "⚽ Golos": "⚽ Goals",
  "HISTÓRICO DE JOGOS": "GAME HISTORY",
  "votação a decorrer": "voting in progress",
  "Pago": "Paid", "Pendente": "Pending",

  // ── SocialTab ──────────────────────────────────────────
  "Amigos": "Friends",
  "A comunidade de futebol do PITCH": "The PITCH football community",
  "Partilha um momento, um golo, uma jogada…": "Share a moment, a goal, a play…",
  "A carregar ficheiro…": "Uploading file…", "Falha no upload:": "Upload failed:",
  "Foto": "Photo", "Vídeo": "Video", "Publicar": "Post",
  "Treino": "Workout", "Registar treino": "Log a workout",
  "Distância (km)": "Distance (km)", "Duração (min)": "Duration (min)",
  "Calorias (kcal)": "Calories (kcal)", "FC média (bpm)": "Avg. heart rate (bpm)",
  "Foto do jogo/local (opcional)": "Game/venue photo (optional)",
  "Uma legenda (opcional)…": "A caption (optional)…",
  "Juntar também os teus": "Also attach your", "do último jogo": "from the last game",
  "Falha ao gerar o cartão.": "Failed to generate the card.",
  "A gerar…": "Generating…", "Gerar cartão": "Generate card",
  "Publicar no feed": "Post to feed", "A publicar…": "Posting…",
  "Adicionar amigo": "Add friend", "PEDIDOS": "REQUESTS", "Aceitar": "Accept",
  "MEMBROS DO CLUBE": "CLUB MEMBERS",
  "Sem ninguém para adicionar por agora.": "No one to add right now.",
  "Sem grupo": "No group", "Pedido enviado": "Request sent",
  "Ainda não tens amigos por aqui. Toca em \"Adicionar amigo\" para começar. 🤝":
    "No friends here yet. Tap \"Add friend\" to get started. 🤝",
  "DO TEU GRUPO": "FROM YOUR SQUAD", "DOS TEUS AMIGOS": "FROM YOUR FRIENDS", "FEED DO CLUBE": "CLUB FEED",
  "Sem publicações de amigos ainda.": "No posts from friends yet.",
  "O teu grupo ainda não publicou nada.": "Your squad hasn't posted anything yet.",
  "Ainda não há publicações. Sê o primeiro! ⚽": "No posts yet. Be the first! ⚽",
  "· tu": "· you", "Apagar publicação?": "Delete post?",
  "Comentar": "Comment", "Escreve um comentário…": "Write a comment…",

  // ── PerfilTab / SecuritySection ────────────────────────
  "O Meu Cartão": "My Card", "Editar": "Edit", "Ver o meu": "View mine",
  "Lesionado": "Injured", "Marcar como lesionado": "Mark as injured", "Remover lesão": "Remove injury",
  "LENDA": "LEGEND", "OURO": "GOLD", "PRATA": "SILVER", "BRONZE": "BRONZE",
  "Não podes escalar um jogador lesionado.": "You can't field an injured player.",
  "Esse jogador está lesionado — a troca não pode ser aceite.": "That player is injured — the trade can't be accepted.",
  "Editar Perfil": "Edit Profile",
  "Telemóvel (MB Way)": "Phone (MB Way)",
  "AVALIAÇÃO DOS AMIGOS": "FRIENDS' RATINGS",
  "avaliações": "ratings",
  "O cartão mostra a média das avaliações que recebeste.": "The card shows the average of the ratings you've received.",
  "Faltam": "Still need", "avaliações para desbloquear o teu cartão.": "ratings to unlock your card.",
  "QUEM JÁ TE AVALIOU": "WHO'S RATED YOU",
  "Ainda ninguém te avaliou.": "No one's rated you yet.",
  "Pedir avaliação": "Request rating", "Inserir código": "Enter code",
  "Cola aqui o código recebido…": "Paste the code you received…",
  "Avaliação adicionada — o teu cartão já reflete a opinião ✓": "Rating added — your card now reflects it ✓",
  "Código inválido — confirma que copiaste tudo.": "Invalid code — make sure you copied everything.",
  "A tua avaliação de": "Your rating of", "Avaliar": "Rate",
  "Sê justo — a média com as avaliações dos outros amigos forma o cartão dele.":
    "Be fair — averaged with other friends' ratings, this forms their card.",
  "Atualizar avaliação": "Update rating", "Enviar avaliação": "Submit rating",
  "Avaliação enviada ✓": "Rating submitted ✓",
  "CONTACTO": "CONTACT",
  "TEMPORADA": "SEASON",
  "Jogos": "Games", "Golos": "Goals", "Presença": "Attendance", "G+A / jogo": "G+A / game",
  "PAGAMENTO": "PAYMENT", "Ativo ✓": "Active ✓",
  "Definições do grupo": "Group settings",
  "Campo, horário, mensalidade e vagas": "Pitch, schedule, monthly fee and spots",
  "Notificações": "Notifications",
  "Ativadas ✓ — avisamos quando entras no jogo": "On ✓ — we'll tell you when you get into the game",
  "Recebe aviso quando abrir vaga para ti": "Get notified when a spot opens for you",
  "Ativar": "Enable", "Notificações ativadas ✓": "Notifications enabled ✓",
  "Ver todos os grupos, jogadores e jogos": "See every group, player and game",
  "Repor demo": "Reset demo",
  "Idioma": "Language",
  "Tema": "Theme", "Escuro": "Dark", "Claro": "Light",
  "SEGURANÇA": "SECURITY",
  "Alterar palavra-passe": "Change password", "Define uma nova palavra-passe": "Set a new password",
  "Nova palavra-passe (mín. 6)": "New password (min. 6)",
  "Guardar palavra-passe": "Save password",
  "Trocar email": "Change email", "Atual:": "Current:", "Muda o email da conta": "Change your account email",
  "novo@email.com": "new@email.com", "Enviar confirmação": "Send confirmation",
  "Escreve um email válido.": "Enter a valid email.",
  "Enviámos um link de confirmação para": "We've sent a confirmation link to",
  " — o email só muda depois de o abrires.": " — the email only changes after you open it.",
  "Sair de todos os dispositivos": "Sign out of all devices",
  "Termina a sessão em todo o lado (incluindo aqui)": "Ends your session everywhere (including here)",
  "Terminar sessão em todos os dispositivos? Vais ter de voltar a entrar em todos, incluindo este.":
    "Sign out on every device? You'll have to log in again everywhere, including here.",
  "Palavra-passe alterada ✓": "Password changed ✓",

  // ── PitchApp dialogs / misc ────────────────────────────
  "Terminar o dia de jogo? As stats entram para a época e abre a votação MVP.":
    "End the matchday? Stats go into the season and MVP voting opens.",
  "Repor os dados de demonstração? As alterações locais serão perdidas.":
    "Reset the demo data? Local changes will be lost.",
  "A ligar ao clube…": "Connecting to the club…",
  "agora": "now",

  // ── FantasyTab (admin-only beta) ───────────────────────
  "Pitch Manager": "Pitch Manager",
  "Matchday": "Matchday",
  "Sorteio, cronómetro e marcação ao vivo.": "Team draw, timer and live scoring.",
  "Ainda não há Pitch Manager neste grupo.": "There's no Pitch Manager in this group yet.",
  "Criar Pitch Manager": "Create Pitch Manager",
  "Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.":
    "Pick your teammates each round and score with their real performance on the pitch.",
  "Nome da liga": "League name",
  "Orçamento": "Budget",
  "Jogadores por escalação": "Players per squad",
  "A tua escalação": "Your squad",
  "Escolhe": "Pick",
  "colegas e define o capitão (pontos em dobro).": "teammates and set a captain (double points).",
  "Capitão": "Captain",
  "Enviar para o banco": "Send to bench", "Tornar titular": "Make starter",
  "banco": "bench", "BANCO": "BENCH", "Sem suplente definido.": "No reserve set yet.",
  "Sem suplentes definidos.": "No reserves set yet.",
  "não pontua": "doesn't score",
  "Escalação guardada ✓": "Squad saved ✓",
  "Guardar escalação": "Save squad",
  "Editar escalação": "Edit squad",
  "Ainda sem capitão — toca na coroa de um jogador no campo.": "No captain yet — tap a player's crown on the pitch.",
  "Pesquisar por nome…": "Search by name…",
  "disponível": "available",
  "Oferta": "Offer",
  "Selecionados": "Selected",
  "Banco": "Bank",
  "Suplente": "Reserve", "Suplentes": "Reserves", "Tornar capitão": "Make captain", "Já é o capitão": "Already captain",
  "O capitão pontua a dobrar.": "The captain scores double.", "Toca num jogador no campo para o enviar para o banco.": "Tap a player on the pitch to bench them.",
  "Pontos": "Points", "na última jornada": "last round", "A minha equipa": "My team", "Liga": "League", "Mercado": "Market",
  "Terminada": "Ended", "Trancada": "Locked", "Ainda sem equipa": "No team yet", "Montar equipa": "Build my team", "ver cartão": "view card", "Managers com este jogador": "Managers who own this player",
  "Ainda sem capitão — toca num jogador no campo e escolhe «Tornar capitão».": "No captain yet — tap a player on the pitch and choose “Make captain”.",
  "Ofertas de troca": "Trade offers",
  "recebidas": "received", "enviadas": "sent",
  "RECEBIDAS": "RECEIVED", "ENVIADAS": "SENT",
  "A quem fazer a oferta": "Who to offer it to",
  "Jogador teu que libertas para abrir espaço": "Your player you're releasing to make room",
  "Troca direta": "Straight swap", "Dinheiro": "Cash",
  "Valor da oferta": "Offer amount",
  "Enviar oferta": "Send offer",
  "A tua oferta a": "Your offer to",
  "Em troca de:": "In exchange for:",
  "quer trocar contigo": "wants to trade with you",
  "Recebes:": "You get:", "dás:": "you give:",
  "Cancelar oferta": "Cancel offer",
  "Recusar": "Decline",
  "Classificação": "Leaderboard",
  "Ainda sem jornadas fechadas.": "No rounds locked in yet.",
  "jornadas": "rounds",
  "Última jornada": "Last round",
  "Pontos de cada participante": "Each participant's points",
  "Duração (meses, mín. 1)": "Duration (months, min. 1)",
  "Todos começam a": "Everyone starts at", "Com este orçamento dá para": "This budget affords",
  "jogadores de início.": "players to start.",
  "Escalação de": "Squad picked by",
  "Falta": "You're short", "tira alguém ou troca por um mais barato.": "drop someone or swap for a cheaper pick.",
  "PRÓXIMA TEMPORADA": "NEXT SEASON",
  "Liga terminada — consulta a classificação final abaixo.": "League ended — check the final standings below.",
  "Escalação trancada — falta menos de 8h para o jogo.": "Squad locked — less than 8h to kickoff.",
  "Por posição": "By position", "Por pontuação": "By points",
  "Todos os jogadores": "All players",
  "Não tens banco suficiente para esta oferta.": "You don't have enough bank for this offer.",
  "O teu banco": "Your bank", "Custo desta troca": "This trade's cost",
  "Banco insuficiente": "Not enough bank",
  "PREÇO": "PRICE", "PTS NA LIGA": "LEAGUE PTS", "DONOS": "OWNERS",
  "Gerar o meu card": "Create my card", "A gerar o teu card…": "Creating your card…",
  "Falha ao gerar o card.": "Couldn't create the card.", "Descarregar": "Download",
  "Que cartão queres gerar?": "Which card do you want to create?",
  "Cartão de jogo": "Match card", "Estilo FUT — golos, assistências e MVP da noite.": "FUT style — goals, assists and the night's MVP.",
  "Cartão de treino": "Workout card", "Estilo Strava — foto + dados do relógio.": "Strava style — photo + watch data.",

  // ── Matchday (goalkeeper picker) ────────────────────────
  "GR?": "GK?",

  // ── Achievements ─────────────────────────────────────────
  "CONQUISTAS": "ACHIEVEMENTS", "desbloqueadas": "unlocked",
  "Estreante": "Rookie", "Disputou o primeiro jogo": "Played your first game",
  "Bota de Ouro": "Golden Boot", "10 golos na temporada": "10 goals this season",
  "Criador de Jogo": "Playmaker", "10 assistências na temporada": "10 assists this season",
  "Veterano": "Veteran", "50 jogos disputados": "50 games played",
  "Muralha": "Brick Wall", "10 jogos sem sofrer golos": "10 clean sheets",
  "Rei da Noite": "King of the Night", "5 vezes eleito MVP": "Voted MVP 5 times",
  "Fiel": "Loyal", "90%+ de presença na temporada": "90%+ season attendance",
  "3 ou mais golos numa só partida": "3+ goals in a single match",
  "Show Particular": "One-Man Show", "Golo e assistência na mesma partida": "Goal and assist in the same match",
  "Herói da Vitória": "Match Hero", "MVP da noite com 2+ golos": "MVP of the night with 2+ goals",
  "Liderança": "Leadership", "Foi organizador ou auxiliar do grupo": "Was organizer or assistant of the group",
  "Bem-visto": "Well Liked", "Cartão com overall 80+ (avaliação dos colegas)": "Card with 80+ overall (peer-rated)",

  // ── Create group from Perfil ────────────────────────────
  "Criar grupo": "Create group", "Torna-te organizador do teu próprio jogo semanal": "Become the organizer of your own weekly game",

  // ── Live matchday, read-only for non-organizers ─────────
  "Aguarda o organizador começar o dia de jogo.": "Waiting for the organizer to start matchday.",
  "Empate — a aguardar o desempate por pénaltis.": "Tied — waiting for the penalty shootout result.",
  "A TUA EQUIPA": "YOUR TEAM",
  "Confirmar equipas": "Confirm teams", "Gerir equipas": "Manage teams", "Sorteio, nomes e trocas": "Draw, names and swaps",
  "As equipas foram confirmadas, mas não estás em nenhuma esta ronda.": "Teams were confirmed, but you're not on one this round.",
  "Equipas": "Teams",
  "O organizador está a preparar as equipas — aguarda a confirmação.": "The organizer is putting the teams together — wait for confirmation.",
  "Sorteado por": "Drawn by", "ainda por confirmar": "not confirmed yet",
  "confirmado por": "confirmed by", "Confirmado por": "Confirmed by",

  // ── Mensalista / avulso ──────────────────────────────────
  "Convidar mensalista": "Invite regular", "Convidar avulso": "Invite drop-in",
  "Tornar mensalista": "Make regular", "Tornar avulso": "Make drop-in",
  "AVULSO": "DROP-IN",
  "Confirmado definitivamente pelo organizador": "Locked in by the organizer",
  "Confirmar definitivamente (protege a vaga)": "Lock in (protects the spot)",
  "Desbloquear vaga (volta a poder ser trocado por um mensalista)": "Unlock spot (a regular member can bump them again)",
  "Convidado": "Guest", "Adicionar convidado (sem conta)": "Add guest (no account)",

  // ── Matchday: Tournament/Fixtures/Matchday Stats sub-nav ────
  "Torneio": "Tournament", "Jogos": "Fixtures", "Stats do Dia": "Matchday Stats",
  "FASE FINAL": "PLAY-OFFS", "bye": "bye",
  "Só é possível avançar para os play-offs quando todos os jogos desta fase estiverem concluídos.": "Can only advance to play-offs when all fixtures are concluded.",
  "CONCLUÍDO": "CONCLUDED", "Concluir jogo": "Conclude game", "Concluído": "Concluded",
  "Recolher": "Collapse", "Reabrir": "Reopen",
  "STATS DO DIA": "MATCHDAY STATS",
  "Ainda sem golos ou assistências registados hoje.": "No goals or assists logged yet today.",

  // ── Stats tab: ranking splits ────────────────────────────
  "Ranking Jogadores de Campo": "Onfield Ranking",
  "O mesmo cálculo do Impacto, só que restrito a quem joga fora da baliza.": "The same Impact calculation, restricted to outfield players.",
  "Ranking Guarda-redes": "Goalkeeper Ranking",
  "O mesmo cálculo de Guarda-redes, só que restrito a quem joga nessa posição.": "The same Goalkeeper calculation, restricted to players in that position.",
  "Voltar ao ranking": "Back to ranking",

  // ── Perfil as home: cross-group feed + group switcher ────
  "A TUA ATIVIDADE": "YOUR ACTIVITY", "Os teus grupos": "Your groups",
  "Olá": "Hey", "Início": "Home", "Cartão": "Card",

  // ── Teams (separate entity from Groups) ──────────────────
  "Times": "Teams", "Elenco": "Squad", "Adicionar": "Add",
  "Ninguém do grupo por adicionar.": "No one left in the group to add.",
  "Um time é diferente do grupo — tem nome, OVR e elenco próprios, e pode um dia desafiar outros times. Começa com o elenco deste grupo, mas depois cresce sozinho.":
    "A team is different from a group — it has its own name, OVR and squad, and can one day challenge other teams. It starts with this group's roster, but grows on its own from there.",
  "Criar Time a partir deste grupo": "Create a Team from this group",
  "Novo time": "New team", "Nome do time": "Team name",
  "O elenco inicial vem do grupo atual — dá para adicionar ou tirar gente depois.": "The initial squad comes from the current group — you can add or remove people afterwards.",
  "Criar": "Create", "A criar…": "Creating…",

  // ── Home: "just played" share banner ─────────────────────
  "ACABASTE DE JOGAR": "YOU JUST PLAYED", "Dispensar": "Dismiss",
  "novo recorde pessoal": "new personal best", "Partilhar o meu desempenho": "Share my performance",
  "golos": "goals", "assist.": "ast.",
  // ── Records: reopen a finished game ────────────────────
  "JOGOS": "GAMES", "toca num jogo para ver os detalhes": "tap a game for details",
  "Sem golos neste jogo": "No goals in this game", "próprio golo": "own goal",
  "grande defesa": "great save", "GR": "GK", "baliza a zero": "clean sheet",
  "Este dia foi encerrado antes do registo golo a golo: só há totais por jogador.": "This day was ended before goal-by-goal records existed: only per-player totals are available.",
  "jornadas seguidas": "matchdays in a row", "G+A na melhor noite": "G+A on your best night",
  "RESUMO RECENTE": "RECENT SUMMARY", "Baseado nas últimas jornadas carregadas, não a época inteira.": "Based on the most recently loaded matchdays, not the full season.",
  "Jornadas": "Matchdays", "Assist.": "Assists",

  // ── Perfil / Definições (redesign v1) ─────────────────────
  "Resumo": "Summary", "Conquistas": "Achievements", "Calendário": "Calendar",
  "Organizador": "Organizer", "Auxiliar": "Assistant", "Membro": "Member", "Plantel": "Squad",
  "Editar perfil": "Edit profile", "últimos": "last", "Grupos e equipas": "Groups & teams", "Ativo": "Active",
  "BANIR JOGADOR": "BAN PLAYER", "Impede": "Prevents",
  "de voltar a entrar neste grupo, mesmo com um novo convite. Escreve o nick dele para confirmar:": "from rejoining this group, even with a new invite. Type their nickname to confirm:",
  "A banir…": "Banning…", "Banir do grupo": "Ban from group",
  "Golos / jogo": "Goals / game", "Assist. / jogo": "Assists / game",
  "Todos os teus grupos · últimas jornadas carregadas, não a época inteira.": "All your groups · latest matchdays loaded, not the whole season.",
  "CONTA": "ACCOUNT", "GRUPO": "GROUP", "PREFERÊNCIAS": "PREFERENCES",
  "Admin · Clube": "Admin · Club", "Reservas de campo, eventos e jogos abertos": "Pitch bookings, events and open games",
  "Mais golos num jogo": "Most goals in a game", "Maior série a marcar": "Longest scoring streak",
  "dias de jogo seguidos com golo": "matchdays in a row with a goal", "G+A por jogo": "G+A per game",
  "na época": "this season", "Melhor noite": "Best night", "golos + assistências": "goals + assists",
  "Presenças seguidas": "Attendance streak", "jornadas sem falhar": "matchdays without missing", "RECORDES": "RECORDS",
  "Mês anterior": "Previous month", "Mês seguinte": "Next month", "golo": "goal",
  "Os dias em que jogas aparecem aqui, a verde-lima.": "The days you play show up here, in lime.",
  "defesas": "saves", "MVP do dia": "MVP of the day", "Jogou, sem golos/assistências registados.": "Played, no goals/assists recorded.",
  "Progresso": "Progress", "Precisas de pelo menos 2 dias de jogo para ver a tendência.": "You need at least 2 matchdays to see the trend.",
  "G+A por dia jogado": "G+A per matchday played", "por desbloquear": "locked",

  // ── Matchday (redesign v1) ───────────────────────────────
  "action:Defesa": "Save", "Assistência": "Assist", "MVP": "MVP", "LIVE": "LIVE", "Ao vivo": "Live", "Terminado": "Finished",
  "Convocados": "Called up", "Ainda ninguém confirmou para este jogo.": "Nobody has confirmed for this game yet.", "em lista de espera": "on the waiting list",
  "Confirmadas": "Confirmed", "Rascunho": "Draft", "Equipas em preparação": "Teams being prepared", "Equipas por sortear": "Teams not drawn yet",
  "Sorteio equilibrado": "Balanced draw", "Equilibrado por posição. Depois podes renomear e trocar jogadores.": "Balanced by position. You can rename teams and swap players afterwards.",
  "Número de equipas": "Number of teams", "Sortear equipas": "Draw teams", "Nome da equipa": "Team name", "A tua equipa": "Your team", "tu": "you", "Outras equipas": "Other teams",
  "Mover de equipa": "Move to team", "Jogadores sem equipa": "Players without a team", "Colocar em…": "Put in…",
  "Concluir edição": "Done editing", "Editar equipas": "Edit teams",
  "Formato e apito inicial": "Format and kick-off", "Sorteia e confirma as equipas para começar.": "Draw and confirm the teams to start.",
  "Formato": "Format", "Começar jogo": "Start match",
  "Golo de que equipa?": "Goal for which team?", "Próprio golo a favor de": "Own goal in favour of", "quem marcou?": "who scored?",
  "↩ Golo normal": "↩ Normal goal", "Foi próprio golo?": "Own goal?", "Assistência para que golo?": "Assist for which goal?",
  "Não há golos sem assistência neste jogo. Regista primeiro o golo — a assistência vem logo a seguir.": "No goals without an assist in this match. Log the goal first — the assist comes right after.",
  "Registar golo": "Log goal", "golo de": "goal by", "Defesa de que equipa?": "Save for which team?", "Grande defesa": "Great save",
  "Candidatos a MVP": "MVP contenders", "A votação MVP abre para todos quando terminares o jogo. Para já, quem está a brilhar:": "MVP voting opens for everyone when you end the match. For now, who's shining:",
  "Substituição": "Substitution", "subst.": "subs", "Quem entra?": "Who comes on?", "Quem sai?": "Who goes off?", "Desfazer substituição": "Undo substitution", "Fechar": "Close",
  "Permissão de microfone negada — ativa o microfone para este site nas definições do browser.": "Microphone permission denied — enable the microphone for this site in your browser settings.",
  "Este browser não permite reconhecimento de voz em páginas web (comum no Safari/iPhone) — experimenta no Chrome, num Android ou computador.": "This browser doesn't allow speech recognition on web pages (common on Safari/iPhone) — try Chrome on Android or a computer.",
  "Não percebi quem marcou em": "Couldn't tell who scored in", "Não ouvi nada — mantém premido enquanto falas.": "Didn't hear anything — keep holding while you speak.",
  "Ouvi:": "I heard:", "Próprio golo de": "Own goal by", "Golo de": "Goal by", "A ouvir…": "Listening…", "Golo por voz — mantém premido e fala": "Voice goal — hold and speak",
  "Desfazer último": "Undo last", "Lances": "Events", "Ainda sem lances. Usa os botões acima para registar.": "No events yet. Use the buttons above to log them.",
  "Ainda sem lances.": "No events yet.", "sem assistência": "no assist", "corrigir": "fix",
  "Clean sheets e defesas espetaculares do GR escolhido contam ao terminar o dia.": "Clean sheets and great saves for the chosen GK count when the day ends.",
  "Tática": "Tactics", "Stats do dia": "Matchday stats", "defesa": "save", "Terminar jogo": "End match",
  "Fecha o dia: as stats entram na época e abre a votação MVP.": "Closes the day: stats go into the season and MVP voting opens.",
  "Cancelar dia de jogo (começou errado)": "Cancel matchday (started by mistake)", "Fase final": "Knockout stage",
  "Mais vitórias": "Most wins", "Golos e assistências": "Goals and assists", "O teu card do jogo": "Your match card",
  "Os teus golos e assistências, pronto para o WhatsApp e Instagram.": "Your goals and assists, ready for WhatsApp and Instagram.",
  "Submeter ao Golo da Semana": "Submit to Goal of the Week", "Preparar o próximo jogo": "Prepare the next match",
  "Votaste": "Voted", "Votação MVP": "MVP vote", "Sem candidatos neste dia.": "No candidates for this day.",
  "Próximo jogo": "Next match", "dias": "days", "horas": "hours", "min": "min", "Ainda não há jogo marcado.": "No match scheduled yet.",
  "O Matchday acende no dia do jogo:": "Matchday lights up on game day:", "Equipas sorteadas e confirmadas": "Teams drawn and confirmed",
  "Marcador ao vivo, golo a golo": "Live score, goal by goal", "Votação MVP no fim": "MVP vote at the end", "Último Matchday": "Last matchday",
  "Mantém premido e diz \"soltar tempo\"": "Hold and say \"start time\"", "Permissão de microfone negada — ativa-a nas definições do browser.": "Microphone permission denied — enable it in your browser settings.",
  "Este browser não permite reconhecimento de voz (comum no Safari/iPhone) — experimenta no Chrome, num Android ou computador.": "This browser doesn't support speech recognition (common on Safari/iPhone) — try Chrome on Android or a computer.",
  "Não percebi — mantém premido enquanto dizes \"iniciar\" ou \"soltar tempo\".": "Didn't catch that — hold while you say \"start\" or \"start time\".",
  "Erro do microfone:": "Microphone error:",
  "Balizas a zero e defesas espetaculares do GR escolhido contam ao terminar o dia.": "Clean sheets and great saves for the chosen GK count when the day ends.",
  "Autogolo": "Own goal", "a favor de": "for", "quem marcou na própria baliza?": "who put it in their own net?", "Tipo de golo": "Goal type",
  "Conta para os": "Counts for", "Escolhe o jogador dos": "Pick the player from", "não entra nos golos dele.": "it doesn't count as their goal.",
  "Foi um adversário a marcar na própria baliza? Escolhe Autogolo.": "Did an opponent put it in their own net? Pick Own goal.",
  "A decorrer": "Running", "Em pausa": "Paused", "Configurar cronómetro": "Timer settings",
  "Balizas a zero": "Clean sheets", "autogolo": "own goal",
  // Competir — full season stats (moved from the group's StatsTab)
  // Home feed — identity items
  "Conquista desbloqueada": "Achievement unlocked", "O teu card chegou ao nível Lenda.": "Your card reached Legend tier.",
  "O card chegou ao nível Lenda.": "Their card reached Legend tier.", "Overall 86+ pela avaliação dos colegas": "86+ overall from teammates' ratings",
  "Ver": "View", "Mais": "More", "Mais rankings": "More rankings", "Forma": "Form", "Jogadores de campo": "Outfield players", "Só guarda-redes": "Goalkeepers only",
  "Sofridos": "Conceded", "Como se calcula?": "How is it calculated?", "Stats lado a lado e % de vitórias juntos": "Stats side by side and win % together",
  "Quem está mais completo esta época, tudo junto num só número: golo vale mais quanto mais longe da baliza adversária é a posição (2 Avançado, 2,5 Médio, 3 Defesa, 4 Guarda-redes), 1 por assistência, 1 por vitória, 3 por MVP, 1 por baliza a zero.": "Who's the most complete player this season, all in one number: a goal is worth more the further the position is from the opponent's goal (2 Forward, 2.5 Midfielder, 3 Defender, 4 Goalkeeper), 1 per assist, 1 per win, 3 per MVP, 1 per clean sheet.",
  "Balizas a zero (valem 3×) e defesas espetaculares — conta quem defendeu de verdade, não só quem joga na baliza.": "Clean sheets (worth 3×) and great saves — counts who actually kept, not just who plays in goal.",

  // ── Competir (redesign v1) ───────────────────────────────
  "Rankings": "Rankings", "Classificação da época": "Season standings", "Fiabilidade %": "Reliability %",
  "dias de jogo": "matchdays", "dia de jogo": "matchday", "Ninguém pontuou ainda nesta categoria.": "Nobody has scored in this category yet.",
  "Ver menos": "Show less", "Ver todos": "See all", "Jogador": "Player", "Ainda sem dias de jogo registados.": "No matchdays recorded yet.",
  "Pódio da jornada": "Matchday podium", "Votação MVP aberta": "MVP voting open",
  "Golo da Semana": "Goal of the Week", "últimos 7 dias": "last 7 days",
  "Ainda não há golos em vídeo esta semana. Publica o teu no feed — o vídeo com mais ⚽ Golaço ganha.": "No goal videos this week yet. Post yours in the feed — the video with the most ⚽ Golaço wins.",
  "O teu ⚽ Golaço é o voto. Ganha o vídeo com mais Golaços.": "Your ⚽ Golaço is your vote. The video with the most Golaços wins.",
  "Ainda sem jogos por aqui — quando jogares, a tua atividade aparece nesta tela.": "No games here yet — once you play, your activity shows up on this screen.",

  // ── Redesign v1 integration (Home actions, feed, Matchday after, demo) ──
  "CONFIRMA A TUA PRESENÇA": "CONFIRM YOUR SPOT", "PAGAMENTO EM FALTA": "PAYMENT DUE",
  "VOTAÇÃO MVP ABERTA": "MVP VOTING OPEN", "Votar MVP": "Vote MVP",
  "1º": "1st", "2º": "2nd", "3º": "3rd",
  "lidera com": "leads with", "Ver ranking": "See ranking",
  "Publicado no feed — o vídeo com mais ⚽ Golaço ganha.": "Posted to the feed — the video with the most ⚽ Golaço wins.",
  "Escolhe \"Vídeo\" e publica o teu golo. Os vídeos do grupo dos últimos 7 dias entram no Golo da Semana.": "Pick \"Video\" and post your goal. Group videos from the last 7 days enter Goal of the Week.",
  "Descreve o golo…": "Describe the goal…",
  "Indisponível na demonstração.": "Not available in the demo.",
  "Cancelar o dia de jogo em curso? Todos os golos e resultados registados até agora são apagados. As stats da época não são afetadas — ainda não foram gravadas.": "Cancel the matchday in progress? Every goal and result logged so far is deleted. Season stats aren't affected — they haven't been saved yet.",
  "Apagar o dia de jogo de": "Delete the matchday of",
  "As stats desse dia são retiradas da época de cada jogador. Esta ação não pode ser desfeita.": "That day's stats are removed from each player's season. This can't be undone.",
  "As stats da época foram gravadas, mas a pontuação da Fantasy falhou para este dia. Vai a Manager e usa \"Sincronizar\" para recuperar esta ronda.": "Season stats were saved, but Fantasy scoring failed for this day. Go to Manager and use \"Sync\" to recover this round.",
  // Stats (group page)
  "Impacto": "Impact", "Sobre-entrega": "Over-delivery", "Forma (últimos 5)": "Form (last 5)",
  "Melhor ataque (dia)": "Best attack (day)", "Melhor defesa (dia)": "Best defence (day)",
  "Quem está mais completo esta época, tudo junto num só número: golo vale mais quanto mais longe da baliza adversária é a posição (2 Avançado, 2,5 Médio, 3 Defesa, 4 Guarda-redes), 1 por assistência, 1 por vitória, 3 por MVP, 1 por clean sheet.": "Who's the most complete player this season, all in one number: a goal is worth more the further the position is from the opponent's goal (2 Forward, 2.5 Midfielder, 3 Defender, 4 Goalkeeper), 1 per assist, 1 per win, 3 per MVP, 1 per clean sheet.",
  "Total de golos marcados na época.": "Total goals scored this season.",
  "Total de assistências na época.": "Total assists this season.",
  "Vezes eleito MVP do dia.": "Times voted matchday MVP.",
  "Clean sheets (valem 3×) e defesas espetaculares — conta quem defendeu de verdade, não só quem joga na baliza.": "Clean sheets (worth 3×) and great saves — counts who actually kept, not just who plays in goal.",
  "Compara o ranking de avaliação (OVR dos colegas) com o ranking real de Impacto. Positivo = rende mais do que esperavam; negativo = rende menos. Só entra quem já tem 3+ avaliações.": "Compares the rating ranking (teammates' OVR) with the real Impact ranking. Positive = delivering more than expected; negative = less. Only players with 3+ ratings.",
  "O mesmo cálculo do Impacto, mas só dos últimos 5 dias de jogo — quem está em alta agora. 🔥 = a render bem acima da média da época.": "Same as Impact, but only the last 5 matchdays — who's hot right now. 🔥 = performing well above their season average.",
  "Mais golos marcados por uma equipa num único dia de jogo.": "Most goals scored by a team in a single matchday.",
  "Menos golos sofridos por uma equipa num único dia de jogo.": "Fewest goals conceded by a team in a single matchday.",
  "Comparar jogadores": "Compare players",
  "Escolhe 2 a 4 jogadores para comparar as stats e ver a % de vitórias quando jogam juntos.": "Pick 2 to 4 players to compare stats and see the win % when they play together.",
  "Escolhe pelo menos 2 jogadores.": "Pick at least 2 players.",
  "Ainda sem dias em que todos jogaram juntos na mesma equipa — passa a contar a partir do próximo dia de jogo.": "No days yet where they all played on the same team — it starts counting from the next matchday.",
  "Jogos juntos": "Games together", "% Vitórias": "Win %", "Golos marcados": "Goals scored", "Golos sofridos": "Goals conceded",
  "Ninguém tem ainda 3+ avaliações dos colegas para comparar.": "Nobody has 3+ teammate ratings to compare yet.",
  "Ainda sem dados.": "No data yet.",
  // Fantasy
  "Recupera jornadas em que as stats gravaram mas a pontuação Fantasy falhou": "Recovers rounds where stats saved but Fantasy scoring failed",
  "A sincronizar…": "Syncing…", "recuperada(s)": "recovered", "Tudo em dia": "All up to date", "Sincronizar": "Sync",
  "Oferta por": "Offer for",
  // Redesign v1 polish pass
  "Novidades": "What's new", "O meu perfil": "My profile", "clean sheet": "clean sheet",
  "A tua noite": "Your night", "Marco": "Milestone", "Progresso do dia de jogo": "Matchday progress", "balizas a zero": "clean sheets", "vitória": "win", "vitórias": "wins",
  // PhoneInput
  "Indicativo do país": "Country code",
  "Os telemóveis portugueses começam por 9.": "Portuguese mobile numbers start with 9.",
  "Este número parece curto demais — confirma.": "This number looks too short — double-check it.",
  "Este número parece longo demais — confirma.": "This number looks too long — double-check it.",
  "MB Way só funciona com números portugueses.": "MB Way only works with Portuguese numbers.",
};

const PT_BR = {
  // ── Dates ──────────────────────────────────────────────
  "Fev": "Fev", "Abr": "Abr", "Mai": "Mai", "Ago": "Ago", "Set": "Set", "Out": "Out", "Dez": "Dez",
  "às": "às",

  // ── Shared / generic ───────────────────────────────────
  "Guardar": "Salvar", "Voltar": "Voltar", "Sair": "Sair",
  "Partilhar": "Compartilhar",
  "A carregar…": "Carregando…",
  "(tu)": "(você)",

  // Positions & feet
  "Guarda-redes": "Goleiro", "Defesa": "Zagueiro", "Médio": "Meia", "Avançado": "Atacante",

  // ── LandingPage ────────────────────────────────────────
  "O teu jogo semanal,": "Seu jogo semanal,",
  "O PITCH junta tudo o que o teu grupo precisa: confirmações, contas do campo, sorteio de equipas, stats e o teu cartão de jogador.":
    "O PITCH reúne tudo o que seu grupo precisa: confirmações, contas do campo, sorteio de times, stats e seu cartão de jogador.",
  "Tudo o que o grupo precisa, numa app": "Tudo o que o grupo precisa, em um app",
  "Do «quem joga sábado?» ao golo da semana — sem stress para o organizador, sem desculpas para os atrasados.":
    "Do «quem joga sábado?» ao gol da semana — sem estresse pro organizador, sem desculpa pros atrasados.",
  "Confirmações num toque, grelha de vagas em direto e lembretes automáticos. O jogo de sábado trata-se sozinho.":
    "Confirmações em um toque, grade de vagas ao vivo e lembretes automáticos. O jogo de sábado se organiza sozinho.",
  "A mensalidade do campo dividida por todos. Vês quem já pagou e cobras os atrasados pelo WhatsApp.":
    "A mensalidade do campo dividida entre todos. Você vê quem já pagou e cobra os atrasados pelo WhatsApp.",
  "O teu horário semanal fica garantido no clube — reservas e renovações diretamente na app.":
    "Seu horário semanal fica garantido no clube — reservas e renovações direto no app.",
  "O teu cartão": "Seu cartão",
  "Estilo FUT: overall, atributos, posição e foto. O teu jogo, em cartão.":
    "Estilo FUT: overall, atributos, posição e foto. Seu jogo, em forma de cartão.",
  "Golos, assistências, votação MVP e fiabilidade. A época toda fica registada.":
    "Gols, assistências, votação de MVP e assiduidade. A temporada toda fica registrada.",
  "Partilha highlights, vota no Golo da Semana e convive com jogadores de outros grupos.":
    "Compartilhe highlights, vote no Gol da Semana e interaja com jogadores de outros grupos.",
  "Cria a tua conta, monta o teu cartão e entra em campo.":
    "Crie sua conta, monte seu cartão e entre em campo.",
  "Criar conta na app": "Criar conta no app",

  // ── LandingPage: feature sections (2026-09-22 revamp) ──
  "O teu jogo da semana,": "Seu jogo da semana,",
  "sem o caos do grupo.": "sem o caos do grupo.",
  "Confirmações, dinheiro, equipas e stats — tudo num só sítio. Pra ninguém perguntar «então, jogamos ou não?» outra vez.":
    "Confirmações, dinheiro, times e stats — tudo em um só lugar. Pra ninguém perguntar «então, vai rolar ou não?» de novo.",
  "Confirma o jogo,": "Confirme o jogo,",
  "não o caos.": "não o caos.",
  "Grelha de vagas em tempo real: todos veem quem já está dentro, quem falta e quantas vagas sobram — sem precisar de percorrer o histórico do grupo pra saber se o jogo vai sair.":
    "Grade de vagas em tempo real: todo mundo vê quem já está dentro, quem falta e quantas vagas sobram — sem precisar rolar o histórico do grupo pra saber se o jogo vai rolar.",
  "Um assistente": "Um assistente",
  "dentro do teu grupo.": "dentro do seu grupo.",
  "O Pitch AI vive no teu WhatsApp e fala a língua do grupo: avisa quando abre vaga, lembra quem ainda não confirmou e faz o resumo do jogo no dia seguinte — sem ninguém precisar de escrever nada.":
    "O Pitch AI mora no seu WhatsApp e fala a língua do grupo: avisa quando abre vaga, lembra quem ainda não confirmou e manda o resumo do jogo no dia seguinte — sem ninguém precisar escrever nada.",
  "Sabes sempre": "Você sempre sabe",
  "quem já pagou.": "quem já pagou.",
  "A mensalidade do campo dividida por todos, visível num toque. Chega de perguntar «faltam quantos?» no grupo — o organizador vê tudo numa só tela, e cobra os atrasados direto pelo WhatsApp.":
    "A mensalidade do campo dividida entre todos, visível em um toque. Chega de perguntar «faltam quantos?» no grupo — o organizador vê tudo em uma tela só, e cobra os atrasados direto pelo WhatsApp.",
  "Sorteio justo,": "Sorteio justo,",
  "jogo registado ao vivo.": "jogo registrado ao vivo.",
  "As equipas saem equilibradas por posição e overall, sem discussão sobre quem ficou com o time mais fraco. Cada golo e assistência entram na hora — com cronómetro e até por comando de voz — pra ninguém decorar nada até ao fim do jogo.":
    "Os times saem equilibrados por posição e overall, sem discussão sobre quem ficou com o time mais fraco. Cada gol e assistência entram na hora — com cronômetro e até por comando de voz — pra ninguém precisar decorar nada até o fim do jogo.",
  "A época inteira,": "A temporada inteira,",
  "num ranking só.": "em um ranking só.",
  "Golos, assistências, vitórias, MVPs e defesas viram um ranking de Impacto — quem está mais completo na época, num número só. E tem ranking à parte pros guarda-redes, porque clean sheet também vale ponto.":
    "Gols, assistências, vitórias, MVPs e defesas viram um ranking de Impacto — quem está mais completo na temporada, em um número só. E tem ranking à parte pros goleiros, porque clean sheet também vale ponto.",
  "A tua liga fantasy,": "Sua liga fantasy,",
  "dentro do próprio grupo.": "dentro do próprio grupo.",
  "Monta o plantel com um orçamento, escolhe o capitão (pontos em dobro) e troca jogadores com os teus amigos. O preço de cada jogador sobe e desce com o desempenho real dele em campo — a competição acontece por cima do próprio jogo da semana.":
    "Monte o elenco com um orçamento, escolha o capitão (pontos em dobro) e troque jogadores com seus amigos. O preço de cada jogador sobe e desce com o desempenho real dele em campo — a competição acontece em cima do próprio jogo da semana.",
  "O teu jogo,": "Seu jogo,",
  "em forma de cartão.": "em forma de cartão.",
  "Estilo FUT: overall calculado a partir dos teus atributos, posição e foto — com tiers de ouro, prata, bronze, ou LENDA se passares de 86. É a forma de mostrar quem é quem no grupo, sem ninguém discutir quem é o melhor jogador.":
    "Estilo FUT: overall calculado a partir dos seus atributos, posição e foto — com tiers de ouro, prata, bronze, ou LENDA se você passar de 86. É a forma de mostrar quem é quem no grupo, sem ninguém discutir quem é o melhor jogador.",

  // ── LandingPage: "Como funciona" (2026-09-22) ──────────
  "COMO FUNCIONA": "COMO FUNCIONA",
  "Do zero ao primeiro jogo": "Do zero ao primeiro jogo",
  "Cria a conta e o grupo": "Crie a conta e o grupo",
  "Nome do grupo, campo, dia da semana e hora, e como divides a mensalidade.":
    "Nome do grupo, campo, dia da semana e horário, e como você divide a mensalidade.",
  "Convida a malta pelo WhatsApp": "Convide a galera pelo WhatsApp",
  "Um link só — todos entram sem instalar nada a mais nem decorar palavra-passe.":
    "Um link só — todo mundo entra sem instalar nada a mais nem decorar senha.",
  "O jogo organiza-se sozinho": "O jogo se organiza sozinho",
  "Confirmações, sorteio de equipas, pagamentos e stats — toda semana, sem esforço.":
    "Confirmações, sorteio de times, pagamentos e stats — toda semana, sem esforço.",
  "Recebe o link do teu grupo": "Receba o link do seu grupo",
  "O organizador manda pelo WhatsApp — é só abrir.": "O organizador manda pelo WhatsApp — é só abrir.",
  "Cria o teu cartão": "Crie seu cartão",
  "Foto, posição e atributos — o teu FUT card em menos de um minuto.":
    "Foto, posição e atributos — seu cartão FUT em menos de um minuto.",
  "Confirma e entra em jogo": "Confirme e entre em jogo",
  "Um toque pra dizer que vais. Prontos, apareces na grelha.":
    "Um toque pra dizer que vai. Pronto, você aparece na grade.",

  // ── FirstRunTour (2026-09-23) ───────────────────────────
  "Fechar": "Fechar",
  "A grelha é o essencial": "A grade é o essencial",
  "10 lugares, preenchidos ou vazios. Confirma ou recusa num toque — é a primeira pergunta: \"temos jogo?\"":
    "10 vagas, preenchidas ou vazias. Confirme ou recuse em um toque — é a primeira pergunta: \"vai ter jogo?\"",
  "Matchday": "Matchday",
  "No dia do jogo, o organizador regista golos e assistências ao vivo. É o que alimenta as tuas estatísticas.":
    "No dia do jogo, o organizador registra gols e assistências ao vivo. É o que alimenta suas estatísticas.",
  "Compete": "Compete",
  "Classificações, MVP e fiabilidade da equipa — a memória do grupo, jogo após jogo.":
    "Classificações, MVP e assiduidade do time — a memória do grupo, jogo após jogo.",
  "O teu cartão estilo FUT. Os atributos sobem com as avaliações dos teus colegas de equipa.":
    "Seu cartão estilo FUT. Os atributos sobem com as avaliações dos seus colegas de time.",
  "Percebi, vamos a isto ⚽": "Entendi, bora pro jogo ⚽",
  "Seguinte": "Próximo",

  // ── AuthForm / ResetPassword ───────────────────────────
  "Preenche email e palavra-passe.": "Preencha email e senha.",
  "A palavra-passe precisa de pelo menos 6 caracteres.": "A senha precisa ter pelo menos 6 caracteres.",
  "Diz-nos o teu nome.": "Nos diga seu nome.",
  "Conta criada! Confirma no email que te enviámos e depois faz login.":
    "Conta criada! Confirme no email que enviamos e depois faça login.",
  "Escreve o teu email primeiro — enviamos-te o link para lá.":
    "Digite seu email primeiro — enviaremos o link para lá.",
  "Enviámos-te um email com o link para criares uma nova palavra-passe. Vê também o spam.":
    "Enviamos um email com o link para você criar uma nova senha. Confira também o spam.",
  "Esqueceste-te da palavra-passe?": "Esqueceu sua senha?",
  "Como te chamas": "Como você se chama",
  "Telemóvel": "Celular", "tu@email.com": "voce@email.com",
  "Palavra-passe": "Senha",
  "Já tens conta? ": "Já tem conta? ",
  "Ainda não tens conta? ": "Ainda não tem conta? ",
  "Nova palavra-passe": "Nova senha",
  "Palavra-passe alterada ✓ Já estás dentro.": "Senha alterada ✓ Você já está dentro.",
  "Ir para a app ⚽": "Ir para o app ⚽",
  "Escolhe a nova palavra-passe da tua conta.": "Escolha a nova senha da sua conta.",
  "Confirmar palavra-passe": "Confirmar senha",
  "As palavras-passe não coincidem.": "As senhas não coincidem.",
  "Guardar nova palavra-passe": "Salvar nova senha",

  // ── AuthLanding / JoinGroup / NoGroupState ─────────────
  "O teu jogo semanal, organizado. ⚽": "Seu jogo semanal, organizado. ⚽",
  "Cria o teu cartão FUT e entra no jogo": "Crie seu cartão FUT e entre no jogo",
  "Define o campo, o horário e convida a malta": "Defina o campo, o horário e convide a galera",
  "Versão de demonstração — os dados ficam só neste dispositivo":
    "Versão de demonstração — os dados ficam só neste aparelho",
  "Cola o código de convite do teu grupo.": "Cole o código de convite do seu grupo.",
  "Entra num grupo": "Entre em um grupo",
  "Pede ao organizador o link ou o código de convite do grupo. Abrir o link do convite junta-te automaticamente.":
    "Peça ao organizador o link ou o código de convite do grupo. Abrir o link do convite já te adiciona automaticamente.",
  "A entrar…": "Entrando…", "Juntar-me ao grupo": "Entrar no grupo",
  "Explora a app na mesma — entras num grupo quando quiseres.":
    "Explore o app do mesmo jeito — entre em um grupo quando quiser.",
  "Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e ver o Clube e o Social.":
    "Entre em um grupo com o link de convite do seu organizador para ver o jogo, a grade de vagas, o sorteio e as stats. Enquanto isso, você já pode criar seu cartão e ver o Clube e o Social.",
  "Entrar num grupo": "Entrar em um grupo",
  "Procurar grupo perto de ti — em breve": "Procurar grupo perto de você — em breve",

  // ── Onboarding (player + organizer) ────────────────────
  "Estilo FUT — o cartão atualiza enquanto preenches.": "Estilo FUT — o cartão atualiza enquanto você preenche.",
  "Trocar fotografia": "Trocar foto", "Adicionar fotografia": "Adicionar foto",
  "Alcunha (nome no cartão)": "Apelido (nome no cartão)",
  "Clube do coração": "Time do coração",
  "A carregar foto…": "Carregando foto…", "Criar o meu cartão ⚽": "Criar meu cartão ⚽",
  "O teu grupo": "Seu grupo",
  "Define o jogo semanal — depois é só convidar a malta.":
    "Defina o jogo semanal — depois é só convidar a galera.",
  "Atualiza as definições do jogo — nada mais é apagado ou reenviado.":
    "Atualize as configurações do jogo — nada mais é apagado ou reenviado.",
  "Guardar alterações": "Salvar alterações",
  "Campo / recinto": "Campo / local",
  "O PITCH trata do resto": "O PITCH cuida do resto",
  "Confirmações com grelha de vagas em direto": "Confirmações com grade de vagas ao vivo",
  "Controlo de pagamentos por jogador": "Controle de pagamentos por jogador",
  "Sorteio de equipas equilibrado por posição": "Sorteio de times equilibrado por posição",
  "Abre a confirmação automaticamente todas as semanas": "Abre a confirmação automaticamente toda semana",

  // ── JogoTab ────────────────────────────────────────────
  "Equipa completa!": "Time completo!",
  "Ainda ninguém confirmou — sê o primeiro! ⚽": "Ainda ninguém confirmou — seja o primeiro! ⚽",
  "Partilhar lista no WhatsApp": "Compartilhar lista no WhatsApp",
  "Agora convida os jogadores 📣": "Agora convide os jogadores 📣",
  "Partilha o link — quem abrir entra logo no grupo.": "Compartilhe o link — quem abrir já entra no grupo.",
  "Vais poder confirmar num toque.": "Você vai poder confirmar em um toque.",
  "Estás na lista de espera": "Você está na lista de espera",
  "Entras automaticamente se alguém desistir. Sem pagar até entrares.":
    "Você entra automaticamente se alguém desistir. Sem pagar até entrar.",
  "Estás dentro!": "Você está dentro!",
  "Disseste que não podes. Mudaste de ideias?": "Você disse que não pode. Mudou de ideia?",
  "Vais jogar?": "Vai jogar?",
  "Jogo cheio — entra na lista de espera e entras se alguém desistir.":
    "Jogo lotado — entre na lista de espera e você entra se alguém desistir.",
  "Por ordem de confirmação. Entra automaticamente quem está em 1º se um titular desistir":
    "Por ordem de confirmação. Quem está em 1º entra automaticamente se um titular desistir",
  " — avisa-os por WhatsApp para estarem a postos.": " — avise-os pelo WhatsApp para estarem prontos.",
  "Sorteio de Equipas": "Sorteio de Times",
  "Escolhe quantas equipas e sorteia — depois podes renomear.": "Escolha quantos times e sorteie — depois você pode renomear.",
  "Equipas:": "Times:",
  "confirma aqui:": "confirme aqui:",
  "Equipa completa! Vê tudo na app:": "Time completo! Veja tudo no app:",

  // ── Matchday / MatchTimer / MatchSummary ───────────────
  "Marca golos e assistências, sem tabela.": "Marque gols e assistências, sem tabela.",
  "Pontos, saldo de golos e classificação.": "Pontos, saldo de gols e classificação.",
  "Escolhe o formato e começa a marcar os jogos.": "Escolha o formato e comece a marcar os jogos.",
  "Sorteia as equipas para começar.": "Sorteie os times para começar.",
  "EQUIPA": "TIME",

  // ── Matchday · Personalizado ────────────────────────────
  "Defines as tuas próprias regras — calendário automático.": "Defina suas próprias regras — calendário automático.",
  "Único (cada equipa joga uma vez)": "Único (cada time joga uma vez)",
  "Quantas equipas vão à final:": "Quantos times vão à final:",
  "Permitir grandes penalidades em caso de empate": "Permitir pênaltis em caso de empate",
  "passa à próxima ronda": "passa para a próxima rodada",
  "Venceu nos pénaltis:": "Venceu nos pênaltis:",
  "Empate — quem venceu nos pénaltis?": "Empate — quem venceu nos pênaltis?",
  "Avançar de ronda": "Avançar de rodada",
  "Termina os jogos desta ronda para avançar.": "Termine os jogos desta rodada para avançar.",
  "Golo dos": "Gol dos", "Golo": "Gol",
  "Escolhe duas equipas diferentes.": "Escolha dois times diferentes.",
  "Clean sheets do GR escolhido e das Defesas contam ao terminar o dia.": "Clean sheets do goleiro escolhido e dos zagueiros contam ao terminar o dia.",
  "Cronómetro do jogo": "Cronômetro do jogo",
  "Tirar 1 minuto": "Tirar 1 minuto",
  "Repor": "Reiniciar",
  "Inicia um dia de jogo para ver o resumo. ⚽": "Inicie um dia de jogo para ver o resumo. ⚽",

  // ── GrupoTab ───────────────────────────────────────────
  "Partilha o link de convite — quem abrir cria conta e entra logo no grupo.":
    "Compartilhe o link de convite — quem abrir cria conta e já entra no grupo.",
  "Convida um amigo pelo link ou WhatsApp": "Convide um amigo pelo link ou WhatsApp",

  // ── StatsTab ───────────────────────────────────────────
  "✓ o teu voto": "✓ seu voto",
  "⚽ Golos": "⚽ Gols",
  "votação a decorrer": "votação em andamento",

  // ── SocialTab ──────────────────────────────────────────
  "Partilha um momento, um golo, uma jogada…": "Compartilhe um momento, um gol, uma jogada…",
  "A carregar ficheiro…": "Carregando arquivo…",
  "Ainda não tens amigos por aqui. Toca em \"Adicionar amigo\" para começar. 🤝":
    "Você ainda não tem amigos por aqui. Toque em \"Adicionar amigo\" para começar. 🤝",
  "DO TEU GRUPO": "DO SEU GRUPO", "DOS TEUS AMIGOS": "DOS SEUS AMIGOS",
  "O teu grupo ainda não publicou nada.": "Seu grupo ainda não publicou nada.",
  "Ainda não há publicações. Sê o primeiro! ⚽": "Ainda não há publicações. Seja o primeiro! ⚽",
  "· tu": "· você",
  "Escreve um comentário…": "Escreva um comentário…",

  // ── PerfilTab / SecuritySection ─────────────────────────
  "Não podes escalar um jogador lesionado.": "Você não pode escalar um jogador lesionado.",
  "Esse jogador está lesionado — a troca não pode ser aceite.": "Esse jogador está lesionado — a troca não pode ser aceita.",
  "Telemóvel (MB Way)": "Celular (MB Way)",
  "O cartão mostra a média das avaliações que recebeste.": "O cartão mostra a média das avaliações que você recebeu.",
  "avaliações para desbloquear o teu cartão.": "avaliações para desbloquear seu cartão.",
  "QUEM JÁ TE AVALIOU": "QUEM JÁ AVALIOU VOCÊ",
  "Ainda ninguém te avaliou.": "Ainda ninguém avaliou você.",
  "Cola aqui o código recebido…": "Cole aqui o código recebido…",
  "Avaliação adicionada — o teu cartão já reflete a opinião ✓": "Avaliação adicionada — seu cartão já reflete a opinião ✓",
  "Código inválido — confirma que copiaste tudo.": "Código inválido — confirme que copiou tudo.",
  "A tua avaliação de": "Sua avaliação de",
  "Sê justo — a média com as avaliações dos outros amigos forma o cartão dele.":
    "Seja justo — a média com as avaliações dos outros amigos forma o cartão dele.",
  "CONTACTO": "CONTATO",
  "Golos": "Gols",
  "Definições do grupo": "Configurações do grupo",
  "Ativadas ✓ — avisamos quando entras no jogo": "Ativadas ✓ — avisamos quando você entra no jogo",
  "Recebe aviso quando abrir vaga para ti": "Receba aviso quando abrir vaga para você",
  "Repor demo": "Reiniciar demo",
  "Alterar palavra-passe": "Alterar senha", "Define uma nova palavra-passe": "Defina uma nova senha",
  "Nova palavra-passe (mín. 6)": "Nova senha (mín. 6)",
  "Guardar palavra-passe": "Salvar senha",
  "Muda o email da conta": "Mude o email da conta",
  "Escreve um email válido.": "Escreva um email válido.",
  "Enviámos um link de confirmação para": "Enviamos um link de confirmação para",
  " — o email só muda depois de o abrires.": " — o email só muda depois de você abrir.",
  "Sair de todos os dispositivos": "Sair de todos os aparelhos",
  "Termina a sessão em todo o lado (incluindo aqui)": "Encerra a sessão em todos os lugares (incluindo aqui)",
  "Terminar sessão em todos os dispositivos? Vais ter de voltar a entrar em todos, incluindo este.":
    "Encerrar sessão em todos os aparelhos? Você vai precisar entrar de novo em todos, incluindo este.",
  "Palavra-passe alterada ✓": "Senha alterada ✓",

  // ── PitchApp dialogs / misc ─────────────────────────────
  "Terminar o dia de jogo? As stats entram para a época e abre a votação MVP.":
    "Terminar o dia de jogo? As stats entram para a temporada e abre a votação de MVP.",
  "Repor os dados de demonstração? As alterações locais serão perdidas.":
    "Reiniciar os dados de demonstração? As alterações locais serão perdidas.",
  "A ligar ao clube…": "Conectando ao clube…",

  // ── FantasyTab / Pitch Manager ───────────────────────────
  "Sorteio, cronómetro e marcação ao vivo.": "Sorteio, cronômetro e marcação ao vivo.",
  "Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.":
    "Escale seus colegas a cada rodada e pontue com o desempenho real deles em campo.",
  "A tua escalação": "Sua escalação",
  "Escolhe": "Escolha",
  "colegas e define o capitão (pontos em dobro).": "colegas e defina o capitão (pontos em dobro).",
  "Escalação guardada ✓": "Escalação salva ✓",
  "Guardar escalação": "Salvar escalação",
  "Ainda sem capitão — toca na coroa de um jogador no campo.": "Ainda sem capitão — toque na coroa de um jogador no campo.",
  "Jogador teu que libertas para abrir espaço": "Jogador seu que você libera para abrir espaço",
  "A tua oferta a": "Sua oferta a",
  "quer trocar contigo": "quer trocar com você",
  "Recebes:": "Você recebe:", "dás:": "você dá:",
  "Ainda sem jornadas fechadas.": "Ainda sem rodadas fechadas.",
  "jornadas": "rodadas",
  "Última jornada": "Última rodada",
  "tira alguém ou troca por um mais barato.": "tire alguém ou troque por um mais barato.",
  "Liga terminada — consulta a classificação final abaixo.": "Liga terminada — consulte a classificação final abaixo.",
  "Escalação trancada — falta menos de 8h para o jogo.": "Escalação travada — falta menos de 8h para o jogo.",
  "Não tens banco suficiente para esta oferta.": "Você não tem saldo suficiente para esta oferta.",
  "O teu banco": "Seu saldo",
  "Banco insuficiente": "Saldo insuficiente",
  "A gerar o teu card…": "Gerando seu card…",
  "Descarregar": "Baixar",

  // ── Achievements ─────────────────────────────────────────
  "Bota de Ouro": "Chuteira de Ouro", "10 golos na temporada": "10 gols na temporada",
  "Empate — a aguardar o desempate por pénaltis.": "Empate — aguardando o desempate por pênaltis.",
  "A TUA EQUIPA": "SEU TIME",
  "Confirmar equipas": "Confirmar times", "Gerir equipas": "Gerenciar times",
  "As equipas foram confirmadas, mas não estás em nenhuma esta ronda.": "Os times foram confirmados, mas você não está em nenhum nesta rodada.",
  "Equipas": "Times",
  "O organizador está a preparar as equipas — aguarda a confirmação.": "O organizador está preparando os times — aguarde a confirmação.",
  "10 jogos sem sofrer golos": "10 jogos sem sofrer gols",
  "5 vezes eleito MVP": "5 vezes eleito MVP",
  "3 ou mais golos numa só partida": "3 ou mais gols em uma só partida",
  "Golo e assistência na mesma partida": "Gol e assistência na mesma partida",
  "MVP da noite com 2+ golos": "MVP da noite com 2+ gols",
  // PhoneInput
  "Indicativo do país": "Código do país",
  "Os telemóveis portugueses começam por 9.": "Os celulares portugueses começam com 9.",
  "Este número parece curto demais — confirma.": "Esse número parece curto demais — confira.",
  "Este número parece longo demais — confirma.": "Esse número parece longo demais — confira.",
  "MB Way só funciona com números portugueses.": "O MB Way só funciona com números portugueses.",
};

const DICTS = { en: EN, "pt-br": PT_BR };
