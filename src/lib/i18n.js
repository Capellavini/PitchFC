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
 * Supported: "pt" (PT-PT, the identity/source language), "pt-br", "en", "it".
 */

const LANG_KEY = "pitch.v2.lang";
const SUPPORTED = ["pt", "pt-br", "en", "it"];

/** Maps the browser's own language preference (navigator.language, no
 *  permission needed, no geolocation) to one of our 4 dictionaries —
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
      if (l.startsWith("it")) return "it";
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

// Attribute names get their own map: "Defesa" the position translates to
// "Defender", but "Defesa" the attribute is "Defending" — can't share a key.
const ATTRS_PT = { rit: "Ritmo", rem: "Remate", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };
const ATTRS_PT_BR = { rit: "Ritmo", rem: "Finalização", pas: "Passe", dri: "Drible", def: "Defesa", fis: "Físico" };
const ATTRS_EN = { rit: "Pace", rem: "Shooting", pas: "Passing", dri: "Dribbling", def: "Defending", fis: "Physical" };
const ATTRS_IT = { rit: "Ritmo", rem: "Tiro", pas: "Passaggio", dri: "Dribbling", def: "Difesa", fis: "Fisico" };
const ATTRS_DICTS = { "pt-br": ATTRS_PT_BR, en: ATTRS_EN, it: ATTRS_IT };
export const attrName = (k) => (current === "pt" ? ATTRS_PT[k] : (ATTRS_DICTS[current]?.[k] ?? ATTRS_PT[k]));

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
  "Editar grupo": "Edit group",
  "Atualiza as definições do jogo — nada mais é apagado ou reenviado.":
    "Updates the game's settings — nothing else gets deleted or resent.",
  "Guardar alterações": "Save changes",
  "Cidade (para a previsão do tempo)": "City (for the weather forecast)",
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
  "MEIA-FINAL": "SEMIFINAL", "FINAL": "FINAL", "CAMPEÃO": "CHAMPION",

  // ── Matchday · Personalizado (custom tournament format) ─
  "Personalizado": "Custom",
  "Defines as tuas próprias regras — calendário automático.": "Set your own rules — the fixture list builds itself.",
  "PERSONALIZADO": "CUSTOM",
  "Confrontos": "Fixtures",
  "Único (cada equipa joga uma vez)": "Single (each team plays once)",
  "Ida e volta (repete confronto)": "Home & away (repeat fixture)",
  "Ter fase final (play-off)": "Add a play-off stage",
  "Quantas equipas vão à final:": "How many teams reach the final:",
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
  "Vais juntar também os teus": "You'll also attach your", "do último jogo.": "from the last game.",
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
};

const IT = {
  // ── Dates ──────────────────────────────────────────────
  "Domingo": "Domenica", "Segunda": "Lunedì", "Terça": "Martedì", "Quarta": "Mercoledì",
  "Quinta": "Giovedì", "Sexta": "Venerdì", "Sábado": "Sabato",
  "Dom": "Dom", "Seg": "Lun", "Ter": "Mar", "Qua": "Mer", "Qui": "Gio", "Sex": "Ven", "Sáb": "Sab",
  "Fev": "Feb", "Abr": "Apr", "Mai": "Mag", "Ago": "Ago", "Set": "Set", "Out": "Ott", "Dez": "Dic",
  "às": "alle",

  // ── Shared / generic ───────────────────────────────────
  "Guardar": "Salva", "Cancelar": "Annulla", "Voltar": "Indietro", "Sair": "Esci",
  "Adicionar": "Aggiungi", "Remover": "Rimuovi", "Copiado": "Copiato", "Partilhar": "Condividi",
  "Convidar": "Invita", "Um momento…": "Un momento…", "A carregar…": "Caricamento…",
  "jogo": "partita", "jogos": "partite", "jogadores": "giocatori", "jogador": "giocatore",
  "(tu)": "(tu)", "não definido": "non impostato", "Entrar": "Accedi", "Criar conta": "Crea account",

  "Guarda-redes": "Portiere", "Defesa": "Difensore", "Médio": "Centrocampista", "Avançado": "Attaccante",
  "Direito": "Destro", "Esquerdo": "Sinistro", "Ambos": "Entrambi",
  "anos": "anni",

  // ── BottomNav ──────────────────────────────────────────
  "Jogo": "Partita", "Clube": "Club", "Grupo": "Gruppo", "Perfil": "Profilo",

  // ── LandingPage ────────────────────────────────────────
  "O teu jogo semanal,": "La tua partita settimanale,",
  "organizado.": "organizzata.",
  "O PITCH junta tudo o que o teu grupo precisa: confirmações, contas do campo, sorteio de equipas, stats e o teu cartão de jogador.":
    "PITCH riunisce tutto ciò di cui il tuo gruppo ha bisogno: conferme, conti campo, sorteggio delle squadre, statistiche e la tua carta giocatore.",
  "Criar conta grátis": "Crea account gratis",
  "Já tenho conta": "Ho già un account",
  "A APP": "L'APP",
  "Tudo o que o grupo precisa, numa app": "Tutto ciò di cui il gruppo ha bisogno, in un'app",
  "Do «quem joga sábado?» ao golo da semana — sem stress para o organizador, sem desculpas para os atrasados.":
    "Dal «chi gioca sabato?» al gol della settimana — zero stress per l'organizzatore, zero scuse per i ritardatari.",
  "Jogos organizados": "Partite organizzate",
  "Confirmações num toque, grelha de vagas em direto e lembretes automáticos. O jogo de sábado trata-se sozinho.":
    "Conferme con un tocco, griglia dei posti in diretta e promemoria automatici. La partita di sabato si organizza da sola.",
  "Finanças do grupo": "Finanze del gruppo",
  "A mensalidade do campo dividida por todos. Vês quem já pagou e cobras os atrasados pelo WhatsApp.":
    "La quota mensile del campo divisa tra tutti. Vedi chi ha già pagato e solleciti i ritardatari su WhatsApp.",
  "Reserva de campo": "Prenotazione campo",
  "O teu horário semanal fica garantido no clube — reservas e renovações diretamente na app.":
    "Il tuo orario settimanale è garantito al club — prenotazioni e rinnovi direttamente nell'app.",
  "O teu cartão": "La tua carta",
  "Estilo FUT: overall, atributos, posição e foto. O teu jogo, em cartão.":
    "Stile FUT: overall, attributi, posizione e foto. Il tuo gioco, in una carta.",
  "Ratings e stats": "Valutazioni e statistiche",
  "Golos, assistências, votação MVP e fiabilidade. A época toda fica registada.":
    "Gol, assist, votazione MVP e affidabilità. Tutta la stagione resta registrata.",
  "Partilha highlights, vota no Golo da Semana e convive com jogadores de outros grupos.":
    "Condividi gli highlight, vota il Gol della Settimana e interagisci con giocatori di altri gruppi.",
  "Eventos": "Eventi",
  "Pronto para o próximo jogo?": "Pronto per la prossima partita?",
  "Cria a tua conta, monta o teu cartão e entra em campo.":
    "Crea il tuo account, costruisci la tua carta ed entra in campo.",
  "Criar conta na app": "Crea account nell'app",
  "PITCH Club · Matosinhos — Porto · versão beta": "PITCH Club · Matosinhos — Porto · versione beta",

  // ── AuthForm / ResetPassword ───────────────────────────
  "Preenche email e palavra-passe.": "Inserisci email e password.",
  "A palavra-passe precisa de pelo menos 6 caracteres.": "La password deve avere almeno 6 caratteri.",
  "Diz-nos o teu nome.": "Dicci il tuo nome.",
  "Conta criada! Confirma no email que te enviámos e depois faz login.":
    "Account creato! Conferma tramite l'email che ti abbiamo inviato e poi accedi.",
  "Escreve o teu email primeiro — enviamos-te o link para lá.":
    "Scrivi prima la tua email — ti invieremo lì il link.",
  "Enviámos-te um email com o link para criares uma nova palavra-passe. Vê também o spam.":
    "Ti abbiamo inviato un'email con il link per creare una nuova password. Controlla anche lo spam.",
  "Esqueceste-te da palavra-passe?": "Hai dimenticato la password?",
  "Nome completo": "Nome completo", "Como te chamas": "Come ti chiami",
  "Telemóvel": "Telefono", "tu@email.com": "tu@email.com",
  "Palavra-passe": "Password", "mín. 6 caracteres": "min. 6 caratteri",
  "Criar conta ⚽": "Crea account ⚽",
  "Já tens conta? ": "Hai già un account? ",
  "Ainda não tens conta? ": "Non hai ancora un account? ",
  "Nova palavra-passe": "Nuova password",
  "Palavra-passe alterada ✓ Já estás dentro.": "Password cambiata ✓ Sei dentro.",
  "Ir para a app ⚽": "Vai all'app ⚽",
  "Escolhe a nova palavra-passe da tua conta.": "Scegli la nuova password del tuo account.",
  "Confirmar palavra-passe": "Conferma password", "repete a mesma": "ripetila",
  "As palavras-passe não coincidem.": "Le password non coincidono.",
  "Guardar nova palavra-passe": "Salva nuova password",

  // ── AuthLanding / JoinGroup / NoGroupState ─────────────
  "O teu jogo semanal, organizado. ⚽": "La tua partita settimanale, organizzata. ⚽",
  "Sou Jogador": "Sono Giocatore",
  "Cria o teu cartão FUT e entra no jogo": "Crea la tua carta FUT ed entra in partita",
  "Sou Organizador": "Sono Organizzatore",
  "Define o campo, o horário e convida a malta": "Imposta il campo, l'orario e invita gli amici",
  "Painel de administrador": "Pannello amministratore",
  "Versão de demonstração — os dados ficam só neste dispositivo":
    "Versione demo — i dati restano solo su questo dispositivo",
  "← Voltar à página inicial": "← Torna alla home",
  "Cola o código de convite do teu grupo.": "Incolla il codice di invito del tuo gruppo.",
  "Entra num grupo": "Entra in un gruppo",
  "Pede ao organizador o link ou o código de convite do grupo. Abrir o link do convite junta-te automaticamente.":
    "Chiedi all'organizzatore il link o il codice di invito del gruppo. Aprire il link ti aggiunge automaticamente.",
  "Código de convite": "Codice di invito",
  "A entrar…": "Accesso in corso…", "Juntar-me ao grupo": "Unisciti al gruppo",
  "Ainda não tenho grupo": "Non ho ancora un gruppo",
  "Explora a app na mesma — entras num grupo quando quiseres.":
    "Esplora comunque l'app — entra in un gruppo quando vuoi.",
  "Ainda sem grupo": "Ancora senza gruppo",
  "Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e ver o Clube e o Social.":
    "Entra in un gruppo con il link di invito del tuo organizzatore per vedere la partita, la griglia dei posti, il sorteggio e le statistiche. Nel frattempo puoi comunque creare la tua carta e vedere Club e Social.",
  "Entrar num grupo": "Entra in un gruppo",
  "Procurar grupo perto de ti — em breve": "Cerca un gruppo vicino a te — presto",

  // ── Onboarding (player + organizer) ────────────────────
  "Estilo FUT — o cartão atualiza enquanto preenches.": "Stile FUT — la carta si aggiorna mentre compili.",
  "Trocar fotografia": "Cambia foto", "Adicionar fotografia": "Aggiungi foto",
  "Aparece no cartão e nos jogos": "Appare sulla carta e nelle partite",
  "Alcunha (nome no cartão)": "Soprannome (nome sulla carta)",
  "Idade": "Età", "Nacionalidade": "Nazionalità", "Clube do coração": "Squadra del cuore",
  "ex.: FC Porto, Real Madrid, Flamengo…": "es.: FC Porto, Real Madrid, Flamengo…",
  "Posição": "Posizione", "Pé dominante": "Piede preferito",
  "A carregar foto…": "Caricamento foto…", "Criar o meu cartão ⚽": "Crea la mia carta ⚽",
  "O teu grupo": "Il tuo gruppo",
  "Define o jogo semanal — depois é só convidar a malta.":
    "Imposta la partita settimanale — poi basta invitare gli amici.",
  "Editar grupo": "Modifica gruppo",
  "Atualiza as definições do jogo — nada mais é apagado ou reenviado.":
    "Aggiorna le impostazioni della partita — nient'altro viene cancellato o reinviato.",
  "Guardar alterações": "Salva modifiche",
  "Cidade (para a previsão do tempo)": "Città (per le previsioni del tempo)",
  "Grupo e campo": "Gruppo e campo", "Nome do grupo": "Nome del gruppo", "Campo / recinto": "Campo / struttura",
  "Dia e hora do jogo": "Giorno e ora della partita", "Hora de início": "Ora di inizio",
  "Jogo recorrente": "Partita ricorrente",
  "Abre a confirmação automaticamente todas as semanas": "Apre la conferma automaticamente ogni settimana",
  "As confirmações abrem em…": "Le conferme aprono…", "…a esta hora": "…a quest'ora",
  "Mensalidade": "Quota mensile",
  "Preço mensal do campo (€)": "Prezzo mensile del campo (€)",
  "Nº de jogadores por jogo": "N° di giocatori per partita",
  "por jogador / mês": "per giocatore / mese",
  "O PITCH trata do resto": "PITCH pensa al resto",
  "Convites e lembretes por WhatsApp": "Inviti e promemoria via WhatsApp",
  "Confirmações com grelha de vagas em direto": "Conferme con griglia dei posti in diretta",
  "Controlo de pagamentos por jogador": "Controllo pagamenti per giocatore",
  "Sorteio de equipas equilibrado por posição": "Sorteggio squadre bilanciato per posizione",
  "Stats, MVP e histórico de jogos": "Statistiche, MVP e cronologia partite",
  "Criar grupo e convidar 📣": "Crea gruppo e invita 📣",

  // ── JogoTab ────────────────────────────────────────────
  "PRÓXIMO JOGO": "PROSSIMA PARTITA", "RECORRENTE": "RICORRENTE",
  "Copiar link do jogo": "Copia link della partita",
  "Alterar": "Modifica", "Alterar dia e hora do jogo": "Modifica giorno e ora della partita", "Hora:": "Ora:",
  "O próximo jogo passa para": "La prossima partita passa a",
  " — e as próximas semanas também.": " — e anche le prossime settimane.",
  "vaga em aberto": "posto disponibile", "vagas em aberto": "posti disponibili",
  "Equipa completa!": "Squadra completa!", "na lista de espera": "in lista d'attesa",
  "Nº de jogadores:": "N° di giocatori:",
  "Ainda ninguém confirmou — sê o primeiro! ⚽": "Ancora nessuno ha confermato — sii il primo! ⚽",
  "Partilhar lista no WhatsApp": "Condividi lista su WhatsApp",
  "Agora convida os jogadores 📣": "Ora invita i giocatori 📣",
  "Partilha o link — quem abrir entra logo no grupo.": "Condividi il link — chi lo apre entra subito nel gruppo.",
  "Confirmações ainda fechadas": "Conferme ancora chiuse",
  "Abrem": "Aprono", "Vais poder confirmar num toque.": "Potrai confermare con un tocco.",
  "Estás na lista de espera": "Sei in lista d'attesa",
  "Entras automaticamente se alguém desistir. Sem pagar até entrares.":
    "Entri automaticamente se qualcuno rinuncia. Non paghi finché non entri.",
  "Estás dentro!": "Sei dentro!",
  "Pago ✓ — bom jogo!": "Pagato ✓ — buona partita!", "Falta pagar": "Da pagare",
  "Pagar": "Paga",
  "Disseste que não podes. Mudaste de ideias?": "Hai detto che non puoi. Hai cambiato idea?",
  "Afinal vou! Confirmar": "Alla fine vengo! Conferma",
  "Vais jogar?": "Giochi?",
  "Jogo cheio — entra na lista de espera e entras se alguém desistir.":
    "Partita al completo — entra in lista d'attesa ed entrerai se qualcuno rinuncia.",
  "Estou dentro!": "Ci sono!", "Entrar na lista de espera": "Entra in lista d'attesa", "Não posso": "Non posso",
  "Lista de espera": "Lista d'attesa",
  "Por ordem de confirmação. Entra automaticamente quem está em 1º se um titular desistir":
    "In ordine di conferma. Entra automaticamente chi è 1° se un titolare rinuncia",
  " — avisa-os por WhatsApp para estarem a postos.": " — avvisali su WhatsApp perché siano pronti.",
  "Avisar": "Avvisa",
  "Sorteio de Equipas": "Sorteggio Squadre",
  "Só o organizador (ou o auxiliar) pode sortear e renomear.": "Solo l'organizzatore (o l'assistente) può sorteggiare e rinominare.",
  "Faltam confirmações para sortear": "Mancano conferme per sorteggiare",
  "Escolhe quantas equipas e sorteia — depois podes renomear.": "Scegli quante squadre e sorteggia — dopo puoi rinominare.",
  "Equipas:": "Squadre:", "Re-sortear": "Ri-sorteggia", "Sortear": "Sorteggia",
  "sem jogadores": "senza giocatori",
  "Sem resposta": "Nessuna risposta",
  "jogador ainda não respondeu": "giocatore non ha ancora risposto",
  "jogadores ainda não responderam": "giocatori non hanno ancora risposto",
  "Lembrar todos": "Ricorda a tutti", "Lembrar": "Ricorda",
  "NÃO PODEM": "NON POSSONO",
  "Material do Jogo": "Materiale Partita", "Adicionar item…": "Aggiungi articolo…", "atribuir…": "assegnare…",
  "Pagamentos": "Pagamenti", "/jogador": "/giocatore", "total": "totale",
  "DEVEM PAGAR": "DEVONO PAGARE", "Pago ✓": "Pagato ✓",
  "JÁ PAGARAM": "GIÀ PAGATO", "Desfazer": "Annulla",
  "Limpar sorteio": "Cancella sorteggio",
  "Confirmados": "Confermati", "Faltam": "Mancano",
  "confirma aqui:": "conferma qui:",
  "Equipa completa! Vê tudo na app:": "Squadra completa! Vedi tutto nell'app:",
  "Cobrar pelo WhatsApp": "Richiedi via WhatsApp", "Todos pagaram!": "Tutti hanno pagato!",

  // ── Matchday / MatchTimer / MatchSummary ───────────────
  "Avulsa": "Amichevole", "Campeonato": "Campionato",
  "Marca golos e assistências, sem tabela.": "Registra gol e assist, senza classifica.",
  "Pontos, saldo de golos e classificação.": "Punti, differenza reti e classifica.",
  "Dia de jogo": "Giornata",
  "Escolhe o formato e começa a marcar os jogos.": "Scegli il formato e inizia a registrare le partite.",
  "Sorteia as equipas para começar.": "Sorteggia le squadre per iniziare.",
  "Começar dia de jogo": "Inizia giornata",
  "DIA DE JOGO · AO VIVO": "GIORNATA · IN DIRETTA",
  "CAMPEONATO": "CAMPIONATO", "AVULSA": "AMICHEVOLE",
  "CLASSIFICAÇÃO": "CLASSIFICA", "EQUIPA": "SQUADRA",
  "J": "G", "V-E-D": "V-N-P", "SG": "DR", "P": "P",
  "JOGO": "PARTITA",
  "MEIA-FINAL": "SEMIFINALE", "FINAL": "FINALE", "CAMPEÃO": "CAMPIONE",

  // ── Matchday · Personalizado (custom tournament format) ─
  "Personalizado": "Personalizzato",
  "Defines as tuas próprias regras — calendário automático.": "Imposta le tue regole — calendario automatico.",
  "PERSONALIZADO": "PERSONALIZZATO",
  "Confrontos": "Incontri",
  "Único (cada equipa joga uma vez)": "Singolo (ogni squadra gioca una volta)",
  "Ida e volta (repete confronto)": "Andata e ritorno (incontro ripetuto)",
  "Ter fase final (play-off)": "Avere fase finale (play-off)",
  "Quantas equipas vão à final:": "Quante squadre vanno in finale:",
  "1º lugar da fase de grupos vai direto à final": "Il 1° posto della fase a gironi va direttamente in finale",
  "Permitir grandes penalidades em caso de empate": "Consenti i rigori in caso di pareggio",
  "passa à próxima ronda": "passa al turno successivo",
  "Venceu nos pénaltis:": "Ha vinto ai rigori:",
  "Empate — quem venceu nos pénaltis?": "Pareggio — chi ha vinto ai rigori?",
  "Avançar para a fase final": "Avanza alla fase finale",
  "Avançar de ronda": "Avanza al turno successivo",
  "Termina os jogos desta ronda para avançar.": "Termina le partite di questo turno per avanzare.",
  "Assistência de…": "Assist di…", "Golo dos": "Gol dei", "— quem marcou?": "— chi ha segnato?",
  "Sem assistência": "Nessun assist", "Golo": "Gol",
  "Quem joga agora?": "Chi gioca ora?", "Escolhe duas equipas diferentes.": "Scegli due squadre diverse.",
  "Criar jogo": "Crea partita", "Novo jogo": "Nuova partita", "Terminar dia": "Termina giornata",
  "Clean sheets do GR escolhido e das Defesas contam ao terminar o dia.": "I clean sheet del portiere scelto e dei difensori contano a fine giornata.",
  "Cronómetro do jogo": "Cronometro della partita", "Fim do tempo!": "Tempo scaduto!",
  "Tirar 1 minuto": "Togli 1 minuto", "Adicionar 1 minuto": "Aggiungi 1 minuto",
  "Pausar": "Pausa", "Retomar": "Riprendi", "Iniciar": "Inizia", "Repor": "Reimposta",
  "Resumo das partidas": "Riepilogo partite",
  "Inicia um dia de jogo para ver o resumo. ⚽": "Inizia una giornata per vedere il riepilogo. ⚽",
  "ao vivo": "in diretta", "último dia": "ultima giornata",
  "Resultado do último dia de jogo": "Risultato dell'ultima giornata",
  "Vitórias": "Vittorie", "Artilheiros": "Capocannonieri", "Assistências": "Assist",

  // ── GrupoTab ───────────────────────────────────────────
  "O Grupo": "Il Gruppo",
  "CONFIRMADOS": "CONFERMATI", "SEM RESPOSTA": "SENZA RISPOSTA",
  "AUXILIAR": "ASSISTENTE",
  "Remover auxiliar": "Rimuovi assistente", "Tornar auxiliar": "Rendi assistente",
  "Remover do jogo": "Rimuovi dalla partita", "Confirmar": "Conferma", "Apagar jogador": "Elimina giocatore",
  "Apagar": "Elimina",
  "? Esta ação não pode ser desfeita — o jogador sai do grupo e perde o histórico.":
    "? Questa azione non può essere annullata — il giocatore lascia il gruppo e perde la cronologia.",
  "Jogador avulso": "Giocatore ospite", "Nome do jogador": "Nome del giocatore",
  "(opcional)": "(opzionale)", "ex.: 75": "es.: 75",
  "Adicionar jogador": "Aggiungi giocatore",
  "Adicionar jogador avulso (sem conta)": "Aggiungi giocatore ospite (senza account)",
  "Adicionar ao grupo": "Aggiungi al gruppo",
  "Partilha o link de convite — quem abrir cria conta e entra logo no grupo.":
    "Condividi il link di invito — chi lo apre crea un account ed entra subito nel gruppo.",
  "Convida um amigo pelo link ou WhatsApp": "Invita un amico tramite link o WhatsApp",

  // ── StatsTab ───────────────────────────────────────────
  "Temporada": "Stagione",
  "ÚLTIMO DIA DE JOGO": "ULTIMA GIORNATA",
  "VOTAÇÃO MVP": "VOTAZIONE MVP", "pts": "pt",
  "Quem foram os 3 melhores em campo?": "Chi sono stati i 3 migliori in campo?",
  "1º lugar": "1° posto", "2º lugar": "2° posto", "3º lugar": "3° posto",
  "✓ o teu voto": "✓ il tuo voto",
  "Fechar votação e revelar o pódio": "Chiudi la votazione e rivela il podio",
  "Pódio do último dia": "Podio dell'ultima giornata",
  "⚽ Golos": "⚽ Gol",
  "HISTÓRICO DE JOGOS": "CRONOLOGIA PARTITE",
  "votação a decorrer": "votazione in corso",
  "Pago": "Pagato", "Pendente": "In sospeso",

  // ── SocialTab ──────────────────────────────────────────
  "Amigos": "Amici",
  "A comunidade de futebol do PITCH": "La community calcistica di PITCH",
  "Partilha um momento, um golo, uma jogada…": "Condividi un momento, un gol, un'azione…",
  "A carregar ficheiro…": "Caricamento file…", "Falha no upload:": "Upload fallito:",
  "Foto": "Foto", "Vídeo": "Video", "Publicar": "Pubblica",
  "Treino": "Allenamento", "Registar treino": "Registra allenamento",
  "Distância (km)": "Distanza (km)", "Duração (min)": "Durata (min)",
  "Calorias (kcal)": "Calorie (kcal)", "FC média (bpm)": "FC media (bpm)",
  "Foto do jogo/local (opcional)": "Foto della partita/luogo (opzionale)",
  "Uma legenda (opcional)…": "Una didascalia (opzionale)…",
  "Vais juntar também os teus": "Aggiungerai anche i tuoi", "do último jogo.": "dall'ultima partita.",
  "Falha ao gerar o cartão.": "Impossibile generare il cartellino.",
  "A gerar…": "Generazione…", "Gerar cartão": "Genera cartellino",
  "Publicar no feed": "Pubblica nel feed", "A publicar…": "Pubblicazione…",
  "Adicionar amigo": "Aggiungi amico", "PEDIDOS": "RICHIESTE", "Aceitar": "Accetta",
  "MEMBROS DO CLUBE": "MEMBRI DEL CLUB",
  "Sem ninguém para adicionar por agora.": "Nessuno da aggiungere per ora.",
  "Sem grupo": "Senza gruppo", "Pedido enviado": "Richiesta inviata",
  "Ainda não tens amigos por aqui. Toca em \"Adicionar amigo\" para começar. 🤝":
    "Non hai ancora amici qui. Tocca \"Aggiungi amico\" per iniziare. 🤝",
  "DO TEU GRUPO": "DAL TUO GRUPPO", "DOS TEUS AMIGOS": "DAI TUOI AMICI", "FEED DO CLUBE": "FEED DEL CLUB",
  "Sem publicações de amigos ainda.": "Ancora nessun post dagli amici.",
  "O teu grupo ainda não publicou nada.": "Il tuo gruppo non ha ancora pubblicato nulla.",
  "Ainda não há publicações. Sê o primeiro! ⚽": "Ancora nessun post. Sii il primo! ⚽",
  "· tu": "· tu", "Apagar publicação?": "Eliminare il post?",
  "Comentar": "Commenta", "Escreve um comentário…": "Scrivi un commento…",

  // ── PerfilTab / SecuritySection ────────────────────────
  "O Meu Cartão": "La Mia Carta", "Editar": "Modifica", "Ver o meu": "Vedi il mio",
  "Lesionado": "Infortunato", "Marcar como lesionado": "Segna come infortunato", "Remover lesão": "Rimuovi infortunio",
  "Não podes escalar um jogador lesionado.": "Non puoi schierare un giocatore infortunato.",
  "Esse jogador está lesionado — a troca não pode ser aceite.": "Questo giocatore è infortunato — lo scambio non può essere accettato.",
  "Editar Perfil": "Modifica Profilo",
  "Telemóvel (MB Way)": "Telefono (MB Way)",
  "AVALIAÇÃO DOS AMIGOS": "VALUTAZIONE DEGLI AMICI",
  "avaliações": "valutazioni",
  "O cartão mostra a média das avaliações que recebeste.": "La carta mostra la media delle valutazioni che hai ricevuto.",
  "Faltam": "Mancano", "avaliações para desbloquear o teu cartão.": "valutazioni per sbloccare la tua carta.",
  "QUEM JÁ TE AVALIOU": "CHI TI HA GIÀ VALUTATO",
  "Ainda ninguém te avaliou.": "Nessuno ti ha ancora valutato.",
  "Pedir avaliação": "Richiedi valutazione", "Inserir código": "Inserisci codice",
  "Cola aqui o código recebido…": "Incolla qui il codice ricevuto…",
  "Avaliação adicionada — o teu cartão já reflete a opinião ✓": "Valutazione aggiunta — la tua carta riflette già l'opinione ✓",
  "Código inválido — confirma que copiaste tudo.": "Codice non valido — controlla di aver copiato tutto.",
  "A tua avaliação de": "La tua valutazione di", "Avaliar": "Valuta",
  "Sê justo — a média com as avaliações dos outros amigos forma o cartão dele.":
    "Sii onesto — la media con le valutazioni degli altri amici forma la sua carta.",
  "Atualizar avaliação": "Aggiorna valutazione", "Enviar avaliação": "Invia valutazione",
  "Avaliação enviada ✓": "Valutazione inviata ✓",
  "CONTACTO": "CONTATTO",
  "TEMPORADA": "STAGIONE",
  "Jogos": "Partite", "Golos": "Gol", "Presença": "Presenza", "G+A / jogo": "G+A / partita",
  "PAGAMENTO": "PAGAMENTO", "Ativo ✓": "Attivo ✓",
  "Definições do grupo": "Impostazioni del gruppo",
  "Campo, horário, mensalidade e vagas": "Campo, orario, quota mensile e posti",
  "Notificações": "Notifiche",
  "Ativadas ✓ — avisamos quando entras no jogo": "Attivate ✓ — ti avvisiamo quando entri in partita",
  "Recebe aviso quando abrir vaga para ti": "Ricevi un avviso quando si apre un posto per te",
  "Ativar": "Attiva", "Notificações ativadas ✓": "Notifiche attivate ✓",
  "Ver todos os grupos, jogadores e jogos": "Vedi tutti i gruppi, giocatori e partite",
  "Repor demo": "Ripristina demo",
  "Idioma": "Lingua",
  "SEGURANÇA": "SICUREZZA",
  "Alterar palavra-passe": "Cambia password", "Define uma nova palavra-passe": "Imposta una nuova password",
  "Nova palavra-passe (mín. 6)": "Nuova password (min. 6)",
  "Guardar palavra-passe": "Salva password",
  "Trocar email": "Cambia email", "Atual:": "Attuale:", "Muda o email da conta": "Cambia l'email dell'account",
  "novo@email.com": "nuova@email.com", "Enviar confirmação": "Invia conferma",
  "Escreve um email válido.": "Inserisci un'email valida.",
  "Enviámos um link de confirmação para": "Abbiamo inviato un link di conferma a",
  " — o email só muda depois de o abrires.": " — l'email cambia solo dopo che lo apri.",
  "Sair de todos os dispositivos": "Esci da tutti i dispositivi",
  "Termina a sessão em todo o lado (incluindo aqui)": "Termina la sessione ovunque (incluso qui)",
  "Terminar sessão em todos os dispositivos? Vais ter de voltar a entrar em todos, incluindo este.":
    "Terminare la sessione su tutti i dispositivi? Dovrai accedere di nuovo ovunque, incluso qui.",
  "Palavra-passe alterada ✓": "Password cambiata ✓",

  // ── PitchApp dialogs / misc ────────────────────────────
  "Terminar o dia de jogo? As stats entram para a época e abre a votação MVP.":
    "Terminare la giornata? Le statistiche entrano nella stagione e si apre la votazione MVP.",
  "Repor os dados de demonstração? As alterações locais serão perdidas.":
    "Ripristinare i dati demo? Le modifiche locali andranno perse.",
  "A ligar ao clube…": "Connessione al club…",
  "agora": "ora",

  // ── FantasyTab (admin-only beta) ───────────────────────
  "Pitch Manager": "Pitch Manager",
  "Matchday": "Matchday",
  "Sorteio, cronómetro e marcação ao vivo.": "Sorteggio, cronometro e punteggio dal vivo.",
  "Ainda não há Pitch Manager neste grupo.": "Non c'è ancora un Pitch Manager in questo gruppo.",
  "Criar Pitch Manager": "Crea Pitch Manager",
  "Escala os teus colegas a cada jornada e pontua com o desempenho real deles em campo.":
    "Schiera i tuoi compagni ogni giornata e fai punti con le loro prestazioni reali in campo.",
  "Nome da liga": "Nome della lega",
  "Orçamento": "Budget",
  "Jogadores por escalação": "Giocatori per formazione",
  "A tua escalação": "La tua formazione",
  "Escolhe": "Scegli",
  "colegas e define o capitão (pontos em dobro).": "i compagni e imposta il capitano (punti doppi).",
  "Capitão": "Capitano",
  "Enviar para o banco": "Manda in panchina", "Tornar titular": "Rendi titolare",
  "banco": "panchina", "BANCO": "PANCHINA", "Sem suplente definido.": "Nessuna riserva impostata.",
  "não pontua": "non fa punti",
  "Escalação guardada ✓": "Formazione salvata ✓",
  "Guardar escalação": "Salva formazione",
  "Editar escalação": "Modifica formazione",
  "Ainda sem capitão — toca na coroa de um jogador no campo.": "Ancora senza capitano — tocca la corona di un giocatore in campo.",
  "Pesquisar por nome…": "Cerca per nome…",
  "disponível": "disponibile",
  "Oferta": "Offerta",
  "Selecionados": "Selezionati",
  "Banco": "Cassa",
  "Ofertas de troca": "Offerte di scambio",
  "recebidas": "ricevute", "enviadas": "inviate",
  "RECEBIDAS": "RICEVUTE", "ENVIADAS": "INVIATE",
  "A quem fazer a oferta": "A chi fare l'offerta",
  "Jogador teu que libertas para abrir espaço": "Un tuo giocatore che liberi per fare spazio",
  "Troca direta": "Scambio diretto", "Dinheiro": "Denaro",
  "Valor da oferta": "Valore dell'offerta",
  "Enviar oferta": "Invia offerta",
  "A tua oferta a": "La tua offerta a",
  "Em troca de:": "In cambio di:",
  "quer trocar contigo": "vuole scambiare con te",
  "Recebes:": "Ricevi:", "dás:": "dai:",
  "Cancelar oferta": "Annulla offerta",
  "Recusar": "Rifiuta",
  "Classificação": "Classifica",
  "Ainda sem jornadas fechadas.": "Ancora nessuna giornata chiusa.",
  "jornadas": "giornate",
  "Última jornada": "Ultima giornata",
  "Pontos de cada participante": "Punti di ogni partecipante",
  "Duração (meses, mín. 1)": "Durata (mesi, min. 1)",
  "Todos começam a": "Tutti iniziano a", "Com este orçamento dá para": "Con questo budget puoi permetterti",
  "jogadores de início.": "giocatori all'inizio.",
  "Escalação de": "Formazione di",
  "Falta": "Mancano", "tira alguém ou troca por um mais barato.": "togli qualcuno o scambialo con uno più economico.",
  "PRÓXIMA TEMPORADA": "PROSSIMA STAGIONE",
  "Liga terminada — consulta a classificação final abaixo.": "Lega terminata — consulta la classifica finale qui sotto.",
  "Escalação trancada — falta menos de 8h para o jogo.": "Formazione bloccata — mancano meno di 8h alla partita.",
  "Por posição": "Per posizione", "Por pontuação": "Per punteggio",
  "Todos os jogadores": "Tutti i giocatori",
  "Não tens banco suficiente para esta oferta.": "Non hai abbastanza cassa per questa offerta.",
  "O teu banco": "La tua cassa", "Custo desta troca": "Costo di questo scambio",
  "Banco insuficiente": "Cassa insufficiente",
  "PREÇO": "PREZZO", "PTS NA LIGA": "PT IN LEGA", "DONOS": "PROPRIETARI",
  "Gerar o meu card": "Crea la mia card", "A gerar o teu card…": "Creazione della tua card…",
  "Falha ao gerar o card.": "Impossibile creare la card.", "Descarregar": "Scarica",
  "Que cartão queres gerar?": "Quale card vuoi creare?",
  "Cartão de jogo": "Card partita", "Estilo FUT — golos, assistências e MVP da noite.": "Stile FUT — gol, assist e MVP della serata.",
  "Cartão de treino": "Card allenamento", "Estilo Strava — foto + dados do relógio.": "Stile Strava — foto + dati dell'orologio.",

  // ── Matchday (goalkeeper picker) ────────────────────────
  "GR?": "POR?",

  // ── Achievements ─────────────────────────────────────────
  "CONQUISTAS": "TROFEI", "desbloqueadas": "sbloccati",
  "Estreante": "Esordiente", "Disputou o primeiro jogo": "Ha giocato la prima partita",
  "Bota de Ouro": "Scarpa d'Oro", "10 golos na temporada": "10 gol in stagione",
  "Criador de Jogo": "Regista", "10 assistências na temporada": "10 assist in stagione",
  "Veterano": "Veterano", "50 jogos disputados": "50 partite disputate",
  "Muralha": "Muro Invalicabile", "10 jogos sem sofrer golos": "10 clean sheet",
  "Rei da Noite": "Re della Serata", "5 vezes eleito MVP": "MVP per 5 volte",
  "Fiel": "Fedele", "90%+ de presença na temporada": "90%+ di presenza in stagione",
  "3 ou mais golos numa só partida": "3 o più gol in una sola partita",
  "Show Particular": "Spettacolo Personale", "Golo e assistência na mesma partida": "Gol e assist nella stessa partita",
  "Herói da Vitória": "Eroe della Vittoria", "MVP da noite com 2+ golos": "MVP della serata con 2+ gol",
  "Liderança": "Leadership", "Foi organizador ou auxiliar do grupo": "È stato organizzatore o assistente del gruppo",
  "Bem-visto": "Ben Voluto", "Cartão com overall 80+ (avaliação dos colegas)": "Card con overall 80+ (valutazione dei compagni)",

  // ── Create group from Perfil ────────────────────────────
  "Criar grupo": "Crea gruppo", "Torna-te organizador do teu próprio jogo semanal": "Diventa l'organizzatore della tua partita settimanale",

  // ── Live matchday, read-only for non-organizers ─────────
  "Aguarda o organizador começar o dia de jogo.": "In attesa che l'organizzatore inizi la giornata di gioco.",
  "Empate — a aguardar o desempate por pénaltis.": "Pareggio — in attesa del risultato dei rigori.",
  "A TUA EQUIPA": "LA TUA SQUADRA",
  "Confirmar equipas": "Conferma squadre", "Gerir equipas": "Gestisci squadre", "Sorteio, nomes e trocas": "Sorteggio, nomi e scambi",
  "As equipas foram confirmadas, mas não estás em nenhuma esta ronda.": "Le squadre sono state confermate, ma non sei in nessuna questo turno.",
  "Equipas": "Squadre",
  "O organizador está a preparar as equipas — aguarda a confirmação.": "L'organizzatore sta preparando le squadre — attendi la conferma.",
  "Sorteado por": "Sorteggiato da", "ainda por confirmar": "ancora da confermare",
  "confirmado por": "confermato da", "Confirmado por": "Confermato da",
};

const DICTS = { en: EN, "pt-br": PT_BR, it: IT };
