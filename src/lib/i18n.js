/**
 * Lightweight i18n: the source of truth is the PT-PT string in the code;
 * t() looks it up in the EN dictionary and falls back to PT when missing,
 * so untranslated corners degrade gracefully instead of breaking.
 *
 * The language lives in localStorage under the app prefix (same key that
 * usePersistentState("lang") uses in PitchApp — PitchApp re-renders the
 * tree on change; this module just mirrors the current value for t()).
 */

const LANG_KEY = "pitch.v2.lang";

let current = (() => {
  try {
    return JSON.parse(localStorage.getItem(LANG_KEY)) || "pt";
  } catch {
    return "pt";
  }
})();

export const getLang = () => current;
export const setLang = (l) => {
  current = l === "en" ? "en" : "pt";
  try { localStorage.setItem(LANG_KEY, JSON.stringify(current)); } catch { /* in-memory only */ }
};

export const t = (s) => (current === "pt" ? s : (EN[s] ?? s));

// Attribute names get their own map: "Defesa" the position translates to
// "Defender", but "Defesa" the attribute is "Defending" — can't share a key.
const ATTRS_PT = { rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };
const ATTRS_EN = { rit: "Pace", rem: "Shooting", pas: "Passing", dri: "Dribbling", def: "Defending", fis: "Physical" };
export const attrName = (k) => (current === "pt" ? ATTRS_PT[k] : ATTRS_EN[k]);

const EN = {
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

  // Positions & feet (stored values stay PT; only display is translated)
  "Guarda-redes": "Goalkeeper", "Defesa": "Defender", "Médio": "Midfielder", "Avançado": "Forward",
  "Direito": "Right", "Esquerdo": "Left", "Ambos": "Both",
  "anos": "yrs",

  // ── BottomNav ──────────────────────────────────────────
  "Jogo": "Game", "Clube": "Club", "Grupo": "Squad", "Perfil": "Profile",

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
  "Grupo e campo": "Group & pitch", "Nome do grupo": "Group name", "Campo / recinto": "Pitch / venue",
  "Dia e hora do jogo": "Game day & time", "Hora de início": "Start time",
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
  "Assistência de…": "Assist by…", "Golo dos": "Goal for", "— quem marcou?": "— who scored?",
  "Sem assistência": "No assist", "Golo": "Goal",
  "Quem joga agora?": "Who plays now?", "Escolhe duas equipas diferentes.": "Pick two different teams.",
  "Criar jogo": "Create game", "Novo jogo": "New game", "Terminar dia": "End matchday",
  "Clean sheets do GR escolhido e das Defesas contam ao terminar o dia.": "Clean sheets for the picked GK and the defenders count when the day ends.",
  "Cronómetro do jogo": "Match timer", "Fim do tempo!": "Time's up!",
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
  "Fantasy": "Fantasy",
  "Ainda não há Liga Fantasy neste grupo.": "There's no Fantasy League in this group yet.",
  "Criar Liga Fantasy": "Create Fantasy League",
  "Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.":
    "Pick your teammates each round and score with their real performance on the pitch.",
  "Nome da liga": "League name",
  "Orçamento": "Budget",
  "Jogadores por escalação": "Players per squad",
  "A tua escalação": "Your squad",
  "Escolhe": "Pick",
  "colegas e define o capitão (pontos em dobro).": "teammates and set a captain (double points).",
  "Capitão": "Captain",
  "Escalação guardada ✓": "Squad saved ✓",
  "Guardar escalação": "Save squad",
  "Classificação": "Leaderboard",
  "Ainda sem jornadas fechadas.": "No rounds locked in yet.",
  "jornadas": "rounds",
  "Última jornada": "Last round",
  "Pontos de cada participante": "Each participant's points",
  "Duração (meses, mín. 1)": "Duration (months, min. 1)",
  "Todos começam a $": "Everyone starts at $", "Com este orçamento dá para": "This budget affords",
  "jogadores de início.": "players to start.",
  "Escalação de": "Squad picked by", "Arrasta um jogador para trocar de posição": "Drag a player to swap spots",
  "Falta": "You're short", "tira alguém ou troca por um mais barato.": "drop someone or swap for a cheaper pick.",
  "PRÓXIMA TEMPORADA": "NEXT SEASON",
  "Liga terminada — consulta a classificação final abaixo.": "League ended — check the final standings below.",
  "Escalação trancada — falta menos de 8h para o jogo.": "Squad locked — less than 8h to kickoff.",

  // ── Matchday (goalkeeper picker) ────────────────────────
  "GR?": "GK?",
};
